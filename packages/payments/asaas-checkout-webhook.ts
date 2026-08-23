import type { PaymentMethod, RawWebhookRequest, VerifiedWebhook } from './provider-contract.ts';

export type AsaasCheckoutEventType = 'created' | 'paid' | 'canceled' | 'expired';
export interface VerifiedAsaasCheckoutWebhook {
  provider: 'asaas';
  providerEventId: string;
  eventType: AsaasCheckoutEventType;
  checkoutSessionId: string;
  checkoutStatus: string;
  externalReference: string | null;
  occurredAt: string;
  signatureVerified: true;
  rawPayloadHash: string;
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
const EVENT_MAP = new Map<string, AsaasCheckoutEventType>([
  ['CHECKOUT_CREATED', 'created'],
  ['CHECKOUT_PAID', 'paid'],
  ['CHECKOUT_CANCELED', 'canceled'],
  ['CHECKOUT_EXPIRED', 'expired'],
]);

function required(value: string, code: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(code);
  return text;
}
function sandboxBaseUrl(environment: 'sandbox'|'production'): string {
  if (environment !== 'sandbox') throw new Error('ASAAS_HML_SANDBOX_ONLY');
  return 'https://api-sandbox.asaas.com';
}
function header(headers: Record<string, string>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) if (key.toLowerCase() === target) return String(value);
  return null;
}
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a); const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function toMinor(value: unknown, code: string): bigint {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(code);
  return BigInt(Math.round(number * 100));
}
function paymentMethod(value: unknown): PaymentMethod {
  const type = String(value ?? '').toUpperCase();
  if (type === 'PIX') return 'pix';
  if (type === 'CREDIT_CARD') return 'card';
  throw new Error('ASAAS_CHECKOUT_PAYMENT_METHOD_UNSUPPORTED');
}
function normalizedPaymentEvent(payment: any): VerifiedWebhook['eventType'] {
  const status = String(payment?.status ?? '').toUpperCase();
  const method = paymentMethod(payment?.billingType);
  if (status === 'PARTIALLY_REFUNDED') throw new Error('ASAAS_PARTIAL_REFUND_RECONCILIATION_REQUIRED');
  if (status === 'REFUNDED') return 'refunded';
  if (['CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(status)) return 'chargeback';
  if (method === 'pix') {
    if (status === 'RECEIVED') return 'paid';
    if (['CONFIRMED','PENDING','AWAITING_RISK_ANALYSIS'].includes(status)) return 'pending';
  }
  if (method === 'card') {
    if (['CONFIRMED','RECEIVED'].includes(status)) return 'paid';
    if (['PENDING','AUTHORIZED','AWAITING_RISK_ANALYSIS'].includes(status)) return 'pending';
  }
  if (['OVERDUE','DELETED'].includes(status)) return 'failed';
  throw new Error(`ASAAS_CHECKOUT_PAYMENT_STATUS_UNSUPPORTED:${status}`);
}

export async function verifyAsaasCheckoutWebhook(input: RawWebhookRequest, webhookAuthToken: string): Promise<VerifiedAsaasCheckoutWebhook> {
  const expected = required(webhookAuthToken, 'ASAAS_WEBHOOK_TOKEN_REQUIRED');
  if (expected.length < 32 || expected.length > 255 || /\s/.test(expected)) throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
  const received = header(input.headers, 'asaas-access-token');
  if (!received || !constantTimeEqual(received, expected)) throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
  const rawPayloadHash = await sha256Hex(input.rawBody);
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(input.rawBody)); }
  catch { throw new Error('ASAAS_WEBHOOK_JSON_INVALID'); }
  const eventName = String(payload?.event ?? '').trim().toUpperCase();
  const eventType = EVENT_MAP.get(eventName);
  if (!eventType) throw new Error(`ASAAS_CHECKOUT_EVENT_UNSUPPORTED:${eventName}`);
  const checkout = payload?.checkout;
  if (!checkout || typeof checkout !== 'object') throw new Error('ASAAS_CHECKOUT_WEBHOOK_CHECKOUT_REQUIRED');
  const checkoutSessionId = required(String(checkout.id ?? ''), 'ASAAS_CHECKOUT_SESSION_ID_REQUIRED');
  const providerEventId = required(String(payload?.id ?? ''), 'ASAAS_WEBHOOK_ID_REQUIRED');
  return {
    provider: 'asaas', providerEventId, eventType, checkoutSessionId,
    checkoutStatus: String(checkout.status ?? '').toUpperCase(),
    externalReference: String(checkout.externalReference ?? '').trim() || null,
    occurredAt: String(payload?.dateCreated ?? input.receivedAt), signatureVerified: true, rawPayloadHash,
  };
}

export function normalizePaymentWebhookEvent(eventName: string, billingType: unknown): VerifiedWebhook['eventType'] | null {
  const event = String(eventName ?? '').trim().toUpperCase();
  if (event === 'PAYMENT_CONFIRMED' && String(billingType ?? '').toUpperCase() === 'PIX') return 'pending';
  return null;
}

export interface VerifiedAsaasPaymentEnvelope {
  provider: 'asaas';
  providerEventId: string;
  eventName: string;
  providerPaymentId: string;
  externalReference: string | null;
  occurredAt: string;
  signatureVerified: true;
  rawPayloadHash: string;
}

export async function verifyAsaasPaymentWebhookEnvelope(input: RawWebhookRequest, webhookAuthToken: string): Promise<VerifiedAsaasPaymentEnvelope> {
  const expected = required(webhookAuthToken, 'ASAAS_WEBHOOK_TOKEN_REQUIRED');
  if (expected.length < 32 || expected.length > 255 || /\s/.test(expected)) throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
  const received = header(input.headers, 'asaas-access-token');
  if (!received || !constantTimeEqual(received, expected)) throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');
  const rawPayloadHash = await sha256Hex(input.rawBody);
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(input.rawBody)); }
  catch { throw new Error('ASAAS_WEBHOOK_JSON_INVALID'); }
  const eventName = required(String(payload?.event ?? '').trim().toUpperCase(), 'ASAAS_WEBHOOK_EVENT_REQUIRED');
  if (!eventName.startsWith('PAYMENT_')) throw new Error(`ASAAS_WEBHOOK_EVENT_UNSUPPORTED:${eventName}`);
  const payment = payload?.payment;
  if (!payment || typeof payment !== 'object') throw new Error('ASAAS_WEBHOOK_PAYMENT_REQUIRED');
  const providerEventId = required(String(payload?.id ?? ''), 'ASAAS_WEBHOOK_ID_REQUIRED');
  const providerPaymentId = required(String(payment?.id ?? ''), 'ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
  return {
    provider: 'asaas', providerEventId, eventName, providerPaymentId,
    externalReference: String(payment?.externalReference ?? '').trim() || null,
    occurredAt: String(payload?.dateCreated ?? input.receivedAt), signatureVerified: true, rawPayloadHash,
  };
}

function eventTypeFromPaymentEventName(eventName: string, billingType: unknown): VerifiedWebhook['eventType'] {
  const event = String(eventName ?? '').trim().toUpperCase();
  const method = paymentMethod(billingType);
  if (event === 'PAYMENT_PARTIALLY_REFUNDED') throw new Error('ASAAS_PARTIAL_REFUND_RECONCILIATION_REQUIRED');
  if (event === 'PAYMENT_REFUNDED') return 'refunded';
  if (['PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL'].includes(event)) return 'chargeback';
  if (event === 'PAYMENT_RECEIVED') return 'paid';
  if (event === 'PAYMENT_CONFIRMED') return method === 'pix' ? 'pending' : 'paid';
  if (['PAYMENT_REPROVED_BY_RISK_ANALYSIS','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'].includes(event)) return 'failed';
  if (['PAYMENT_CREATED','PAYMENT_AWAITING_RISK_ANALYSIS','PAYMENT_APPROVED_BY_RISK_ANALYSIS','PAYMENT_AUTHORIZED','PAYMENT_UPDATED'].includes(event)) return 'pending';
  throw new Error(`ASAAS_WEBHOOK_EVENT_UNSUPPORTED:${event}`);
}

export async function fetchAsaasPaymentById(input: { environment:'sandbox'|'production'; accessToken:string; providerPaymentId:string; fetchImpl?:FetchLike }): Promise<any> {
  const accessToken = required(input.accessToken, 'ASAAS_ACCESS_TOKEN_REQUIRED');
  const providerPaymentId = required(input.providerPaymentId, 'ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
  const baseUrl = sandboxBaseUrl(input.environment);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/v3/payments/${encodeURIComponent(providerPaymentId)}`, { method:'GET', headers:{ Accept:'application/json','User-Agent':'Diretoria/0.1',access_token:accessToken } });
  const text = await response.text(); let body:any=null;
  if (text) { try { body=JSON.parse(text); } catch { throw new Error('ASAAS_INVALID_JSON_RESPONSE'); } }
  if (!response.ok) throw new Error(`ASAAS_HTTP_ERROR:${response.status}`);
  if (!body || typeof body !== 'object' || String(body.id ?? '') !== providerPaymentId) throw new Error('ASAAS_PAYMENT_RESOURCE_INVALID');
  return body;
}

export function paymentEnvelopeToVerifiedWebhook(envelope: VerifiedAsaasPaymentEnvelope, payment: any, checkoutIntentId: string): VerifiedWebhook {
  const eventType = eventTypeFromPaymentEventName(envelope.eventName, payment?.billingType);
  const amountMinor = toMinor(payment?.value, 'ASAAS_WEBHOOK_VALUE_INVALID');
  if (amountMinor <= 0n) throw new Error('ASAAS_WEBHOOK_VALUE_INVALID');
  const method = paymentMethod(payment?.billingType);
  const netMinor = payment?.netValue == null ? null : toMinor(payment.netValue, 'ASAAS_WEBHOOK_NET_VALUE_INVALID');
  if (eventType === 'paid' && netMinor == null) throw new Error('ASAAS_CHECKOUT_PAYMENT_NET_VALUE_REQUIRED');
  const feeMinor = netMinor == null ? null : amountMinor > netMinor ? amountMinor - netMinor : 0n;
  return {
    provider:'asaas', providerEventId:envelope.providerEventId, providerPaymentId:envelope.providerPaymentId,
    eventType, checkoutIntentId, amountMinor, feeMinor, currencyCode:'BRL', paymentMethod:method,
    occurredAt:envelope.occurredAt, signatureVerified:true, rawPayloadHash:envelope.rawPayloadHash,
  };
}

export async function checkoutSessionContainsPayment(input:{environment:'sandbox'|'production';accessToken:string;checkoutSessionId:string;providerPaymentId:string;fetchImpl?:FetchLike}):Promise<boolean>{
  const accessToken=required(input.accessToken,'ASAAS_ACCESS_TOKEN_REQUIRED');
  const checkoutSessionId=required(input.checkoutSessionId,'ASAAS_CHECKOUT_SESSION_ID_REQUIRED');
  const providerPaymentId=required(input.providerPaymentId,'ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
  const baseUrl=sandboxBaseUrl(input.environment);
  const url=new URL('/v3/payments',baseUrl);url.searchParams.set('checkoutSession',checkoutSessionId);url.searchParams.set('limit','20');
  const response=await (input.fetchImpl??fetch)(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'Diretoria/0.1',access_token:accessToken}});
  const text=await response.text();let body:any=null;if(text){try{body=JSON.parse(text);}catch{throw new Error('ASAAS_INVALID_JSON_RESPONSE');}}
  if(!response.ok)throw new Error(`ASAAS_HTTP_ERROR:${response.status}`);
  return (Array.isArray(body?.data)?body.data:[]).some((row:any)=>String(row?.id??'')===providerPaymentId);
}

export async function fetchPaymentForCheckout(input: {
  environment: 'sandbox' | 'production';
  accessToken: string;
  checkoutSessionId: string;
  checkoutIntentId: string;
  expectedAmountMinor: bigint;
  expectedMethod: PaymentMethod;
  providerEventId: string;
  occurredAt: string;
  rawPayloadHash: string;
  fetchImpl?: FetchLike;
}): Promise<VerifiedWebhook> {
  const accessToken = required(input.accessToken, 'ASAAS_ACCESS_TOKEN_REQUIRED');
  const checkoutSessionId = required(input.checkoutSessionId, 'ASAAS_CHECKOUT_SESSION_ID_REQUIRED');
  const baseUrl = sandboxBaseUrl(input.environment);
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL('/v3/payments', baseUrl);
  url.searchParams.set('checkoutSession', checkoutSessionId);
  url.searchParams.set('limit', '20');
  const response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'Diretoria/0.1', access_token: accessToken } });
  const text = await response.text();
  let body: any = null;
  if (text) { try { body = JSON.parse(text); } catch { throw new Error('ASAAS_INVALID_JSON_RESPONSE'); } }
  if (!response.ok) throw new Error(`ASAAS_HTTP_ERROR:${response.status}`);
  const rows = Array.isArray(body?.data) ? body.data : [];
  const candidates = rows.filter((row: any) => {
    try { return paymentMethod(row?.billingType) === input.expectedMethod && toMinor(row?.value, 'ASAAS_CHECKOUT_PAYMENT_VALUE_INVALID') === input.expectedAmountMinor; }
    catch { return false; }
  });
  if (candidates.length !== 1) throw new Error(candidates.length ? 'ASAAS_CHECKOUT_PAYMENT_AMBIGUOUS' : 'ASAAS_CHECKOUT_PAYMENT_NOT_FOUND');
  const payment = candidates[0];
  const eventType = normalizedPaymentEvent(payment);
  const providerPaymentId = required(String(payment?.id ?? ''), 'ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
  const amountMinor = toMinor(payment?.value, 'ASAAS_WEBHOOK_VALUE_INVALID');
  const netMinor = payment?.netValue == null ? null : toMinor(payment.netValue, 'ASAAS_WEBHOOK_NET_VALUE_INVALID');
  if (eventType === 'paid' && netMinor == null) throw new Error('ASAAS_CHECKOUT_PAYMENT_NET_VALUE_REQUIRED');
  const feeMinor = netMinor == null ? null : amountMinor > netMinor ? amountMinor - netMinor : 0n;
  return {
    provider: 'asaas', providerEventId: input.providerEventId, providerPaymentId, eventType,
    checkoutIntentId: input.checkoutIntentId, amountMinor, feeMinor, currencyCode: 'BRL',
    paymentMethod: input.expectedMethod, occurredAt: input.occurredAt, signatureVerified: true, rawPayloadHash: input.rawPayloadHash,
  };
}
