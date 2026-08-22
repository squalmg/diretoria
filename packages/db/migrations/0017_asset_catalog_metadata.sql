BEGIN;

ALTER TABLE assets
  ADD COLUMN historical_event_label text,
  ADD COLUMN captured_at timestamptz,
  ADD COLUMN source_credit text,
  ADD COLUMN rights_notes text,
  ADD COLUMN external_source_url text,
  ADD COLUMN created_by uuid REFERENCES users(id),
  ADD COLUMN updated_by uuid REFERENCES users(id),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX assets_historical_event_idx ON assets(historical_event_label, created_at DESC)
  WHERE historical_event_label IS NOT NULL;
CREATE INDEX assets_captured_at_idx ON assets(captured_at DESC)
  WHERE captured_at IS NOT NULL;
CREATE INDEX assets_created_by_idx ON assets(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX assets_updated_by_idx ON assets(updated_by) WHERE updated_by IS NOT NULL;

COMMENT ON COLUMN assets.historical_event_label IS
  'Human label for historical events that are not modeled as current event rows.';
COMMENT ON COLUMN assets.rights_notes IS
  'Operational rights notes. This field does not replace legal review.';

COMMIT;
