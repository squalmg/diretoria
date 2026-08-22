import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresAcquisitionCore } from 'https://raw.githubusercontent.com/squalmg/diretoria/43af5391796e16daf2f50b22884c132486c3ad52/packages/db/src/acquisition-core.ts';
import {
  normalizeLandingPath,
  normalizePublicLeadEmail,
  normalizePublicLeadName,
  normalizePublicLeadPhone,
  normalizePublicSource,
  optionalTrackingValue,
} from 'https://raw.githubusercontent.com/squalmg/diretoria/43af5391796e16daf2f50b22884c132486c3ad52/packages/domain/src/public-lead.ts';

const CANONICAL_ORIGIN = 'https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3200', 'http://127.0.0.1:3200']);
const POLICY_VERSION = 'privacy-hml-2026-08-v1';
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 600;
const MAX_BODY_CHARS = 16_000;
let coreInstance: PostgresAcquisitionCore | null = null;

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return origin === CANONICAL_ORIGIN || LOCAL_ORIGINS.has(origin);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && originAllowed(origin) ? origin : CANONICAL_ORIGIN,
    'Access-Control-Allow-Headers': 'content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function json(req: Request, body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(req), ...(extraHeaders ?? {}) } });
}

function routePath(req: Request): string {
  const pathname = new URL(req.url).pathname;
  const marker = '/diretoria-public-api';
  const index = pathname.indexOf(marker);
  if (index < 0) return pathname;
  const remainder = pathname.slice(index + marker.length);
  return remainder || '/';
}

async function serverContext(req: Request) {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'none' });
  if (error || !ctx) return { response: json(req, { ok: false, code: 'SERVICE_UNAVAILABLE' }, 503) } as const;
  return { ctx } as const;
}

function core(): PostgresAcquisitionCore {
  if (coreInstance) return coreInstance;
  const connectionString = Deno.env.get('SUPABASE_DB_URL');
  if (!connectionString) throw new Error('DATABASE_UNAVAILABLE');
  coreInstance = new PostgresAcquisitionCore(connectionString);
  return coreInstance;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clientAddress(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || undefined;
}

async function consumeRateLimit(req: Request, ctx: any, sessionKey?: string) {
  const address = clientAddress(req);
  const fallback = sessionKey ? `session:${sessionKey}` : `ua:${req.headers.get('user-agent') ?? 'unknown'}`;
  const subject = address ? `ip:${address}` : fallback;
  const pepper = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!pepper) throw new Error('RATE_LIMIT_UNAVAILABLE');
  const keyHash = await sha256Hex(`diretoria-public-lead|${pepper}|${subject}`);
  const { data, error } = await ctx.supabaseAdmin.rpc('consume_public_lead_rate_limit', {
    p_key_hash: keyHash,
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });
  if (error || !data?.[0]) throw new Error('RATE_LIMIT_UNAVAILABLE');
  return data[0] as { allowed: boolean; remaining: number; reset_at: string };
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) throw new Error('PAYLOAD_TOO_LARGE');
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) throw new Error('PAYLOAD_TOO_LARGE');
  try {
    const parsed = JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

async function publicHealth(req: Request): Promise<Response> {
  const server = await serverContext(req);
  if ('response' in server) return server.response;
  const { error } = await server.ctx.supabaseAdmin.from('profiles').select('id', { head: true, count: 'exact' });
  if (error) return json(req, { ok: false, service: 'diretoria-public-api', database: 'unavailable' }, 503);
  return json(req, {
    ok: true,
    service: 'diretoria-public-api',
    environment: 'hml',
    database: 'connected',
    leadCapture: 'enabled-hml',
    rateLimit: { requests: RATE_LIMIT, windowSeconds: RATE_WINDOW_SECONDS },
  });
}

async function publicState(req: Request): Promise<Response> {
  const server = await serverContext(req);
  if ('response' in server) return server.response;
  const eventResult = await server.ctx.supabaseAdmin
    .from('events')
    .select('id,event_code,name,status,capacity,event_starts_at,created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (eventResult.error) return json(req, { ok: false, code: 'STATE_UNAVAILABLE' }, 503);
  const event = eventResult.data?.[0];
  if (!event) {
    return json(req, { ok: true, phase: 'REATIVACAO', event: null, cta: 'WAITLIST' });
  }

  const snapshotResult = await server.ctx.supabaseAdmin
    .from('quorum_snapshots')
    .select('valid_credit_count,quorum_minimum,protected_percentage,financial_status,calculated_at')
    .eq('event_id', event.id)
    .order('calculated_at', { ascending: false })
    .limit(1);
  if (snapshotResult.error) return json(req, { ok: false, code: 'STATE_UNAVAILABLE' }, 503);

  return json(req, {
    ok: true,
    phase: event.status,
    event: {
      eventCode: event.event_code,
      name: event.name,
      status: event.status,
      capacity: event.capacity,
      startsAt: event.event_starts_at,
    },
    quorum: snapshotResult.data?.[0] ?? null,
    cta: ['CONFIRMADO','VENDA_PUBLICA','PRE_EVENTO'].includes(event.status) ? 'TICKETS' : 'WAITLIST',
  });
}

async function captureLead(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const payload = await parseBody(req);

    // Honeypot: bots receive a generic accepted response without touching CRM data.
    if (String(payload.website ?? '').trim()) {
      return json(req, { ok: true, accepted: true, requestId }, 202);
    }

    const server = await serverContext(req);
    if ('response' in server) return server.response;

    const sessionKey = optionalTrackingValue(payload.sessionKey, 200);
    const limit = await consumeRateLimit(req, server.ctx, sessionKey);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((new Date(limit.reset_at).getTime() - Date.now()) / 1000));
      return json(req, { ok: false, code: 'RATE_LIMITED', requestId }, 429, { 'Retry-After': String(retryAfter) });
    }

    if (payload.privacyConsent !== true) {
      return json(req, { ok: false, code: 'PRIVACY_CONSENT_REQUIRED', requestId }, 400);
    }

    const result = await core().captureLead({
      fullName: normalizePublicLeadName(payload.fullName),
      email: normalizePublicLeadEmail(payload.email),
      phoneE164: normalizePublicLeadPhone(payload.phone),
      policyVersion: POLICY_VERSION,
      source: normalizePublicSource(payload.utmSource),
      medium: optionalTrackingValue(payload.utmMedium, 120),
      campaign: optionalTrackingValue(payload.utmCampaign, 180),
      content: optionalTrackingValue(payload.utmContent, 180),
      term: optionalTrackingValue(payload.utmTerm, 180),
      referralCode: optionalTrackingValue(payload.referralCode, 120),
      landingPage: normalizeLandingPath(payload.landingPage),
      sessionKey,
      userAgent: req.headers.get('user-agent')?.slice(0, 1000),
      consents: {
        privacy: true,
        marketing: booleanValue(payload.marketingConsent),
        whatsapp: booleanValue(payload.whatsappConsent),
        email: booleanValue(payload.emailConsent),
      },
    });

    console.log(JSON.stringify({ level: 'info', msg: 'public_lead_captured', requestId, created: result.created }));
    return json(req, { ok: true, accepted: true, requestId }, 202);
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const code = raw.split(':')[0];
    if (['FULL_NAME_INVALID','EMAIL_INVALID','PHONE_INVALID','PHONE_REQUIRED','LANDING_PAGE_INVALID','TRACKING_VALUE_TOO_LONG','PRIVACY_CONSENT_REQUIRED','CONTACT_REQUIRED','EMAIL_TOO_LONG','PHONE_TOO_LONG'].includes(code)) {
      return json(req, { ok: false, code, requestId }, 400);
    }
    if (code === 'PAYLOAD_TOO_LARGE') return json(req, { ok: false, code, requestId }, 413);
    if (code === 'INVALID_JSON') return json(req, { ok: false, code, requestId }, 400);
    if (code === 'IDENTITY_COLLISION' || code === 'IDENTITY_CONTACT_CONFLICT') {
      return json(req, { ok: false, code: 'CONTACTS_CONFLICT', requestId }, 409);
    }
    // Avoid exposing whether a blocked profile exists.
    if (code === 'PROFILE_BLOCKED') return json(req, { ok: true, accepted: true, requestId }, 202);
    console.error(JSON.stringify({ level: 'error', msg: 'public_lead_failed', requestId, code }));
    return json(req, { ok: false, code: 'LEAD_CAPTURE_FAILED', requestId }, 500);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (origin && !originAllowed(origin)) return json(req, { ok: false, code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const path = routePath(req);
  if (req.method === 'GET' && (path === '/' || path === '/health')) return publicHealth(req);
  if (req.method === 'GET' && path === '/state') return publicState(req);
  if (req.method === 'POST' && path === '/leads') return captureLead(req);
  return json(req, { ok: false, code: 'NOT_FOUND' }, 404);
});
