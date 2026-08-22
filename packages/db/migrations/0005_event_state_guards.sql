BEGIN;

CREATE OR REPLACE FUNCTION enforce_event_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  latest_snapshot quorum_snapshots%ROWTYPE;
  latest_review event_go_no_go_reviews%ROWTYPE;
  active_config event_financial_configs%ROWTYPE;
  required_count integer;
  approved_count integer;
  transition_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  transition_allowed := CASE OLD.status
    WHEN 'PLANEJAMENTO' THEN NEW.status = 'REATIVACAO'
    WHEN 'REATIVACAO' THEN NEW.status = 'LISTA_DE_ESPERA'
    WHEN 'LISTA_DE_ESPERA' THEN NEW.status = 'FORMACAO'
    WHEN 'FORMACAO' THEN NEW.status = 'QUORUM_EM_ANDAMENTO'
    WHEN 'QUORUM_EM_ANDAMENTO' THEN NEW.status = 'VIAVEL'
    WHEN 'VIAVEL' THEN NEW.status IN ('QUORUM_EM_ANDAMENTO','CONFIRMADO')
    WHEN 'CONFIRMADO' THEN NEW.status = 'VENDA_PUBLICA'
    WHEN 'VENDA_PUBLICA' THEN NEW.status = 'PRE_EVENTO'
    WHEN 'PRE_EVENTO' THEN NEW.status = 'AO_VIVO'
    WHEN 'AO_VIVO' THEN NEW.status = 'FECHAMENTO'
    WHEN 'FECHAMENTO' THEN NEW.status = 'ENCERRADO'
    WHEN 'ENCERRADO' THEN NEW.status = 'RETENCAO'
    WHEN 'RETENCAO' THEN NEW.status = 'PLANEJAMENTO'
    ELSE false
  END;

  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'EVENT_TRANSITION_NOT_ALLOWED:%->%', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'VIAVEL' THEN
    SELECT * INTO latest_snapshot
    FROM quorum_snapshots
    WHERE event_id = OLD.id
    ORDER BY calculated_at DESC, id DESC
    LIMIT 1;

    IF latest_snapshot.id IS NULL OR latest_snapshot.financial_status NOT IN ('VIAVEL','PROTEGIDO','SUPERAVIT') THEN
      RAISE EXCEPTION 'EVENT_VIABLE_REQUIRES_CURRENT_FINANCIAL_VIABILITY'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status = 'CONFIRMADO' THEN
    SELECT * INTO latest_snapshot
    FROM quorum_snapshots
    WHERE event_id = OLD.id
    ORDER BY calculated_at DESC, id DESC
    LIMIT 1;

    IF latest_snapshot.id IS NULL OR latest_snapshot.financial_status NOT IN ('VIAVEL','PROTEGIDO','SUPERAVIT') THEN
      RAISE EXCEPTION 'EVENT_CONFIRMATION_REQUIRES_VIABLE_SNAPSHOT'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO active_config
    FROM event_financial_configs
    WHERE event_id = OLD.id AND effective_to IS NULL
    ORDER BY version DESC
    LIMIT 1;

    IF active_config.id IS NULL OR active_config.id <> latest_snapshot.financial_config_id THEN
      RAISE EXCEPTION 'EVENT_CONFIRMATION_REQUIRES_CURRENT_FINANCIAL_CONFIG'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO latest_review
    FROM event_go_no_go_reviews
    WHERE event_id = OLD.id
    ORDER BY reviewed_at DESC, id DESC
    LIMIT 1;

    IF latest_review.id IS NULL OR latest_review.result <> 'GO' OR latest_review.quorum_snapshot_id <> latest_snapshot.id THEN
      RAISE EXCEPTION 'EVENT_CONFIRMATION_REQUIRES_CURRENT_GO_REVIEW'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT
      count(*) FILTER (WHERE required = true),
      count(*) FILTER (WHERE required = true AND status IN ('approved','not_applicable'))
    INTO required_count, approved_count
    FROM event_confirmation_checks
    WHERE event_id = OLD.id;

    IF required_count = 0 OR required_count <> approved_count THEN
      RAISE EXCEPTION 'EVENT_CONFIRMATION_REQUIRES_APPROVED_CHECKLIST'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_state_guard ON events;
CREATE TRIGGER events_state_guard
BEFORE UPDATE OF status ON events
FOR EACH ROW
EXECUTE FUNCTION enforce_event_state_transition();

COMMIT;
