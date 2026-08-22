BEGIN;

CREATE TABLE hml_bootstrap_tokens (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  note text,
  CHECK (expires_at > created_at)
);

ALTER TABLE hml_bootstrap_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX hml_bootstrap_tokens_active_idx
  ON hml_bootstrap_tokens(expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE hml_bootstrap_tokens IS
  'One-time HML-only bootstrap credentials. Store SHA-256 hashes only; never store plaintext tokens.';

COMMIT;
