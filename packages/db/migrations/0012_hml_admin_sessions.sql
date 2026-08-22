BEGIN;

CREATE TABLE hml_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  bootstrap_token_hash text REFERENCES hml_bootstrap_tokens(token_hash),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

ALTER TABLE hml_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX hml_admin_sessions_active_idx
  ON hml_admin_sessions(expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE hml_admin_sessions IS
  'Temporary HML-only admin sessions. Store token hashes only. Not a production auth policy.';

COMMIT;
