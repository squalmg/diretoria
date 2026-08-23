import { PostgresProviderPaymentCore } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/provider-payment-core.ts';
import { checkoutSessionContainsPayment, fetchAsaasPaymentById, fetchPaymentForCheckout, paymentEnvelopeToVerifiedWebhook, verifyAsaasCheckoutWebhook, verifyAsaasPaymentWebhookEnvelope } from './checkout-support.ts';
import { PostgresAsaasCheckoutReconciliation } from './checkout-reconciliation.ts';

const PUBLIC_HML_ORIGIN = 'https://diretoria-public-hml.vercel.app';
let coreInstance: PostgresProviderPaymentCore | null = null;
let checkoutReconciliationInstance: PostgresAsaasCheckoutReconciliation | null = null;
function databaseUrl(): string { const value = String(Deno.env.get('SUPABASE_DB_URL') ?? '').trim(); if (!value) throw new Error('SUPABASE_DB_URL_REQUIRED'); return value; }
function accessToken(): string { const value = String(Deno.env.get('ASAAS_ACCESS_TOKEN') ?? '').trim(); if (!value) throw new Error('PAYMENT_PROVIDER_UNCONFIGURED'); return value; }
function webhookToken(): string { const value = String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN') ?? '').trim(); if (!value) throw new Error('PAYMENT_PROVIDER_UNCONFIGURED'); return value; }
function core(): PostgresProviderPaymentCore { if (!coreInstance) coreInstance = new PostgresProviderPaymentCore(databaseUrl()); return coreInstance; }
function checkoutReconciliation(): PostgresAsaasCheckoutReconciliation { if (!checkoutReconciliationInstance) checkoutReconciliationInstance = new PostgresAsaasCheckoutReconciliation(databaseUrl()); return checkoutReconciliationInstance; }
function headersRecord(headers: Headers): Record<string,string> { const out: Record<string,string> = {}; headers.forEach((value,key)=>{out[key]=value;}); return out; }
function response(body: unknown, status=200): Response { return Response.json(body,{status,headers:{'Cache-Control':'no-store'}}); }
function moneyToMinor(value: unknown): bigint { const text=String(value??'').trim(); const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(text); if(!match)throw new Error('MONEY_VALUE_INVALID'); return BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0')); }
function eventHint(rawBody: Uint8Array): { event: string; billingType: string; providerEventId: string; providerPaymentId: string } { try { const body=JSON.parse(new TextDecoder().decode(rawBody)); return {event:String(body?.event??'').toUpperCase(),billingType:String(body?.payment?.billingType??'').toUpperCase(),providerEventId:String(body?.id??'').trim(),providerPaymentId:String(body?.payment?.id??'').trim()}; } catch { return {event:'',billingType:'',providerEventId:'',providerPaymentId:''}; } }
function safeCode(error: unknown): string { const raw=error instanceof Error?error.message:'UNKNOWN_ERROR'; return raw.split(':')[0].replace(/[^A-Z0-9_]/gi,'_').toUpperCase()||'UNKNOWN_ERROR'; }

function isUuid(value:string|null):boolean{return Boolean(value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));}
function providerMethod(value:unknown):'pix'|'card'{const type=String(value??'').toUpperCase();if(type==='PIX')return'pix';if(type==='CREDIT_CARD')return'card';throw new Error('ASAAS_CHECKOUT_PAYMENT_METHOD_UNSUPPORTED');}
function providerMoney(value:unknown):string{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error('ASAAS_WEBHOOK_VALUE_INVALID');return number.toFixed(2);}
async function resolveIntentForProviderPayment(envelope:{providerPaymentId:string;externalReference:string|null},payment:any):Promise<string>{
  if(isUuid(envelope.externalReference))return envelope.externalReference!;
  const resourceExternalReference=String(payment?.externalReference??'').trim()||null;if(isUuid(resourceExternalReference))return resourceExternalReference!;
  try{return (await checkoutReconciliation().findIntentByProviderPaymentId(envelope.providerPaymentId)).id;}
  catch(error){if(safeCode(error)!=='PAYMENT_PROVIDER_ID_NOT_FOUND')throw error;}
  const method=providerMethod(payment?.billingType),amount=providerMoney(payment?.value);
  const candidates=await checkoutReconciliation().findUnboundCandidates(amount,method);const matches=[];
  for(const candidate of candidates){if(await checkoutSessionContainsPayment({environment:'sandbox',accessToken:accessToken(),checkoutSessionId:candidate.providerSessionId,providerPaymentId:envelope.providerPaymentId}))matches.push(candidate);}
  if(matches.length!==1)throw new Error(matches.length?'PAYMENT_CHECKOUT_SESSION_AMBIGUOUS':'PAYMENT_CHECKOUT_SESSION_NOT_FOUND');
  return matches[0].id;
}

const PERMANENT_FINANCIAL_RECONCILIATION=new Set(['PAYMENT_WEBHOOK_CURRENCY_MISMATCH','PAYMENT_WEBHOOK_AMOUNT_MISMATCH','PAYMENT_WEBHOOK_METHOD_MISMATCH','PAYMENT_PROVIDER_ID_CONFLICT','ASAAS_ACTUAL_FEE_EXCEEDS_PASSTHROUGH','PAYMENT_FAILURE_AFTER_FINAL_STATE','PAYMENT_STATUS_NOT_CONFIRMABLE','PAYMENT_REVERSAL_WITHOUT_PAID','VALID_CREDIT_NOT_FOUND','PAID_PAYMENT_WITHOUT_CREDIT','CHECKOUT_PROVIDER_MISMATCH','PAYMENT_PROTECTED_CONTRIBUTION_INVALID','PAYMENT_FEE_PASS_THROUGH_REQUIRED']);
async function processVerifiedWithBindingRecovery(verified:any){
  try{
    try{return{result:await core().processVerifiedWebhook(verified),reconciliation:null};}
    catch(error){if(safeCode(error)!=='CHECKOUT_PAYMENT_NOT_FOUND')throw error;await checkoutReconciliation().ensurePendingPayment(verified.checkoutIntentId);return{result:await core().processVerifiedWebhook(verified),reconciliation:null};}
  }catch(error){
    const code=safeCode(error);if(!PERMANENT_FINANCIAL_RECONCILIATION.has(code))throw error;
    const tracked=await checkoutReconciliation().recordVerifiedPaymentReconciliation({providerEventId:verified.providerEventId,providerPaymentId:verified.providerPaymentId,checkoutIntentId:verified.checkoutIntentId,rawPayloadHash:verified.rawPayloadHash,code});
    return{result:null,reconciliation:{...tracked,code}};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') { const configured=Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN')??'').trim()&&String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')??'').trim()); return response({ok:true,service:'diretoria-asaas-webhook',environment:'hml',provider:'asaas-sandbox',configured,checkoutEvents:true,pixConfirmedPolicy:'wait_for_received',build:'asaas-hml-v3-20260823',features:{paymentExternalReferenceOptional:true,bindingRecovery:true,partialRefundReconciliation:true,refundLifecycleTracking:true}}); }
  if (req.method !== 'POST') return response({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  let rawBody: Uint8Array; try { rawBody=new Uint8Array(await req.arrayBuffer()); } catch { return response({ok:false,code:'WEBHOOK_BODY_READ_FAILED'},400); }
  if (!rawBody.byteLength || rawBody.byteLength>1_000_000) return response({ok:false,code:'WEBHOOK_BODY_INVALID'},400);
  const headers=headersRecord(req.headers); const hint=eventHint(rawBody);
  try {
    if (hint.event.startsWith('CHECKOUT_')) {
      const checkoutEvent=await verifyAsaasCheckoutWebhook({headers,rawBody,receivedAt:new Date().toISOString()},webhookToken());
      if (checkoutEvent.eventType==='created'||checkoutEvent.eventType==='canceled'||checkoutEvent.eventType==='expired') {
        const result=await checkoutReconciliation().processLifecycle(checkoutEvent);
        return response({ok:true,provider:'asaas',eventId:checkoutEvent.providerEventId,eventType:`checkout.${checkoutEvent.eventType}`,replayed:result.replayed,state:result.state});
      }
      const intent=await checkoutReconciliation().findIntent(checkoutEvent.checkoutSessionId);
      if (checkoutEvent.externalReference && checkoutEvent.externalReference!==intent.id) throw new Error('ASAAS_CHECKOUT_EXTERNAL_REFERENCE_MISMATCH');
      const verified=await fetchPaymentForCheckout({ environment:'sandbox', accessToken:accessToken(), checkoutSessionId:checkoutEvent.checkoutSessionId, checkoutIntentId:intent.id, expectedAmountMinor:moneyToMinor(intent.amountGross), expectedMethod:intent.paymentMethod, providerEventId:checkoutEvent.providerEventId, occurredAt:checkoutEvent.occurredAt, rawPayloadHash:checkoutEvent.rawPayloadHash });
      const processed=await processVerifiedWithBindingRecovery(verified);
      if(processed.reconciliation)return response({ok:true,provider:'asaas',eventId:verified.providerEventId,eventType:verified.eventType,source:'checkout',reconciliationRequired:true,replayed:processed.reconciliation.replayed,code:processed.reconciliation.code},200);
      const result=processed.result!;if(verified.eventType==='refunded') await checkoutReconciliation().markRefundFinal(result.paymentId);
      return response({ok:true,provider:'asaas',eventId:verified.providerEventId,eventType:verified.eventType,source:'checkout',replayed:result.replayed});
    }

    const envelope=await verifyAsaasPaymentWebhookEnvelope({headers,rawBody,receivedAt:new Date().toISOString()},webhookToken());
    if(envelope.eventName==='PAYMENT_PARTIALLY_REFUNDED'){
      const tracked=await checkoutReconciliation().recordPartialRefundReconciliation({providerEventId:envelope.providerEventId,providerPaymentId:envelope.providerPaymentId,rawPayloadHash:envelope.rawPayloadHash});
      return response({ok:true,provider:'asaas',eventId:envelope.providerEventId,eventType:'partial_refund',reconciliationRequired:true,replayed:tracked.replayed},200);
    }
    if(envelope.eventName==='PAYMENT_REFUND_IN_PROGRESS'){
      const tracked=await checkoutReconciliation().recordRefundProgress({providerEventId:envelope.providerEventId,providerPaymentId:envelope.providerPaymentId,rawPayloadHash:envelope.rawPayloadHash});
      return response({ok:true,provider:'asaas',eventId:envelope.providerEventId,eventType:'refund_in_progress',economicStateChanged:false,replayed:tracked.replayed},200);
    }
    if(envelope.eventName==='PAYMENT_REFUND_DENIED'){
      const tracked=await checkoutReconciliation().recordRefundDenied({providerEventId:envelope.providerEventId,providerPaymentId:envelope.providerPaymentId,rawPayloadHash:envelope.rawPayloadHash});
      return response({ok:true,provider:'asaas',eventId:envelope.providerEventId,eventType:'refund_denied',economicStateChanged:false,replayed:tracked.replayed},200);
    }
    const providerPayment=await fetchAsaasPaymentById({environment:'sandbox',accessToken:accessToken(),providerPaymentId:envelope.providerPaymentId});
    const intentId=await resolveIntentForProviderPayment(envelope,providerPayment);
    const verified=paymentEnvelopeToVerifiedWebhook(envelope,providerPayment,intentId);
    const processed=await processVerifiedWithBindingRecovery(verified);
    if(processed.reconciliation)return response({ok:true,provider:'asaas',eventId:verified.providerEventId,eventType:verified.eventType,source:'payment',reconciliationRequired:true,replayed:processed.reconciliation.replayed,code:processed.reconciliation.code},200);
    const result=processed.result!;if(verified.eventType==='refunded') await checkoutReconciliation().markRefundFinal(result.paymentId);
    return response({ok:true,provider:'asaas',eventId:verified.providerEventId,eventType:verified.eventType,source:'payment',replayed:result.replayed});
  } catch (error) {
    const code=safeCode(error);
    if (code==='ASAAS_WEBHOOK_EVENT_UNSUPPORTED'||code==='ASAAS_CHECKOUT_EVENT_UNSUPPORTED') return response({ok:true,ignored:true,code},200);
    if (code==='ASAAS_WEBHOOK_TOKEN_INVALID') return response({ok:false,code},401);
    if (code==='PAYMENT_PROVIDER_UNCONFIGURED') return response({ok:false,code},503);
    if (code.includes('NOT_FOUND')||code.includes('AMBIGUOUS')||code.includes('NET_VALUE_REQUIRED')||code.includes('MISMATCH')||code.includes('CONFLICT')||code.includes('INVALID')||code.includes('REQUIRED')) return response({ok:false,code},409);
    console.error('diretoria-asaas-webhook',code); return response({ok:false,code:'ASAAS_WEBHOOK_PROCESSING_ERROR'},500);
  }
});
