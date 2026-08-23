import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync('supabase/functions/diretoria-asaas-checkout-api/start-guard.ts','utf8');
const api=fs.readFileSync('supabase/functions/diretoria-asaas-checkout-api/index.ts','utf8');

for(const [needle,label] of [
  ["for update of ci",'row lock'],
  ["reconciliation_status='pending'",'claim before provider call'],
  ["CHECKOUT_START_ALREADY_IN_PROGRESS",'concurrent start rejection'],
  ["CHECKOUT_RECONCILIATION_REQUIRED",'required reconciliation gate'],
  ["releaseDefinitiveFailure",'definitive failure release'],
  ["requireReconciliation",'uncertain failure lock'],
]) assert.ok(guard.includes(needle),`missing ${label}`);

assert.ok(api.includes("const claim=await startGuard().claim(auth.subject,intent.id)"),'start must claim before remote checkout');
const claimIndex=api.indexOf("const claim=await startGuard().claim(auth.subject,intent.id)");
const createIndex=api.indexOf("created=await asaasClient().createCheckout");
assert.ok(claimIndex>=0&&createIndex>claimIndex,'claim must happen before Asaas createCheckout');
assert.ok(api.includes("await startGuard().requireReconciliation(intent.id,info.code)"),'uncertain provider errors require reconciliation');
assert.ok(api.includes("await startGuard().releaseDefinitiveFailure(intent.id,info.code)"),'definitive provider errors release claim');
assert.ok(api.includes("await startGuard().requireReconciliation(intent.id,'CHECKOUT_BIND_FAILED')"),'bind failure requires reconciliation');
assert.ok(api.includes("status===408||status===409||status===425||status===429||status>=500"),'uncertain HTTP classification must cover retry-risk statuses');

assert.ok(guard.includes('recordProviderSession'),'external checkout session must be persisted before binding');
const persistIndex=api.indexOf("await startGuard().recordProviderSession(intent.id,created.providerSessionId,created.expiresAt)");
const bindIndex=api.indexOf("await providerCore().bindCheckout");
assert.ok(persistIndex>createIndex&&bindIndex>persistIndex,'provider session must be persisted after Asaas create and before full bind');
assert.ok(api.includes("CHECKOUT_SESSION_PERSIST_FAILED"),'session persistence failure must require reconciliation');

console.log('OK: checkout start guard claims before provider call and separates definitive vs uncertain failure');

assert.ok(api.includes("code.includes('IN_PROGRESS')")&&api.includes("code.includes('CONFLICT')")&&api.includes("code.includes('NOT_STARTABLE')"),'start concurrency/state conflicts must map to HTTP 409');
