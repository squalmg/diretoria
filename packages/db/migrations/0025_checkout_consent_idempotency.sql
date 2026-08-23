BEGIN;

-- O aceite do bundle do checkout espelha Termos e Privacidade em `consents`.
-- Duas requisições concorrentes não podem criar dois consentimentos ativos da
-- mesma pessoa para a mesma versão documental do checkout. O escopo fica
-- restrito ao formato `policy_document:...`; consentimentos de aquisição como
-- `privacy-v1` preservam a semântica histórica do CRM e não entram neste índice.
-- Revogar remove a linha do índice parcial e permite novo aceite futuro.
CREATE UNIQUE INDEX consents_active_policy_version_uq
  ON consents(profile_id, consent_type, policy_version)
  WHERE granted = true
    AND revoked_at IS NULL
    AND consent_type IN ('terms','privacy')
    AND policy_version LIKE 'policy_document:%';

COMMIT;
