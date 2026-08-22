import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresMemberAccounts } from '../packages/db/src/member-accounts.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');

const db = new Pool({ connectionString });
const core = new PostgresMemberAccounts(connectionString);

const authA = '11111111-1111-4111-8111-111111111111';
const authB = '22222222-2222-4222-8222-222222222222';
const authC = '33333333-3333-4333-8333-333333333333';

async function expectCode(fn: () => Promise<unknown>, code: string) {
  let thrown = '';
  try { await fn(); } catch (error) { thrown = error instanceof Error ? error.message : String(error); }
  assert.equal(thrown.split(':')[0], code);
}

try {
  await db.query(`insert into profiles(display_code,full_name,email,email_normalized,phone_e164,status,first_source)
                  values('LEAD-A','Lead Existente','lead@example.test','lead@example.test','+5511999990001','lead','public_hml')`);
  const lead = await db.query(`select id from profiles where display_code='LEAD-A'`);
  await db.query(`insert into crm_stage_history(profile_id,from_stage,to_stage,reason,source_type,source_id)
                  values($1,null,'lead','PUBLIC_LEAD_CAPTURE','system',$1)`, [lead.rows[0].id]);

  const linked = await core.ensureAccount({
    providerSubject: authA,
    email: 'LEAD@example.test',
    phone: '+5511999990001',
    emailVerified: true,
    phoneVerified: true,
    fullName: 'Lead Existente',
  });
  assert.equal(linked.profileId, lead.rows[0].id);
  assert.equal(linked.linkedExistingProfile, true);
  assert.equal(linked.created, true);

  const replay = await core.ensureAccount({
    providerSubject: authA,
    email: 'lead@example.test',
    phone: '+5511999990001',
    emailVerified: true,
    phoneVerified: true,
    fullName: 'Outro nome ignorado',
  });
  assert.equal(replay.profileId, linked.profileId);
  assert.equal(replay.created, false);

  const account = await core.getAccount(authA);
  assert.equal(account.crm_stage, 'lead');
  assert.equal(account.email_normalized, 'lead@example.test');

  await db.query(`insert into profiles(display_code,full_name,email,email_normalized,status)
                  values('LEAD-B','Lead Não Verificado','unverified@example.test','unverified@example.test','lead')`);
  await expectCode(() => core.ensureAccount({
    providerSubject: authB,
    email: 'unverified@example.test',
    emailVerified: false,
    phoneVerified: false,
    fullName: 'Tentativa',
  }), 'MEMBER_EMAIL_VERIFICATION_REQUIRED_FOR_LINK');

  await db.query(`insert into profiles(display_code,full_name,email,email_normalized,status)
                  values('LEAD-C1','C1','conflict@example.test','conflict@example.test','lead')`);
  await db.query(`insert into profiles(display_code,full_name,phone_e164,status)
                  values('LEAD-C2','C2','+5511999990002','lead')`);
  await expectCode(() => core.ensureAccount({
    providerSubject: authC,
    email: 'conflict@example.test',
    phone: '+5511999990002',
    emailVerified: true,
    phoneVerified: true,
    fullName: 'Conflito',
  }), 'MEMBER_IDENTITY_CONFLICT');

  await db.query(`insert into events(event_code,name,slug,status,created_by)
                  values('DIR-MEMBER-HML','Diretoria Member HML','dir-member-hml','PLANEJAMENTO',$1)`, [linked.userId]);
  const event = await db.query(`select id from events where event_code='DIR-MEMBER-HML'`);
  await db.query(`insert into credits(profile_id,event_id,origin_type,gross_value,protected_value,status,valid_from)
                  values($1,$2,'hml_test',120,110,'valid',now())`, [linked.profileId, event.rows[0].id]);

  const wallet = await core.wallet(authA);
  assert.equal(wallet.account.profile_id, linked.profileId);
  assert.equal(wallet.credits.length, 1);
  assert.equal(wallet.credits[0].status, 'valid');
  assert.equal(wallet.ticketsImplemented, false);
  assert.deepEqual(wallet.tickets, []);

  const audit = await db.query(`select action from audit_logs where entity_id=$1 order by occurred_at`, [linked.profileId]);
  assert.ok(audit.rows.some((row:any) => row.action === 'member.account_linked'));

  console.log(JSON.stringify({
    ok: true,
    linkedExistingLead: true,
    replayIdempotent: true,
    unverifiedMergeBlocked: true,
    identityConflictBlocked: true,
    stageRemainsLead: true,
    walletCreditCount: wallet.credits.length,
    ticketsImplemented: wallet.ticketsImplemented,
  }));
} finally {
  await core.close();
  await db.end();
}
