BEGIN;

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('requested','approved','processing','paid','failed','cancelled')),
  gateway_refund_id varchar(255),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  requested_by uuid REFERENCES users(id)
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE INDEX refunds_payment_idx ON refunds(payment_id, requested_at DESC);
CREATE INDEX refunds_profile_idx ON refunds(profile_id, requested_at DESC);
CREATE INDEX refunds_event_idx ON refunds(event_id, requested_at DESC);
CREATE INDEX refunds_requested_by_idx ON refunds(requested_by);

COMMIT;
