import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

try {
  const operator = await pool.query(`
    select u.id
    from users u join profiles p on p.id=u.profile_id
    where p.display_code='HML-OPERATOR'
    limit 1
  `);
  assert(operator.rows[0]?.id, 'hml operator missing');
  const operatorId = operator.rows[0].id;
  const suffix = Date.now().toString(36);

  const event = await pool.query(
    `insert into events(event_code,name,slug,status,capacity,created_by)
     values ($1,'Asaas Pass Through HML',$2,'FORMACAO',700,$3)
     returning id`,
    [`DIR-ASAAS-${suffix}`, `asaas-pass-${suffix}`, operatorId],
  );
  const eventId = event.rows[0].id;

  // Nova política Asaas: custo interno de processamento é zero porque a taxa
  // calculada é adicionada ao valor que o pagador vê antes de confirmar.
  const config = await pool.query(
    `insert into event_financial_configs(
      event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
      contingency_type,contingency_value,approved_exposure_limit,created_by
    ) values ($1,1,150.00,0,5.00,'percentage',15.00,0,$2)
    returning id,fee_pass_through,estimated_fee_per_member`,
    [eventId, operatorId],
  );
  assert(config.rows[0].fee_pass_through === true, 'new Asaas config must default to pass-through');
  assert(String(config.rows[0].estimated_fee_per_member) === '0.00', 'pass-through must have zero internal processing fee');

  // Compatibilidade: código/configuração que ainda informa taxa interna positiva
  // declara, por definição, o modelo de taxa absorvida.
  const legacyDefaultEvent = await pool.query(
    `insert into events(event_code,name,slug,status,capacity,created_by)
     values ($1,'Legacy Default Fee Model',$2,'PLANEJAMENTO',100,$3)
     returning id`,
    [`DIR-LEGACY-${suffix}`, `legacy-default-fee-${suffix}`, operatorId],
  );
  const legacyDefault = await pool.query(
    `insert into event_financial_configs(
      event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
      contingency_type,contingency_value,approved_exposure_limit,created_by
    ) values ($1,1,150.00,4.50,5.00,'fixed',0,0,$2)
    returning fee_pass_through,estimated_fee_per_member`,
    [legacyDefaultEvent.rows[0].id, operatorId],
  );
  assert(legacyDefault.rows[0].fee_pass_through === false, 'positive internal fee must imply absorbed legacy model');
  assert(String(legacyDefault.rows[0].estimated_fee_per_member) === '4.50', 'legacy internal fee must be preserved');

  // Também continua possível declarar o legado explicitamente.
  const historicalEvent = await pool.query(
    `insert into events(event_code,name,slug,status,capacity,created_by)
     values ($1,'Historical Fee Model',$2,'PLANEJAMENTO',100,$3)
     returning id`,
    [`DIR-HIST-${suffix}`, `historical-fee-${suffix}`, operatorId],
  );
  const historical = await pool.query(
    `insert into event_financial_configs(
      event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
      contingency_type,contingency_value,approved_exposure_limit,created_by,fee_pass_through
    ) values ($1,1,150.00,4.50,5.00,'fixed',0,0,$2,false)
    returning fee_pass_through,estimated_fee_per_member`,
    [historicalEvent.rows[0].id, operatorId],
  );
  assert(historical.rows[0].fee_pass_through === false, 'historical fee policy must remain possible');
  assert(String(historical.rows[0].estimated_fee_per_member) === '4.50', 'absorbed fee must be preserved when pass-through=false');

  const profile = await pool.query(
    `insert into profiles(display_code,full_name,status,first_source)
     values ($1,'Asaas Checkout Test','active','integration_test') returning id`,
    [`ASAAS-${suffix}`],
  );

  const intent = await pool.query(
    `insert into checkout_intents(
      profile_id,event_id,financial_config_id,purpose,provider,idempotency_key,
      amount_gross,base_amount,processing_fee_amount,currency_code,status,payment_method,installment_count,
      fee_snapshot,fee_source_hash,fee_quoted_at
    ) values ($1,$2,$3,'club_credit','asaas',$4,155.13,150.00,5.13,'BRL','ready','card',1,$5::jsonb,$6,now())
    returning id`,
    [
      profile.rows[0].id,
      eventId,
      config.rows[0].id,
      `asaas:${suffix}:1`,
      JSON.stringify({ source: 'asaas_account_fees', oneInstallmentPercentage: 2.99, operationValue: 0.49 }),
      'a'.repeat(64),
    ],
  );
  assert(intent.rows[0]?.id, 'priced checkout intent must insert');

  let invalidCompositionBlocked = false;
  try {
    await pool.query(
      `insert into checkout_intents(
        profile_id,event_id,financial_config_id,purpose,provider,idempotency_key,
        amount_gross,base_amount,processing_fee_amount,currency_code,status
      ) values ($1,$2,$3,'club_credit','asaas',$4,154.00,150.00,5.13,'BRL','ready')`,
      [profile.rows[0].id, eventId, config.rows[0].id, `asaas:${suffix}:bad`],
    );
  } catch (error: any) {
    invalidCompositionBlocked = error?.code === '23514';
  }
  assert(invalidCompositionBlocked, 'checkout total must equal base + passed fee');

  // Inserção antiga sem base explícita é normalizada para base=total, taxa=0.
  const legacyIntent = await pool.query(
    `insert into checkout_intents(
      profile_id,event_id,financial_config_id,purpose,provider,idempotency_key,
      amount_gross,currency_code,status
    ) values ($1,$2,$3,'club_credit','unconfigured',$4,150.00,'BRL','draft')
    returning base_amount,processing_fee_amount`,
    [profile.rows[0].id, eventId, config.rows[0].id, `asaas:${suffix}:legacy-intent`],
  );
  assert(String(legacyIntent.rows[0].base_amount) === '150.00', 'legacy checkout must normalize base amount');
  assert(String(legacyIntent.rows[0].processing_fee_amount) === '0.00', 'legacy checkout must remain fee-free draft');

  const payment = await pool.query(
    `insert into payments(
      profile_id,event_id,purpose,gateway,idempotency_key,amount_gross,base_amount,
      processing_fee_passed,provider_fee_actual,currency_code,payment_method,status
    ) values ($1,$2,'club_credit','asaas',$3,155.13,150.00,5.13,5.13,'BRL','card','pending')
    returning id`,
    [profile.rows[0].id, eventId, `asaas-payment:${suffix}`],
  );
  assert(payment.rows[0]?.id, 'payment with separated base and fee must insert');

  const legacyPayment = await pool.query(
    `insert into payments(
      profile_id,event_id,purpose,gateway,idempotency_key,amount_gross,currency_code,payment_method,status
    ) values ($1,$2,'club_credit','mock',$3,150.00,'BRL','mock','pending')
    returning base_amount,processing_fee_passed`,
    [profile.rows[0].id, eventId, `legacy-payment:${suffix}`],
  );
  assert(String(legacyPayment.rows[0].base_amount) === '150.00', 'legacy payment must normalize base amount');
  assert(String(legacyPayment.rows[0].processing_fee_passed) === '0.00', 'legacy payment must have no passed fee');

  console.log('OK: Asaas fee pass-through is explicit, auditable and backward-compatible.');
} finally {
  await pool.end();
}
