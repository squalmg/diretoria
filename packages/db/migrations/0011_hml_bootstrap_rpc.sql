BEGIN;

CREATE OR REPLACE FUNCTION hml_consume_bootstrap(
  p_token_hash text,
  p_email_normalized text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  consumed_hash text;
BEGIN
  IF p_email_normalized IS NULL OR btrim(p_email_normalized) = '' THEN
    RETURN false;
  END IF;

  UPDATE hml_bootstrap_tokens
  SET used_at = now()
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING token_hash INTO consumed_hash;

  IF consumed_hash IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO hml_admin_allowlist(email_normalized, enabled, note, updated_at)
  VALUES (lower(btrim(p_email_normalized)), true, 'HML bootstrap token', now())
  ON CONFLICT (email_normalized) DO UPDATE
  SET enabled = true,
      note = excluded.note,
      updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION hml_consume_bootstrap(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hml_consume_bootstrap(text, text) FROM anon;
REVOKE ALL ON FUNCTION hml_consume_bootstrap(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION hml_consume_bootstrap(text, text) TO service_role;

COMMIT;
