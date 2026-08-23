import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase/functions/diretoria-asaas-checkout-api/index.ts',import.meta.url),'utf8');const client=fs.readFileSync(new URL('../supabase/functions/diretoria-asaas-checkout-api/hosted-checkout.ts',import.meta.url),'utf8');
assert.match(source,/quoteAsaasPassThrough/);assert.match(source,/freezeQuote/);assert.match(source,/assertAccepted/);assert.match(source,/privacy_policy/);assert.match(source,/CHECKOUT_CONSENT_REQUIRED/);assert.match(source,/consent_type/);assert.match(source,/bindCheckout/);assert.match(source,/startGuard\(\)\.claim/);assert.match(source,/requireReconciliation/);assert.match(source,/releaseDefinitiveFailure/);assert.match(source,/checkoutUrlForSession/);assert.match(source,/event:event\.slug/);assert.match(client,/externalReference:checkoutIntentId/);assert.match(client,/checkoutSession\/show/);assert.match(client,/if\(link\)/);assert.doesNotMatch(source,/ASAAS_WEBHOOK_AUTH_TOKEN/);console.log('OK: checkout API local separa quote/start e suporta id-only');

assert.match(source,/intent\.status==='ready'/);assert.match(source,/replayed:true,quote/);assert.match(source,/CHECKOUT_FROZEN_QUOTE_INVALID/);

assert.match(source,/assertPaymentNotFinal/);assert.match(source,/CHECKOUT_PAYMENT_ALREADY_FINAL/);

assert.match(client,/ASAAS_HML_SANDBOX_ONLY/);assert.doesNotMatch(client,/https:\/\/api\.asaas\.com/);
