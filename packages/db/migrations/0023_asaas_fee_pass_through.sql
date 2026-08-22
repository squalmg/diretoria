BEGIN;

-- A decisão canônica a partir desta migration é: a taxa do meio de pagamento
-- é recuperada do pagador e não reduz a contribuição econômica da Diretoria.
-- Configurações históricas preservam a semântica anterior.
ALTER TABLE event_financial_configs
  ADD COLUMN fee_pass_through boolean;

UPDATE event_financial_configs
SET fee_pass_through = false
WHERE fee_pass_through IS NULL;

ALTER TABLE event_financial_configs
  ALTER COLUMN fee_pass_through SET DEFAULT true,
  ALTER COLUMN fee_pass_through SET NOT NULL;

CREATE OR REPLACE FUNCTION enforce_event_financial_fee_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- estimated_fee_per_member representa apenas taxa absorvida pela Diretoria.
  -- Se a taxa for integralmente repassada, o custo econômico interno é zero.
  IF NEW.fee_pass_through THEN
    NEW.estimated_fee_per_member := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_financial_fee_policy_guard ON event_financial_configs;
CREATE TRIGGER event_financial_fee_policy_guard
BEFORE INSERT OR UPDATE OF fee_pass_through, estimated_fee_per_member
ON event_financial_configs
FOR EACH ROW
EXECUTE FUNCTION enforce_event_financial_fee_policy();

-- O checkout passa a separar explicitamente preço-base, taxa recuperada e total.
ALTER TABLE checkout_intents
  ADD COLUMN base_amount numeric(14,2),
  ADD COLUMN processing_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN payment_method varchar(20),
  ADD COLUMN installment_count integer,
  ADD COLUMN fee_snapshot jsonb,
  ADD COLUMN fee_source_hash varchar(128),
  ADD COLUMN fee_quoted_at timestamptz;

UPDATE checkout_intents
SET base_amount = amount_gross
WHERE base_amount IS NULL;

ALTER TABLE checkout_intents
  ALTER COLUMN base_amount SET NOT NULL,
  ADD CONSTRAINT checkout_intents_base_amount_positive CHECK (base_amount > 0),
  ADD CONSTRAINT checkout_intents_processing_fee_nonnegative CHECK (processing_fee_amount >= 0),
  ADD CONSTRAINT checkout_intents_total_composition CHECK (amount_gross = base_amount + processing_fee_amount),
  ADD CONSTRAINT checkout_intents_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('pix','card')),
  ADD CONSTRAINT checkout_intents_installment_count_check CHECK (
    installment_count IS NULL OR (installment_count BETWEEN 1 AND 21)
  ),
  ADD CONSTRAINT checkout_intents_card_installment_consistency CHECK (
    (payment_method = 'card' AND installment_count IS NOT NULL)
    OR (payment_method = 'pix' AND installment_count IS NULL)
    OR payment_method IS NULL
  );

-- Payments preservam o total cobrado e passam a expor quanto era preço da
-- Diretoria e quanto foi recuperado para cobrir o custo do gateway.
ALTER TABLE payments
  ADD COLUMN base_amount numeric(14,2),
  ADD COLUMN processing_fee_passed numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN provider_fee_actual numeric(14,2);

UPDATE payments
SET base_amount = amount_gross
WHERE base_amount IS NULL;

ALTER TABLE payments
  ALTER COLUMN base_amount SET NOT NULL,
  ADD CONSTRAINT payments_base_amount_positive CHECK (base_amount > 0),
  ADD CONSTRAINT payments_processing_fee_passed_nonnegative CHECK (processing_fee_passed >= 0),
  ADD CONSTRAINT payments_provider_fee_actual_nonnegative CHECK (provider_fee_actual IS NULL OR provider_fee_actual >= 0),
  ADD CONSTRAINT payments_total_composition CHECK (amount_gross = base_amount + processing_fee_passed);

COMMENT ON COLUMN event_financial_configs.fee_pass_through IS
  'true = taxa do meio de pagamento é cobrada além do preço-base e não reduz a contribuição ao quórum';
COMMENT ON COLUMN checkout_intents.processing_fee_amount IS
  'acréscimo informado ao pagador para recuperar a taxa estimada do gateway; não é capital protegido';
COMMENT ON COLUMN payments.processing_fee_passed IS
  'parte do total cobrado destinada a recuperar a taxa do gateway, separada do preço-base da Diretoria';

COMMIT;
