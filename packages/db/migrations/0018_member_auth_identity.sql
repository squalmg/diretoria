BEGIN;

-- Garante que uma identidade externa autenticada só possa apontar para uma conta interna.
CREATE UNIQUE INDEX users_auth_provider_subject_uq
  ON users(auth_provider, provider_subject)
  WHERE provider_subject IS NOT NULL;

CREATE INDEX users_auth_provider_idx
  ON users(auth_provider)
  WHERE provider_subject IS NOT NULL;

COMMIT;
