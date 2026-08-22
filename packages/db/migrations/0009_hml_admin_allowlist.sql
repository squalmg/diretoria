BEGIN;

CREATE TABLE hml_admin_allowlist (
  email_normalized text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hml_admin_allowlist ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE hml_admin_allowlist IS
  'HML authorization allowlist. Empty by default. Never use as an implicit production authorization policy.';

COMMIT;
