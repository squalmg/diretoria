import pg from 'pg';
import { PostgresClubCheckout } from '../packages/db/src/club-checkout.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');

const pool = new Pool({ connectionString });
const core = new PostgresClubCheckout(connectionString);
const suffix = Date.now().toString(36);
const subject = crypto.randomUUID();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

try {
  const operator = await pool.query(`select u.id from users u join profiles p on p.id=u.profile_id where p.display_code='HML-OPERATOR' limit 1`);
  assert(operator.rows[0]?.id, 'hml operator missing');
  const operatorId = operator.rows[0].id;

  const profile = await pool.query(
    `insert into profiles(display_code,full_name,email,email_normalized,status,first_source)
     values ($1,'Club Checkout Test',$2,$2,'active','integration_test') returning id`,
    [`CHK-${suffix}`, `club-${suffix}@example.invalid`],
  );
  const profileId = profile.rows[0].id;
  await pool.query(
    `insert into users(profile_id,auth_provider,provider_subject,email_verified_at,status)
     values ($1,'supabase',$2,now(),'active')`,
    [profileId, subject],
  );

  const event = await pool.query(
    `insert into events(event_code,name,slug,status,capacity,created_by)
     values ($1,'Club Checkout HML',$2,'FORMACAO',700,$3) returning id`,
    [`DIR-CHK-${suffix}`, `club-checkout-${suffix}`, operatorId],
  );
  const eventId = event.rows[0].id;
  const config = await pool.query(
    `insert into event_financial_configs(
      event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
      contingency_type,contingency_value,approved_exposure_limit,created_by
     ) values ($1,1,150.00,5.00,5.00,'percentage',15.00,0.00,$2) returning id`,
    [eventId, operatorId],
  );
  const config1 = config.rows[0].id;

  const offer = await core.offerBySlug(`club-checkout-${suffix}`);
  assert(offer.available === true, 'offer should be available in FORMACAO');
  assert(offer.financialConfig?.id === config1, 'offer should use current financial config');
  assert(offer.financialConfig?.founderTicketGross === '150.00', 'offer should expose configured price');
  assert(offer.checkoutProvider === 'unconfigured', 'provider must remain unconfigured');
  assert(offer.paymentEnabled === false, 'payment must remain disabled');

  const first = await core.createIntent({ providerSubject: subject, eventId, idempotencyKey: `checkout:${suffix}:1` });
  assert(first.status === 'draft', 'intent must be draft without provider');
  assert(first.provider === 'unconfigured', 'intent provider must be unconfigured');
  assert(first.amountGross === '150.00', 'intent must snapshot configured price');
  assert(first.financialConfigId === config1, 'intent must pin config version');
  assert(first.replayed === false, 'first request is not replay');

  const replay = await core.createIntent({ providerSubject: subject, eventId, idempotencyKey: `checkout:${suffix}:1` });
  assert(replay.id === first.id && replay.replayed === true, 'same idempotency key must replay same intent');

  const paymentCount = await pool.query(`select count(*)::int n from payments where profile_id=$1 and event_id=$2`, [profileId, eventId]);
  const creditCount = await pool.query(`select count(*)::int n from credits where profile_id=$1 and event_id=$2`, [profileId, eventId]);
  assert(paymentCount.rows[0].n === 0, 'checkout intent must not create payment');
  assert(creditCount.rows[0].n === 0, 'checkout intent must not create credit');

  await pool.query(`update event_financial_configs set effective_to=now() where id=$1`, [config1]);
  const config2 = await pool.query(
    `insert into event_financial_configs(
      event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
      contingency_type,contingency_value,approved_exposure_limit,created_by
     ) values ($1,2,175.00,5.00,5.00,'percentage',15.00,0.00,$2) returning id`,
    [eventId, operatorId],
  );
  const second = await core.createIntent({ providerSubject: subject, eventId, idempotencyKey: `checkout:${suffix}:2` });
  assert(second.amountGross === '175.00', 'new intent must use new config price');
  assert(second.financialConfigId === config2.rows[0].id, 'new intent must pin new config');
  const firstStored = await core.getIntent(subject, first.id);
  assert(String(firstStored.amount_gross) === '150.00', 'old intent snapshot must remain unchanged');

  await pool.query(`update events set status='PLANEJAMENTO' where id=$1`, [eventId]);
  let blocked = false;
  try {
    await core.createIntent({ providerSubject: subject, eventId, idempotencyKey: `checkout:${suffix}:blocked` });
  } catch (error) {
    blocked = error instanceof Error && error.message === 'CLUB_OFFER_PHASE_BLOCKED';
  }
  assert(blocked, 'checkout must be blocked outside formation phases');

  console.log('OK: club offer/checkout contract is gateway-neutral, idempotent and does not create money facts.');
} finally {
  await core.close();
  await pool.end();
}
