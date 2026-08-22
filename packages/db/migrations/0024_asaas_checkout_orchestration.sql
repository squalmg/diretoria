BEGIN;

-- Estados adicionais evitam retries automáticos quando não sabemos se o Asaas
-- recebeu/criou o checkout após timeout ou falha de rede.
ALTER TABLE checkout_intents
  DROP CONSTRAINT IF EXISTS checkout_intents_status_check;

ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_status_check CHECK (
    status IN ('draft','ready','creating','uncertain','pending','expired','cancelled')
  );

ALTER TABLE checkout_intents
  ADD COLUMN provider_redirect_url text,
  ADD COLUMN provider_creation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN provider_creation_started_at timestamptz,
  ADD COLUMN provider_last_error_code varchar(120),
  ADD COLUMN policy_fingerprint varchar(64);

ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_provider_attempts_nonnegative CHECK (provider_creation_attempts >= 0),
  ADD CONSTRAINT checkout_intents_policy_fingerprint_format CHECK (
    policy_fingerprint IS NULL OR policy_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT checkout_intents_provider_pending_requires_session CHECK (
    status <> 'pending' OR (provider <> 'unconfigured' AND provider_session_id IS NOT NULL AND provider_redirect_url IS NOT NULL)
  );

-- Relação é payment -> checkout_intent. O checkout não possui payment_id e não
-- pode fabricar um fato financeiro; somente o orquestrador cria o payment pending
-- depois de receber confirmação síncrona de que a página Asaas foi criada.
ALTER TABLE payments
  ADD COLUMN checkout_intent_id uuid REFERENCES checkout_intents(id);

CREATE UNIQUE INDEX payments_checkout_intent_uq
  ON payments(checkout_intent_id)
  WHERE checkout_intent_id IS NOT NULL;

CREATE INDEX checkout_intents_provider_state_idx
  ON checkout_intents(provider, status, created_at DESC);

COMMENT ON COLUMN checkout_intents.provider_creation_attempts IS
  'número de POSTs efetivamente iniciados contra o provider; estado uncertain bloqueia retry automático';
COMMENT ON COLUMN checkout_intents.provider_last_error_code IS
  'código sanitizado do último erro de criação do checkout; nunca contém segredo/resposta bruta';
COMMENT ON COLUMN checkout_intents.policy_fingerprint IS
  'fingerprint SHA-256 do bundle de políticas ativas e aceitas no momento em que o checkout foi iniciado';
COMMENT ON COLUMN payments.checkout_intent_id IS
  'checkout interno que originou o payment; um intent gera no máximo um payment interno';

COMMIT;
