BEGIN;

CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(120) NOT NULL,
  channel varchar(20) NOT NULL CHECK (channel IN ('whatsapp','email','push')),
  purpose varchar(20) NOT NULL CHECK (purpose IN ('transactional','marketing')),
  version integer NOT NULL CHECK (version > 0),
  content text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE(code, channel, version)
);

CREATE UNIQUE INDEX notification_templates_one_active_uq
  ON notification_templates(code, channel)
  WHERE status='active';

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  template_id uuid NOT NULL REFERENCES notification_templates(id),
  channel varchar(20) NOT NULL CHECK (channel IN ('whatsapp','email','push')),
  purpose varchar(20) NOT NULL CHECK (purpose IN ('transactional','marketing')),
  status varchar(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','delivered','failed','cancelled')),
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key varchar(255),
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notifications_dedupe_uq
  ON notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX notifications_queue_idx
  ON notifications(status, scheduled_at, created_at)
  WHERE status IN ('queued','sending');

CREATE INDEX notifications_profile_idx
  ON notifications(profile_id, created_at DESC);

CREATE INDEX notifications_event_idx
  ON notifications(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

CREATE TABLE notification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id),
  provider varchar(80) NOT NULL DEFAULT 'unconfigured',
  external_id varchar(255),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status varchar(20) NOT NULL CHECK (status IN ('sending','sent','delivered','failed')),
  error_code varchar(120),
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, attempt_number)
);

CREATE INDEX notification_attempts_external_idx
  ON notification_attempts(provider, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;
