BEGIN;

ALTER TABLE checkout_intents
  ADD COLUMN provider_started_at timestamptz,
  ADD COLUMN provider_error_code varchar(120),
  ADD COLUMN reconciliation_status varchar(20) NOT NULL DEFAULT 'not_required'
    CHECK (reconciliation_status IN ('not_required','pending','required','resolved'));

ALTER TABLE payments
  ADD COLUMN checkout_intent_id uuid REFERENCES checkout_intents(id);

CREATE UNIQUE INDEX payments_checkout_intent_uq
  ON payments(checkout_intent_id)
  WHERE checkout_intent_id IS NOT NULL;

ALTER TABLE payment_webhook_receipts
  ADD COLUMN checkout_intent_id uuid REFERENCES checkout_intents(id);

CREATE INDEX payment_webhook_receipts_checkout_idx
  ON payment_webhook_receipts(checkout_intent_id, received_at DESC)
  WHERE checkout_intent_id IS NOT NULL;

CREATE INDEX checkout_intents_reconciliation_idx
  ON checkout_intents(reconciliation_status, updated_at)
  WHERE reconciliation_status IN ('pending','required');

COMMIT;
