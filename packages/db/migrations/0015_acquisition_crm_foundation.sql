BEGIN;

CREATE TABLE consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  consent_type text NOT NULL CHECK (consent_type IN ('terms','privacy','marketing','whatsapp','email','push')),
  policy_version text NOT NULL,
  granted boolean NOT NULL,
  source text NOT NULL,
  ip_address inet,
  user_agent text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE INDEX consents_profile_type_idx ON consents(profile_id, consent_type, granted_at DESC);

CREATE TABLE acquisition_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  session_key text,
  source text NOT NULL,
  medium text,
  campaign text,
  content text,
  term text,
  referral_code text,
  landing_page text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acquisition_attributions ENABLE ROW LEVEL SECURITY;
CREATE INDEX acquisition_profile_idx ON acquisition_attributions(profile_id, occurred_at DESC);
CREATE INDEX acquisition_campaign_idx ON acquisition_attributions(source, campaign, occurred_at DESC);
CREATE INDEX acquisition_referral_idx ON acquisition_attributions(referral_code, occurred_at DESC) WHERE referral_code IS NOT NULL;

CREATE TABLE crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  from_stage text,
  to_stage text NOT NULL CHECK (to_stage IN ('visitor','lead','member','member_confirmed','ticket_issued','participant','repeat_participant','ambassador','inactive')),
  reason text,
  source_type text NOT NULL,
  source_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_stage IS NULL OR from_stage IN ('visitor','lead','member','member_confirmed','ticket_issued','participant','repeat_participant','ambassador','inactive'))
);
ALTER TABLE crm_stage_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX crm_stage_profile_idx ON crm_stage_history(profile_id, changed_at DESC);
CREATE INDEX crm_stage_event_idx ON crm_stage_history(event_id, changed_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX crm_stage_current_lookup_idx ON crm_stage_history(profile_id, changed_at DESC, id DESC);

CREATE TABLE crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','site','phone','in_person','system')),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','system')),
  interaction_type text NOT NULL,
  summary text NOT NULL,
  external_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id)
);
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX crm_interactions_profile_idx ON crm_interactions(profile_id, occurred_at DESC);
CREATE INDEX crm_interactions_event_idx ON crm_interactions(event_id, occurred_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX crm_interactions_created_by_idx ON crm_interactions(created_by) WHERE created_by IS NOT NULL;

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  session_id text,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX analytics_event_name_idx ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX analytics_profile_idx ON analytics_events(profile_id, occurred_at DESC) WHERE profile_id IS NOT NULL;
CREATE INDEX analytics_event_id_idx ON analytics_events(event_id, occurred_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX analytics_session_idx ON analytics_events(session_id, occurred_at DESC) WHERE session_id IS NOT NULL;

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  asset_type text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  title text,
  description text,
  format text,
  quality text,
  usage_permission text NOT NULL DEFAULT 'unknown',
  rights_status text NOT NULL DEFAULT 'review_required',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX assets_event_idx ON assets(event_id, created_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX assets_type_idx ON assets(asset_type, created_at DESC);
CREATE INDEX assets_rights_idx ON assets(rights_status, created_at DESC);

CREATE TABLE asset_tags (
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY(asset_id, tag)
);
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX asset_tags_tag_idx ON asset_tags(tag, asset_id);

COMMIT;
