BEGIN;

CREATE TABLE payment_fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(40) NOT NULL,
  environment varchar(20) NOT NULL CHECK (environment IN ('hml','production')),
  billing_type varchar(20) NOT NULL CHECK (billing_type IN ('PIX','CREDIT_CARD')),
  installments_min integer NOT NULL DEFAULT 1 CHECK (installments_min >= 1),
  installments_max integer NOT NULL DEFAULT 1 CHECK (installments_max >= installments_min),
  fixed_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (fixed_fee >= 0),
  percentage_basis_points integer NOT NULL DEFAULT 0 CHECK (percentage_basis_points >= 0 AND percentage_basis_points < 10000),
  source_label varchar(180) NOT NULL,
  source_url text,
  account_verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((billing_type='PIX' AND installments_min=1 AND installments_max=1) OR billing_type='CREDIT_CARD')
);

CREATE INDEX payment_fee_schedules_lookup_idx
  ON payment_fee_schedules(provider, environment, billing_type, installments_min, installments_max)
  WHERE active=true AND effective_to IS NULL;

ALTER TABLE checkout_intents
  ADD COLUMN billing_type varchar(20) CHECK (billing_type IN ('PIX','CREDIT_CARD')),
  ADD COLUMN installment_count integer CHECK (installment_count IS NULL OR installment_count >= 1),
  ADD COLUMN fee_schedule_id uuid REFERENCES payment_fee_schedules(id),
  ADD COLUMN gateway_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
  ADD COLUMN customer_total numeric(14,2),
  ADD COLUMN fee_passthrough boolean NOT NULL DEFAULT true;

UPDATE checkout_intents
SET customer_total=amount_gross
WHERE customer_total IS NULL;

ALTER TABLE checkout_intents
  ALTER COLUMN customer_total SET NOT NULL,
  ADD CONSTRAINT checkout_intents_total_covers_base CHECK (customer_total >= amount_gross),
  ADD CONSTRAINT checkout_intents_fee_matches_total CHECK (customer_total = amount_gross + gateway_fee);

CREATE INDEX checkout_intents_fee_schedule_idx ON checkout_intents(fee_schedule_id) WHERE fee_schedule_id IS NOT NULL;

-- Baseline HML: taxas públicas padrão consultadas em 22/08/2026.
-- Não representam necessariamente as taxas contratuais da conta do usuário.
INSERT INTO payment_fee_schedules(provider,environment,billing_type,installments_min,installments_max,fixed_fee,percentage_basis_points,source_label,source_url,account_verified)
VALUES
  ('asaas','hml','PIX',1,1,1.99,0,'Asaas public standard pricing 2026-08-22','https://www.asaas.com/precos-e-taxas',false),
  ('asaas','hml','CREDIT_CARD',1,1,0.49,299,'Asaas public standard pricing 2026-08-22','https://www.asaas.com/precos-e-taxas',false),
  ('asaas','hml','CREDIT_CARD',2,6,0.49,349,'Asaas public standard pricing 2026-08-22','https://www.asaas.com/precos-e-taxas',false),
  ('asaas','hml','CREDIT_CARD',7,12,0.49,399,'Asaas public standard pricing 2026-08-22','https://www.asaas.com/precos-e-taxas',false),
  ('asaas','hml','CREDIT_CARD',13,21,0.49,429,'Asaas public standard pricing 2026-08-22','https://www.asaas.com/precos-e-taxas',false);

ALTER TABLE payment_fee_schedules ENABLE ROW LEVEL SECURITY;

COMMIT;
