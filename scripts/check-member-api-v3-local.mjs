import fs from'node:fs';import assert from'node:assert/strict';
const api=fs.readFileSync(new URL('../supabase/functions/diretoria-member-api/index.ts',import.meta.url),'utf8');
assert.match(api,/build:BUILD/);assert.match(api,/BUILD='asaas-hml-v3-20260823'/);assert.match(api,/legacyPaymentRoutes:'disabled'/);assert.match(api,/orchestration:'dedicated_v3'/);assert.match(api,/privacy_policy/);assert.match(api,/CHECKOUT_ORCHESTRATION_MOVED_TO_V3/);assert.match(api,/legacyOrchestrationRoute/);assert.match(api,/\/checkout-intents/);assert.match(api,/nextAction:'quote_fee_v3'/);
assert.doesNotMatch(api,/quoteAsaasPassThrough|createCheckout\(|policyCore\(\)\.accept|AsaasPaymentAdapter|PostgresProviderPaymentCore/);
console.log('OK: member API V3 mantém conta/intenção e bloqueia orquestração financeira legada');
