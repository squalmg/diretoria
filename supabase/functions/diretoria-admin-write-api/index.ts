import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresEconomicCore } from 'https://raw.githubusercontent.com/squalmg/diretoria/7d7240b8a037f395185d4d154daaf02982cd8b48/packages/db/src/economic-core.ts';
import type { EventStatus } from 'https://raw.githubusercontent.com/squalmg/diretoria/7d7240b8a037f395185d4d154daaf02982cd8b48/packages/domain/src/event-state.ts';

const CANONICAL_ORIGIN = 'https://diretoria-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3100', 'http://127.0.0.1:3100']);
let coreInstance: PostgresEconomicCore | null = null;

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return origin === CANONICAL_ORIGIN || LOCAL_ORIGINS.has(origin);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && originAllowed(origin) ? origin : CANONICAL_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function json(req: Request, body: unknown, status = 200): Response {
  return Response.json(jsonSafe(body), { status, headers: corsHeaders(req) });
}

function routePath(req: Request): string {
  const pathname = new URL(req.url).pathname;
  const marker = '/diretoria-admin-write-api';
  const index = pathname.indexOf(marker);
  if (index < 0) return pathname;
  const remainder = pathname.slice(index + marker.length);
  return remainder || '/';
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function serverContext(req: Request) {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'none' });
  if (error || !ctx) return { response: json(req, { ok: false, code: 'CONTEXT_ERROR' }, 503) } as const;
  return { ctx } as const;
}

async function writeContext(req: Request) {
  const token = bearerToken(req);
  if (!token?.startsWith('hml_')) return { response: json(req, { ok: false, code: 'HML_SESSION_REQUIRED' }, 401) } as const;
  const server = await serverContext(req);
  if ('response' in server) return server;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const { data: session, error: sessionError } = await server.ctx.supabaseAdmin
    .from('hml_admin_sessions')
    .select('id,expires_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle();
  if (sessionError) return { response: json(req, { ok: false, code: 'HML_SESSION_QUERY_FAILED' }, 500) } as const;
  if (!session) return { response: json(req, { ok: false, code: 'HML_SESSION_INVALID' }, 401) } as const;

  const { data: actorProfile, error: actorProfileError } = await server.ctx.supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('display_code', 'HML-OPERATOR')
    .maybeSingle();
  if (actorProfileError || !actorProfile) return { response: json(req, { ok: false, code: 'HML_OPERATOR_NOT_READY' }, 503) } as const;
  const { data: actor, error: actorError } = await server.ctx.supabaseAdmin
    .from('users')
    .select('id')
    .eq('profile_id', actorProfile.id)
    .eq('provider_subject', 'hml-test-operator')
    .eq('status', 'active')
    .maybeSingle();
  if (actorError || !actor) return { response: json(req, { ok: false, code: 'HML_OPERATOR_NOT_READY' }, 503) } as const;

  return { ctx: server.ctx, actorUserId: actor.id as string, sessionId: session.id as string } as const;
}

function core(): PostgresEconomicCore {
  if (coreInstance) return coreInstance;
  const connectionString = Deno.env.get('SUPABASE_DB_URL');
  if (!connectionString) throw new Error('SUPABASE_DB_URL_REQUIRED');
  coreInstance = new PostgresEconomicCore(connectionString);
  return coreInstance;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const value = await req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON_OBJECT');
    return value as Record<string, unknown>;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function stringField(value: unknown, code: string, min = 1, max = 240): string {
  const text = String(value ?? '').trim();
  if (text.length < min || text.length > max) throw new Error(code);
  return text;
}

function optionalString(value: unknown, max = 240): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim();
  if (!text || text.length > max) throw new Error('STRING_INVALID');
  return text;
}

function cents(value: unknown, code: string): bigint {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(code);
  const amount = BigInt(text);
  if (amount > 9_999_999_999_999n) throw new Error(code);
  return amount;
}

function integer(value: unknown, code: string, min = 0, max = 2_147_483_647): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(code);
  return number;
}

function eventIdFrom(path: string, suffix: string): string | null {
  const match = new RegExp(`^/events/([0-9a-f-]{36})/${suffix}$`, 'i').exec(path);
  return match?.[1] ?? null;
}

function paymentIdFrom(path: string, prefix: string, suffix: string): string | null {
  const match = new RegExp(`^/${prefix}/([0-9a-f-]{36})/${suffix}$`, 'i').exec(path);
  return match?.[1] ?? null;
}

async function customerProfileId(ctx: any): Promise<string> {
  const { data, error } = await ctx.supabaseAdmin.from('profiles').select('id').eq('display_code', 'HML-CUSTOMER').maybeSingle();
  if (error || !data) throw new Error('HML_CUSTOMER_NOT_READY');
  return data.id as string;
}

function errorStatus(code: string): number {
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('REQUIRED') || code.includes('INVALID') || code.includes('NEGATIVE') || code.includes('EXCEEDS') || code.includes('FIELDS')) return 400;
  if (code.includes('NOT_ALLOWED') || code.includes('NOT_VIABLE') || code.includes('BLOCKED') || code.includes('STALE') || code.includes('NOT_REFUNDABLE') || code.includes('NOT_CONFIRMABLE')) return 409;
  return 500;
}

function safeError(req: Request, error: unknown): Response {
  const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const code = raw.split(':')[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || 'UNKNOWN_ERROR';
  const status = errorStatus(code);
  return json(req, { ok: false, code }, status);
}

async function execute(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  if (origin && !originAllowed(origin)) return json(req, { ok: false, code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const auth = await writeContext(req);
  if ('response' in auth) return auth.response;
  const path = routePath(req);

  try {
    if (path === '/events') {
      const input = await body(req);
      const result = await core().createEvent({
        eventCode: stringField(input.eventCode, 'EVENT_CODE_REQUIRED', 2, 40),
        name: stringField(input.name, 'EVENT_NAME_REQUIRED', 2, 180),
        slug: stringField(input.slug, 'EVENT_SLUG_REQUIRED', 2, 180),
        capacity: input.capacity === undefined ? undefined : integer(input.capacity, 'EVENT_CAPACITY_INVALID', 1),
        createdBy: auth.actorUserId,
      });
      return json(req, { ok: true, event: result }, 201);
    }

    const transitionEventId = eventIdFrom(path, 'transition');
    if (transitionEventId) {
      const input = await body(req);
      const to = stringField(input.to, 'EVENT_STATUS_REQUIRED', 2, 32) as EventStatus;
      const reason = stringField(input.reason, 'TRANSITION_REASON_REQUIRED', 3, 500);
      const status = await core().transitionEvent(transitionEventId, to, auth.actorUserId, reason);
      return json(req, { ok: true, status });
    }

    const configEventId = eventIdFrom(path, 'financial-config');
    if (configEventId) {
      const input = await body(req);
      const contingency = input.contingency as Record<string, unknown> | undefined;
      if (!contingency || typeof contingency !== 'object') throw new Error('CONTINGENCY_REQUIRED');
      const contingencyType = stringField(contingency.type, 'CONTINGENCY_TYPE_REQUIRED', 5, 20);
      const normalizedContingency = contingencyType === 'fixed'
        ? { type: 'fixed' as const, amount: cents(contingency.amountCents, 'CONTINGENCY_AMOUNT_INVALID') }
        : contingencyType === 'percentage'
          ? { type: 'percentage' as const, basisPoints: integer(contingency.basisPoints, 'CONTINGENCY_BPS_INVALID', 0, 10_000) }
          : (() => { throw new Error('CONTINGENCY_TYPE_INVALID'); })();
      const result = await core().createFinancialConfig({
        eventId: configEventId,
        founderTicketGross: cents(input.founderTicketGrossCents, 'TICKET_GROSS_INVALID'),
        estimatedFeePerMember: cents(input.estimatedFeePerMemberCents, 'FEE_INVALID'),
        variableCostPerMember: cents(input.variableCostPerMemberCents, 'VARIABLE_COST_INVALID'),
        contingency: normalizedContingency,
        approvedExposureLimit: cents(input.approvedExposureLimitCents, 'EXPOSURE_INVALID'),
        createdBy: auth.actorUserId,
      });
      return json(req, { ok: true, financialConfig: result }, 201);
    }

    const costEventId = eventIdFrom(path, 'costs');
    if (costEventId) {
      const input = await body(req);
      const id = await core().addProtectedCost({
        eventId: costEventId,
        category: stringField(input.category, 'COST_CATEGORY_REQUIRED', 2, 80),
        description: stringField(input.description, 'COST_DESCRIPTION_REQUIRED', 2, 500),
        costType: stringField(input.costType, 'COST_TYPE_REQUIRED', 3, 20) as any,
        amount: cents(input.amountCents, 'COST_AMOUNT_INVALID'),
        createdBy: auth.actorUserId,
      });
      return json(req, { ok: true, costId: id }, 201);
    }

    const revenueEventId = eventIdFrom(path, 'guaranteed-revenues');
    if (revenueEventId) {
      const input = await body(req);
      const id = await core().addGuaranteedRevenue({
        eventId: revenueEventId,
        revenueType: stringField(input.revenueType, 'REVENUE_TYPE_REQUIRED', 3, 40) as any,
        counterparty: optionalString(input.counterparty, 180),
        grossAmount: cents(input.grossAmountCents, 'REVENUE_GROSS_INVALID'),
        eligibleAmount: cents(input.eligibleAmountCents, 'REVENUE_ELIGIBLE_INVALID'),
        status: stringField(input.status, 'REVENUE_STATUS_REQUIRED', 3, 30) as any,
      });
      return json(req, { ok: true, revenueId: id }, 201);
    }

    const recalcEventId = eventIdFrom(path, 'recalculate');
    if (recalcEventId) {
      const snapshot = await core().recalculateQuorum(recalcEventId, 'hml_admin_manual');
      return json(req, { ok: true, quorum: snapshot });
    }

    const mockPaymentEventId = eventIdFrom(path, 'mock-payments');
    if (mockPaymentEventId) {
      const input = await body(req);
      const profileId = await customerProfileId(auth.ctx);
      const result = await core().createPendingMockPayment({
        profileId,
        eventId: mockPaymentEventId,
        amountGross: cents(input.amountGrossCents, 'PAYMENT_AMOUNT_INVALID'),
        idempotencyKey: optionalString(input.idempotencyKey, 255) ?? `hml_${crypto.randomUUID()}`,
      });
      return json(req, { ok: true, payment: result }, 201);
    }

    const confirmPaymentId = paymentIdFrom(path, 'mock-payments', 'confirm');
    if (confirmPaymentId) {
      const input = await body(req);
      const gatewayEventId = optionalString(input.gatewayEventId, 255) ?? `hml_evt_${crypto.randomUUID()}`;
      const payloadHash = optionalString(input.payloadHash, 128) ?? await sha256Hex(`${confirmPaymentId}:${gatewayEventId}`);
      const result = await core().confirmMockPayment({ paymentId: confirmPaymentId, gatewayEventId, payloadHash, actorUserId: auth.actorUserId });
      return json(req, { ok: true, result });
    }

    const refundPaymentId = paymentIdFrom(path, 'payments', 'refund');
    if (refundPaymentId) {
      const input = await body(req);
      const result = await core().refundMockPayment({
        paymentId: refundPaymentId,
        actorUserId: auth.actorUserId,
        reason: stringField(input.reason, 'REFUND_REASON_REQUIRED', 3, 500),
      });
      return json(req, { ok: true, result });
    }

    const checkEventId = eventIdFrom(path, 'checks');
    if (checkEventId) {
      const input = await body(req);
      await core().setConfirmationCheck({
        eventId: checkEventId,
        code: stringField(input.code, 'CHECK_CODE_REQUIRED', 2, 80),
        label: stringField(input.label, 'CHECK_LABEL_REQUIRED', 2, 180),
        status: stringField(input.status, 'CHECK_STATUS_REQUIRED', 3, 20) as any,
        actorUserId: auth.actorUserId,
        required: input.required === undefined ? true : input.required === true,
      });
      return json(req, { ok: true });
    }

    const goNoGoEventId = eventIdFrom(path, 'go-no-go');
    if (goNoGoEventId) {
      const input = await body(req);
      const result = await core().reviewGoNoGo({
        eventId: goNoGoEventId,
        actorUserId: auth.actorUserId,
        projectedRequiredExposure: cents(input.projectedRequiredExposureCents, 'PROJECTED_EXPOSURE_INVALID'),
      });
      return json(req, { ok: true, review: result });
    }

    const confirmEventId = eventIdFrom(path, 'confirm');
    if (confirmEventId) {
      const input = await body(req);
      const result = await core().confirmEvent({
        eventId: confirmEventId,
        actorUserId: auth.actorUserId,
        reason: stringField(input.reason, 'CONFIRM_REASON_REQUIRED', 3, 500),
      });
      return json(req, { ok: true, result });
    }

    return json(req, { ok: false, code: 'NOT_FOUND' }, 404);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'hml_write_failed', path, code: error instanceof Error ? error.message.split(':')[0] : 'UNKNOWN' }));
    return safeError(req, error);
  }
}

Deno.serve(execute);
