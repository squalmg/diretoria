BEGIN;

CREATE TABLE public_lead_rate_limits (
  key_hash text NOT NULL,
  bucket_start timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(key_hash, bucket_start)
);

ALTER TABLE public_lead_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX public_lead_rate_limits_cleanup_idx ON public_lead_rate_limits(bucket_start);

CREATE OR REPLACE FUNCTION consume_public_lead_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket_start timestamptz;
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) < 32 THEN
    RAISE EXCEPTION 'RATE_LIMIT_KEY_INVALID';
  END IF;
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'RATE_LIMIT_VALUE_INVALID';
  END IF;
  IF p_window_seconds < 10 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'RATE_LIMIT_WINDOW_INVALID';
  END IF;

  v_bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public_lead_rate_limits(key_hash,bucket_start,hit_count,updated_at)
  VALUES (p_key_hash,v_bucket_start,1,now())
  ON CONFLICT (key_hash,bucket_start) DO UPDATE
  SET hit_count = least(public_lead_rate_limits.hit_count + 1, p_limit + 1),
      updated_at = now()
  RETURNING hit_count INTO v_count;

  RETURN QUERY SELECT
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_bucket_start + make_interval(secs => p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION consume_public_lead_rate_limit(text,integer,integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION consume_public_lead_rate_limit(text,integer,integer) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION consume_public_lead_rate_limit(text,integer,integer) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION consume_public_lead_rate_limit(text,integer,integer) TO service_role';
  END IF;
END;
$$;

COMMENT ON TABLE public_lead_rate_limits IS
  'Rate-limit buckets for public lead capture. key_hash must be non-reversible; never store raw client IP here.';

COMMIT;
