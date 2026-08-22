import { AsaasPaymentAdapter } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/payments/asaas-adapter.ts';
import { PostgresProviderPaymentCore } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/provider-payment-core.ts';

const PUBLIC_HML_ORIGIN = 'https://diretoria-public-hml.vercel.app';
let coreInstance: PostgresProviderPaymentCore | null = null;
let adapterInstance: AsaasPaymentAdapter | null = null;

function databaseUrl(): string {
  const value = String(Deno.env.get('SUPABASE_DB_URL') ?? '').trim();
  if (!value) throw new Error('SUPABASE_DB_URL_REQUIRED');
  return value;
}

function core(): PostgresProviderPaymentCore {
  if (!coreInstance) coreInstance = new PostgresProviderPaymentCore(databaseUrl());
  return coreInstance;
}

function adapter(): AsaasPaymentAdapter {
  if (adapterInstance) return adapterInstance;
  const accessToken = String(Deno.env.get('ASAAS_ACCESS_TOKEN') ?? '').trim();
  const webhookAuthToken = String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN') ?? '').trim();
  if (!accessToken || !webhookAuthToken) throw new Error('PAYMENT_PROVIDER_UNCONFIGURED');
  adapterInstance = new AsaasPaymentAdapter({
    environment: 'sandbox',
    accessToken,
    webhookAuthToken,
    callback: {
      successUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=success`,
      cancelUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=cancel`,
      expiredUrl: `${PUBLIC_HML_ORIGIN}/club.html?provider=asaas&result=expired`,
    },
  });
  return adapterInstance;
}

function headersRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => { out[key] = value; });
  return out;
}

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const configured = Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN') ?? '').trim() && String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN') ?? '').trim());
    return response({ ok: true, service: 'diretoria-asaas-webhook', environment: 'hml', provider: 'asaas-sandbox', configured });
  }
  if (req.method !== 'POST') return response({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  let rawBody: Uint8Array;
  try {
    rawBody = new Uint8Array(await req.arrayBuffer());
  } catch {
    return response({ ok: false, code: 'WEBHOOK_BODY_READ_FAILED' }, 400);
  }
  if (!rawBody.byteLength || rawBody.byteLength > 1_000_000) return response({ ok: false, code: 'WEBHOOK_BODY_INVALID' }, 400);

  try {
    const verified = await adapter().verifyAndNormalizeWebhook({
      headers: headersRecord(req.headers),
      rawBody,
      receivedAt: new Date().toISOString(),
    });
    const result = await core().processVerifiedWebhook(verified);
    return response({ ok: true, provider: 'asaas', eventId: verified.providerEventId, eventType: verified.eventType, replayed: result.replayed === true });
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const code = raw.split(':')[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || 'UNKNOWN_ERROR';

    // Eventos do Asaas que não fazem parte do lifecycle financeiro modelado são
    // reconhecidos e descartados para evitar retries infinitos do provedor.
    if (code === 'ASAAS_WEBHOOK_EVENT_UNSUPPORTED') return response({ ok: true, ignored: true, code }, 200);
    if (code === 'ASAAS_WEBHOOK_TOKEN_INVALID') return response({ ok: false, code }, 401);
    if (code === 'PAYMENT_PROVIDER_UNCONFIGURED') return response({ ok: false, code }, 503);
    if (code.includes('WEBHOOK') || code.includes('MISMATCH') || code.includes('CONFLICT') || code.includes('INVALID') || code.includes('REQUIRED')) {
      return response({ ok: false, code }, 409);
    }
    console.error('diretoria-asaas-webhook', code);
    return response({ ok: false, code: 'ASAAS_WEBHOOK_PROCESSING_ERROR' }, 500);
  }
});