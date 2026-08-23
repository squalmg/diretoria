BEGIN;

-- O aceite do bundle do checkout espelha Termos e Privacidade em `consents`.
-- Duas requisições concorrentes não podem criar dois consentimentos ativos da
-- mesma pessoa para a mesma versão documental. Revogar remove a linha do índice
-- parcial e permite um novo aceite futuro da mesma versão, preservando histórico.
CREATE UNIQUE INDEX consents_active_policy_version_uq
  ON consents(profile_id, consent_type, policy_version)
  WHERE granted = true AND revoked_at IS NULL AND consent_type IN ('terms','privacy');

COMMIT;
