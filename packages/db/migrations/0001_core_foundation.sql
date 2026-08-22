BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code varchar(32) NOT NULL UNIQUE,
  full_name varchar(180) NOT NULL,
  email varchar(320),
  email_normalized varchar(320),
  phone_e164 varchar(20),
  birth_date date,
  status varchar(20) NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','blocked','archived')),
  first_source varchar(120),
  first_campaign varchar(180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE UNIQUE INDEX profiles_email_normalized_uq ON profiles(email_normalized) WHERE email_normalized IS NOT NULL;
CREATE UNIQUE INDEX profiles_phone_e164_uq ON profiles(phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id),
  auth_provider varchar(40) NOT NULL DEFAULT 'local',
  provider_subject varchar(255),
  password_hash text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code varchar(40) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE,
  description text,
  status varchar(32) NOT NULL DEFAULT 'PLANEJAMENTO' CHECK (status IN (
    'PLANEJAMENTO','REATIVACAO','LISTA_DE_ESPERA','FORMACAO','QUORUM_EM_ANDAMENTO','VIAVEL','CONFIRMADO',
    'VENDA_PUBLICA','PRE_EVENTO','AO_VIVO','FECHAMENTO','ENCERRADO','RETENCAO'
  )),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  formation_starts_at timestamptz,
  quorum_deadline_at timestamptz,
  public_sales_starts_at timestamptz,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  confirmed_at timestamptz,
  closed_at timestamptz,
  timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  default_currency char(3) NOT NULL DEFAULT 'BRL',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  event_id uuid REFERENCES events(id),
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_global_uq ON user_roles(user_id, role_id) WHERE event_id IS NULL;
CREATE UNIQUE INDEX user_roles_event_uq ON user_roles(user_id, role_id, event_id) WHERE event_id IS NOT NULL;

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id),
  permission_id uuid NOT NULL REFERENCES permissions(id),
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE event_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  from_status varchar(32),
  to_status varchar(32) NOT NULL,
  reason text,
  actor_user_id uuid REFERENCES users(id),
  automated boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_status_history_event_idx ON event_status_history(event_id, occurred_at DESC);

CREATE TABLE event_financial_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  version integer NOT NULL CHECK (version > 0),
  founder_ticket_gross numeric(14,2) NOT NULL CHECK (founder_ticket_gross >= 0),
  estimated_fee_per_member numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_fee_per_member >= 0),
  variable_cost_per_member numeric(14,2) NOT NULL DEFAULT 0 CHECK (variable_cost_per_member >= 0),
  contingency_type varchar(20) NOT NULL CHECK (contingency_type IN ('fixed','percentage')),
  contingency_value numeric(14,2) NOT NULL CHECK (contingency_value >= 0),
  approved_exposure_limit numeric(14,2) CHECK (approved_exposure_limit IS NULL OR approved_exposure_limit >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, version)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  purpose varchar(30) NOT NULL CHECK (purpose IN ('club_credit','public_ticket','other')),
  gateway varchar(60) NOT NULL,
  gateway_payment_id varchar(255),
  idempotency_key varchar(255) NOT NULL UNIQUE,
  amount_gross numeric(14,2) NOT NULL CHECK (amount_gross > 0),
  amount_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_fee >= 0),
  amount_net numeric(14,2),
  currency_code char(3) NOT NULL DEFAULT 'BRL',
  payment_method varchar(30) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','paid','failed','expired','refunded','chargeback')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);
CREATE UNIQUE INDEX payments_gateway_id_uq ON payments(gateway, gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX payments_profile_event_status_idx ON payments(profile_id, event_id, status);

CREATE TABLE payment_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway varchar(60) NOT NULL,
  gateway_event_id varchar(255) NOT NULL,
  event_type varchar(120) NOT NULL,
  signature_valid boolean NOT NULL,
  payload_hash varchar(128) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status varchar(20) NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processed','ignored','failed')),
  error_message text,
  UNIQUE(gateway, gateway_event_id)
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  event_type varchar(120) NOT NULL,
  old_status varchar(20),
  new_status varchar(20),
  gateway_event_id varchar(255),
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_payment_idx ON payment_events(payment_id, occurred_at);

CREATE TABLE credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid NOT NULL REFERENCES events(id),
  payment_id uuid REFERENCES payments(id),
  origin_type varchar(40) NOT NULL,
  origin_id uuid,
  gross_value numeric(14,2) NOT NULL CHECK (gross_value >= 0),
  protected_value numeric(14,2) NOT NULL CHECK (protected_value >= 0 AND protected_value <= gross_value),
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valid','converted','rolled_over','refund_requested','refunded','cancelled')),
  valid_from timestamptz,
  converted_at timestamptz,
  rolled_over_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX credits_payment_uq ON credits(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX credits_event_status_idx ON credits(event_id, status);
CREATE INDEX credits_profile_event_idx ON credits(profile_id, event_id);

CREATE TABLE credit_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES credits(id),
  movement_type varchar(30) NOT NULL CHECK (movement_type IN ('validated','converted','rollover_out','rollover_in','refund','adjustment')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  from_event_id uuid REFERENCES events(id),
  to_event_id uuid REFERENCES events(id),
  reference_type varchar(60),
  reference_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  category varchar(80) NOT NULL,
  description text NOT NULL,
  cost_type varchar(20) NOT NULL CHECK (cost_type IN ('fixed','variable','provision','tax','other')),
  estimated_amount numeric(14,2) NOT NULL CHECK (estimated_amount >= 0),
  approved_amount numeric(14,2) CHECK (approved_amount IS NULL OR approved_amount >= 0),
  protected boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','approved','cancelled')),
  created_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_cost_items_event_status_idx ON event_cost_items(event_id, status);

CREATE TABLE event_revenue_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  revenue_type varchar(40) NOT NULL CHECK (revenue_type IN ('sponsorship','guaranteed_partner','other_guaranteed')),
  counterparty varchar(180),
  gross_amount numeric(14,2) NOT NULL CHECK (gross_amount >= 0),
  eligible_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (eligible_percentage >= 0 AND eligible_percentage <= 100),
  eligible_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (eligible_amount >= 0 AND eligible_amount <= gross_amount),
  status varchar(30) NOT NULL DEFAULT 'promised' CHECK (status IN ('promised','contracted','partially_received','received','cancelled')),
  evidence_reference text,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_revenue_commitments_event_status_idx ON event_revenue_commitments(event_id, status);

CREATE TABLE quorum_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  financial_config_id uuid NOT NULL REFERENCES event_financial_configs(id),
  protected_costs numeric(14,2) NOT NULL CHECK (protected_costs >= 0),
  contingency_amount numeric(14,2) NOT NULL CHECK (contingency_amount >= 0),
  guaranteed_revenue numeric(14,2) NOT NULL CHECK (guaranteed_revenue >= 0),
  financial_need numeric(14,2) NOT NULL CHECK (financial_need >= 0),
  valid_credit_count integer NOT NULL CHECK (valid_credit_count >= 0),
  protected_capital numeric(14,2) NOT NULL CHECK (protected_capital >= 0),
  quorum_minimum integer NOT NULL CHECK (quorum_minimum >= 0),
  protected_percentage numeric(9,4) NOT NULL CHECK (protected_percentage >= 0),
  deficit numeric(14,2) NOT NULL CHECK (deficit >= 0),
  surplus numeric(14,2) NOT NULL CHECK (surplus >= 0),
  financial_status varchar(30) NOT NULL CHECK (financial_status IN ('NAO_VIAVEL','PROXIMO_DO_QUORUM','VIAVEL','PROTEGIDO','SUPERAVIT')),
  trigger_type varchar(60) NOT NULL,
  trigger_id uuid,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quorum_snapshots_current_idx ON quorum_snapshots(event_id, calculated_at DESC);

CREATE TABLE event_confirmation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  check_code varchar(80) NOT NULL,
  label varchar(180) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','not_applicable')),
  evidence text,
  validated_by uuid REFERENCES users(id),
  validated_at timestamptz,
  UNIQUE(event_id, check_code)
);

CREATE TABLE event_go_no_go_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  quorum_snapshot_id uuid NOT NULL REFERENCES quorum_snapshots(id),
  approved_exposure_limit numeric(14,2) NOT NULL CHECK (approved_exposure_limit >= 0),
  projected_required_exposure numeric(14,2) NOT NULL CHECK (projected_required_exposure >= 0),
  no_future_sales_assumed boolean NOT NULL DEFAULT true,
  bar_revenue_assumed numeric(14,2) NOT NULL DEFAULT 0 CHECK (bar_revenue_assumed >= 0),
  result varchar(10) NOT NULL CHECK (result IN ('GO','NO_GO')),
  reason text,
  reviewed_by uuid NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (result <> 'GO' OR (no_future_sales_assumed = true AND bar_revenue_assumed = 0 AND projected_required_exposure <= approved_exposure_limit))
);

CREATE TABLE ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  account_type varchar(20) NOT NULL CHECK (account_type IN ('asset','liability','revenue','expense','equity','control')),
  financial_center varchar(80),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  transaction_type varchar(80) NOT NULL,
  reference_type varchar(80) NOT NULL,
  reference_id uuid NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversal_of_id uuid REFERENCES financial_transactions(id)
);
CREATE INDEX financial_transactions_event_idx ON financial_transactions(event_id, occurred_at);

CREATE TABLE financial_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES financial_transactions(id),
  ledger_account_id uuid NOT NULL REFERENCES ledger_accounts(id),
  direction varchar(10) NOT NULL CHECK (direction IN ('debit','credit')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency_code char(3) NOT NULL DEFAULT 'BRL'
);
CREATE INDEX financial_postings_tx_idx ON financial_postings(transaction_id);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  actor_type varchar(40) NOT NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id uuid NOT NULL,
  event_id uuid REFERENCES events(id),
  before_data jsonb,
  after_data jsonb,
  reason text,
  ip_address inet,
  device_id varchar(120),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_event_idx ON audit_logs(event_id, occurred_at DESC);

COMMIT;
