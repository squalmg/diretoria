import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresMemberAccounts } from 'https://raw.githubusercontent.com/squalmg/diretoria/1ede7b88b0f68269aeb4ea0a55948f8331766fa6/packages/db/src/member-accounts.ts';
import { PostgresClubCheckout } from 'https://raw.githubusercontent.com/squalmg/diretoria/712a039d2109f5dcfe1c5aee8bae1722ac4f9d1b/packages/db/src/club-checkout.ts';

const PUBLIC_HML_ORIGIN = 'https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3200', 'http://127.0.0.1:3200']);
let memberCoreInstance: PostgresMemberAccounts | null = null;
let checkoutCoreInstance: PostgresClubCheckout | null = null;

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return origin === PUBLIC_HML_ORIGIN || LOCAL_ORIGINS.has(origin);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && originAllowed(origin) ? origin : PUBLIC_HML_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function routePath(req: Request): string {
  const pathname = new URL(req.url).pathname;
  const marker = '/diretoria-member-api';
  const index = pathname.indexOf(marker);
  if (index < 0) return pathname;
  const remainder = pathname.slice(index + marker.length);
  return remainder || '/';
}

function databaseUrl(): string {
  const connectionString = Deno.env.get('SUPABASE_DB_URL');
  if (!connectionString) throw new Error('SUPABASE_DB_URL_REQUIRED');
  return connectionString;
}

function memberCore(): PostgresMemberAccounts {
  if (!memberCoreInstance) memberCoreInstance = new PostgresMemberAccounts(databaseUrl());
  return memberCoreInstance;
}

function checkoutCore(): PostgresClubCheckout {
  if (!checkoutCoreInstance) checkoutCoreInstance = new PostgresClubCheckout(databaseUrl());
  return checkoutCoreInstance;
}

async function authenticated(req: Request) {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' });
  if (error || !ctx) {
    return { response: json(req, { ok: false, code: error?.code ?? 'AUTH_REQUIRED' }, error?.status ?? 401) } as const;
  }
  const subject = String(ctx.userClaims?.sub ?? '').trim();
  if (!subject) return { response: json(req, { ok: false, code: 'AUTH_SUBJECT_REQUIRED' }, 401) } as const;

  const userResult = await ctx.supabaseAdmin.auth.admin.getUserById(subject);
  const authUser = userResult.data?.user;
  if (userResult.error || !authUser) return { response: json(req, { ok: false, code: 'AUTH_USER_NOT_FOUND' }, 401) } as const;

  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  return {
    subject,
    email: authUser.email ?? null,
    phone: authUser.phone ?? null,
    emailVerified: Boolean(authUser.email_confirmed_at),
    phoneVerified: Boolean(authUser.phone_confirmed_at),
    fullName: String(metadata.full_name ?? metadata.name ?? '').trim() || null,
  } as const;
}

function safeError(req: Request, error: unknown): Response {
  const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const code = raw.split(':')[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || 'UNKNOWN_ERROR';
  if (code.includes('NOT_FOUND')) return json(req, { ok: false, code }, 404);
  if (
    code.includes('VERIFICATION_REQUIRED') ||
    code.includes('IDENTITY_CONFLICT') ||
    code.includes('ALREADY_HAS_ACCOUNT') ||
    code.includes('NOT_ACTIVE') ||
    code.includes('PHASE_BLOCKED') ||
    code.includes('IDEMPOTENCY_CONFLICT')
  ) return json(req, { ok: false, code }, 409);
  if (code.includes('INVALID') || code.includes('REQUIRED') || code.includes('TOO_LONG')) return json(req, { ok: false, code }, 400);
  return json(req, { ok: false, code: 'MEMBER_API_ERROR' }, 500);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (origin && !originAllowed(origin)) return json(req, { ok: false, code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });

  const path = routePath(req);
  const url = new URL(req.url);

  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    try {
      const [memberHealth, checkoutHealth] = await Promise.all([memberCore().health(), checkoutCore().health()]);
      return json(req, {
        ok: true,
        service: 'diretoria-member-api',
        environment: 'hml',
        database: memberHealth.database === 'connected' && checkoutHealth.database === 'connected' ? 'connected' : 'unavailable',
        checkoutProvider: 'unconfigured',
        payments: 'disabled',
      });
    } catch {
      return json(req, { ok: false, service: 'diretoria-member-api', database: 'unavailable' }, 503);
    }
  }

  if (req.method === 'GET' && path === '/offer') {
    try {
      const offer = await checkoutCore().offerBySlug(url.searchParams.get('slug') ?? '');
      return json(req, { ok: true, offer });
    } catch (error) {
      return safeError(req, error);
    }
  }

  const auth = await authenticated(req);
  if ('response' in auth) return auth.response;

  try {
    if (req.method === 'POST' && path === '/account/bootstrap') {
      const account = await memberCore().ensureAccount({
        providerSubject: auth.subject,
        email: auth.email,
        phone: auth.phone,
        emailVerified: auth.emailVerified,
        phoneVerified: auth.phoneVerified,
        fullName: auth.fullName,
      });
      return json(req, { ok: true, account });
    }

    if (req.method === 'GET' && path === '/me') {
      const account = await memberCore().getAccount(auth.subject);
      return json(req, { ok: true, account });
    }

    if (req.method === 'GET' && path === '/wallet') {
      const wallet = await memberCore().wallet(auth.subject);
      return json(req, { ok: true, wallet });
    }

    if (req.method === 'POST' && path === '/checkout-intents') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const intent = await checkoutCore().createIntent({
        providerSubject: auth.subject,
        eventId: String(body.eventId ?? ''),
        idempotencyKey: String(body.idempotencyKey ?? ''),
        policyVersion: body.policyVersion == null ? null : String(body.policyVersion),
      });
      return json(req, {
        ok: true,
        intent,
        paymentEnabled: false,
        checkoutProvider: 'unconfigured',
        nextAction: 'configure_gateway_before_payment',
      }, 201);
    }

    const intentMatch = /^\/checkout-intents\/([0-9a-f-]{36})$/i.exec(path);
    if (req.method === 'GET' && intentMatch) {
      const intent = await checkoutCore().getIntent(auth.subject, intentMatch[1]);
      return json(req, { ok: true, intent, paymentEnabled: false, checkoutProvider: 'unconfigured' });
    }

    return json(req, { ok: false, code: 'NOT_FOUND', method: req.method, path }, 404);
  } catch (error) {
    return safeError(req, error);
  }
});
