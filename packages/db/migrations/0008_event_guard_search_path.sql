BEGIN;

ALTER FUNCTION enforce_event_state_transition()
  SET search_path = public, pg_temp;

COMMIT;
