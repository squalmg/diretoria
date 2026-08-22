import fs from 'node:fs';

const member = fs.readFileSync('supabase/functions/diretoria-member-api/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/diretoria-asaas-webhook/index.ts','utf8');

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
requireText(member, "markCheckoutReconciliationRequired", 'reconciliation on uncertain create');
requireText(member, "adapter.getAccountFees()", 'account fee quote');
requireText(member, "quoteAsaasPassThrough", 'fee pass-through quote');
requireText(member, "allowedMethods: [intent.payment_method]", 'single method hosted checkout');
requireText(member, "PAYMENT_PROVIDER_UNCONFIGURED", 'fail closed without secrets');

requireText(webhook, "verifyAndNormalizeWebhook", 'provider webhook verification');
requireText(webhook, "processVerifiedWebhook", 'transactional webhook core');
requireText(webhook, "ASAAS_WEBHOOK_TOKEN_INVALID", 'invalid token rejection');
requireText(webhook, "new Uint8Array(await req.arrayBuffer())", 'raw body verification');
requireText(webhook, "PAYMENT_PROVIDER_UNCONFIGURED", 'webhook fail closed');

forbid(member, 'accessToken:', 'literal access token in source');
forbid(member, 'webhookAuthToken:', 'literal webhook token in source');
forbid(webhook, "'asaas-access-token':", 'hardcoded webhook header value');
forbid(webhook, 'service_role', 'service role secret');

console.log('OK: Asaas HML edge is fail-closed, policy-gated and keeps secrets server-side.');
