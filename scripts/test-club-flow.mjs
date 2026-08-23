import assert from 'node:assert/strict';
import {assertSandboxCheckoutUrl,friendly,policyBundleValid,stage,statusText} from '../apps/public-hml/club-flow.js';
const docs=[
{id:'11111111-1111-4111-8111-111111111111',code:'club_terms',version:1,title:'Termos',content:'conteúdo aprovado',contentHash:'a'.repeat(64)},
{id:'22222222-2222-4222-8222-222222222222',code:'non_achievement_policy',version:1,title:'Não atingimento',content:'conteúdo aprovado',contentHash:'b'.repeat(64)},
{id:'33333333-3333-4333-8333-333333333333',code:'privacy_policy',version:1,title:'Privacidade',content:'conteúdo aprovado',contentHash:'c'.repeat(64)},
];
const bundle={fingerprint:'d'.repeat(64),documents:docs};
assert.equal(assertSandboxCheckoutUrl('https://sandbox.asaas.com/checkoutSession/show/abc').hostname,'sandbox.asaas.com');assert.equal(assertSandboxCheckoutUrl('https://sandbox.asaas.com/checkoutSession/show?id=abc').hostname,'sandbox.asaas.com');
for(const invalid of ['http://sandbox.asaas.com/a','https://asaas.com/a','https://evil.example/a','javascript:alert(1)',''])assert.throws(()=>assertSandboxCheckoutUrl(invalid),/CHECKOUT_REDIRECT_URL_INVALID/);
assert.equal(policyBundleValid(bundle),true);
assert.equal(policyBundleValid({...bundle,documents:docs.slice(0,2)}),false);
assert.equal(policyBundleValid({...bundle,documents:[...docs.slice(0,2),{...docs[2],code:'other'}]}),false);
assert.equal(stage({status:'draft'}),'draft');
assert.equal(stage({status:'ready'}),'ready');
assert.equal(stage({status:'pending',payment:{status:'pending'}}),'pending');
assert.equal(stage({status:'pending',payment:{status:'paid'},credit:{status:'valid'}}),'credited');
assert.equal(stage({status:'pending',payment:{status:'refunded'},credit:{status:'refunded'}}),'reversed');
assert.match(statusText({payment:{status:'paid'},credit:{status:'valid',gross_value:'150.00',protected_value:'140.00'}},'BRL').text,/R\$\s*150,00/);
assert.match(friendly('POLICY_ACTIVE_DOCUMENT_REQUIRED:privacy_policy'),/políticas ativas/i);
assert.match(friendly('CHECKOUT_RECONCILIATION_REQUIRED:ASAAS_REQUEST_TIMEOUT'),/reconciliação/i);
console.log('OK: club-flow local invariants com privacy gate');

assert.match(friendly('CHECKOUT_START_ALREADY_IN_PROGRESS'),/já está sendo criado/);assert.match(friendly('CHECKOUT_QUOTE_ALREADY_FROZEN'),/já foi congelada/);

assert.match(friendly('CHECKOUT_PAYMENT_ALREADY_FINAL:paid'),/já foi finalizado/);
