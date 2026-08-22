BEGIN;

-- Supabase exposes public schema tables through PostgREST. Keep the foundation
-- default-deny until explicit application policies are designed and reviewed.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_financial_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_revenue_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quorum_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_confirmation_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_go_no_go_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- user_roles needs a physical primary key while preserving nullable event_id for
-- global roles. The existing partial unique indexes continue to enforce scope.
ALTER TABLE user_roles ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

-- Cover foreign keys identified by the database advisor.
CREATE INDEX audit_logs_actor_user_idx ON audit_logs(actor_user_id);
CREATE INDEX credit_movements_credit_idx ON credit_movements(credit_id);
CREATE INDEX credit_movements_from_event_idx ON credit_movements(from_event_id);
CREATE INDEX credit_movements_to_event_idx ON credit_movements(to_event_id);
CREATE INDEX event_confirmation_checks_validated_by_idx ON event_confirmation_checks(validated_by);
CREATE INDEX event_cost_items_approved_by_idx ON event_cost_items(approved_by);
CREATE INDEX event_cost_items_created_by_idx ON event_cost_items(created_by);
CREATE INDEX event_financial_configs_created_by_idx ON event_financial_configs(created_by);
CREATE INDEX event_go_no_go_reviews_event_idx ON event_go_no_go_reviews(event_id);
CREATE INDEX event_go_no_go_reviews_snapshot_idx ON event_go_no_go_reviews(quorum_snapshot_id);
CREATE INDEX event_go_no_go_reviews_reviewed_by_idx ON event_go_no_go_reviews(reviewed_by);
CREATE INDEX event_status_history_actor_idx ON event_status_history(actor_user_id);
CREATE INDEX events_created_by_idx ON events(created_by);
CREATE INDEX financial_postings_account_idx ON financial_postings(ledger_account_id);
CREATE INDEX financial_transactions_reversal_idx ON financial_transactions(reversal_of_id);
CREATE INDEX payments_event_idx ON payments(event_id);
CREATE INDEX quorum_snapshots_financial_config_idx ON quorum_snapshots(financial_config_id);
CREATE INDEX role_permissions_permission_idx ON role_permissions(permission_id);
CREATE INDEX user_roles_event_idx ON user_roles(event_id);
CREATE INDEX user_roles_granted_by_idx ON user_roles(granted_by);
CREATE INDEX user_roles_role_idx ON user_roles(role_id);

COMMIT;
