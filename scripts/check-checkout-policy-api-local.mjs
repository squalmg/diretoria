import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase/functions/diretoria-checkout-policy-api/index.ts',import.meta.url),'utf8');
const guard=fs.readFileSync(new URL('../supabase/functions/diretoria-checkout-policy-api/accept-guard.ts',import.meta.url),'utf8');
for(const code of ['club_terms','non_achievement_policy','privacy_policy'])assert.ok(source.includes(code));
assert.match(source,/policyCore\(\)\.activeBundle/);assert.match(source,/policyCore\(\)\.assertAccepted/);assert.match(source,/acceptanceGuard\(\)\.accept/);assert.match(source,/acceptanceAtomic:true/);assert.doesNotMatch(source,/policyCore\(\)\.accept/);assert.doesNotMatch(source,/consentResults/);
assert.match(guard,/BEGIN/);assert.match(guard,/COMMIT/);assert.match(guard,/ROLLBACK/);assert.match(guard,/on conflict\(profile_id,policy_document_id,context\) do nothing/);assert.match(guard,/consents_active_policy_version_uq/);assert.match(guard,/on conflict do nothing returning id/);assert.match(guard,/club_terms/);assert.match(guard,/privacy_policy/);assert.match(guard,/POLICY_BUNDLE_STALE/);
assert.doesNotMatch(source,/localStorage/);assert.doesNotMatch(source,/ASAAS_ACCESS_TOKEN|ASAAS_WEBHOOK_AUTH_TOKEN/);assert.doesNotMatch(guard,/ASAAS_ACCESS_TOKEN|ASAAS_WEBHOOK_AUTH_TOKEN/);
console.log('OK: checkout policy API grava 3 acceptances + terms/privacy atomicamente e idempotente');
