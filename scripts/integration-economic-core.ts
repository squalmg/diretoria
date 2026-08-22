import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresEconomicCore } from '../packages/db/src/economic-core.ts';
import { moneyFromReais } from '../packages/domain/src/money.ts';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? 'postgresql://diretoria:ci_only_password@localhost:5432/diretoria';
const pool = new Pool({ connectionString });
const core = new PostgresEconomicCore(connectionString);

async function expectReject(fn: () => Promise<unknown>, contains: string): Promise<void> {
  let caught: unknown;
  try {
    await fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `expected rejection containing ${contains}`);
  assert.match(caught.message, new RegExp(contains));
}

async function createProfile(code: string, name: string): Promise<string> {
  const result = await pool.query(
    `insert into profiles(display_code,full_name,email_normalized,status)
     values ($1,$2,$3,'active') returning id`,
    [code, name, `${code.toLowerCase()}@example.invalid`],
  );
  return result.rows[0].id;
}

try {
  const actorProfileId = await createProfile('CORE-ACTOR', 'Core Actor');
  const actorResult = await pool.query(
    `insert into users(profile_id,auth_provider,status,email_verified_at)
     values ($1,'integration','active',now()) returning id`,
    [actorProfileId],
  );
  const actorUserId = actorResult.rows[0].id as string;

  const event = await core.createEvent({
    eventCode: 'DIR-INT-001',
    name: 'Diretoria Integration #01',
    slug: 'diretoria-integration-01',
    capacity: 1000,
    createdBy: actorUserId,
  });
  assert.equal(event.status, 'PLANEJAMENTO');

  const config = await core.createFinancialConfig({
    eventId: event.id,
    founderTicketGross: moneyFromReais(120),
    estimatedFeePerMember: moneyFromReais(5),
    variableCostPerMember: moneyFromReais(5),
    contingency: { type: 'percentage', basisPoints: 1500 },
    approvedExposureLimit: 0n,
    createdBy: actorUserId,
  });
  assert.equal(config.version, 1);

  await core.addProtectedCost({
    eventId: event.id,
    category: 'producao',
    description: 'Custos protegidos cenário canônico',
    costType: 'fixed',
    amount: moneyFromReais(70_000),
    createdBy: actorUserId,
  });

  await core.addGuaranteedRevenue({
    eventId: event.id,
    revenueType: 'sponsorship',
    counterparty: 'Patrocinador HML',
    grossAmount: moneyFromReais(10_000),
    eligibleAmount: moneyFromReais(10_000),
    status: 'received',
  });

  await expectReject(
    () => core.addGuaranteedRevenue({
      eventId: event.id,
      revenueType: 'sponsorship',
      counterparty: 'Promessa não recebida',
      grossAmount: moneyFromReais(5_000),
      eligibleAmount: moneyFromReais(5_000),
      status: 'promised',
    }),
    'PROMISED_REVENUE_NOT_ELIGIBLE',
  );

  await core.transitionEvent(event.id, 'REATIVACAO', actorUserId, 'INTEGRATION_SETUP');
  await core.transitionEvent(event.id, 'LISTA_DE_ESPERA', actorUserId, 'INTEGRATION_SETUP');
  await core.transitionEvent(event.id, 'FORMACAO', actorUserId, 'INTEGRATION_SETUP');
  await core.transitionEvent(event.id, 'QUORUM_EM_ANDAMENTO', actorUserId, 'INTEGRATION_SETUP');

  const zero = await core.recalculateQuorum(event.id, 'integration_initial');
  assert.equal(zero.financialNeed, moneyFromReais(70_500));
  assert.equal(zero.quorumMinimum, 641n);
  assert.equal(zero.validCreditCount, 0);
  assert.equal(zero.status, 'NAO_VIAVEL');
  assert.equal(zero.eventStatus, 'QUORUM_EM_ANDAMENTO');

  const member1 = await createProfile('CORE-MEMBER-0001', 'Member 1');
  const payment1 = await core.createPendingMockPayment({
    profileId: member1,
    eventId: event.id,
    amountGross: moneyFromReais(120),
    idempotencyKey: 'core-payment-0001',
  });
  assert.equal(payment1.status, 'pending');

  const confirmed1 = await core.confirmMockPayment({
    paymentId: payment1.id,
    gatewayEventId: 'mock-event-0001',
    payloadHash: 'integration-payload-0001',
  });
  assert.equal(confirmed1.alreadyProcessed, false);
  assert.equal(confirmed1.snapshot.validCreditCount, 1);

  const replay1 = await core.confirmMockPayment({
    paymentId: payment1.id,
    gatewayEventId: 'mock-event-0001',
    payloadHash: 'integration-payload-0001',
  });
  assert.equal(replay1.alreadyProcessed, true);
  const creditCount1 = await pool.query('select count(*)::int as count from credits where payment_id=$1', [payment1.id]);
  assert.equal(Number(creditCount1.rows[0].count), 1);

  await pool.query(
    `insert into profiles(display_code,full_name,email_normalized,status)
     select
       'CORE-MEMBER-' || lpad(g::text,4,'0'),
       'Member ' || g,
       'core-member-' || lpad(g::text,4,'0') || '@example.invalid',
       'active'
     from generate_series(2,640) as g`,
  );

  await pool.query(
    `insert into payments(
       profile_id,event_id,purpose,gateway,gateway_payment_id,idempotency_key,
       amount_gross,amount_fee,amount_net,currency_code,payment_method,status,paid_at
     )
     select p.id,$1,'club_credit','integration-seed',p.display_code,'seed-' || p.display_code,
            120.00,5.00,115.00,'BRL','mock','paid',now()
     from profiles p
     where p.display_code between 'CORE-MEMBER-0002' and 'CORE-MEMBER-0640'`,
    [event.id],
  );

  await pool.query(
    `insert into credits(
       profile_id,event_id,payment_id,origin_type,origin_id,gross_value,protected_value,status,valid_from
     )
     select pay.profile_id,pay.event_id,pay.id,'integration_seed',pay.id,120.00,110.00,'valid',now()
     from payments pay
     where pay.event_id=$1 and pay.gateway='integration-seed'`,
    [event.id],
  );

  await pool.query(
    `insert into credit_movements(credit_id,movement_type,amount,to_event_id,reference_type,reference_id)
     select c.id,'validated',c.protected_value,c.event_id,'payment',c.payment_id
     from credits c
     join payments p on p.id=c.payment_id
     where c.event_id=$1 and p.gateway='integration-seed'`,
    [event.id],
  );

  const at640 = await core.recalculateQuorum(event.id, 'integration_640');
  assert.equal(at640.validCreditCount, 640);
  assert.equal(at640.protectedCapital, moneyFromReais(70_400));
  assert.equal(at640.status, 'NAO_VIAVEL');
  assert.equal(at640.eventStatus, 'QUORUM_EM_ANDAMENTO');

  const member641 = await createProfile('CORE-MEMBER-0641', 'Member 641');
  const payment641 = await core.createPendingMockPayment({
    profileId: member641,
    eventId: event.id,
    amountGross: moneyFromReais(120),
    idempotencyKey: 'core-payment-0641',
  });
  const reached = await core.confirmMockPayment({
    paymentId: payment641.id,
    gatewayEventId: 'mock-event-0641',
    payloadHash: 'integration-payload-0641',
  });
  assert.equal(reached.snapshot.validCreditCount, 641);
  assert.equal(reached.snapshot.protectedCapital, moneyFromReais(70_510));
  assert.equal(reached.snapshot.status, 'VIAVEL');
  assert.equal(reached.snapshot.eventStatus, 'VIAVEL');

  await expectReject(
    () => core.transitionEvent(event.id, 'CONFIRMADO', actorUserId, 'BYPASS_ATTEMPT'),
    'EVENT_CONFIRMATION_REQUIRES_CURRENT_GO_REVIEW|EVENT_CONFIRMATION_REQUIRES_APPROVED_CHECKLIST',
  );

  for (const [code, label] of [
    ['date_defined', 'Data definida'],
    ['venue_defined', 'Local definido'],
    ['capacity_validated', 'Capacidade validada'],
    ['budget_updated', 'Orçamento atualizado'],
    ['critical_suppliers', 'Fornecedores críticos validados'],
  ] as const) {
    await core.setConfirmationCheck({
      eventId: event.id,
      code,
      label,
      status: 'approved',
      actorUserId,
    });
  }

  const firstGo = await core.reviewGoNoGo({
    eventId: event.id,
    actorUserId,
    projectedRequiredExposure: 0n,
  });
  assert.equal(firstGo.result, 'GO');

  const refund = await core.refundMockPayment({
    paymentId: payment641.id,
    actorUserId,
    reason: 'INTEGRATION_REFUND',
  });
  assert.equal(refund.snapshot.validCreditCount, 640);
  assert.equal(refund.snapshot.status, 'NAO_VIAVEL');
  assert.equal(refund.snapshot.eventStatus, 'QUORUM_EM_ANDAMENTO');

  await expectReject(
    () => core.confirmEvent({ eventId: event.id, actorUserId, reason: 'SHOULD_FAIL_AFTER_REFUND' }),
    'EVENT_NOT_VIABLE',
  );

  const member642 = await createProfile('CORE-MEMBER-0642', 'Member 642');
  const payment642 = await core.createPendingMockPayment({
    profileId: member642,
    eventId: event.id,
    amountGross: moneyFromReais(120),
    idempotencyKey: 'core-payment-0642',
  });
  const reachedAgain = await core.confirmMockPayment({
    paymentId: payment642.id,
    gatewayEventId: 'mock-event-0642',
    payloadHash: 'integration-payload-0642',
  });
  assert.equal(reachedAgain.snapshot.validCreditCount, 641);
  assert.equal(reachedAgain.snapshot.status, 'VIAVEL');
  assert.equal(reachedAgain.snapshot.eventStatus, 'VIAVEL');

  await expectReject(
    () => core.confirmEvent({ eventId: event.id, actorUserId, reason: 'STALE_GO_REVIEW' }),
    'GO_NO_GO_REVIEW_STALE',
  );

  const secondGo = await core.reviewGoNoGo({
    eventId: event.id,
    actorUserId,
    projectedRequiredExposure: 0n,
  });
  assert.equal(secondGo.result, 'GO');

  const confirmedEvent = await core.confirmEvent({
    eventId: event.id,
    actorUserId,
    reason: 'INTEGRATION_GO',
  });
  assert.equal(confirmedEvent.status, 'CONFIRMADO');

  const finalEvent = await pool.query('select status,confirmed_at from events where id=$1', [event.id]);
  assert.equal(finalEvent.rows[0].status, 'CONFIRMADO');
  assert.ok(finalEvent.rows[0].confirmed_at);

  const refunds = await pool.query("select count(*)::int as count from refunds where event_id=$1 and status='paid'", [event.id]);
  assert.equal(Number(refunds.rows[0].count), 1);

  const audit = await pool.query('select count(*)::int as count from audit_logs where event_id=$1', [event.id]);
  assert.ok(Number(audit.rows[0].count) >= 10);

  const refundRls = await pool.query(
    `select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='refunds'`,
  );
  assert.equal(refundRls.rows[0].relrowsecurity, true);

  await expectReject(
    () => pool.query(
      `insert into event_revenue_commitments(event_id,revenue_type,gross_amount,eligible_percentage,eligible_amount,status)
       values ($1,'bar',40000,100,40000,'received')`,
      [event.id],
    ),
    'event_revenue_commitments_revenue_type_check',
  );

  console.log('ECONOMIC_CORE_INTEGRATION_OK');
} finally {
  await core.close();
  await pool.end();
}
