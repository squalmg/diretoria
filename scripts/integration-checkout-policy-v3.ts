import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresPolicyGate } from '../packages/db/src/policy-gate.ts';
import { PostgresCheckoutPolicyAcceptanceGuard } from '../supabase/functions/diretoria-checkout-policy-api/accept-guard.ts';
const { Pool }=pg;const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');const pool=new Pool({connectionString});const gate=new PostgresPolicyGate(connectionString);const acceptance=new PostgresCheckoutPolicyAcceptanceGuard(connectionString);const suffix=Date.now().toString(36);
try{
  const profile=(await pool.query(`insert into profiles(display_code,full_name,email_normalized,status) values($1,'CI Policy',$2,'active') returning id`,[`CI-POL-${suffix}`,`ci-pol-${suffix}@example.invalid`])).rows[0];
  const user=(await pool.query(`insert into users(profile_id,auth_provider,provider_subject,status) values($1,'system',$2,'active') returning id`,[profile.id,`ci-policy-${suffix}`])).rows[0];
  const definitions=[['club_terms','terms','Termos CI'],['non_achievement_policy','policy','Não atingimento CI'],['privacy_policy','policy','Privacidade CI']] as const;
  for(const [code,type,title] of definitions){const draft=await gate.createDraft({code,documentType:type,title,content:`Conteúdo de homologação CI para ${code}; não é texto de produção. ${suffix}`,createdBy:user.id});await gate.activate(draft.id,user.id);}
  const bundle=await gate.activeBundle(definitions.map(([code])=>code));assert.equal(bundle.documents.length,3);assert.deepEqual(bundle.documents.map(d=>d.code).sort(),definitions.map(([code])=>code).sort());
  const acceptanceInput={profileId:profile.id,documents:bundle.documents.map(d=>({id:d.id,code:d.code,version:d.version,contentHash:d.contentHash,status:d.status})),context:'club_checkout',source:'ci_checkout',bundleFingerprint:bundle.fingerprint,userAgent:'CI'};
  const [first,second]=await Promise.all([acceptance.accept(acceptanceInput),acceptance.accept(acceptanceInput)]);
  assert.equal(first.acceptedIds.length+second.acceptedIds.length,3);assert.equal(first.replayedIds.length+second.replayedIds.length,3);
  const acceptanceRows=await pool.query(`select id from policy_acceptances where profile_id=$1 and context='club_checkout'`,[profile.id]);assert.equal(acceptanceRows.rowCount,3);
  const verified=await gate.assertAccepted({profileId:profile.id,context:'club_checkout',requiredCodes:definitions.map(([code])=>code)});assert.equal(verified.fingerprint,bundle.fingerprint);
  let consents=await pool.query(`select id,consent_type,policy_version from consents where profile_id=$1 and granted=true and revoked_at is null and consent_type in('terms','privacy')`,[profile.id]);assert.equal(consents.rowCount,2);assert.deepEqual(consents.rows.map(r=>r.consent_type).sort(),['privacy','terms']);
  const index=await pool.query(`select 1 from pg_indexes where schemaname='public' and indexname='consents_active_policy_version_uq'`);assert.equal(index.rowCount,1);
  const terms=consents.rows.find(r=>r.consent_type==='terms');assert.ok(terms);
  await assert.rejects(()=>pool.query(`insert into consents(profile_id,consent_type,policy_version,granted,source) values($1,'terms',$2,true,'ci_duplicate')`,[profile.id,terms.policy_version]),(error:any)=>error?.code==='23505');
  await pool.query(`update consents set revoked_at=now() where id=$1`,[terms.id]);
  await pool.query(`insert into consents(profile_id,consent_type,policy_version,granted,source) values($1,'terms',$2,true,'ci_regrant')`,[profile.id,terms.policy_version]);
  consents=await pool.query(`select consent_type from consents where profile_id=$1 and granted=true and revoked_at is null and consent_type in('terms','privacy')`,[profile.id]);assert.equal(consents.rowCount,2);assert.deepEqual(consents.rows.map(r=>r.consent_type).sort(),['privacy','terms']);
  console.log('OK: checkout policies V3 PostgreSQL bundle + consent mirrors + active-version idempotency');
}finally{await acceptance.close();await gate.close();await pool.end();}
