BEGIN;

CREATE TABLE policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL,
  document_type varchar(30) NOT NULL CHECK (document_type IN ('terms','rules','policy','notice')),
  version integer NOT NULL CHECK (version > 0),
  title varchar(240) NOT NULL,
  content text NOT NULL,
  content_hash char(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE(code, version)
);

CREATE UNIQUE INDEX policy_documents_one_active_uq
  ON policy_documents(code)
  WHERE status='active';

CREATE INDEX policy_documents_created_by_idx
  ON policy_documents(created_by)
  WHERE created_by IS NOT NULL;

CREATE TABLE policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  policy_document_id uuid NOT NULL REFERENCES policy_documents(id),
  context varchar(80) NOT NULL,
  source varchar(80) NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, policy_document_id, context)
);

CREATE INDEX policy_acceptances_profile_idx
  ON policy_acceptances(profile_id, accepted_at DESC);

CREATE INDEX policy_acceptances_document_idx
  ON policy_acceptances(policy_document_id, accepted_at DESC);

CREATE OR REPLACE FUNCTION protect_policy_document_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IN ('active','retired') AND (
    NEW.code IS DISTINCT FROM OLD.code OR
    NEW.document_type IS DISTINCT FROM OLD.document_type OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.content_hash IS DISTINCT FROM OLD.content_hash OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'POLICY_DOCUMENT_IMMUTABLE_AFTER_ACTIVATION';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER policy_documents_history_guard
BEFORE UPDATE ON policy_documents
FOR EACH ROW EXECUTE FUNCTION protect_policy_document_history();

CREATE OR REPLACE FUNCTION protect_policy_acceptance_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'POLICY_ACCEPTANCE_APPEND_ONLY';
END;
$$;

CREATE TRIGGER policy_acceptances_update_guard
BEFORE UPDATE ON policy_acceptances
FOR EACH ROW EXECUTE FUNCTION protect_policy_acceptance_history();

CREATE TRIGGER policy_acceptances_delete_guard
BEFORE DELETE ON policy_acceptances
FOR EACH ROW EXECUTE FUNCTION protect_policy_acceptance_history();

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;

COMMIT;
