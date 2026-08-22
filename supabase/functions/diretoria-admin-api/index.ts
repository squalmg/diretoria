import { createSupabaseContext } from 'npm:@supabase/server@^1';

const CANONICAL_ORIGIN = 'https://diretoria-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3100', 'http://127.0.0.1:3100']);

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return origin === CANONICAL_ORIGIN || LOCAL_ORIGINS.has(origin);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && originAllowed(origin) ? origin : CANONICAL_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function routePath(req: Request): string {
  const pathname = new URL(req.url).pathname;
  const marker = '/diretoria-admin-api';
  const index = pathname.indexOf(marker);
  if (index < 0) return pathname;
  const remainder = pathname.slice(index + marker.length);
  return remainder || '/';
}

async function userContext(req: Request) {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' });
  if (error || !ctx) {
    return { response: json(req, { ok: false, code: error?.code ?? 'AUTH_REQUIRED', message: error?.message ?? 'Authentication required' }, error?.status ?? 401) } as const;
  }
  const email = normalizeEmail(ctx.userClaims?.email);
  if (!email) {
    return { response: json(req, { ok: false, code: 'EMAIL_CLAIM_REQUIRED' }, 403) } as const;
  }
  return { ctx, email } as const;
}

async function adminContext(req: Request) {
  const auth = await userContext(req);
  if ('response' in auth) return auth;
  const { data, error } = await auth.ctx.supabaseAdmin
    .from('hml_admin_allowlist')
    .select('email_normalized,enabled')
    .eq('email_normalized', auth.email)
    .eq('enabled', true)
    .maybeSingle();
  if (error) {
    return { response: json(req, { ok: false, code: 'ALLOWLIST_QUERY_FAILED' }, 500) } as const;
  }
  if (!data) {
    return { response: json(req, { ok: false, code: 'HML_ADMIN_NOT_ALLOWED', email: auth.email }, 403) } as const;
  }
  return auth;
}

async function publicHealth(req: Request): Promise<Response> {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'none' });
  if (error || !ctx) {
    return json(req, { ok: false, service: 'diretoria-admin-api', database: 'unavailable', code: error?.code ?? 'CONTEXT_ERROR' }, 503);
  }
  const { count, error: countError } = await ctx.supabaseAdmin
    .from('events')
    .select('id', { count: 'exact', head: true });
  if (countError) {
    return json(req, { ok: false, service: 'diretoria-admin-api', database: 'unavailable', code: 'DATABASE_QUERY_FAILED' }, 503);
  }
  return json(req, {
    ok: true,
    service: 'diretoria-admin-api',
    environment: 'hml',
    database: 'connected',
    eventCount: count ?? 0,
    authorization: 'supabase-auth-plus-hml-allowlist',
    writes: 'not-exposed-in-this-slice',
  });
}

async function bootstrap(req: Request): Promise<Response> {
  const auth = await userContext(req);
  if ('response' in auth) return auth.response;
  let payload: { token?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, code: 'INVALID_JSON' }, 400);
  }
  const token = String(payload.token ?? '').trim();
  if (token.length < 24 || token.length > 256) {
    return json(req, { ok: false, code: 'BOOTSTRAP_TOKEN_INVALID' }, 400);
  }
  const tokenHash = await sha256Hex(token);
  const { data, error } = await auth.ctx.supabaseAdmin.rpc('hml_consume_bootstrap', {
    p_token_hash: tokenHash,
    p_email_normalized: auth.email,
  });
  if (error) {
    return json(req, { ok: false, code: 'BOOTSTRAP_RPC_FAILED' }, 500);
  }
  if (data !== true) {
    return json(req, { ok: false, code: 'BOOTSTRAP_TOKEN_REJECTED' }, 403);
  }
  return json(req, { ok: true, allowed: true, email: auth.email });
}

async function me(req: Request): Promise<Response> {
  const auth = await userContext(req);
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.ctx.supabaseAdmin
    .from('hml_admin_allowlist')
    .select('enabled')
    .eq('email_normalized', auth.email)
    .eq('enabled', true)
    .maybeSingle();
  if (error) return json(req, { ok: false, code: 'ALLOWLIST_QUERY_FAILED' }, 500);
  return json(req, { ok: true, email: auth.email, allowed: Boolean(data?.enabled) });
}

async function listEvents(req: Request): Promise<Response> {
  const auth = await adminContext(req);
  if ('response' in auth) return auth.response;
  const { data: events, error } = await auth.ctx.supabaseAdmin
    .from('events')
    .select('id,event_code,name,slug,status,capacity,created_at,updated_at,confirmed_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return json(req, { ok: false, code: 'EVENT_LIST_FAILED' }, 500);

  const ids = (events ?? []).map((event) => event.id);
  let snapshots: Array<Record<string, unknown>> = [];
  if (ids.length > 0) {
    const snapshotResult = await auth.ctx.supabaseAdmin
      .from('quorum_snapshots')
      .select('id,event_id,protected_capital,financial_need,valid_credit_count,quorum_minimum,protected_percentage,deficit,surplus,financial_status,calculated_at')
      .in('event_id', ids)
      .order('calculated_at', { ascending: false });
    if (snapshotResult.error) return json(req, { ok: false, code: 'SNAPSHOT_LIST_FAILED' }, 500);
    snapshots = snapshotResult.data ?? [];
  }

  const latestByEvent = new Map<string, Record<string, unknown>>();
  for (const snapshot of snapshots) {
    const eventId = String(snapshot.event_id);
    if (!latestByEvent.has(eventId)) latestByEvent.set(eventId, snapshot);
  }
  return json(req, {
    ok: true,
    events: (events ?? []).map((event) => ({ ...event, quorum: latestByEvent.get(event.id) ?? null })),
  });
}

async function eventSummary(req: Request, eventId: string): Promise<Response> {
  const auth = await adminContext(req);
  if ('response' in auth) return auth.response;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return json(req, { ok: false, code: 'EVENT_ID_INVALID' }, 400);

  const [eventResult, configResult, costsResult, revenueResult, snapshotResult, checksResult, reviewResult] = await Promise.all([
    auth.ctx.supabaseAdmin.from('events').select('*').eq('id', eventId).maybeSingle(),
    auth.ctx.supabaseAdmin.from('event_financial_configs').select('*').eq('event_id', eventId).order('version', { ascending: false }).limit(1),
    auth.ctx.supabaseAdmin.from('event_cost_items').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    auth.ctx.supabaseAdmin.from('event_revenue_commitments').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    auth.ctx.supabaseAdmin.from('quorum_snapshots').select('*').eq('event_id', eventId).order('calculated_at', { ascending: false }).limit(1),
    auth.ctx.supabaseAdmin.from('event_confirmation_checks').select('*').eq('event_id', eventId).order('check_code', { ascending: true }),
    auth.ctx.supabaseAdmin.from('event_go_no_go_reviews').select('*').eq('event_id', eventId).order('reviewed_at', { ascending: false }).limit(1),
  ]);

  const failure = [eventResult, configResult, costsResult, revenueResult, snapshotResult, checksResult, reviewResult].find((result) => result.error);
  if (failure?.error) return json(req, { ok: false, code: 'EVENT_SUMMARY_FAILED' }, 500);
  if (!eventResult.data) return json(req, { ok: false, code: 'EVENT_NOT_FOUND' }, 404);

  return json(req, {
    ok: true,
    event: eventResult.data,
    financialConfig: configResult.data?.[0] ?? null,
    costs: costsResult.data ?? [],
    guaranteedRevenues: revenueResult.data ?? [],
    quorum: snapshotResult.data?.[0] ?? null,
    confirmationChecks: checksResult.data ?? [],
    goNoGo: reviewResult.data?.[0] ?? null,
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (origin && !originAllowed(origin)) {
    return json(req, { ok: false, code: 'ORIGIN_NOT_ALLOWED' }, 403);
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });

  const path = routePath(req);
  if (req.method === 'GET' && (path === '/' || path === '/health')) return publicHealth(req);
  if (req.method === 'GET' && path === '/me') return me(req);
  if (req.method === 'POST' && path === '/bootstrap') return bootstrap(req);
  if (req.method === 'GET' && path === '/events') return listEvents(req);

  const summaryMatch = /^\/events\/([0-9a-f-]{36})\/summary$/i.exec(path);
  if (req.method === 'GET' && summaryMatch) return eventSummary(req, summaryMatch[1]);

  return json(req, { ok: false, code: 'NOT_FOUND', method: req.method, path }, 404);
});
