export type PaymentMethod = 'pix' | 'card';
export type NormalizedPaymentEventType = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'chargeback';

export interface ProviderCapabilities {
  pix: boolean;
  card: boolean;
  refunds: boolean;
  webhookSignatureVerification: boolean;
}

export interface CreateProviderCheckoutInput {
  checkoutIntentId: string;
  idempotencyKey: string;
  amountMinor: bigint;
  currencyCode: string;
  customerReference: string;
  eventReference: string;
  allowedMethods: PaymentMethod[];
  returnUrl?: string | null;
  webhookUrl: string;
}

export interface ProviderCheckoutResult {
  provider: string;
  providerSessionId: string;
  providerPaymentId?: string | null;
  status: 'pending';
  paymentMethod?: PaymentMethod | null;
  expiresAt?: string | null;
  redirectUrl?: string | null;
  pixCopyPaste?: string | null;
  pixQrPayload?: string | null;
  clientToken?: string | null;
}

export interface RawWebhookRequest {
  headers: Record<string, string>;
  rawBody: Uint8Array;
  receivedAt: string;
}

export interface VerifiedWebhook {
  provider: string;
  providerEventId: string;
  providerPaymentId: string;
  eventType: NormalizedPaymentEventType;
  checkoutIntentId: string;
  amountMinor: bigint;
  feeMinor?: bigint | null;
  currencyCode: string;
  paymentMethod?: PaymentMethod | null;
  occurredAt: string;
  signatureVerified: true;
  rawPayloadHash: string;
}

export interface RefundProviderInput {
  providerPaymentId: string;
  amountMinor: bigint;
  currencyCode: string;
  idempotencyKey: string;
  reason: string;
}

export interface RefundProviderResult {
  provider: string;
  providerRefundId: string;
  status: 'pending' | 'paid';
}

export interface PaymentProviderAdapter {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  createCheckout(input: CreateProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  verifyAndNormalizeWebhook(input: RawWebhookRequest): Promise<VerifiedWebhook>;
  refund(input: RefundProviderInput): Promise<RefundProviderResult>;
}

export class PaymentProviderUnconfiguredError extends Error {
  constructor(operation: string) {
    super(`PAYMENT_PROVIDER_UNCONFIGURED:${operation}`);
    this.name = 'PaymentProviderUnconfiguredError';
  }
}

export class DisabledPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'unconfigured';
  readonly capabilities: ProviderCapabilities = Object.freeze({
    pix: false,
    card: false,
    refunds: false,
    webhookSignatureVerification: false,
  });

  async createCheckout(): Promise<ProviderCheckoutResult> {
    throw new PaymentProviderUnconfiguredError('createCheckout');
  }

  async verifyAndNormalizeWebhook(): Promise<VerifiedWebhook> {
    throw new PaymentProviderUnconfiguredError('verifyAndNormalizeWebhook');
  }

  async refund(): Promise<RefundProviderResult> {
    throw new PaymentProviderUnconfiguredError('refund');
  }
}

export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProviderAdapter>();
  private readonly fallback = new DisabledPaymentProvider();

  constructor(adapters: PaymentProviderAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: PaymentProviderAdapter): void {
    const name = adapter.name.trim().toLowerCase();
    if (!name || name === 'unconfigured') throw new Error('PAYMENT_PROVIDER_NAME_INVALID');
    if (this.providers.has(name)) throw new Error('PAYMENT_PROVIDER_DUPLICATE');
    if (!adapter.capabilities.webhookSignatureVerification) throw new Error('PAYMENT_PROVIDER_WEBHOOK_VERIFICATION_REQUIRED');
    this.providers.set(name, adapter);
  }

  resolve(name?: string | null): PaymentProviderAdapter {
    const normalized = String(name ?? '').trim().toLowerCase();
    if (!normalized || normalized === 'unconfigured') return this.fallback;
    return this.providers.get(normalized) ?? this.fallback;
  }

  configuredNames(): string[] {
    return [...this.providers.keys()].sort();
  }
}

export function assertVerifiedWebhookMatchesCheckout(input: {
  webhook: VerifiedWebhook;
  checkoutIntentId: string;
  amountMinor: bigint;
  currencyCode: string;
  provider: string;
}): void {
  if (input.webhook.signatureVerified !== true) throw new Error('PAYMENT_WEBHOOK_NOT_VERIFIED');
  if (input.webhook.checkoutIntentId !== input.checkoutIntentId) throw new Error('PAYMENT_WEBHOOK_CHECKOUT_MISMATCH');
  if (input.webhook.amountMinor !== input.amountMinor) throw new Error('PAYMENT_WEBHOOK_AMOUNT_MISMATCH');
  if (input.webhook.currencyCode.toUpperCase() !== input.currencyCode.toUpperCase()) throw new Error('PAYMENT_WEBHOOK_CURRENCY_MISMATCH');
  if (input.webhook.provider.toLowerCase() !== input.provider.toLowerCase()) throw new Error('PAYMENT_WEBHOOK_PROVIDER_MISMATCH');
  if (!input.webhook.providerEventId.trim()) throw new Error('PAYMENT_WEBHOOK_EVENT_ID_REQUIRED');
  if (!input.webhook.providerPaymentId.trim()) throw new Error('PAYMENT_WEBHOOK_PAYMENT_ID_REQUIRED');
  if (!input.webhook.rawPayloadHash.trim()) throw new Error('PAYMENT_WEBHOOK_PAYLOAD_HASH_REQUIRED');
}
