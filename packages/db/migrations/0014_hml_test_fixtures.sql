BEGIN;

WITH operator_profile AS (
  INSERT INTO profiles(display_code, full_name, status, first_source)
  VALUES ('HML-OPERATOR', 'HML Test Operator', 'active', 'hml_fixture')
  ON CONFLICT (display_code) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      status = 'active',
      first_source = 'hml_fixture',
      updated_at = now()
  RETURNING id
)
INSERT INTO users(profile_id, auth_provider, provider_subject, status)
SELECT id, 'system', 'hml-test-operator', 'active'
FROM operator_profile
ON CONFLICT (profile_id) DO UPDATE
SET auth_provider = 'system',
    provider_subject = 'hml-test-operator',
    status = 'active',
    updated_at = now();

INSERT INTO profiles(display_code, full_name, status, first_source)
VALUES ('HML-CUSTOMER', 'HML Test Customer', 'active', 'hml_fixture')
ON CONFLICT (display_code) DO UPDATE
SET full_name = EXCLUDED.full_name,
    status = 'active',
    first_source = 'hml_fixture',
    updated_at = now();

COMMIT;
