import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresMemberAccounts } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/member-accounts.ts';
import { PostgresClubCheckout } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/club-checkout.ts';
import { PostgresPolicyGate } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/policy-gate.ts';
import { PostgresProviderPaymentCore } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/provider-payment-core.ts';
import { AsaasPaymentAdapter } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/payments/asaas-adapter.ts';
import { quoteAsaasPassThrough } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/payments/asaas-fees.ts';

const PUBLIC_HML_ORIGIN = 'https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3200', 'http://127.0.0.1:3200']);
const ASAAS_WEBHOOK_URL = 'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook';
const REQUIRED_CHECKOUT_POLICIES = ['club_terms', 'non_achievement_policy'];
const POLICY_CONTEXT = 'club_checkout';
const PINNED_CORE_SHA = 'c0fefccf0cf71b664ed6860b595dbe1bb037b827';

let memberCoreInstance: PostgresMemberAccounts | null = null;
let checkoutCoreInstance: PostgresClubCheckout | null = null;
let policyCoreInstance: PostgresPolicyGate | null = null;
let providerCoreInstance: PostgresProviderPaymentCore | null = null;
let asaasAdapterInstance: AsaasPaymentAdapter | null | undefined;

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
function policyCore(): PostgresPolicyGate {
  if (!policyCoreInstance) policyCoreInstance = new PostgresPolicyGate(databaseUrl());
  return policyCoreInstance;
}
function providerCore(): PostgresProviderPaymentCore {
  if (!providerCoreInstance) providerCoreInstance = new PostgresProviderPaymentCore(databaseUrl());
  return providerCoreInstance;
}

function asaasConfigured(): boolean {
  return Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN') ?? '').trim() && String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN') ?? '').trim());
}

function asaasAdapter(): AsaasPaymentAdapter | null {
  if (asaasAdapterInstance !== undefined) return asaasAdapterInstance;
  const accessToken = String(Deno.env.get('ASAAS_ACCESS_TOKEN') ?? '').trim();
  const webhookAuthToken = String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN') ?? '').trim();
  if (!accessToken || !webhookAuthToken) {
    asaasAdapterInstance = null;
    return null;
  }
  asaasAdapterInstance = new AsaasPaymentAdapter({
    environment: 'sandbox',
    accessToken,
    webhookAuthToken,
    callback: {
      successUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=success`,
      cancelUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=cancel`,
      expiredUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=expired`,
    },
  });
  return asaasAdapterInstance;
}

function decimalToMinor(value: unknown): bigint {
  const text = String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('MONEY_VALUE_INVALID');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function bigintJson(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function authenticated(req: Request) {
  const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' });
  if (error || !ctx) return { response: json(req, { ok: false, code: error?.code ?? 'AUTH_REQUIRED' }, error?.status ?? 401) } as const;
  const subject = String(ctx.userClaims?.sub ?? '').trim();
  if (!subject) return { response: json(req, { ok: false, code: 'AUTH_SUBJECT_REQUIRED' }, 401) } as const;
  const userResult = await ctx.supabaseAdmin.auth.admin.getUserById(subject);
  const authUser = userResult.data?.user;
  if (userResult.error || !authUser) return { response: json(req, { ok: false, code: 'AUTH_USER_NOT_FOUND' }, 401) } as const;
  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  return {
    ctx,
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
  if (code.includes('AUTH_REQUIRED')) return json(req, { ok: false, code }, 401);
  if (
    code.includes('VERIFICATION_REQUIRED') || code.includes('IDENTITY_CONFLICT') || code.includes('ALREADY_HAS_ACCOUNT') ||
    code.includes('NOT_ACTIVE') || code.includes('PHASE_BLOCKED') || code.includes('IDEMPOTENCY_CONFLICT') ||
    code.includes('ACCEPTANCE_REQUIRED') || code.includes('ACTIVE_DOCUMENT_REQUIRED') || code.includes('ALREADY_FROZEN') ||
    code.includes('SESSION_CONFLICT') || code.includes('RECONCILIATION') || code.includes('STALE')
  ) return json(req, { ok: false, code }, 409);
  if (code.includes('UNCONFIGURED')) return json(req, { ok: false, code }, 503);
  if (code.includes('INVALID') || code.includes('REQUIRED') || code.includes('TOO_LONG') || code.includes('UNSUPPORTED')) return json(req, { ok: false, code }, 400);
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
      await Promise.all([memberCore().health(), checkoutCore().health(), policyCore().health()]);
      const configured = asaasConfigured();
      return json(req, {
        ok: true,
        service: 'diretoria-member-api', environment: 'hml',
        database: 'connected',
        checkoutProvider: configured ? 'asaas-sandbox' : 'asaas-sandbox-unconfigured',
        payments: configured ? 'sandbox-ready' : 'disabled',
        requiredPolicyCodes: REQUIRED_CHECKOUT_POLICIES,
        coreRevision: PINNED_CORE_SHA,
      });
    } catch {
      return json(req, { ok: false, service: 'diretoria-member-api', database: 'unavailable' }, 503);
    }
  }

  if (req.method === 'GET' && path === '/offer') {
    try {
      const configured = asaasConfigured();
      const offer = await checkoutCore().offerBySlug(url.searchParams.get('slug') ?? '');
      return json(req, {
        ok: true,
        offer: {
          ...offer,
          checkoutProvider: configured ? 'asaas-sandbox' : 'asaas-sandbox-unconfigured',
          paymentEnabled: configured,
        },
      });
    } catch (error) { return safeError(req, error); }
  }

  const auth = await authenticated(req);
  if ('response' in auth) return auth.response;

  try {
    if (req.method === 'POST' && path === '/account/bootstrap') {
      const account = await memberCore().ensureAccount({
        providerSubject: auth.subject, email: auth.email, phone: auth.phone,
        emailVerified: auth.emailVerified, phoneVerified: auth.phoneVerified, fullName: auth.fullName,
      });
      return json(req, { ok: true, account });
    }
    if (req.method === 'GET' && path === '/me') return json(req, { ok: true, account: await memberCore().getAccount(auth.subject) });
    if (req.method === 'GET' && path === '/wallet') return json(req, { ok: true, wallet: await memberCore().wallet(auth.subject) });

    if (req.method === 'GET' && path === '/checkout-policies') {
      const bundle = await policyCore().activeBundle(REQUIRED_CHECKOUT_POLICIES);
      const ids = bundle.documents.map((document) => document.id);
      const { data: rows, error } = await auth.ctx.supabaseAdmin
        .from('policy_documents')
        .select('id,content')
        .in('id', ids);
      if (error) throw new Error('POLICY_CONTENT_QUERY_FAILED');
      const contentById = new Map((rows ?? []).map((row: { id: string; content: string }) => [row.id, row.content]));
      if (ids.some((id) => !contentById.has(id))) throw new Error('POLICY_CONTENT_NOT_FOUND');
      return json(req, {
        ok: true,
        context: POLICY_CONTEXT,
        bundle: {
          fingerprint: bundle.fingerprint,
          documents: bundle.documents.map((document) => ({ ...document, content: contentById.get(document.id) })),
        },
      });
    }

    if (req.method === 'POST' && path === '/checkout-policies/accept') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const fingerprint = String(body.fingerprint ?? '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(fingerprint)) throw new Error('POLICY_FINGERPRINT_INVALID');
      const bundle = await policyCore().activeBundle(REQUIRED_CHECKOUT_POLICIES);
      if (bundle.fingerprint !== fingerprint) throw new Error('POLICY_BUNDLE_STALE');
      const account = await memberCore().getAccount(auth.subject);
      const accepted = await policyCore().accept({
        profileId: account.profile_id,
        policyDocumentIds: bundle.documents.map((document) => document.id),
        context: POLICY_CONTEXT,
        source: 'public_hml',
        evidence: {
          bundleFingerprint: bundle.fingerprint,
          userAgent: String(req.headers.get('user-agent') ?? '').slice(0, 300),
        },
      });
      const verified = await policyCore().assertAccepted({
        profileId: account.profile_id,
        context: POLICY_CONTEXT,
        requiredCodes: REQUIRED_CHECKOUT_POLICIES,
      });
      return json(req, {
        ok: true,
        acceptance: {
          fingerprint: verified.fingerprint,
          documentIds: verified.documentIds,
          acceptedIds: accepted.acceptedIds,
          replayedIds: accepted.replayedIds,
        },
      });
    }

    if (req.method === 'POST' && path === '/checkout-intents') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const intent = await checkoutCore().createIntent({
        providerSubject: auth.subject, eventId: String(body.eventId ?? ''), idempotencyKey: String(body.idempotencyKey ?? ''), policyVersion: null,
      });
      return json(req, { ok: true, intent, paymentEnabled: asaasConfigured(), checkoutProvider: 'asaas', nextAction: 'quote_fee' }, 201);
    }

    const intentMatch = /^\/checkout-intents\/([0-9a-f-]{36})$/i.exec(path);
    if (req.method === 'GET' && intentMatch) {
      const intent = await checkoutCore().getIntent(auth.subject, intentMatch[1]);
      return json(req, { ok: true, intent, paymentEnabled: asaasConfigured(), checkoutProvider: 'asaas' });
    }

    const quoteMatch = /^\/checkout-intents\/([0-9a-f-]{36})\/quote$/i.exec(path);
    if (req.method === 'POST' && quoteMatch) {
      const adapter = asaasAdapter();
      if (!adapter) throw new Error('PAYMENT_PROVIDER_UNCONFIGURED');
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const method = String(body.method ?? '').toLowerCase();
      if (!['pix', 'card'].includes(method)) throw new Error('ASAAS_PAYMENT_METHOD_INVALID');
      const installments = method === 'card' ? Number(body.installments ?? 1) : null;
      if (method === 'card' && installments !== 1) throw new Error('ASAAS_HML_CARD_ONLY_ONE_INSTALLMENT');
      const intent = await checkoutCore().getIntent(auth.subject, quoteMatch[1]);
      if (intent.status !== 'draft' && intent.status !== 'ready') throw new Error(`CHECKOUT_INTENT_NOT_QUOTABLE:${intent.status}`);
      const accountFees = await adapter.getAccountFees();
      const quotedAt = new Date();
      const quote = quoteAsaasPassThrough(
        decimalToMinor(intent.base_amount), method === 'pix' ? { method: 'pix' } : { method: 'card', installments: 1 }, accountFees, quotedAt,
      );
      const snapshot = {
        provider: 'asaas', environment: 'sandbox', quotedAt: quotedAt.toISOString(),
        method: quote.method, installments: quote.installments,
        baseMinor: quote.baseMinor, processingFeeMinor: quote.processingFeeMinor, totalMinor: quote.totalMinor,
        providerFeeOnTotalMinor: quote.providerFeeOnTotalMinor, netAfterProviderFeeMinor: quote.netAfterProviderFeeMinor,
        feeModel: quote.feeModel,
      };
      const snapshotJson = JSON.stringify(snapshot, bigintJson);
      const feeSourceHash = await sha256Text(snapshotJson);
      await providerCore().freezeQuote({
        providerSubject: auth.subject, intentId: intent.id, paymentMethod: quote.method,
        installmentCount: quote.installments, baseAmountMinor: quote.baseMinor,
        processingFeeMinor: quote.processingFeeMinor, totalMinor: quote.totalMinor,
        feeSnapshot: JSON.parse(snapshotJson), feeSourceHash,
      });
      return json(req, {
        ok: true, quote: {
          provider: 'asaas', method: quote.method, installments: quote.installments,
          baseAmount: (Number(quote.baseMinor) / 100).toFixed(2),
          processingFee: (Number(quote.processingFeeMinor) / 100).toFixed(2),
          customerTotal: (Number(quote.totalMinor) / 100).toFixed(2),
          feeSourceHash,
        },
        nextAction: 'accept_policies_then_start_checkout',
      });
    }

    const startMatch = /^\/checkout-intents\/([0-9a-f-]{36})\/start$/i.exec(path);
    if (req.method === 'POST' && startMatch) {
      const adapter = asaasAdapter();
      if (!adapter) throw new Error('PAYMENT_PROVIDER_UNCONFIGURED');
      const intent = await checkoutCore().getIntent(auth.subject, startMatch[1]);
      if (intent.status === 'pending' && intent.provider_session_id) {
        return json(req, { ok: true, checkout: { provider: 'asaas', sessionId: intent.provider_session_id, status: 'pending' }, replayed: true });
      }
      if (intent.status !== 'ready') throw new Error(`CHECKOUT_INTENT_NOT_READY:${intent.status}`);
      const account = await memberCore().getAccount(auth.subject);
      const accepted = await policyCore().assertAccepted({ profileId: account.profile_id, context: POLICY_CONTEXT, requiredCodes: REQUIRED_CHECKOUT_POLICIES });
      const totalMinor = decimalToMinor(intent.amount_gross);
      let checkout;
      try {
        checkout = await adapter.createCheckout({
          checkoutIntentId: intent.id,
          idempotencyKey: `asaas-checkout:${intent.id}`,
          amountMinor: totalMinor,
          currencyCode: intent.currency_code,
          customerReference: account.profile_id,
          eventReference: intent.event_id,
          allowedMethods: [intent.payment_method],
          returnUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&intent=${encodeURIComponent(intent.id)}&result=return`,
          webhookUrl: ASAAS_WEBHOOK_URL,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message.split(':')[0] : 'ASAAS_UNKNOWN_ERROR';
        if (['ASAAS_REQUEST_TIMEOUT', 'ASAAS_NETWORK_ERROR', 'ASAAS_INVALID_JSON_RESPONSE', 'ASAAS_CHECKOUT_ID_MISSING', 'ASAAS_CHECKOUT_LINK_MISSING'].includes(code)) {
          await providerCore().markCheckoutReconciliationRequired(intent.id, code);
          throw new Error(`CHECKOUT_RECONCILIATION_REQUIRED:${code}`);
        }
        throw error;
      }
      await providerCore().bindCheckout({ providerSubject: auth.subject, intentId: intent.id, providerSessionId: checkout.providerSessionId, expiresAt: checkout.expiresAt });
      return json(req, {
        ok: true,
        checkout: { provider: 'asaas', sessionId: checkout.providerSessionId, redirectUrl: checkout.redirectUrl, expiresAt: checkout.expiresAt },
        policyFingerprint: accepted.fingerprint,
        paymentState: 'pending_provider_webhook',
      }, 201);
    }

    return json(req, { ok: false, code: 'NOT_FOUND', method: req.method, path }, 404);
  } catch (error) {
    return safeError(req, error);
  }
});