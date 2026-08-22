BEGIN;

CREATE INDEX checkout_intents_financial_config_idx
  ON checkout_intents(financial_config_id);

CREATE INDEX notification_templates_created_by_idx
  ON notification_templates(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX notifications_template_idx
  ON notifications(template_id);

COMMIT;
