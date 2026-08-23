import fs from 'node:fs';

const member = fs.readFileSync('supabase/functions/diretoria-member-api/index.ts','utf8');
const checkout = fs.readFileSync('supabase/functions/diretoria-asaas-checkout-api/index.ts','utf8');
const policy = fs.readFileSync('supabase/functions/diretoria-checkout-policy-api/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/diretoria-asaas-webhook/index.ts','utf8');
const club = fs.readFileSync('apps/public-hml/club.js','utf8');
const flow = fs.readFileSync('apps/public-hml/club-flow.js','utf8');

function requireText(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`ASAAS_EDGE_REQUIRED:${label}`);
}
function forbid(text, needle, label) {
  if (text.includes(needle)) throw new Error(`ASAAS_EDGE_FORBIDDEN:${label}`);
}

// Member API V3 mantém identidade/oferta/intenção, mas não orquestra dinheiro.
requireText(member, "legacyPaymentRoutes:'disabled'", 'legacy payment routes disabled');
requireText(member, "orchestration:'dedicated_v3'", 'dedicated V3 orchestration');
requireText(member, 'privacy_policy', 'privacy policy gate exposed');
requireText(member, 'CHECKOUT_ORCHESTRATION_MOVED_TO_V3', 'legacy orchestration returns gone');
forbid(member, 'quoteAsaasPassThrough', 'quote removed from member API');
forbid(member, 'AsaasPaymentAdapter', 'Asaas adapter removed from member API');

// Checkout API assume quote/start e mantém Sandbox fail-closed.
requireText(checkout, "Deno.env.get('ASAAS_ACCESS_TOKEN')", 'server side access token');
requireText(checkout, "installments!==1", 'card one installment HML gate');
requireText(checkout, 'quoteAsaasPassThrough', 'fee pass-through quote');
requireText(checkout, 'startGuard().claim', 'transactional start guard');
requireText(checkout, 'recordProviderSession', 'provider session persistence before bind');
requireText(checkout, 'CHECKOUT_RECONCILIATION_REQUIRED', 'uncertain create reconciliation');
requireText(checkout, "requiredCodes:REQUIRED_POLICIES", 'three-policy gate before start');
requireText(checkout, "consent_type", 'terms/privacy consent mirror check');

// Policy API é a única rota pública de bundle/aceite V3.
requireText(policy, "['club_terms','non_achievement_policy','privacy_policy']", 'three required policies');
requireText(policy, "acceptanceGuard().accept", 'atomic policy acceptance guard');
requireText(policy, "activeConsentIdempotency:'0025'", 'consent idempotency migration contract');

// Browser usa exclusivamente APIs V3 e só redireciona ao host Sandbox validado.
requireText(club, 'diretoria-checkout-policy-api', 'Club uses policy V3 API');
requireText(club, 'diretoria-asaas-checkout-api', 'Club uses checkout V3 API');
requireText(club, 'diretoria-checkout-status', 'Club reads backend status');
requireText(club, 'assertSandboxCheckoutUrl', 'Club validates Sandbox redirect');
requireText(flow, 'sandbox.asaas.com', 'Sandbox host allowlist');
requireText(flow, 'privacy_policy', 'privacy document required in UI');

// Webhook externo continua autenticado pelo token próprio e cobre Checkout + Payment.
requireText(webhook, "Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')", 'server side webhook token');
requireText(webhook, 'verifyAsaasCheckoutWebhook', 'Checkout webhook verification');
requireText(webhook, 'verifyAsaasPaymentWebhookEnvelope', 'Payment webhook verification');
requireText(webhook, 'processVerifiedWebhook', 'transactional payment core');
requireText(webhook, "new Uint8Array(await req.arrayBuffer())", 'raw body verification');
requireText(webhook, 'bindingRecovery', 'binding recovery health contract');
requireText(webhook, 'refundLifecycleTracking', 'refund lifecycle health contract');
requireText(webhook, "pixConfirmedPolicy:'wait_for_received'", 'Pix confirmed is not final');

for (const source of [member, checkout, policy, webhook, club, flow]) {
  forbid(source, '$aact_', 'literal Asaas access token');
  forbid(source, 'whsec_', 'literal webhook secret');
}
forbid(club, 'cardNumber', 'card number in frontend');
forbid(club, 'cvv', 'CVV in frontend');
forbid(webhook, 'service_role', 'service role secret');

console.log('OK: Asaas HML V3 is split, fail-closed, policy/consent-gated, Sandbox-only in browser and webhook-authoritative.');
