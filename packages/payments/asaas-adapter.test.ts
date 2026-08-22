import test from 'node:test';
import assert from 'node:assert/strict';
import { AsaasPaymentAdapter } from './asaas-adapter.ts';

const ACCESS_TOKEN = ['TEST', 'ACCESS', 'TOKEN', 'ONLY'].join('_');
const WEBHOOK_TOKEN = `whsec_${'x'.repeat(40)}`;
const CALLBACK = {
  successUrl: 'https://diretoria-public-hml.vercel.app/payment/success',
  cancelUrl: 'https://diretoria-public-hml.vercel.app/payment/cancel',
  expiredUrl: 'https://diretoria-public-hml.vercel.app/payment/expired',
};

type CapturedCall = { url: string; init: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function adapterWith(handler: (url: string, init: RequestInit) => Promise<Response> | Response, overrides: Record<string, unknown> = {}) {
  const calls: CapturedCall[] = [];
  const fetchImpl = async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  };
  const adapter = new AsaasPaymentAdapter({
    environment: 'sandbox',
    accessToken: ACCESS_TOKEN,
    webhookAuthToken: WEBHOOK_TOKEN,
    callback: CALLBACK,
    fetchImpl,
    ...overrides,
  } as any);
  return { adapter, calls };
}

function checkoutInput(method: 'pix' | 'card' = 'pix') {
  return {
    checkoutIntentId: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: 'internal-idempotency-1',
    amountMinor: 15_199n,
    currencyCode: 'BRL',
    customerReference: 'customer-1',
    eventReference: 'diretoria-hml-01',
    allowedMethods: [method],
    returnUrl: null,
    webhookUrl: 'https://example.invalid/webhook',
  };
}

function webhookBody(event = 'PAYMENT_RECEIVED', overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_001',
    event,
    dateCreated: '2026-08-22 12:30:00',
    payment: {
      id: 'pay_001',
      value: 151.99,
      netValue: 150,
      billingType: 'PIX',
      status: 'RECEIVED',
      externalReference: '11111111-1111-4111-8111-111111111111',
      ...overrides,
    },
  };
}

function rawWebhook(payload: unknown, token = WEBHOOK_TOKEN) {
  return {
    headers: { 'Asaas-Access-Token': token },
    rawBody: new TextEncoder().encode(JSON.stringify(payload)),
    receivedAt: '2026-08-22T15:30:00.000Z',
  };
}

test('GET de taxas usa host sandbox, access_token e nenhum body', async () => {
  const { adapter, calls } = adapterWith(() => jsonResponse({ payment: { pix: { fixedFeeValue: 1.99 } } }));
  const fees = await adapter.getAccountFees();
  assert.equal(fees.payment?.pix?.fixedFeeValue, 1.99);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api-sandbox.asaas.com/v3/myAccount/fees/');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
  assert.equal((calls[0].init.headers as Record<string, string>).access_token, ACCESS_TOKEN);
});

test('produção usa exclusivamente api.asaas.com', async () => {
  const calls: CapturedCall[] = [];
  const adapter = new AsaasPaymentAdapter({
    environment: 'production',
    accessToken: ACCESS_TOKEN,
    webhookAuthToken: WEBHOOK_TOKEN,
    callback: CALLBACK,
    fetchImpl: async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ payment: {} });
    },
  });
  await adapter.getAccountFees();
  assert.equal(calls[0].url, 'https://api.asaas.com/v3/myAccount/fees/');
});

test('Checkout Pix hospedado usa DETACHED, método único e não envia dados de cartão/cliente', async () => {
  const { adapter, calls } = adapterWith(() => jsonResponse({
    id: 'chk_001',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk_001',
    status: 'ACTIVE',
    externalReference: '11111111-1111-4111-8111-111111111111',
  }));
  const result = await adapter.createCheckout(checkoutInput('pix'));
  assert.equal(result.provider, 'asaas');
  assert.equal(result.providerSessionId, 'chk_001');
  assert.equal(result.paymentMethod, 'pix');
  assert.equal(result.redirectUrl, 'https://sandbox.asaas.com/checkoutSession/show/chk_001');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api-sandbox.asaas.com/v3/checkouts');
  assert.equal(calls[0].init.method, 'POST');
  const payload = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(payload.billingTypes, ['PIX']);
  assert.deepEqual(payload.chargeTypes, ['DETACHED']);
  assert.equal(payload.externalReference, checkoutInput().checkoutIntentId);
  assert.equal(payload.items[0].value, 151.99);
  assert.equal(payload.items[0].quantity, 1);
  assert.ok(payload.items[0].imageBase64);
  assert.equal('customerData' in payload, false);
  assert.equal('installment' in payload, false);
  assert.equal(JSON.stringify(payload).toLowerCase().includes('creditcard'), false);
});

test('Checkout cartão V1 é único e DETACHED (1x)', async () => {
  const { adapter, calls } = adapterWith(() => jsonResponse({
    id: 'chk_card',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk_card',
    status: 'ACTIVE',
    externalReference: checkoutInput('card').checkoutIntentId,
  }));
  const input = checkoutInput('card');
  input.amountMinor = 15_513n;
  const result = await adapter.createCheckout(input);
  assert.equal(result.paymentMethod, 'card');
  const payload = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(payload.billingTypes, ['CREDIT_CARD']);
  assert.deepEqual(payload.chargeTypes, ['DETACHED']);
  assert.equal(payload.items[0].value, 155.13);
  assert.equal('installment' in payload, false);
});

test('Checkout bloqueia múltiplos métodos porque taxa exata deve ser cotada antes', async () => {
  const { adapter, calls } = adapterWith(() => jsonResponse({}));
  const input = checkoutInput();
  input.allowedMethods = ['pix', 'card'];
  await assert.rejects(() => adapter.createCheckout(input), /ASAAS_EXACT_FEE_REQUIRES_SINGLE_METHOD/);
  assert.equal(calls.length, 0);
});

test('link de checkout em host inesperado é bloqueado', async () => {
  const { adapter } = adapterWith(() => jsonResponse({
    id: 'chk_evil',
    link: 'https://example.com/phishing',
    status: 'ACTIVE',
    externalReference: checkoutInput().checkoutIntentId,
  }));
  await assert.rejects(() => adapter.createCheckout(checkoutInput()), /ASAAS_CHECKOUT_LINK_HOST_INVALID/);
});

test('POST não é repetido automaticamente após erro HTTP', async () => {
  let count = 0;
  const { adapter } = adapterWith(() => { count += 1; return jsonResponse({ errors: [] }, 500); });
  await assert.rejects(() => adapter.createCheckout(checkoutInput()), /ASAAS_HTTP_ERROR:500/);
  assert.equal(count, 1);
});

test('timeout não causa retry automático', async () => {
  let count = 0;
  const { adapter } = adapterWith((_url, init) => {
    count += 1;
    return new Promise((_resolve, reject) => {
      const signal = init.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  }, { timeoutMs: 500 });
  await assert.rejects(() => adapter.createCheckout(checkoutInput()), /ASAAS_REQUEST_TIMEOUT/);
  assert.equal(count, 1);
});

test('webhook PAYMENT_RECEIVED com token correto normaliza paid e taxa real', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  const normalized = await adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody()));
  assert.equal(normalized.provider, 'asaas');
  assert.equal(normalized.providerEventId, 'evt_001');
  assert.equal(normalized.providerPaymentId, 'pay_001');
  assert.equal(normalized.checkoutIntentId, checkoutInput().checkoutIntentId);
  assert.equal(normalized.eventType, 'paid');
  assert.equal(normalized.amountMinor, 15_199n);
  assert.equal(normalized.feeMinor, 199n);
  assert.equal(normalized.paymentMethod, 'pix');
  assert.equal(normalized.signatureVerified, true);
  assert.match(normalized.rawPayloadHash, /^[0-9a-f]{64}$/);
});

test('mesmo webhook preserva ID/hash para idempotência no banco', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  const request = rawWebhook(webhookBody());
  const first = await adapter.verifyAndNormalizeWebhook(request);
  const second = await adapter.verifyAndNormalizeWebhook(request);
  assert.equal(first.providerEventId, second.providerEventId);
  assert.equal(first.rawPayloadHash, second.rawPayloadHash);
});

test('webhook com token divergente é rejeitado antes de processar payload', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  await assert.rejects(
    () => adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody(), `whsec_${'y'.repeat(40)}`)),
    /ASAAS_WEBHOOK_TOKEN_INVALID/,
  );
});

test('PAYMENT_CONFIRMED também é compromisso financeiro pago', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  const result = await adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_CONFIRMED')));
  assert.equal(result.eventType, 'paid');
});

test('eventos de falha, refund e chargeback são normalizados sem ambiguidade', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  assert.equal((await adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', { billingType: 'CREDIT_CARD' })))).eventType, 'failed');
  assert.equal((await adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_REFUNDED')))).eventType, 'refunded');
  assert.equal((await adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_CHARGEBACK_REQUESTED', { billingType: 'CREDIT_CARD' })))).eventType, 'chargeback');
});

test('PAYMENT_OVERDUE não é inventado como expired', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  await assert.rejects(
    () => adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_OVERDUE'))),
    /ASAAS_WEBHOOK_EVENT_UNSUPPORTED:PAYMENT_OVERDUE/,
  );
});

test('webhook sem externalReference é rejeitado', async () => {
  const { adapter } = adapterWith(() => jsonResponse({}));
  await assert.rejects(
    () => adapter.verifyAndNormalizeWebhook(rawWebhook(webhookBody('PAYMENT_RECEIVED', { externalReference: null }))),
    /ASAAS_WEBHOOK_EXTERNAL_REFERENCE_REQUIRED/,
  );
});

test('refund chama uma vez o endpoint oficial e permanece pending até confirmação', async () => {
  const { adapter, calls } = adapterWith(() => jsonResponse({
    id: 'pay_001',
    refunds: [{ status: 'PENDING', value: 151.99, dateCreated: '2026-08-22 13:00:00', description: 'Cancelamento' }],
  }));
  const result = await adapter.refund({
    providerPaymentId: 'pay_001',
    amountMinor: 15_199n,
    currencyCode: 'BRL',
    idempotencyKey: 'refund-internal-1',
    reason: 'Cancelamento solicitado',
  });
  assert.equal(result.provider, 'asaas');
  assert.equal(result.status, 'pending');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api-sandbox.asaas.com/v3/payments/pay_001/refund');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.value, 151.99);
  assert.equal(body.description, 'Cancelamento solicitado');
  assert.equal((calls[0].init.headers as Record<string, string>)['Idempotency-Key'], undefined);
});

test('refund DONE retorna paid', async () => {
  const { adapter } = adapterWith(() => jsonResponse({
    id: 'pay_001',
    refunds: [{ id: 'ref_001', status: 'DONE', value: 151.99, dateCreated: '2026-08-22 13:00:00' }],
  }));
  const result = await adapter.refund({
    providerPaymentId: 'pay_001', amountMinor: 15_199n, currencyCode: 'BRL', idempotencyKey: 'x', reason: 'Teste',
  });
  assert.equal(result.status, 'paid');
  assert.equal(result.providerRefundId, 'ref_001');
});

test('segredos nunca aparecem em erro de rede/HTTP', async () => {
  const { adapter } = adapterWith(() => jsonResponse({ detail: ACCESS_TOKEN, token: WEBHOOK_TOKEN }, 401));
  let message = '';
  try { await adapter.getAccountFees(); } catch (error) { message = error instanceof Error ? error.message : String(error); }
  assert.equal(message.includes(ACCESS_TOKEN), false);
  assert.equal(message.includes(WEBHOOK_TOKEN), false);
  assert.match(message, /ASAAS_HTTP_ERROR:401/);
});
