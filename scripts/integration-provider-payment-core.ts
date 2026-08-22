import pg from 'pg';
import { PostgresProviderPaymentCore } from '../packages/db/src/provider-payment-core.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString });
const core = new PostgresProviderPaymentCore(connectionString);

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(`ASSERTION_FAILED:${message}`); }
function webhook(input: { eventId: string; paymentId: string; intentId: string; type: 'pending'|'paid'|'failed'|'refunded'|'chargeback'; amountMinor?: bigint; feeMinor?: bigint }) {
  return {
    provider: 'asaas' as const,
    providerEventId: input.eventId,
    providerPaymentId: input.paymentId,
    eventType: input.type,
    checkoutIntentId: input.intentId,
    amountMinor: input.amountMinor ?? 15513n,
    feeMinor: input.feeMinor ?? 513n,
    currencyCode: 'BRL',
    paymentMethod: 'card' as const,
    occurredAt: new Date().toISOString(),
    signatureVerified: true as const,
    rawPayloadHash: `hash-${input.eventId}`,
  };
}

try {
  const operator = await pool.query(`select u.id from users u join profiles p on p.id=u.profile_id where p.display_code='HML-OPERATOR' limit 1`);
  assert(operator.rows[0]?.id, 'operator missing');
  const operatorId = operator.rows[0].id;
  const suffix = Date.now().toString(36);
  const profile = await pool.query(`insert into profiles(display_code,full_name,status,first_source) values ($1,'Provider Flow Test','active','integration_test') returning id`, [`PP-${suffix}`]);
  const profileId = profile.rows[0].id;
  const subject = crypto.randomUUID();
  const user = await pool.query(`insert into users(profile_id,auth_provider,provider_subject,status,email_verified_at) values ($1,'supabase',$2,'active',now()) returning id`, [profileId,subject]);
  const event = await pool.query(`insert into events(event_code,name,slug,status,capacity,created_by) values ($1,'Provider HML',$2,'QUORUM_EM_ANDAMENTO',700,$3) returning id`, [`PP-${suffix}`,`provider-${suffix}`,operatorId]);
  const eventId = event.rows[0].id;
  const config = await pool.query(`insert into event_financial_configs(event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,contingency_type,contingency_value,approved_exposure_limit,created_by,fee_pass_through) values ($1,1,150.00,0,10.00,'fixed',0,0,$2,true) returning id`, [eventId,operatorId]);
  const intent = await pool.query(`insert into checkout_intents(profile_id,event_id,financial_config_id,purpose,provider,idempotency_key,amount_gross,base_amount,processing_fee_amount,currency_code,status) values ($1,$2,$3,'club_credit','unconfigured',$4,150.00,150.00,0,'BRL','draft') returning id`, [profileId,eventId,config.rows[0].id,`provider:${suffix}`]);
  const intentId = intent.rows[0].id;

  const quote = await core.freezeQuote({
    providerSubject:subject,intentId,paymentMethod:'card',installmentCount:1,
    baseAmountMinor:15000n,processingFeeMinor:513n,totalMinor:15513n,
    feeSnapshot:{provider:'asaas',source:'integration-test'},feeSourceHash:`fee-${suffix}`,
  });
  assert(quote.status === 'ready' && quote.replayed === false,'quote freeze');
  const quoteReplay = await core.freezeQuote({providerSubject:subject,intentId,paymentMethod:'card',installmentCount:1,baseAmountMinor:15000n,processingFeeMinor:513n,totalMinor:15513n,feeSnapshot:{provider:'asaas'},feeSourceHash:`fee-${suffix}`});
  assert(quoteReplay.replayed === true,'quote replay');

  const bound = await core.bindCheckout({providerSubject:subject,intentId,providerSessionId:`chk_${suffix}`,expiresAt:new Date(Date.now()+3600000).toISOString()});
  assert(bound.status === 'pending','bound pending');
  const paymentId = bound.paymentId;
  const paymentBefore = await pool.query(`select amount_gross,base_amount,processing_fee_passed,status,gateway from payments where id=$1`,[paymentId]);
  assert(String(paymentBefore.rows[0].amount_gross)==='155.13','customer total stored');
  assert(String(paymentBefore.rows[0].base_amount)==='150.00','base stored');
  assert(String(paymentBefore.rows[0].processing_fee_passed)==='5.13','fee stored');
  assert(paymentBefore.rows[0].gateway==='asaas','gateway stored');

  const paid = await core.processVerifiedWebhook(webhook({eventId:`evt_paid_${suffix}`,paymentId:`pay_${suffix}`,intentId,type:'paid'}));
  assert(paid.eventType==='paid' && paid.replayed===false,'paid applied');
  const credit = await pool.query(`select gross_value,protected_value,status from credits where payment_id=$1`,[paymentId]);
  assert(String(credit.rows[0].gross_value)==='150.00','credit excludes passed fee');
  assert(String(credit.rows[0].protected_value)==='140.00','protected is base minus variable cost');
  const paidRow = await pool.query(`select amount_gross,base_amount,processing_fee_passed,provider_fee_actual,amount_net,status from payments where id=$1`,[paymentId]);
  assert(String(paidRow.rows[0].provider_fee_actual)==='5.13','actual fee recorded');
  assert(String(paidRow.rows[0].amount_net)==='150.00','net retains base');
  assert(paidRow.rows[0].status==='paid','paid status');

  const replay = await core.processVerifiedWebhook(webhook({eventId:`evt_paid_${suffix}`,paymentId:`pay_${suffix}`,intentId,type:'paid'}));
  assert(replay.replayed===true,'same webhook id replay');
  const creditsCount = await pool.query(`select count(*)::int n from credits where payment_id=$1`,[paymentId]);
  assert(creditsCount.rows[0].n===1,'one credit only');

  const receivedLater = await core.processVerifiedWebhook(webhook({eventId:`evt_received_${suffix}`,paymentId:`pay_${suffix}`,intentId,type:'paid'}));
  assert(receivedLater.replayed===true,'second paid lifecycle event no duplicate credit');

  const refunded = await core.processVerifiedWebhook(webhook({eventId:`evt_refund_${suffix}`,paymentId:`pay_${suffix}`,intentId,type:'refunded'}));
  assert(refunded.eventType==='refunded','refund applied');
  const afterRefund = await pool.query(`select p.status payment_status,c.status credit_status from payments p join credits c on c.payment_id=p.id where p.id=$1`,[paymentId]);
  assert(afterRefund.rows[0].payment_status==='refunded' && afterRefund.rows[0].credit_status==='refunded','refund invalidates credit');

  let resurrectBlocked=false;
  try { await core.processVerifiedWebhook(webhook({eventId:`evt_late_paid_${suffix}`,paymentId:`pay_${suffix}`,intentId,type:'paid'})); } catch(error) { resurrectBlocked=error instanceof Error && error.message.includes('PAYMENT_STATUS_NOT_CONFIRMABLE'); }
  assert(resurrectBlocked,'late paid after refund must not resurrect automatically');

  const protectedSum = await pool.query(`select coalesce(sum(protected_value),0)::text total from credits where event_id=$1 and status='valid'`,[eventId]);
  assert(String(protectedSum.rows[0].total)==='0','refund removes protected capital');

  console.log('OK: Asaas provider lifecycle preserves base price, excludes fee from credit, dedupes webhooks and reverses protected capital.');
} finally {
  await core.close();
  await pool.end();
}
