BEGIN;

-- PostgreSQL's text type is the natural representation for domain status strings.
-- Keeping the existing CHECK constraint preserves the allowed-value boundary while
-- avoiding ambiguous parameter inference when the same value is used in CASE expressions.
ALTER TABLE event_revenue_commitments
  ALTER COLUMN status TYPE text USING status::text;

COMMIT;
