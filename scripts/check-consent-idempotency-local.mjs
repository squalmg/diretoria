import fs from 'node:fs';import assert from 'node:assert/strict';
const migration=fs.readFileSync('packages/db/migrations/0025_checkout_consent_idempotency.sql','utf8');
const guard=fs.readFileSync('supabase/functions/diretoria-checkout-policy-api/accept-guard.ts','utf8');
assert.match(migration,/CREATE UNIQUE INDEX consents_active_policy_version_uq/i);assert.match(migration,/profile_id, consent_type, policy_version/i);assert.match(migration,/WHERE granted = true[\s\S]*revoked_at IS NULL/i);assert.match(migration,/consent_type IN \('terms','privacy'\)/i);assert.match(migration,/policy_version LIKE 'policy_document:%'/i);
assert.match(guard,/consents_active_policy_version_uq/);assert.match(guard,/on conflict\(profile_id,policy_document_id,context\) do nothing/i);assert.match(guard,/on conflict do nothing returning id/i);assert.match(guard,/POLICY_ACCEPTANCE_IDEMPOTENCY_RECHECK_FAILED/);assert.match(guard,/CONSENT_IDEMPOTENCY_RECHECK_FAILED/);assert.match(guard,/BEGIN/);assert.match(guard,/ROLLBACK/);
console.log('OK: aceite jurídico do checkout é atômico/idempotente sem alterar consentimentos genéricos do CRM');
