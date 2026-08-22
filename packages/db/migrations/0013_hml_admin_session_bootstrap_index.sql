BEGIN;

CREATE INDEX IF NOT EXISTS hml_admin_sessions_bootstrap_token_idx
  ON hml_admin_sessions(bootstrap_token_hash)
  WHERE bootstrap_token_hash IS NOT NULL;

COMMIT;
