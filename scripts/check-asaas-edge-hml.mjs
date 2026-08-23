import fs from 'node:fs';

const member = fs.readFileSync('supabase/functions/diretoria-member-api/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/diretoria-asaas-webhook/index.ts','utf8');
const club = fs.readFileSync('apps/public-hml/club.js','utf8');

function requireText(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`ASAAS_EDGE_REQUIRED:${label}`);
}
function forbid(text, needle, label) {
  if (text.includes(needle)) throw new Error(`ASAAS_EDGE_FORBIDDEN:${label}`);
}

requireText(member, "Deno.env.get('ASAAS_ACCESS_TOKEN')", 'server side access token');
requireText(member, "Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')", 'server side webhook token');
requireText(member, "installments !== 1", 'card one installment HML gate');
requireText(member, "REQUIRED_CHECKOUT_POLICIES", 'policy gate');
requireText(member, "path === '/checkout-policies'", 'active policy bundle route');
requireText(member, "path === '/checkout-policies/accept'", 'policy acceptance route');
requireText(member, "policyCore().accept", 'append-only policy acceptance');
requireText(member, "POLICY_BUNDLE_STALE", 'stale policy bundle rejection');
requireText(member, ".select('id,content')", 'active policy content retrieval');
requireText(member, "checkoutProvider: configured ? 'asaas-sandbox' : 'asaas-sandbox-unconfigured'", 'dynamic Asaas offer state');
requireText(member, "markCheckoutReconciliationRequired", 'reconciliation on uncertain create');
requireText(member, "adapter.getAccountFees()", 'account fee quote');
requireText(member, "quoteAsaasPassThrough", 'fee pass-through quote');
requireText(member, "allowedMethods: [intent.payment_method]", 'single method hosted checkout');
requireText(member, "PAYMENT_PROVIDER_UNCONFIGURED", 'fail closed without secrets');

requireText(club, "memberApi('/checkout-policies')", 'Club loads active policies');
requireText(club, "memberApi('/checkout-policies/accept'", 'Club records policy acceptance');
requireText(club, "/quote`,{method:'POST'", 'Club requests fee quote');
requireText(club, "/start`,{method:'POST'", 'Club starts hosted checkout');
requireText(club, "location.assign(target.href)", 'Club redirects only after backend checkout');

requireText(webhook, "verifyAndNormalizeWebhook", 'provider webhook verification');
requireText(webhook, "processVerifiedWebhook", 'transactional webhook core');
requireText(webhook, "ASAAS_WEBHOOK_TOKEN_INVALID", 'invalid token rejection');
requireText(webhook, "new Uint8Array(await req.arrayBuffer())", 'raw body verification');
requireText(webhook, "PAYMENT_PROVIDER_UNCONFIGURED", 'webhook fail closed');

forbid(member, 'accessToken:', 'literal access token in source');
forbid(member, 'webhookAuthToken:', 'literal webhook token in source');
forbid(webhook, "'asaas-access-token':", 'hardcoded webhook header value');
forbid(webhook, 'service_role', 'service role secret');

console.log('OK: Asaas HML edge is fail-closed, policy-gated, UI-wired and keeps secrets server-side.');
