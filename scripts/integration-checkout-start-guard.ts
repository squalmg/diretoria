import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresCheckoutStartGuard } from '../supabase/functions/diretoria-asaas-checkout-api/start-guard.ts';

const { Pool }=pg;
const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');
const pool=new Pool({connectionString});
const guard=new PostgresCheckoutStartGuard(connectionString);
const suffix=Date.now().toString(36);

async function one(sql:string,values:unknown[]=[]){const result=await pool.query(sql,values);return result.rows[0];}

async function seedReadyIntent(){
  const profile=await one(`insert into profiles(display_code,full_name,email_normalized,status) values($1,$2,$3,'active') returning id`,[`CI-START-${suffix}`,'CI Checkout Start',`ci-start-${suffix}@example.invalid`]);
  const subject=`ci-start-subject-${suffix}`;
  const user=await one(`insert into users(profile_id,auth_provider,provider_subject,status) values($1,'supabase',$2,'active') returning id`,[profile.id,subject]);
  const event=await one(`insert into events(event_code,name,slug,status,created_by) values($1,$2,$3,'FORMACAO',$4) returning id`,[`CI-START-${suffix}`,`CI Start ${suffix}`,`ci-start-${suffix}`,user.id]);
  const config=await one(`insert into event_financial_configs(event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,contingency_type,contingency_value,approved_exposure_limit,created_by,fee_pass_through) values($1,1,150,0,10,'fixed',0,0,$2,true) returning id`,[event.id,user.id]);
  const intent=await one(`insert into checkout_intents(profile_id,event_id,financial_config_id,provider,idempotency_key,amount_gross,base_amount,processing_fee_amount,currency_code,payment_method,status,reconciliation_status) values($1,$2,$3,'asaas',$4,155.13,150,5.13,'BRL','pix','ready','not_required') returning id`,[profile.id,event.id,config.id,`ci-start-${suffix}`]);
  return{subject,intent};
}

try{
  const seeded=await seedReadyIntent();
  const concurrent=await Promise.allSettled([
    guard.claim(seeded.subject,seeded.intent.id),
    guard.claim(seeded.subject,seeded.intent.id),
  ]);
  const fulfilled=concurrent.filter((item):item is PromiseFulfilledResult<any>=>item.status==='fulfilled');
  const rejected=concurrent.filter((item):item is PromiseRejectedResult=>item.status==='rejected');
  assert.equal(fulfilled.length,1,'exactly one concurrent start must claim the intent');
  assert.equal(rejected.length,1,'exactly one concurrent start must be rejected');
  assert.equal(fulfilled[0].value.replayed,false);
  assert.match(String(rejected[0].reason?.message??rejected[0].reason),/CHECKOUT_START_ALREADY_IN_PROGRESS/);
  let row=await one(`select status,reconciliation_status,provider_error_code,provider_started_at from checkout_intents where id=$1`,[seeded.intent.id]);
  assert.equal(row.status,'ready');assert.equal(row.reconciliation_status,'pending');assert.ok(row.provider_started_at);

  await guard.releaseDefinitiveFailure(seeded.intent.id,'ASAAS_HTTP_ERROR_400');
  row=await one(`select reconciliation_status,provider_error_code from checkout_intents where id=$1`,[seeded.intent.id]);
  assert.equal(row.reconciliation_status,'not_required');assert.equal(row.provider_error_code,'ASAAS_HTTP_ERROR_400');

  const reclaimed=await guard.claim(seeded.subject,seeded.intent.id);
  assert.equal(reclaimed.replayed,false);
  const persisted=await guard.recordProviderSession(seeded.intent.id,`chk-persist-${suffix}`,new Date(Date.now()+3600000).toISOString());
  assert.equal(persisted.replayed,false);
  row=await one(`select provider_session_id,reconciliation_status from checkout_intents where id=$1`,[seeded.intent.id]);assert.equal(row.provider_session_id,`chk-persist-${suffix}`);assert.equal(row.reconciliation_status,'pending');
  const persistedReplay=await guard.recordProviderSession(seeded.intent.id,`chk-persist-${suffix}`,null);assert.equal(persistedReplay.replayed,true);
  await guard.requireReconciliation(seeded.intent.id,'ASAAS_REQUEST_TIMEOUT');
  row=await one(`select reconciliation_status,provider_error_code from checkout_intents where id=$1`,[seeded.intent.id]);
  assert.equal(row.reconciliation_status,'required');assert.equal(row.provider_error_code,'ASAAS_REQUEST_TIMEOUT');

  await assert.rejects(()=>guard.claim(seeded.subject,seeded.intent.id),/CHECKOUT_RECONCILIATION_REQUIRED/);

  await pool.query(`update checkout_intents set status='pending',provider_session_id=$2,reconciliation_status='not_required' where id=$1`,[seeded.intent.id,`chk-persist-${suffix}`]);
  const replay=await guard.claim(seeded.subject,seeded.intent.id);
  assert.equal(replay.replayed,true);assert.equal(replay.providerSessionId,`chk-persist-${suffix}`);

  console.log('OK: checkout start guard PostgreSQL concurrency/release/reconciliation integration');
}finally{await guard.close();await pool.end();}
