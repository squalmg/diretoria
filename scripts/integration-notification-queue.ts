import pg from 'pg';
import { PostgresNotificationQueue } from '../packages/db/src/notification-queue.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString });
const queue = new PostgresNotificationQueue(connectionString);
const suffix = Date.now().toString(36);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

try {
  const operator = await pool.query(`select u.id from users u join profiles p on p.id=u.profile_id where p.display_code='HML-OPERATOR' limit 1`);
  assert(operator.rows[0]?.id, 'operator fixture missing');
  const operatorId = operator.rows[0].id;

  const profile = await pool.query(
    `insert into profiles(display_code,full_name,email,email_normalized,status,first_source)
     values ($1,'Notification Test',$2,$2,'active','integration_test') returning id`,
    [`NOTIF-${suffix}`, `notification-${suffix}@example.invalid`],
  );
  const profileId = profile.rows[0].id;
  const event = await pool.query(
    `insert into events(event_code,name,slug,status,capacity,created_by)
     values ($1,'Notification Event',$2,'PLANEJAMENTO',100,$3) returning id`,
    [`DIR-NOTIF-${suffix}`, `notification-${suffix}`, operatorId],
  );
  const eventId = event.rows[0].id;

  const health = await queue.health();
  assert(health.database === 'connected', 'database health');
  assert(health.provider === 'unconfigured', 'provider must start unconfigured');

  const v1 = await queue.createTemplateVersion({
    code: 'payment_confirmed', channel: 'whatsapp', purpose: 'transactional',
    content: 'Pagamento confirmado para {{event_name}}.', createdBy: operatorId,
  });
  assert(v1.version === 1 && v1.status === 'draft', 'v1 draft');
  await queue.activateTemplate(v1.id, operatorId);

  const first = await queue.queueTransactional({
    profileId, eventId, templateCode: 'payment_confirmed', channel: 'whatsapp',
    variables: { event_name: 'Notification Event' }, dedupeKey: `payment:${suffix}:confirmed`,
  });
  assert(first.status === 'queued' && first.replayed === false, 'first notification queued');
  assert(first.templateId === v1.id && first.templateVersion === 1, 'first notification pins v1');

  const replay = await queue.queueTransactional({
    profileId, eventId, templateCode: 'payment_confirmed', channel: 'whatsapp',
    variables: { event_name: 'ignored replay variable' }, dedupeKey: `payment:${suffix}:confirmed`,
  });
  assert(replay.id === first.id && replay.replayed === true, 'dedupe replays same notification');

  const attemptsBefore = await pool.query(`select count(*)::int n from notification_attempts where notification_id=$1`, [first.id]);
  assert(attemptsBefore.rows[0].n === 0, 'queueing must not contact provider');

  const v2 = await queue.createTemplateVersion({
    code: 'payment_confirmed', channel: 'whatsapp', purpose: 'transactional',
    content: 'Seu pagamento foi confirmado para {{event_name}}.', createdBy: operatorId,
  });
  assert(v2.version === 2, 'v2 version');
  await queue.activateTemplate(v2.id, operatorId);
  const active = await pool.query(`select id,version from notification_templates where code='payment_confirmed' and channel='whatsapp' and status='active'`);
  assert(active.rows.length === 1 && active.rows[0].id === v2.id, 'only v2 active');
  const retired = await pool.query(`select status from notification_templates where id=$1`, [v1.id]);
  assert(retired.rows[0].status === 'retired', 'v1 retired');

  const second = await queue.queueTransactional({
    profileId, eventId, templateCode: 'payment_confirmed', channel: 'whatsapp',
    variables: { event_name: 'Notification Event' }, dedupeKey: `payment:${suffix}:confirmed-v2`,
  });
  assert(second.templateVersion === 2, 'new notification uses active v2');
  const firstStored = await pool.query(`select template_id from notifications where id=$1`, [first.id]);
  assert(firstStored.rows[0].template_id === v1.id, 'old notification remains pinned to v1');

  const marketing = await queue.createTemplateVersion({
    code: 'campaign_news', channel: 'email', purpose: 'marketing', content: 'Campanha teste', createdBy: operatorId,
  });
  await queue.activateTemplate(marketing.id, operatorId);
  let marketingBlocked = false;
  try {
    await queue.queueTransactional({ profileId, templateCode: 'campaign_news', channel: 'email', dedupeKey: `mkt:${suffix}` });
  } catch (error) {
    marketingBlocked = error instanceof Error && error.message === 'NOTIFICATION_TEMPLATE_NOT_TRANSACTIONAL';
  }
  assert(marketingBlocked, 'transactional queue cannot send marketing template');

  const claimed = await queue.claimBatch(10);
  assert(claimed.some((item) => item.id === first.id), 'first notification claimed');
  const attempt = await queue.recordAttempt({ notificationId: first.id, status: 'failed', errorCode: 'PROVIDER_UNCONFIGURED' });
  assert(attempt.notificationStatus === 'failed', 'failed attempt reflected');
  const attemptRow = await pool.query(`select provider,status,error_code from notification_attempts where id=$1`, [attempt.attemptId]);
  assert(attemptRow.rows[0].provider === 'unconfigured', 'attempt provider explicitly unconfigured');
  assert(attemptRow.rows[0].status === 'failed' && attemptRow.rows[0].error_code === 'PROVIDER_UNCONFIGURED', 'failure recorded without external send');

  console.log('OK: notification queue is versioned, idempotent and provider-neutral.');
} finally {
  await queue.close();
  await pool.end();
}
