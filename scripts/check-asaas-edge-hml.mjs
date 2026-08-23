import fs from 'node:fs';

const member = fs.readFileSync('supabase/functions/diretoria-member-api/index.ts','utf8');
const checkout = fs.readFileSync('supabase/functions/diretoria-asaas-checkout-api/index.ts','utf8');
const hosted = fs.readFileSync('supabase/functions/diretoria-asaas-checkout-api/hosted-checkout.ts','utf8');
const policy = fs.readFileSync('supabase/functions/diretoria-checkout-policy-api/index.ts','utf8');
const status = fs.readFileSync('supabase/functions/diretoria-checkout-status/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/diretoria-asaas-webhook/index.ts','utf8');
const club = fs.readFileSync('apps/public-hml/club.js','utf8');

function requireText(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`ASAAS_EDGE_REQUIRED:${label}`);
}
function forbid(text, needle, label) {
  if (text.includes(needle)) throw new Error(`ASAAS_EDGE_FORBIDDEN:${label}`);
}

// Member API remains the account/offer/intent boundary and explicitly closes V2 orchestration.
requireText(member, "legacyPaymentRoutes:'disabled'", 'legacy payment routes disabled');
requireText(member, "orchestration:'dedicated_v3'", 'dedicated V3 orchestration');
requireText(member, 'CHECKOUT_ORCHESTRATION_MOVED_TO_V3', 'legacy route tombstone');
requireText(member, "Deno.env.get('ASAAS_ACCESS_TOKEN')", 'member runtime detects Asaas configuration server-side');
requireText(member, 'privacy_policy', 'three-document checkout policy declaration');
forbid(member, 'quoteAsaasPassThrough', 'quote no longer belongs in member API');
forbid(member, 'AsaasPaymentAdapter', 'provider adapter no longer belongs in member API');
forbid(member, 'policyCore().accept', 'policy acceptance no longer belongs in member API');

// Dedicated checkout API owns quote/start and the anti-duplication guard.
requireText(checkout, "Deno.env.get('ASAAS_ACCESS_TOKEN')", 'server-side Asaas access token');
requireText(checkout, 'quoteAsaasPassThrough', 'fee pass-through quote');
requireText(checkout, 'getAccountFees()', 'account fee lookup');
requireText(checkout, "installments!==1", 'card one-installment HML gate');
requireText(checkout, 'startGuard().claim', 'transactional start lock');
requireText(checkout, 'recordProviderSession', 'provider session persisted before bind');
requireText(checkout, 'CHECKOUT_CONSENT_REQUIRED', 'terms/privacy consent gate');
requireText(checkout, 'policyCore().assertAccepted', 'policy acceptance gate before checkout');
requireText(checkout, 'CHECKOUT_RECONCILIATION_REQUIRED', 'uncertain create goes to reconciliation');
requireText(hosted, "environment!=='sandbox'", 'hosted client is sandbox-only');
requireText(hosted, '/checkoutSession/show/', 'canonical Asaas checkout URL');
const productionAsaasApi = 'https://api.' + 'asaas.com';
forbid(hosted, productionAsaasApi, 'production Asaas endpoint in HML hosted checkout');

// Policy API owns the complete bundle and atomic acceptance mirrors.
requireText(policy, "['club_terms','non_achievement_policy','privacy_policy']", 'three required policies');
requireText(policy, 'acceptanceGuard().accept', 'atomic policy acceptance guard');
requireText(policy, 'activeConsentIdempotency', 'consent idempotency feature');
requireText(policy, 'acceptanceAtomic:true', 'atomic acceptance feature');

// Status endpoint is read-only backend authority.
requireText(status, "authority:'backend_only'", 'backend-only checkout status');
requireText(status, 'left join payments', 'status reads payment');
requireText(status, 'left join credits', 'status reads credit');

// Browser is wired only to the dedicated V3 APIs and validates sandbox redirects.
requireText(club, 'diretoria-asaas-checkout-api', 'Club uses dedicated checkout API');
requireText(club, 'diretoria-checkout-policy-api', 'Club uses dedicated policy API');
requireText(club, 'diretoria-checkout-status', 'Club uses read-only status API');
requireText(club, 'assertSandboxCheckoutUrl', 'Club validates sandbox checkout URL');
requireText(club, 'location.assign(url.href)', 'Club redirects only after validated backend checkout');
forbid(club, 'cardNumber', 'browser card number handling');
forbid(club, 'securityCode', 'browser security code handling');
forbid(club, 'cvv', 'browser CVV handling');

// Webhook stays the authority for financial effects and supports hosted Checkout + Payment events.
requireText(webhook, 'verifyAsaasCheckoutWebhook', 'Checkout webhook verification');
requireText(webhook, 'verifyAsaasPaymentWebhookEnvelope', 'Payment webhook verification');
requireText(webhook, 'processVerifiedWithBindingRecovery', 'binding recovery');
requireText(webhook, 'processVerifiedWebhook', 'transactional financial core');
requireText(webhook, 'ASAAS_WEBHOOK_TOKEN_INVALID', 'invalid webhook token rejection');
requireText(webhook, 'new Uint8Array(await req.arrayBuffer())', 'raw body verification');
requireText(webhook, 'PAYMENT_PARTIALLY_REFUNDED', 'partial refund reconciliation');
requireText(webhook, 'PAYMENT_REFUND_IN_PROGRESS', 'refund in-progress tracking');
requireText(webhook, 'PAYMENT_REFUND_DENIED', 'refund denied tracking');
requireText(webhook, 'PAYMENT_PROVIDER_UNCONFIGURED', 'webhook fail closed');

for (const [text,label] of [[member,'member'],[checkout,'checkout'],[policy,'policy'],[status,'status'],[webhook,'webhook'],[club,'club']]) {
  forbid(text, '$aact_', `${label} literal Asaas access token`);
  forbid(text, 'whsec_', `${label} literal webhook token`);
  forbid(text, 'service_role', `${label} service-role literal`);
}

console.log('OK: Asaas HML V3 separates member/policy/checkout/status/webhook authority and remains sandbox/fail-closed.');
