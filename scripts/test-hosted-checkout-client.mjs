import assert from 'node:assert/strict';
import { AsaasHostedCheckoutClient } from '../supabase/functions/diretoria-asaas-checkout-api/hosted-checkout.ts';
function reply(body,status=200){return Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));}
const base={checkoutIntentId:'11111111-1111-4111-8111-111111111111',amountMinor:15513n,currencyCode:'BRL',eventReference:'evt',paymentMethod:'pix',returnUrl:'https://diretoria-public-hml.vercel.app/club.html?intent=x',cancelUrl:'https://diretoria-public-hml.vercel.app/club.html?result=cancel',expiredUrl:'https://diretoria-public-hml.vercel.app/club.html?result=expired'};
let posted;
const noLink=new AsaasHostedCheckoutClient({environment:'sandbox',accessToken:'test',fetchImpl:async(url,init)=>{posted=JSON.parse(String(init?.body));return reply({id:'chk_123'});}});
const a=await noLink.createCheckout(base);assert.equal(a.providerSessionId,'chk_123');assert.equal(new URL(a.redirectUrl).hostname,'sandbox.asaas.com');assert.equal(new URL(a.redirectUrl).pathname,'/checkoutSession/show/chk_123');assert.equal(new URL(a.redirectUrl).search,'');assert.equal(posted.externalReference,base.checkoutIntentId);assert.deepEqual(posted.billingTypes,['PIX']);
const withLink=new AsaasHostedCheckoutClient({environment:'sandbox',accessToken:'test',fetchImpl:()=>reply({id:'chk_456',link:'https://sandbox.asaas.com/checkoutSession/show?id=chk_456',status:'ACTIVE'})});
assert.equal((await withLink.createCheckout({...base,paymentMethod:'card'})).providerSessionId,'chk_456');
const evil=new AsaasHostedCheckoutClient({environment:'sandbox',accessToken:'test',fetchImpl:()=>reply({id:'chk_evil',link:'https://example.com/pay'})});await assert.rejects(()=>evil.createCheckout(base),/HOST_INVALID/);
console.log('OK: hosted checkout aceita resposta id-only e mantém host sandbox');

await assert.rejects(()=>new AsaasHostedCheckoutClient({environment:'sandbox',accessToken:'x',fetchImpl:()=>Promise.resolve(new Response(JSON.stringify({id:'bad-port',link:'https://sandbox.asaas.com:444/checkoutSession/show/bad-port',status:'ACTIVE'}),{status:200}))}).createCheckout({checkoutIntentId:'11111111-1111-4111-8111-111111111111',amountMinor:15513n,currencyCode:'BRL',eventReference:'evt',paymentMethod:'pix',returnUrl:'https://example.com/ok',cancelUrl:'https://example.com/cancel',expiredUrl:'https://example.com/expired'}),/ASAAS_CHECKOUT_LINK_HOST_INVALID/);
await assert.rejects(()=>new AsaasHostedCheckoutClient({environment:'sandbox',accessToken:'x',fetchImpl:()=>Promise.resolve(new Response(JSON.stringify({id:'bad-path',link:'https://sandbox.asaas.com/checkoutSession/other/bad-path',status:'ACTIVE'}),{status:200}))}).createCheckout({checkoutIntentId:'11111111-1111-4111-8111-111111111111',amountMinor:15513n,currencyCode:'BRL',eventReference:'evt',paymentMethod:'pix',returnUrl:'https://example.com/ok',cancelUrl:'https://example.com/cancel',expiredUrl:'https://example.com/expired'}),/ASAAS_CHECKOUT_LINK_HOST_INVALID/);

assert.throws(()=>new AsaasHostedCheckoutClient({environment:'production',accessToken:'x'}),/ASAAS_HML_SANDBOX_ONLY/);
