import type {
  CreateProviderCheckoutInput,
  PaymentMethod,
  PaymentProviderAdapter,
  ProviderCapabilities,
  ProviderCheckoutResult,
  RawWebhookRequest,
  RefundProviderInput,
  RefundProviderResult,
  VerifiedWebhook,
  NormalizedPaymentEventType,
} from './provider-contract.ts';
import type { AsaasAccountFeesResponse } from './asaas-fees.ts';

export type AsaasEnvironment = 'sandbox' | 'production';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface AsaasAdapterConfig {
  environment: AsaasEnvironment;
  accessToken: string;
  webhookAuthToken: string;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
  };
  minutesToExpire?: number;
  itemImageBase64?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

const DEFAULT_ITEM_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_EXPIRE_MINUTES = 60;

const PENDING_EVENTS = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_UPDATED',
]);
const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const FAILED_EVENTS = new Set(['PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED']);
const REFUNDED_EVENTS = new Set(['PAYMENT_REFUNDED']);
const CHARGEBACK_EVENTS = new Set([
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
]);

function requiredSecret(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertWebhookToken(value: string): string {
  const token = requiredSecret(value, 'ASAAS_WEBHOOK_TOKEN_REQUIRED');
  if (token.length < 32 || token.length > 255 || /\s/.test(token)) throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
  return token;
}

function assertHttpsUrl(value: string, code: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(code);
  return url.toString();
}

function toMajor(minor: bigint): number {
  if (minor <= 0n) throw new Error('ASAAS_AMOUNT_MUST_BE_POSITIVE');
  const value = Number(minor) / 100;
  if (!Number.isSafeInteger(Number(minor)) || !Number.isFinite(value)) throw new Error('ASAAS_AMOUNT_OUT_OF_RANGE');
  return value;
}

function toMinor(value: unknown, code: string): bigint {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error(code);
  return BigInt(Math.round(numberValue * 100));
}

function getHeader(headers: Record<string, string>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === target) return String(value);
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapMethod(method: PaymentMethod): 'PIX' | 'CREDIT_CARD' {
  if (method === 'pix') return 'PIX';
  if (method === 'card') return 'CREDIT_CARD';
  throw new Error('ASAAS_PAYMENT_METHOD_UNSUPPORTED');
}

function normalizeBillingType(value: unknown): PaymentMethod {
  const type = String(value ?? '').toUpperCase();
  if (type === 'PIX') return 'pix';
  if (type === 'CREDIT_CARD') return 'card';
  throw new Error('ASAAS_WEBHOOK_BILLING_TYPE_UNSUPPORTED');
}

function normalizeEvent(value: unknown): NormalizedPaymentEventType {
  const event = String(value ?? '').trim();
  if (!event) throw new Error('ASAAS_WEBHOOK_EVENT_REQUIRED');
  if (PENDING_EVENTS.has(event)) return 'pending';
  if (PAID_EVENTS.has(event)) return 'paid';
  if (FAILED_EVENTS.has(event)) return 'failed';
  if (REFUNDED_EVENTS.has(event)) return 'refunded';
  if (CHARGEBACK_EVENTS.has(event)) return 'chargeback';
  throw new Error(`ASAAS_WEBHOOK_EVENT_UNSUPPORTED:${event}`);
}

function assertCheckoutLink(environment: AsaasEnvironment, link: string): string {
  const parsed = new URL(link);
  if (parsed.protocol !== 'https:') throw new Error('ASAAS_CHECKOUT_LINK_INVALID');
  const allowed = environment === 'sandbox'
    ? new Set(['sandbox.asaas.com'])
    : new Set(['asaas.com', 'www.asaas.com']);
  if (!allowed.has(parsed.hostname.toLowerCase())) throw new Error('ASAAS_CHECKOUT_LINK_HOST_INVALID');
  return parsed.toString();
}

function newestRefund(payload: any): any | null {
  const refunds = Array.isArray(payload?.refunds) ? payload.refunds : [];
  if (!refunds.length) return null;
  return refunds[refunds.length - 1] ?? null;
}

export class AsaasPaymentAdapter implements PaymentProviderAdapter {
  readonly name = 'asaas';
  readonly capabilities: ProviderCapabilities = Object.freeze({
    pix: true,
    card: true,
    refunds: true,
    webhookSignatureVerification: true,
  });

  private readonly environment: AsaasEnvironment;
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly webhookAuthToken: string;
  private readonly callback: AsaasAdapterConfig['callback'];
  private readonly minutesToExpire: number;
  private readonly itemImageBase64: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(config: AsaasAdapterConfig) {
    if (!['sandbox', 'production'].includes(config.environment)) throw new Error('ASAAS_ENVIRONMENT_INVALID');
    this.environment = config.environment;
    this.baseUrl = config.environment === 'sandbox' ? 'https://api-sandbox.asaas.com' : 'https://api.asaas.com';
    this.accessToken = requiredSecret(config.accessToken, 'ASAAS_ACCESS_TOKEN_REQUIRED');
    this.webhookAuthToken = assertWebhookToken(config.webhookAuthToken);
    this.callback = {
      successUrl: assertHttpsUrl(config.callback.successUrl, 'ASAAS_SUCCESS_URL_INVALID'),
      cancelUrl: assertHttpsUrl(config.callback.cancelUrl, 'ASAAS_CANCEL_URL_INVALID'),
      expiredUrl: assertHttpsUrl(config.callback.expiredUrl, 'ASAAS_EXPIRED_URL_INVALID'),
    };
    this.minutesToExpire = config.minutesToExpire ?? DEFAULT_EXPIRE_MINUTES;
    if (!Number.isInteger(this.minutesToExpire) || this.minutesToExpire < 10 || this.minutesToExpire > 1440) {
      throw new Error('ASAAS_CHECKOUT_EXPIRATION_INVALID');
    }
    this.itemImageBase64 = String(config.itemImageBase64 ?? DEFAULT_ITEM_IMAGE_BASE64).trim();
    if (!this.itemImageBase64) throw new Error('ASAAS_ITEM_IMAGE_REQUIRED');
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 30_000) throw new Error('ASAAS_TIMEOUT_INVALID');
  }

  private async requestJson(path: string, init: RequestInit = {}): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Diretoria/0.1',
          access_token: this.accessToken,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      const text = await response.text();
      let body: any = null;
      if (text) {
        try { body = JSON.parse(text); } catch { throw new Error('ASAAS_INVALID_JSON_RESPONSE'); }
      }
      if (!response.ok) {
        const suffix = Number.isInteger(response.status) ? `:${response.status}` : '';
        throw new Error(`ASAAS_HTTP_ERROR${suffix}`);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('ASAAS_REQUEST_TIMEOUT');
      if (error instanceof Error && error.message.startsWith('ASAAS_')) throw error;
      throw new Error('ASAAS_NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAccountFees(): Promise<AsaasAccountFeesResponse> {
    const body = await this.requestJson('/v3/myAccount/fees/', { method: 'GET' });
    if (!body || typeof body !== 'object') throw new Error('ASAAS_ACCOUNT_FEES_INVALID');
    return body as AsaasAccountFeesResponse;
  }

  async createCheckout(input: CreateProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (input.currencyCode.toUpperCase() !== 'BRL') throw new Error('ASAAS_CURRENCY_UNSUPPORTED');
    if (!input.checkoutIntentId.trim()) throw new Error('ASAAS_CHECKOUT_INTENT_REQUIRED');
    if (input.checkoutIntentId.length > 200) throw new Error('ASAAS_EXTERNAL_REFERENCE_TOO_LONG');
    if (input.allowedMethods.length !== 1) throw new Error('ASAAS_EXACT_FEE_REQUIRES_SINGLE_METHOD');
    const method = input.allowedMethods[0];
    const billingType = mapMethod(method);
    const amount = toMajor(input.amountMinor);
    const successUrl = input.returnUrl ? assertHttpsUrl(input.returnUrl, 'ASAAS_RETURN_URL_INVALID') : this.callback.successUrl;

    const payload = {
      billingTypes: [billingType],
      chargeTypes: ['DETACHED'],
      minutesToExpire: this.minutesToExpire,
      externalReference: input.checkoutIntentId,
      callback: {
        successUrl,
        cancelUrl: this.callback.cancelUrl,
        expiredUrl: this.callback.expiredUrl,
      },
      items: [{
        externalReference: input.eventReference.slice(0, 200),
        name: 'Crédito Diretoria Club',
        description: `Participação na edição ${input.eventReference}`.slice(0, 500),
        quantity: 1,
        value: amount,
        imageBase64: this.itemImageBase64,
      }],
    };

    const body = await this.requestJson('/v3/checkouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const id = String(body?.id ?? '').trim();
    const link = String(body?.link ?? '').trim();
    if (!id) throw new Error('ASAAS_CHECKOUT_ID_MISSING');
    if (!link) throw new Error('ASAAS_CHECKOUT_LINK_MISSING');
    if (body?.externalReference != null && String(body.externalReference) !== input.checkoutIntentId) {
      throw new Error('ASAAS_CHECKOUT_EXTERNAL_REFERENCE_MISMATCH');
    }
    if (body?.status != null && String(body.status).toUpperCase() !== 'ACTIVE') throw new Error('ASAAS_CHECKOUT_NOT_ACTIVE');

    return {
      provider: 'asaas',
      providerSessionId: id,
      providerPaymentId: null,
      status: 'pending',
      paymentMethod: method,
      expiresAt: new Date(Date.now() + this.minutesToExpire * 60_000).toISOString(),
      redirectUrl: assertCheckoutLink(this.environment, link),
      pixCopyPaste: null,
      pixQrPayload: null,
      clientToken: null,
    };
  }

  async verifyAndNormalizeWebhook(input: RawWebhookRequest): Promise<VerifiedWebhook> {
    const receivedToken = getHeader(input.headers, 'asaas-access-token');
    if (!receivedToken || !constantTimeEqual(receivedToken, this.webhookAuthToken)) {
      throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
    }

    const rawPayloadHash = await sha256Hex(input.rawBody);
    let payload: any;
    try {
      payload = JSON.parse(new TextDecoder().decode(input.rawBody));
    } catch {
      throw new Error('ASAAS_WEBHOOK_JSON_INVALID');
    }

    const providerEventId = String(payload?.id ?? '').trim();
    const eventType = normalizeEvent(payload?.event);
    const payment = payload?.payment;
    if (!providerEventId) throw new Error('ASAAS_WEBHOOK_ID_REQUIRED');
    if (!payment || typeof payment !== 'object') throw new Error('ASAAS_WEBHOOK_PAYMENT_REQUIRED');
    const providerPaymentId = String(payment.id ?? '').trim();
    const checkoutIntentId = String(payment.externalReference ?? '').trim();
    if (!providerPaymentId) throw new Error('ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
    if (!checkoutIntentId) throw new Error('ASAAS_WEBHOOK_EXTERNAL_REFERENCE_REQUIRED');

    const amountMinor = toMinor(payment.value, 'ASAAS_WEBHOOK_VALUE_INVALID');
    if (amountMinor <= 0n) throw new Error('ASAAS_WEBHOOK_VALUE_INVALID');
    const paymentMethod = normalizeBillingType(payment.billingType);
    const netMinor = payment.netValue == null ? null : toMinor(payment.netValue, 'ASAAS_WEBHOOK_NET_VALUE_INVALID');
    const feeMinor = netMinor == null ? null : amountMinor > netMinor ? amountMinor - netMinor : 0n;

    return {
      provider: 'asaas',
      providerEventId,
      providerPaymentId,
      eventType,
      checkoutIntentId,
      amountMinor,
      feeMinor,
      currencyCode: 'BRL',
      paymentMethod,
      occurredAt: String(payload?.dateCreated ?? input.receivedAt),
      signatureVerified: true,
      rawPayloadHash,
    };
  }

  async refund(input: RefundProviderInput): Promise<RefundProviderResult> {
    if (input.currencyCode.toUpperCase() !== 'BRL') throw new Error('ASAAS_CURRENCY_UNSUPPORTED');
    if (!input.providerPaymentId.trim()) throw new Error('ASAAS_REFUND_PAYMENT_ID_REQUIRED');
    const reason = String(input.reason ?? '').trim();
    if (!reason) throw new Error('ASAAS_REFUND_REASON_REQUIRED');
    const body = await this.requestJson(`/v3/payments/${encodeURIComponent(input.providerPaymentId)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ value: toMajor(input.amountMinor), description: reason.slice(0, 255) }),
    });

    const latest = newestRefund(body);
    const status = String(latest?.status ?? '').toUpperCase();
    const providerRefundId = String(
      latest?.id
      ?? latest?.endToEndIdentifier
      ?? `${input.providerPaymentId}:refund:${latest?.dateCreated ?? 'pending'}:${input.amountMinor.toString()}`,
    );
    return {
      provider: 'asaas',
      providerRefundId,
      status: status === 'DONE' ? 'paid' : 'pending',
    };
  }
}
