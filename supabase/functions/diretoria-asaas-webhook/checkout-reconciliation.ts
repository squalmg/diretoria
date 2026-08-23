import pg from 'pg';
import type { PaymentMethod } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/payments/provider-contract.ts';
import type { VerifiedAsaasCheckoutWebhook } from './checkout-support.ts';
const { Pool } = pg;
type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }> };
export interface CheckoutIntentForReconciliation { id: string; eventId: string; providerSessionId: string; amountGross: string; paymentMethod: PaymentMethod; currencyCode: string; }
export class PostgresAsaasCheckoutReconciliation {
  private readonly pool: any;
  constructor(connectionString: string) { if (!connectionString) throw new Error('DATABASE_URL_REQUIRED'); this.pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 }); }
  async close(): Promise<void> { await this.pool.end(); }
  private async transaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> { const client = await this.pool.connect(); try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async findIntent(providerSessionId: string): Promise<CheckoutIntentForReconciliation> {
    const session = String(providerSessionId ?? '').trim(); if (!session) throw new Error('ASAAS_CHECKOUT_SESSION_ID_REQUIRED');
    const result = await this.pool.query(`select id,event_id,provider_session_id,amount_gross,payment_method,currency_code from checkout_intents where provider='asaas' and provider_session_id=$1 limit 2`, [session]);
    if (result.rows.length !== 1) throw new Error(result.rows.length ? 'CHECKOUT_PROVIDER_SESSION_AMBIGUOUS' : 'CHECKOUT_PROVIDER_SESSION_NOT_FOUND');
    const row = result.rows[0]; if (!['pix','card'].includes(row.payment_method)) throw new Error('CHECKOUT_PAYMENT_METHOD_INVALID');
    return { id: row.id, eventId: row.event_id, providerSessionId: row.provider_session_id, amountGross: String(row.amount_gross), paymentMethod: row.payment_method, currencyCode: row.currency_code };
  }
  async findIntentByProviderPaymentId(providerPaymentId: string): Promise<CheckoutIntentForReconciliation> {
    const providerId=String(providerPaymentId??'').trim();if(!providerId)throw new Error('ASAAS_WEBHOOK_PAYMENT_ID_REQUIRED');
    const result=await this.pool.query(`select ci.id,ci.event_id,ci.provider_session_id,ci.amount_gross,ci.payment_method,ci.currency_code from payments p join checkout_intents ci on ci.id=p.checkout_intent_id where p.gateway='asaas' and p.gateway_payment_id=$1 limit 2`,[providerId]);
    if(result.rows.length!==1)throw new Error(result.rows.length?'PAYMENT_PROVIDER_ID_AMBIGUOUS':'PAYMENT_PROVIDER_ID_NOT_FOUND');
    const row=result.rows[0];if(!['pix','card'].includes(row.payment_method)||!row.provider_session_id)throw new Error('CHECKOUT_PAYMENT_BINDING_INVALID');
    return{id:row.id,eventId:row.event_id,providerSessionId:row.provider_session_id,amountGross:String(row.amount_gross),paymentMethod:row.payment_method,currencyCode:row.currency_code};
  }
  async findUnboundCandidates(amountGross: string, paymentMethod: PaymentMethod): Promise<CheckoutIntentForReconciliation[]> {
    if(!['pix','card'].includes(paymentMethod))throw new Error('CHECKOUT_PAYMENT_METHOD_INVALID');
    const amount=String(amountGross??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(amount))throw new Error('CHECKOUT_TOTAL_INVALID');
    const result=await this.pool.query(`select ci.id,ci.event_id,ci.provider_session_id,ci.amount_gross,ci.payment_method,ci.currency_code from checkout_intents ci left join payments p on p.checkout_intent_id=ci.id where ci.provider='asaas' and ci.provider_session_id is not null and ci.status in('ready','pending') and ci.payment_method=$2 and ci.amount_gross=$1::numeric and p.gateway_payment_id is null order by ci.created_at desc limit 10`,[amount,paymentMethod]);
    return result.rows.map((row:any)=>({id:row.id,eventId:row.event_id,providerSessionId:row.provider_session_id,amountGross:String(row.amount_gross),paymentMethod:row.payment_method,currencyCode:row.currency_code}));
  }
  async ensurePendingPayment(intentId:string):Promise<{paymentId:string;created:boolean}>{
    const id=String(intentId??'').trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('CHECKOUT_INTENT_ID_INVALID');
    return this.transaction(async client=>{
      const result=await client.query(`select * from checkout_intents where id=$1 and provider='asaas' for update`,[id]);const intent=result.rows[0];if(!intent)throw new Error('CHECKOUT_INTENT_NOT_FOUND');if(!['ready','pending'].includes(intent.status))throw new Error(`CHECKOUT_INTENT_NOT_RECOVERABLE:${intent.status}`);if(!['pix','card'].includes(intent.payment_method))throw new Error('CHECKOUT_PAYMENT_METHOD_INVALID');if(!intent.base_amount||Number(intent.base_amount)<=0||Number(intent.amount_gross)<=0||Number(intent.processing_fee_amount)<0)throw new Error('CHECKOUT_PAYMENT_COMPOSITION_INVALID');
      const existing=await client.query(`select id,status from payments where checkout_intent_id=$1 for update`,[id]);if(existing.rows[0])return{paymentId:existing.rows[0].id,created:false};
      const payment=await client.query(`insert into payments(profile_id,event_id,checkout_intent_id,purpose,gateway,idempotency_key,amount_gross,base_amount,processing_fee_passed,currency_code,payment_method,status) values($1,$2,$3,'club_credit','asaas',$4,$5,$6,$7,$8,$9,'pending') on conflict(checkout_intent_id) where checkout_intent_id is not null do update set checkout_intent_id=excluded.checkout_intent_id returning id`,[intent.profile_id,intent.event_id,intent.id,`asaas-checkout:${intent.id}`,intent.amount_gross,intent.base_amount,intent.processing_fee_amount,intent.currency_code,intent.payment_method]);
      await client.query(`update checkout_intents set status='pending',updated_at=now() where id=$1`,[id]);
      await client.query(`insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason) values(null,'system','checkout.binding_recovered_from_webhook','checkout_intent',$1,$2,$3::jsonb,'ASAAS_VERIFIED_WEBHOOK_RECOVERY')`,[intent.id,intent.event_id,JSON.stringify({paymentId:payment.rows[0].id,providerSessionId:intent.provider_session_id??null,reconciliationStatus:intent.reconciliation_status})]);
      return{paymentId:payment.rows[0].id,created:true};
    });
  }
  async recordVerifiedPaymentReconciliation(input:{providerEventId:string;providerPaymentId:string;checkoutIntentId:string;rawPayloadHash:string;code:string}):Promise<{intentId:string;paymentId:string|null;replayed:boolean}>{
    const eventId=String(input.providerEventId??'').trim(),providerPaymentId=String(input.providerPaymentId??'').trim(),intentId=String(input.checkoutIntentId??'').trim(),code=String(input.code??'').trim().slice(0,120);
    if(!eventId||!providerPaymentId||!/^[0-9a-f-]{36}$/i.test(intentId)||!code)throw new Error('ASAAS_RECONCILIATION_IDENTIFIERS_REQUIRED');
    return this.transaction(async client=>{
      const intentResult=await client.query(`select id,event_id,reconciliation_status from checkout_intents where id=$1 for update`,[intentId]);const intent=intentResult.rows[0];if(!intent)throw new Error('CHECKOUT_INTENT_NOT_FOUND');
      const paymentResult=await client.query(`select id,status from payments where checkout_intent_id=$1 for update`,[intentId]);const payment=paymentResult.rows[0]??null;
      const receipt=await client.query(`insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status,error_message) values('asaas',$1,'payment.reconciliation_required',true,$2,$3,now(),'failed',$4) on conflict(gateway,gateway_event_id) do nothing returning id`,[eventId,input.rawPayloadHash,intentId,code]);
      if((receipt.rowCount??0)===0)return{intentId,paymentId:payment?.id??null,replayed:true};
      await client.query(`update checkout_intents set reconciliation_status='required',provider_error_code=$2,updated_at=now() where id=$1`,[intentId,code]);
      if(payment)await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values($1,'payment.reconciliation_required',$2,$2,$3,$4::jsonb)`,[payment.id,payment.status,eventId,JSON.stringify({provider:'asaas',providerPaymentId,reason:code})]);
      await client.query(`insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason) values(null,'system','payment.reconciliation_required','checkout_intent',$1,$2,$3::jsonb,$4)`,[intentId,intent.event_id,JSON.stringify({providerEventId:eventId,providerPaymentId,paymentId:payment?.id??null}),code]);
      return{intentId,paymentId:payment?.id??null,replayed:false};
    });
  }
  async recordPartialRefundReconciliation(input: { providerEventId: string; providerPaymentId: string; rawPayloadHash: string }): Promise<{ intentId: string | null; paymentId: string | null; replayed: boolean }> {
    const eventId = String(input.providerEventId ?? '').trim(); const providerPaymentId = String(input.providerPaymentId ?? '').trim();
    if (!eventId || !providerPaymentId) throw new Error('ASAAS_PARTIAL_REFUND_IDENTIFIERS_REQUIRED');
    return this.transaction(async (client) => {
      const paymentResult = await client.query(`select p.id,p.status,p.checkout_intent_id from payments p where p.gateway='asaas' and p.gateway_payment_id=$1 for update`, [providerPaymentId]);
      const payment = paymentResult.rows[0] ?? null;
      const intentId = payment?.checkout_intent_id ?? null;
      const receipt = await client.query(`insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status,error_message) values('asaas',$1,'payment.partial_refund',true,$2,$3,now(),'failed','ASAAS_PARTIAL_REFUND_RECONCILIATION_REQUIRED') on conflict(gateway,gateway_event_id) do nothing returning id`, [eventId,input.rawPayloadHash,intentId]);
      if ((receipt.rowCount ?? 0) === 0) return { intentId, paymentId: payment?.id ?? null, replayed: true };
      if (intentId) await client.query(`update checkout_intents set reconciliation_status='required',provider_error_code='ASAAS_PARTIAL_REFUND_RECONCILIATION_REQUIRED',updated_at=now() where id=$1`, [intentId]);
      if (payment) await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values($1,'payment.partial_refund_reconciliation',$2,$2,$3,$4::jsonb)`, [payment.id,payment.status,eventId,JSON.stringify({provider:'asaas',providerPaymentId})]);
      return { intentId, paymentId: payment?.id ?? null, replayed: false };
    });
  }
  async recordRefundProgress(input: { providerEventId: string; providerPaymentId: string; rawPayloadHash: string }): Promise<{ intentId: string | null; paymentId: string; refundId: string | null; replayed: boolean }> {
    const eventId=String(input.providerEventId??'').trim(),providerPaymentId=String(input.providerPaymentId??'').trim();
    if(!eventId||!providerPaymentId)throw new Error('ASAAS_REFUND_PROGRESS_IDENTIFIERS_REQUIRED');
    return this.transaction(async client=>{
      const paymentResult=await client.query(`select p.id,p.status,p.checkout_intent_id,p.profile_id,p.event_id,p.amount_gross from payments p where p.gateway='asaas' and p.gateway_payment_id=$1 for update`,[providerPaymentId]);
      const payment=paymentResult.rows[0];if(!payment)throw new Error('PAYMENT_PROVIDER_ID_NOT_FOUND');
      const receipt=await client.query(`insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status) values('asaas',$1,'payment.refund_in_progress',true,$2,$3,now(),'processed') on conflict(gateway,gateway_event_id) do nothing returning id`,[eventId,input.rawPayloadHash,payment.checkout_intent_id]);
      const existingRefund=await client.query(`select id,status from refunds where payment_id=$1 and status in('requested','approved','processing') order by requested_at desc limit 1 for update`,[payment.id]);
      if((receipt.rowCount??0)===0)return{intentId:payment.checkout_intent_id??null,paymentId:payment.id,refundId:existingRefund.rows[0]?.id??null,replayed:true};
      let refundId:string|null=existingRefund.rows[0]?.id??null;
      if(existingRefund.rows[0])await client.query(`update refunds set status='processing',processed_at=null where id=$1`,[existingRefund.rows[0].id]);
      else if(payment.status==='paid'){const inserted=await client.query(`insert into refunds(payment_id,profile_id,event_id,amount,reason,status) values($1,$2,$3,$4,'ASAAS_WEBHOOK_EXTERNAL_REFUND_IN_PROGRESS','processing') returning id`,[payment.id,payment.profile_id,payment.event_id,payment.amount_gross]);refundId=inserted.rows[0].id;}
      await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values($1,'payment.refund_in_progress',$2,$2,$3,$4::jsonb)`,[payment.id,payment.status,eventId,JSON.stringify({provider:'asaas',providerPaymentId,refundId})]);
      return{intentId:payment.checkout_intent_id??null,paymentId:payment.id,refundId,replayed:false};
    });
  }
  async recordRefundDenied(input: { providerEventId: string; providerPaymentId: string; rawPayloadHash: string }): Promise<{ intentId: string | null; paymentId: string; refundId: string | null; replayed: boolean }> {
    const eventId=String(input.providerEventId??'').trim(),providerPaymentId=String(input.providerPaymentId??'').trim();
    if(!eventId||!providerPaymentId)throw new Error('ASAAS_REFUND_DENIED_IDENTIFIERS_REQUIRED');
    return this.transaction(async client=>{
      const paymentResult=await client.query(`select p.id,p.status,p.checkout_intent_id,p.profile_id,p.event_id,p.amount_gross from payments p where p.gateway='asaas' and p.gateway_payment_id=$1 for update`,[providerPaymentId]);
      const payment=paymentResult.rows[0];if(!payment)throw new Error('PAYMENT_PROVIDER_ID_NOT_FOUND');
      const receipt=await client.query(`insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status,error_message) values('asaas',$1,'payment.refund_denied',true,$2,$3,now(),'processed','ASAAS_REFUND_DENIED_TERMINAL') on conflict(gateway,gateway_event_id) do nothing returning id`,[eventId,input.rawPayloadHash,payment.checkout_intent_id]);
      const active=await client.query(`select id,status from refunds where payment_id=$1 and status in('requested','approved','processing') order by requested_at desc limit 1 for update`,[payment.id]);
      if((receipt.rowCount??0)===0)return{intentId:payment.checkout_intent_id??null,paymentId:payment.id,refundId:active.rows[0]?.id??null,replayed:true};
      let refundId:string|null=active.rows[0]?.id??null;
      if(active.rows[0])await client.query(`update refunds set status='failed',processed_at=coalesce(processed_at,now()) where id=$1`,[active.rows[0].id]);
      else if(payment.status==='paid'){const inserted=await client.query(`insert into refunds(payment_id,profile_id,event_id,amount,reason,status,processed_at) values($1,$2,$3,$4,'ASAAS_WEBHOOK_EXTERNAL_REFUND_DENIED','failed',now()) returning id`,[payment.id,payment.profile_id,payment.event_id,payment.amount_gross]);refundId=inserted.rows[0].id;}
      if(payment.checkout_intent_id)await client.query(`update checkout_intents set reconciliation_status=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'resolved' else reconciliation_status end,provider_error_code=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'ASAAS_REFUND_DENIED_TERMINAL' else provider_error_code end,updated_at=now() where id=$1`,[payment.checkout_intent_id]);
      await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values($1,'payment.refund_denied',$2,$2,$3,$4::jsonb)`,[payment.id,payment.status,eventId,JSON.stringify({provider:'asaas',providerPaymentId,refundId})]);
      return{intentId:payment.checkout_intent_id??null,paymentId:payment.id,refundId,replayed:false};
    });
  }
  async markRefundFinal(paymentId: string): Promise<{ refundId: string; created: boolean }> {
    const id = String(paymentId ?? '').trim(); if (!id) throw new Error('PAYMENT_ID_REQUIRED');
    return this.transaction(async (client) => {
      const paymentResult = await client.query(`select id,profile_id,event_id,amount_gross,checkout_intent_id from payments where id=$1 for update`, [id]);
      const payment = paymentResult.rows[0]; if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      const active = await client.query(`select id from refunds where payment_id=$1 and status in ('requested','approved','processing') order by requested_at desc limit 1 for update`, [id]);
      if (active.rows[0]) {
        await client.query(`update refunds set status='paid',processed_at=coalesce(processed_at,now()) where id=$1`, [active.rows[0].id]);
        if(payment.checkout_intent_id)await client.query(`update checkout_intents set reconciliation_status=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'resolved' else reconciliation_status end,provider_error_code=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'ASAAS_REFUND_PAID_TERMINAL' else provider_error_code end,updated_at=now() where id=$1`,[payment.checkout_intent_id]);
        return { refundId: active.rows[0].id, created: false };
      }
      const existingPaid = await client.query(`select id from refunds where payment_id=$1 and status='paid' order by processed_at desc nulls last,requested_at desc limit 1`, [id]);
      if (existingPaid.rows[0]) {
        if(payment.checkout_intent_id)await client.query(`update checkout_intents set reconciliation_status=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'resolved' else reconciliation_status end,provider_error_code=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'ASAAS_REFUND_PAID_TERMINAL' else provider_error_code end,updated_at=now() where id=$1`,[payment.checkout_intent_id]);
        return { refundId: existingPaid.rows[0].id, created: false };
      }
      const inserted = await client.query(`insert into refunds(payment_id,profile_id,event_id,amount,reason,status,processed_at) values($1,$2,$3,$4,'ASAAS_WEBHOOK_EXTERNAL_REFUND','paid',now()) returning id`, [payment.id,payment.profile_id,payment.event_id,payment.amount_gross]);
      if(payment.checkout_intent_id)await client.query(`update checkout_intents set reconciliation_status=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'resolved' else reconciliation_status end,provider_error_code=case when reconciliation_status in('pending','required') and provider_error_code like 'REFUND_RECONCILIATION_REQUIRED%' then 'ASAAS_REFUND_PAID_TERMINAL' else provider_error_code end,updated_at=now() where id=$1`,[payment.checkout_intent_id]);
      return { refundId: inserted.rows[0].id, created: true };
    });
  }
  async processLifecycle(webhook: VerifiedAsaasCheckoutWebhook): Promise<{ replayed: boolean; intentId: string; paymentId: string | null; state: string }> {
    if (webhook.signatureVerified !== true || webhook.provider !== 'asaas') throw new Error('ASAAS_CHECKOUT_WEBHOOK_NOT_VERIFIED');
    if (!['created','canceled','expired'].includes(webhook.eventType)) throw new Error('ASAAS_CHECKOUT_LIFECYCLE_EVENT_INVALID');
    return this.transaction(async (client) => {
      const intentResult = await client.query(`select * from checkout_intents where provider='asaas' and provider_session_id=$1 for update`, [webhook.checkoutSessionId]);
      const intent = intentResult.rows[0]; if (!intent) throw new Error('CHECKOUT_PROVIDER_SESSION_NOT_FOUND');
      const receipt = await client.query(`insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status) values ('asaas',$1,$2,true,$3,$4,now(),'processed') on conflict (gateway,gateway_event_id) do nothing returning id`, [webhook.providerEventId,`checkout.${webhook.eventType}`,webhook.rawPayloadHash,intent.id]);
      const paymentResult = await client.query(`select * from payments where checkout_intent_id=$1 for update`, [intent.id]); const payment = paymentResult.rows[0] ?? null;
      if ((receipt.rowCount ?? 0) === 0) return { replayed: true, intentId: intent.id, paymentId: payment?.id ?? null, state: intent.status };
      if (webhook.eventType === 'created') return { replayed: false, intentId: intent.id, paymentId: payment?.id ?? null, state: intent.status };
      if (payment && ['paid','refunded','chargeback'].includes(payment.status)) return { replayed: false, intentId: intent.id, paymentId: payment.id, state: payment.status };
      const nextIntent = webhook.eventType === 'expired' ? 'expired' : 'cancelled'; const nextPayment = webhook.eventType === 'expired' ? 'expired' : 'failed';
      await client.query(`update checkout_intents set status=$2,expires_at=case when $2='expired' then coalesce(expires_at,now()) else expires_at end,reconciliation_status=case when reconciliation_status in('pending','required') then 'resolved' else reconciliation_status end,provider_error_code=case when reconciliation_status in('pending','required') then $3 else provider_error_code end,updated_at=now() where id=$1`, [intent.id,nextIntent,`ASAAS_CHECKOUT_${webhook.eventType.toUpperCase()}_TERMINAL`]);
      if (payment) { const oldStatus = payment.status; await client.query(`update payments set status=$2,updated_at=now() where id=$1`, [payment.id,nextPayment]); await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values ($1,$2,$3,$4,$5,$6::jsonb)`, [payment.id,`checkout.${webhook.eventType}`,oldStatus,nextPayment,webhook.providerEventId,JSON.stringify({provider:'asaas',checkoutSessionId:webhook.checkoutSessionId})]); }
      return { replayed: false, intentId: intent.id, paymentId: payment?.id ?? null, state: nextIntent };
    });
  }
}
