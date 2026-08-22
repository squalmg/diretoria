import pg from 'pg';
import { PostgresPolicyGate } from '../packages/db/src/policy-gate.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString });
const gate = new PostgresPolicyGate(connectionString);
const suffix = Date.now().toString(36);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

async function expectError(fn: () => Promise<unknown>, expectedPrefix: string) {
  let matched = false;
  try { await fn(); } catch (error) {
    matched = error instanceof Error && error.message.startsWith(expectedPrefix);
  }
  assert(matched, `expected error ${expectedPrefix}`);
}

try {
  const operator = await pool.query(`select u.id from users u join profiles p on p.id=u.profile_id where p.display_code='HML-OPERATOR' limit 1`);
  assert(operator.rows[0]?.id, 'operator fixture missing');
  const operatorId = operator.rows[0].id;

  const profile = await pool.query(
    `insert into profiles(display_code,full_name,email,email_normalized,status,first_source)
     values ($1,'Policy Test',$2,$2,'active','integration_test') returning id`,
    [`POL-${suffix}`, `policy-${suffix}@example.invalid`],
  );
  const profileId = profile.rows[0].id;
  assert((await gate.health()).database === 'connected', 'policy DB health');

  const termsV1 = await gate.createDraft({
    code: 'club_terms', documentType: 'terms', title: 'Termos Club HML v1',
    content: 'Conteúdo sintético v1 para teste automatizado.', createdBy: operatorId,
  });
  const nonAchievementV1 = await gate.createDraft({
    code: 'non_achievement_policy', documentType: 'policy', title: 'Política não atingimento HML v1',
    content: 'Conteúdo sintético de política para teste automatizado.', createdBy: operatorId,
  });
  assert(termsV1.version === 1 && termsV1.status === 'draft', 'terms v1 draft');
  assert(nonAchievementV1.version === 1, 'non achievement v1 draft');

  await gate.activate(termsV1.id, operatorId);
  await gate.activate(nonAchievementV1.id, operatorId);
  const bundleV1 = await gate.activeBundle(['non_achievement_policy', 'club_terms']);
  assert(bundleV1.documents.length === 2, 'bundle contains both active docs');
  assert(bundleV1.fingerprint.length === 64, 'bundle fingerprint sha256');

  await expectError(
    () => gate.assertAccepted({ profileId, context: 'club_checkout', requiredCodes: ['club_terms', 'non_achievement_policy'] }),
    'POLICY_ACCEPTANCE_REQUIRED:',
  );

  const acceptedV1 = await gate.accept({
    profileId,
    policyDocumentIds: bundleV1.documents.map((document) => document.id),
    context: 'club_checkout',
    source: 'integration_test',
    evidence: { hml: true },
  });
  assert(acceptedV1.acceptedIds.length === 2 && acceptedV1.replayedIds.length === 0, 'first acceptance inserts both');
  const replayV1 = await gate.accept({
    profileId,
    policyDocumentIds: bundleV1.documents.map((document) => document.id),
    context: 'club_checkout',
    source: 'integration_test',
  });
  assert(replayV1.acceptedIds.length === 0 && replayV1.replayedIds.length === 2, 'acceptance idempotent');

  const gateV1 = await gate.assertAccepted({ profileId, context: 'club_checkout', requiredCodes: ['club_terms', 'non_achievement_policy'] });
  assert(gateV1.ok && gateV1.fingerprint === bundleV1.fingerprint, 'v1 gate passes');

  const termsV2 = await gate.createDraft({
    code: 'club_terms', documentType: 'terms', title: 'Termos Club HML v2',
    content: 'Conteúdo sintético v2 alterado para teste automatizado.', createdBy: operatorId,
  });
  assert(termsV2.version === 2 && termsV2.contentHash !== termsV1.contentHash, 'v2 increments and hash changes');
  await gate.activate(termsV2.id, operatorId);

  const oldStatus = await pool.query(`select status from policy_documents where id=$1`, [termsV1.id]);
  assert(oldStatus.rows[0].status === 'retired', 'v1 retired after v2 activation');
  const bundleV2 = await gate.activeBundle(['club_terms', 'non_achievement_policy']);
  assert(bundleV2.fingerprint !== bundleV1.fingerprint, 'bundle fingerprint changes with new active version');
  await expectError(
    () => gate.assertAccepted({ profileId, context: 'club_checkout', requiredCodes: ['club_terms', 'non_achievement_policy'] }),
    'POLICY_ACCEPTANCE_REQUIRED:club_terms',
  );

  await gate.accept({ profileId, policyDocumentIds: [termsV2.id], context: 'club_checkout', source: 'integration_test' });
  const gateV2 = await gate.assertAccepted({ profileId, context: 'club_checkout', requiredCodes: ['club_terms', 'non_achievement_policy'] });
  assert(gateV2.fingerprint === bundleV2.fingerprint, 'v2 gate passes after new acceptance');

  let mutationBlocked = false;
  try { await pool.query(`update policy_documents set content='tampered' where id=$1`, [termsV2.id]); }
  catch (error) { mutationBlocked = error instanceof Error && error.message.includes('POLICY_DOCUMENT_IMMUTABLE_AFTER_ACTIVATION'); }
  assert(mutationBlocked, 'active policy content mutation blocked by DB');

  const acceptance = await pool.query(`select id from policy_acceptances where profile_id=$1 limit 1`, [profileId]);
  let deleteBlocked = false;
  try { await pool.query(`delete from policy_acceptances where id=$1`, [acceptance.rows[0].id]); }
  catch (error) { deleteBlocked = error instanceof Error && error.message.includes('POLICY_ACCEPTANCE_APPEND_ONLY'); }
  assert(deleteBlocked, 'acceptance delete blocked by DB');

  const audit = await pool.query(`select count(*)::int n from audit_logs where action='policy.document_activated' and entity_type='policy_document'`);
  assert(audit.rows[0].n >= 3, 'activations audited');

  console.log('OK: policy gate is versioned, immutable after activation and requires acceptance of current versions.');
} finally {
  await gate.close();
  await pool.end();
}
