BEGIN;

CREATE OR REPLACE FUNCTION calculate_event_quorum(p_event_id uuid)
RETURNS TABLE (
  financial_config_id uuid,
  protected_costs numeric(14,2),
  contingency_amount numeric(14,2),
  guaranteed_revenue numeric(14,2),
  financial_need numeric(14,2),
  valid_credit_count integer,
  protected_capital numeric(14,2),
  quorum_minimum integer,
  protected_percentage numeric(9,4),
  deficit numeric(14,2),
  surplus numeric(14,2),
  financial_status varchar(30)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cfg event_financial_configs%ROWTYPE;
  v_protected_costs numeric(14,2) := 0;
  v_contingency numeric(14,2) := 0;
  v_guaranteed_revenue numeric(14,2) := 0;
  v_financial_need numeric(14,2) := 0;
  v_valid_credit_count integer := 0;
  v_protected_capital numeric(14,2) := 0;
  v_net_contribution numeric(14,2) := 0;
  v_quorum_minimum integer := 0;
  v_protected_percentage numeric(9,4) := 0;
  v_deficit numeric(14,2) := 0;
  v_surplus numeric(14,2) := 0;
  v_status varchar(30) := 'NAO_VIAVEL';
BEGIN
  SELECT *
    INTO v_cfg
    FROM event_financial_configs
   WHERE event_id = p_event_id
     AND effective_from <= now()
     AND (effective_to IS NULL OR effective_to > now())
   ORDER BY version DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUORUM_CONFIG_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(COALESCE(approved_amount, estimated_amount)), 0)::numeric(14,2)
    INTO v_protected_costs
    FROM event_cost_items
   WHERE event_id = p_event_id
     AND protected = true
     AND status = 'approved';

  IF v_cfg.contingency_type = 'percentage' THEN
    v_contingency := ROUND(v_protected_costs * v_cfg.contingency_value / 100.0, 2);
  ELSE
    v_contingency := v_cfg.contingency_value;
  END IF;

  SELECT COALESCE(SUM(eligible_amount), 0)::numeric(14,2)
    INTO v_guaranteed_revenue
    FROM event_revenue_commitments
   WHERE event_id = p_event_id
     AND status IN ('contracted', 'partially_received', 'received');

  SELECT COUNT(*)::integer,
         COALESCE(SUM(protected_value), 0)::numeric(14,2)
    INTO v_valid_credit_count, v_protected_capital
    FROM credits
   WHERE event_id = p_event_id
     AND status = 'valid';

  v_financial_need := GREATEST(v_protected_costs + v_contingency - v_guaranteed_revenue, 0);
  v_net_contribution := v_cfg.founder_ticket_gross - v_cfg.estimated_fee_per_member - v_cfg.variable_cost_per_member;

  IF v_net_contribution <= 0 THEN
    RAISE EXCEPTION 'NET_CONTRIBUTION_MUST_BE_POSITIVE';
  END IF;

  v_quorum_minimum := CEIL(v_financial_need / v_net_contribution)::integer;
  v_deficit := GREATEST(v_financial_need - v_protected_capital, 0);
  v_surplus := GREATEST(v_protected_capital - v_financial_need, 0);

  IF v_financial_need = 0 THEN
    v_protected_percentage := 100.0000;
  ELSE
    v_protected_percentage := ROUND((v_protected_capital * 100.0 / v_financial_need)::numeric, 4);
  END IF;

  IF v_protected_capital >= v_financial_need THEN
    v_status := 'VIAVEL';
  ELSE
    v_status := 'NAO_VIAVEL';
  END IF;

  RETURN QUERY SELECT
    v_cfg.id,
    v_protected_costs,
    v_contingency,
    v_guaranteed_revenue,
    v_financial_need,
    v_valid_credit_count,
    v_protected_capital,
    v_quorum_minimum,
    v_protected_percentage,
    v_deficit,
    v_surplus,
    v_status;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_event_quorum_snapshot(
  p_event_id uuid,
  p_trigger_type varchar,
  p_trigger_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_calc record;
  v_snapshot_id uuid;
  v_old_status varchar(32);
  v_new_status varchar(32);
BEGIN
  SELECT * INTO v_calc FROM calculate_event_quorum(p_event_id);

  INSERT INTO quorum_snapshots (
    event_id,
    financial_config_id,
    protected_costs,
    contingency_amount,
    guaranteed_revenue,
    financial_need,
    valid_credit_count,
    protected_capital,
    quorum_minimum,
    protected_percentage,
    deficit,
    surplus,
    financial_status,
    trigger_type,
    trigger_id
  ) VALUES (
    p_event_id,
    v_calc.financial_config_id,
    v_calc.protected_costs,
    v_calc.contingency_amount,
    v_calc.guaranteed_revenue,
    v_calc.financial_need,
    v_calc.valid_credit_count,
    v_calc.protected_capital,
    v_calc.quorum_minimum,
    v_calc.protected_percentage,
    v_calc.deficit,
    v_calc.surplus,
    v_calc.financial_status,
    p_trigger_type,
    p_trigger_id
  ) RETURNING id INTO v_snapshot_id;

  SELECT status INTO v_old_status FROM events WHERE id = p_event_id FOR UPDATE;
  v_new_status := v_old_status;

  IF v_calc.financial_status = 'VIAVEL' AND v_old_status IN ('FORMACAO', 'QUORUM_EM_ANDAMENTO') THEN
    v_new_status := 'VIAVEL';
  ELSIF v_calc.financial_status = 'NAO_VIAVEL' AND v_old_status = 'VIAVEL' THEN
    v_new_status := 'QUORUM_EM_ANDAMENTO';
  END IF;

  IF v_new_status <> v_old_status THEN
    UPDATE events
       SET status = v_new_status,
           updated_at = now()
     WHERE id = p_event_id;

    INSERT INTO event_status_history (
      event_id,
      from_status,
      to_status,
      reason,
      automated,
      occurred_at
    ) VALUES (
      p_event_id,
      v_old_status,
      v_new_status,
      'quorum_recalculated',
      true,
      now()
    );
  END IF;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_quorum_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'QUORUM_SNAPSHOT_IS_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS quorum_snapshots_immutable ON quorum_snapshots;
CREATE TRIGGER quorum_snapshots_immutable
BEFORE UPDATE OR DELETE ON quorum_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_quorum_snapshot_mutation();

COMMIT;
