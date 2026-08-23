import assert from 'node:assert/strict';
import { checkoutSessionContainsPayment, fetchAsaasPaymentById, fetchPaymentForCheckout, normalizePaymentWebhookEvent, paymentEnvelopeToVerifiedWebhook, verifyAsaasCheckoutWebhook, verifyAsaasPaymentWebhookEnvelope } from '../packages/payments/asaas-checkout-webhook.ts';
const token='x'.repeat(40);
const checkoutPayload={id:'evt_checkout_1',event:'CHECKOUT_PAID',dateCreated:'2026-08-23T12:00:00Z',checkout:{id:'chk_1',status:'PAID',externalReference:'11111111-1111-4111-8111-111111111111'}};
const rawBody=new TextEncoder().encode(JSON.stringify(checkoutPayload));
const verified=await verifyAsaasCheckoutWebhook({headers:{'asaas-access-token':token},rawBody,receivedAt:'2026-08-23T12:00:01Z'},token);
assert.equal(verified.eventType,'paid'); assert.equal(verified.checkoutSessionId,'chk_1'); assert.equal(verified.externalReference,'11111111-1111-4111-8111-111111111111');
await assert.rejects(()=>verifyAsaasCheckoutWebhook({headers:{'asaas-access-token':'wrong'},rawBody,receivedAt:'x'},token),/ASAAS_WEBHOOK_TOKEN_INVALID/);
assert.equal(normalizePaymentWebhookEvent('PAYMENT_CONFIRMED','PIX'),'pending');
assert.equal(normalizePaymentWebhookEvent('PAYMENT_CONFIRMED','CREDIT_CARD'),null);
function response(body,status=200){return Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));}

const paymentPayloadNoRef={id:'evt_payment_1',event:'PAYMENT_RECEIVED',dateCreated:'2026-08-23T12:01:00Z',payment:{id:'pay_no_ref'}};
const paymentRaw=new TextEncoder().encode(JSON.stringify(paymentPayloadNoRef));
const envelope=await verifyAsaasPaymentWebhookEnvelope({headers:{'asaas-access-token':token},rawBody:paymentRaw,receivedAt:'2026-08-23T12:01:01Z'},token);
assert.equal(envelope.providerPaymentId,'pay_no_ref');assert.equal(envelope.externalReference,null);assert.equal(envelope.eventName,'PAYMENT_RECEIVED');
for(const refundEvent of ['PAYMENT_REFUND_IN_PROGRESS','PAYMENT_REFUND_DENIED']){const refundRaw=new TextEncoder().encode(JSON.stringify({id:`evt_${refundEvent.toLowerCase()}`,event:refundEvent,payment:{id:'pay_no_ref'}}));const refundEnvelope=await verifyAsaasPaymentWebhookEnvelope({headers:{'asaas-access-token':token},rawBody:refundRaw,receivedAt:'2026-08-23T12:02:00Z'},token);assert.equal(refundEnvelope.eventName,refundEvent);assert.equal(refundEnvelope.providerPaymentId,'pay_no_ref');}
const resource=await fetchAsaasPaymentById({environment:'sandbox',accessToken:'access',providerPaymentId:'pay_no_ref',fetchImpl:()=>response({id:'pay_no_ref',billingType:'PIX',value:155.13,netValue:150,status:'RECEIVED'})});
const rebuilt=paymentEnvelopeToVerifiedWebhook(envelope,resource,'11111111-1111-4111-8111-111111111111');assert.equal(rebuilt.eventType,'paid');assert.equal(rebuilt.feeMinor,513n);
assert.equal(await checkoutSessionContainsPayment({environment:'sandbox',accessToken:'access',checkoutSessionId:'chk_1',providerPaymentId:'pay_no_ref',fetchImpl:()=>response({data:[{id:'pay_no_ref'}]})}),true);
assert.equal(await checkoutSessionContainsPayment({environment:'sandbox',accessToken:'access',checkoutSessionId:'chk_1',providerPaymentId:'pay_missing',fetchImpl:()=>response({data:[{id:'pay_no_ref'}]})}),false);
const common={environment:'sandbox',accessToken:'access',checkoutSessionId:'chk_1',checkoutIntentId:'11111111-1111-4111-8111-111111111111',expectedAmountMinor:15513n,providerEventId:'evt_checkout_1',occurredAt:'2026-08-23T12:00:00Z',rawPayloadHash:'a'.repeat(64)};
let requested='';
const pix=await fetchPaymentForCheckout({...common,expectedMethod:'pix',fetchImpl:(url)=>{requested=String(url);return response({data:[{id:'pay_1',billingType:'PIX',value:155.13,netValue:150,status:'RECEIVED'}]});}});
assert.match(requested,/checkoutSession=chk_1/); assert.equal(pix.eventType,'paid'); assert.equal(pix.feeMinor,513n); assert.equal(pix.providerPaymentId,'pay_1');
const pixConfirmed=await fetchPaymentForCheckout({...common,expectedMethod:'pix',fetchImpl:()=>response({data:[{id:'pay_2',billingType:'PIX',value:155.13,netValue:150,status:'CONFIRMED'}]})});
assert.equal(pixConfirmed.eventType,'pending');
const card=await fetchPaymentForCheckout({...common,expectedMethod:'card',fetchImpl:()=>response({data:[{id:'pay_3',billingType:'CREDIT_CARD',value:155.13,netValue:150,status:'CONFIRMED'}]})});
assert.equal(card.eventType,'paid');
await assert.rejects(()=>fetchPaymentForCheckout({...common,expectedMethod:'pix',fetchImpl:()=>response({data:[{id:'pay_partial',billingType:'PIX',value:155.13,netValue:150,status:'PARTIALLY_REFUNDED'}]})}),/PARTIAL_REFUND_RECONCILIATION_REQUIRED/);
await assert.rejects(()=>fetchPaymentForCheckout({...common,expectedMethod:'pix',fetchImpl:()=>response({data:[{id:'pay_4',billingType:'PIX',value:155.13,status:'RECEIVED'}]})}),/NET_VALUE_REQUIRED/);
await assert.rejects(()=>fetchPaymentForCheckout({...common,expectedMethod:'pix',fetchImpl:()=>response({data:[{id:'a',billingType:'PIX',value:155.13,netValue:150,status:'RECEIVED'},{id:'b',billingType:'PIX',value:155.13,netValue:150,status:'RECEIVED'}]})}),/AMBIGUOUS/);
console.log('OK: Asaas hosted Checkout webhook reconciliation');

await assert.rejects(()=>fetchAsaasPaymentById({environment:'production',accessToken:'x',providerPaymentId:'p'}),/ASAAS_HML_SANDBOX_ONLY/);
