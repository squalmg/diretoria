BEGIN;

CREATE TABLE checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid NOT NULL REFERENCES events(id),
  financial_config_id uuid NOT NULL REFERENCES event_financial_configs(id),
  purpose varchar(30) NOT NULL DEFAULT 'club_credit' CHECK (purpose IN ('club_credit')),
  provider varchar(60) NOT NULL DEFAULT 'unconfigured',
  provider_session_id varchar(255),
  idempotency_key varchar(255) NOT NULL UNIQUE,
  amount_gross numeric(14,2) NOT NULL CHECK (amount_gross > 0),
  currency_code char(3) NOT NULL DEFAULT 'BRL',
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','pending','expired','cancelled')),
  policy_version varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX checkout_intents_provider_session_uq
  ON checkout_intents(provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX checkout_intents_profile_event_idx
  ON checkout_intents(profile_id, event_id, created_at DESC);

CREATE INDEX checkout_intents_event_status_idx
  ON checkout_intents(event_id, status, created_at DESC);

ALTER TABLE checkout_intents ENABLE ROW LEVEL SECURITY;

COMMIT;
