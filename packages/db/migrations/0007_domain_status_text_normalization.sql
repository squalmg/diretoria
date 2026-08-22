BEGIN;

-- PostgreSQL does not provide a storage/performance advantage for bounded varchar
-- over text. Domain validity remains enforced by CHECK constraints, while text
-- avoids ambiguous bind-parameter inference in CASE/upsert statements.
ALTER TABLE event_confirmation_checks
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE payments
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE credits
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE refunds
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE payment_webhook_receipts
  ALTER COLUMN processing_status TYPE text USING processing_status::text;

COMMIT;
