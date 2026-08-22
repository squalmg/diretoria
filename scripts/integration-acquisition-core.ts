import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresAcquisitionCore } from '../packages/db/src/acquisition-core.ts';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');

const { Pool } = pg;
const pool = new Pool({ connectionString });
const core = new PostgresAcquisitionCore(connectionString);

async function count(table: string, profileId?: string): Promise<number> {
  const allowed = new Set(['profiles','consents','acquisition_attributions','crm_stage_history','crm_interactions','analytics_events']);
  if (!allowed.has(table)) throw new Error('TABLE_NOT_ALLOWED');
  const result = profileId
    ? await pool.query(`select count(*)::int as count from ${table} where profile_id=$1`, [profileId])
    : await pool.query(`select count(*)::int as count from ${table}`);
  return Number(result.rows[0].count);
}

async function countIdentity(email: string, phone: string): Promise<number> {
  const result = await pool.query(
    `select count(*)::int as count from profiles where email_normalized=$1 or phone_e164=$2`,
    [email, phone],
  );
  return Number(result.rows[0].count);
}

async function latestStage(profileId: string): Promise<string | null> {
  const result = await pool.query(
    `select to_stage from crm_stage_history where profile_id=$1 order by changed_at desc,id desc limit 1`,
    [profileId],
  );
  return result.rows[0]?.to_stage ?? null;
}

try {
  const first = await core.captureLead({
    fullName: 'Lead HML Alpha',
    email: '  Alpha.Example@Example.com ',
    phoneE164: '+5564999990001',
    policyVersion: 'privacy-v1',
    source: 'instagram',
    medium: 'paid_social',
    campaign: 'reativacao-hml',
    content: 'video-01',
    referralCode: 'REF-HML-01',
    landingPage: '/lista',
    sessionKey: 'session-alpha-1',
    consents: { privacy: true, marketing: true, whatsapp: true, email: false },
  });

  assert.equal(first.created, true);
  assert.equal(first.stageChanged, true);
  assert.equal(await countIdentity('alpha.example@example.com', '+5564999990001'), 1);
  assert.equal(await count('consents', first.profileId), 4);
  assert.equal(await count('acquisition_attributions', first.profileId), 1);
  assert.equal(await count('crm_interactions', first.profileId), 1);
  assert.equal(await count('analytics_events', first.profileId), 1);
  assert.equal(await latestStage(first.profileId), 'lead');

  const normalized = await pool.query('select email_normalized,phone_e164 from profiles where id=$1', [first.profileId]);
  assert.equal(normalized.rows[0].email_normalized, 'alpha.example@example.com');
  assert.equal(normalized.rows[0].phone_e164, '+5564999990001');

  const consentDecision = await pool.query(
    `select consent_type,granted from consents where profile_id=$1 order by consent_type`,
    [first.profileId],
  );
  const consentMap = Object.fromEntries(consentDecision.rows.map((row) => [row.consent_type, row.granted]));
  assert.deepEqual(consentMap, { email: false, marketing: true, privacy: true, whatsapp: true });

  const repeated = await core.captureLead({
    fullName: 'Lead HML Alpha Atualizado',
    email: 'alpha.example@example.com',
    phoneE164: '+5564999990001',
    policyVersion: 'privacy-v1',
    source: 'whatsapp',
    medium: 'owned',
    campaign: 'reativacao-hml-followup',
    sessionKey: 'session-alpha-2',
    consents: { privacy: true, marketing: false, whatsapp: true, email: false },
  });
  assert.equal(repeated.profileId, first.profileId);
  assert.equal(repeated.created, false);
  assert.equal(await countIdentity('alpha.example@example.com', '+5564999990001'), 1);
  assert.equal(await count('acquisition_attributions', first.profileId), 2);
  assert.equal(await count('consents', first.profileId), 8);
  assert.equal(await latestStage(first.profileId), 'lead');

  await pool.query(
    `insert into crm_stage_history(profile_id,from_stage,to_stage,reason,source_type)
     values ($1,'lead','member','TEST_PROMOTION','integration_test')`,
    [first.profileId],
  );
  const afterMember = await core.captureLead({
    fullName: 'Lead HML Alpha Já Membro',
    email: 'alpha.example@example.com',
    policyVersion: 'privacy-v1',
    source: 'instagram',
    campaign: 'retargeting-member',
    consents: { privacy: true, marketing: true },
  });
  assert.equal(afterMember.profileId, first.profileId);
  assert.equal(afterMember.stageChanged, false);
  assert.equal(await latestStage(first.profileId), 'member');

  const emailOnly = await core.captureLead({
    fullName: 'Lead Collision Email',
    email: 'collision-email@example.com',
    policyVersion: 'privacy-v1',
    source: 'site',
    consents: { privacy: true },
  });
  const phoneOnly = await core.captureLead({
    fullName: 'Lead Collision Phone',
    phoneE164: '+5564999990002',
    policyVersion: 'privacy-v1',
    source: 'site',
    consents: { privacy: true },
  });
  assert.notEqual(emailOnly.profileId, phoneOnly.profileId);
  const attributionBeforeCollision = await count('acquisition_attributions');

  await assert.rejects(
    core.captureLead({
      fullName: 'Collision Attempt',
      email: 'collision-email@example.com',
      phoneE164: '+5564999990002',
      policyVersion: 'privacy-v1',
      source: 'site',
      consents: { privacy: true },
    }),
    /IDENTITY_COLLISION/,
  );
  assert.equal(await count('acquisition_attributions'), attributionBeforeCollision);

  const profilesBeforeNoConsent = await count('profiles');
  await assert.rejects(
    core.captureLead({
      fullName: 'No Privacy',
      email: 'no-privacy@example.com',
      policyVersion: 'privacy-v1',
      source: 'site',
      consents: { privacy: false },
    }),
    /PRIVACY_CONSENT_REQUIRED/,
  );
  assert.equal(await count('profiles'), profilesBeforeNoConsent);

  const audit = await pool.query(`select count(*)::int as count from audit_logs where action='lead.captured'`);
  assert.ok(Number(audit.rows[0].count) >= 5);

  console.log(JSON.stringify({
    ok: true,
    scenario: 'acquisition_core',
    canonicalProfileId: first.profileId,
    duplicateConsolidated: repeated.profileId === first.profileId,
    laterStagePreserved: await latestStage(first.profileId),
    collisionRollback: true,
    privacyGate: true,
  }));
} finally {
  await core.close();
  await pool.end();
}
