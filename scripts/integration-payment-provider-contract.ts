import {
  DisabledPaymentProvider,
  PaymentProviderRegistry,
  PaymentProviderUnconfiguredError,
  assertVerifiedWebhookMatchesCheckout,
  type PaymentProviderAdapter,
  type RawWebhookRequest,
  type VerifiedWebhook,
} from '../packages/payments/provider-contract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

async function expectUnconfigured(fn: () => Promise<unknown>, operation: string) {
  let matched = false;
  try { await fn(); } catch (error) {
    matched = error instanceof PaymentProviderUnconfiguredError && error.message === `PAYMENT_PROVIDER_UNCONFIGURED:${operation}`;
  }
  assert(matched, `${operation} must fail closed when provider is unconfigured`);
}

const disabled = new DisabledPaymentProvider();
assert(disabled.name === 'unconfigured', 'disabled provider name');
assert(disabled.capabilities.pix === false, 'pix disabled');
assert(disabled.capabilities.card === false, 'card disabled');
assert(disabled.capabilities.refunds === false, 'refunds disabled');
assert(disabled.capabilities.webhookSignatureVerification === false, 'webhook verification unavailable on disabled provider');

await expectUnconfigured(() => disabled.createCheckout({
  checkoutIntentId: crypto.randomUUID(),
  idempotencyKey: 'test:checkout:1',
  amountMinor: 15000n,
  currencyCode: 'BRL',
  customerReference: crypto.randomUUID(),
  eventReference: crypto.randomUUID(),
  allowedMethods: ['pix'],
  webhookUrl: 'https://example.invalid/webhook',
}), 'createCheckout');
await expectUnconfigured(() => disabled.verifyAndNormalizeWebhook({ headers: {}, rawBody: new Uint8Array(), receivedAt: new Date().toISOString() }), 'verifyAndNormalizeWebhook');
await expectUnconfigured(() => disabled.refund({ providerPaymentId: 'none', amountMinor: 15000n, currencyCode: 'BRL', idempotencyKey: 'refund:1', reason: 'test' }), 'refund');

const emptyRegistry = new PaymentProviderRegistry();
assert(emptyRegistry.configuredNames().length === 0, 'registry starts empty');
assert(emptyRegistry.resolve() instanceof DisabledPaymentProvider, 'empty registry resolves disabled provider');
assert(emptyRegistry.resolve('anything') instanceof DisabledPaymentProvider, 'unknown provider fails closed');

const insecureAdapter = {
  name: 'synthetic-insecure',
  capabilities: { pix: true, card: false, refunds: false, webhookSignatureVerification: false },
  async createCheckout() { throw new Error('not-used'); },
  async verifyAndNormalizeWebhook() { throw new Error('not-used'); },
  async refund() { throw new Error('not-used'); },
} satisfies PaymentProviderAdapter;
let insecureBlocked = false;
try { new PaymentProviderRegistry([insecureAdapter]); } catch (error) { insecureBlocked = error instanceof Error && error.message === 'PAYMENT_PROVIDER_WEBHOOK_VERIFICATION_REQUIRED'; }
assert(insecureBlocked, 'adapter without webhook verification must be rejected');

const verifiedEvent: VerifiedWebhook = {
  provider: 'synthetic-verified',
  providerEventId: 'evt-001',
  providerPaymentId: 'pay-001',
  eventType: 'paid',
  checkoutIntentId: 'intent-001',
  amountMinor: 15000n,
  feeMinor: 500n,
  currencyCode: 'BRL',
  paymentMethod: 'pix',
  occurredAt: new Date().toISOString(),
  signatureVerified: true,
  rawPayloadHash: 'sha256:synthetic',
};

const syntheticAdapter: PaymentProviderAdapter = {
  name: 'synthetic-verified',
  capabilities: { pix: true, card: true, refunds: true, webhookSignatureVerification: true },
  async createCheckout(input) {
    return { provider: 'synthetic-verified', providerSessionId: `session:${input.checkoutIntentId}`, status: 'pending' };
  },
  async verifyAndNormalizeWebhook(_input: RawWebhookRequest) { return verifiedEvent; },
  async refund() { return { provider: 'synthetic-verified', providerRefundId: 'refund-001', status: 'pending' }; },
};
const registry = new PaymentProviderRegistry([syntheticAdapter]);
assert(registry.configuredNames()[0] === 'synthetic-verified', 'verified synthetic adapter registered');
assert(registry.resolve('synthetic-verified') === syntheticAdapter, 'registered adapter resolved');
let duplicateBlocked = false;
try { registry.register(syntheticAdapter); } catch (error) { duplicateBlocked = error instanceof Error && error.message === 'PAYMENT_PROVIDER_DUPLICATE'; }
assert(duplicateBlocked, 'duplicate provider blocked');

assertVerifiedWebhookMatchesCheckout({ webhook: verifiedEvent, checkoutIntentId: 'intent-001', amountMinor: 15000n, currencyCode: 'BRL', provider: 'synthetic-verified' });
for (const [field, mutate, expected] of [
  ['checkout', (e: any) => { e.checkoutIntentId = 'other'; }, 'PAYMENT_WEBHOOK_CHECKOUT_MISMATCH'],
  ['amount', (e: any) => { e.amountMinor = 14999n; }, 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH'],
  ['currency', (e: any) => { e.currencyCode = 'USD'; }, 'PAYMENT_WEBHOOK_CURRENCY_MISMATCH'],
  ['provider', (e: any) => { e.provider = 'other'; }, 'PAYMENT_WEBHOOK_PROVIDER_MISMATCH'],
  ['signature', (e: any) => { e.signatureVerified = false; }, 'PAYMENT_WEBHOOK_NOT_VERIFIED'],
] as const) {
  const changed: any = { ...verifiedEvent };
  mutate(changed);
  let blocked = false;
  try { assertVerifiedWebhookMatchesCheckout({ webhook: changed, checkoutIntentId: 'intent-001', amountMinor: 15000n, currencyCode: 'BRL', provider: 'synthetic-verified' }); }
  catch (error) { blocked = error instanceof Error && error.message === expected; }
  assert(blocked, `${field} mismatch must be blocked`);
}

console.log('OK: payment provider contract fails closed and requires verified normalized webhooks.');
