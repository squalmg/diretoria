import assert from 'node:assert/strict';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
const { Pool } = pg;
const pool = new Pool({ connectionString });

async function consume(key: string, limit: number, windowSeconds: number) {
  const result = await pool.query(
    'select * from consume_public_lead_rate_limit($1,$2,$3)',
    [key, limit, windowSeconds],
  );
  return result.rows[0] as { allowed: boolean; remaining: number; reset_at: Date };
}

try {
  const key = 'a'.repeat(64);
  const first = await consume(key, 3, 60);
  const second = await consume(key, 3, 60);
  const third = await consume(key, 3, 60);
  const fourth = await consume(key, 3, 60);

  assert.equal(first.allowed, true);
  assert.equal(Number(first.remaining), 2);
  assert.equal(second.allowed, true);
  assert.equal(Number(second.remaining), 1);
  assert.equal(third.allowed, true);
  assert.equal(Number(third.remaining), 0);
  assert.equal(fourth.allowed, false);
  assert.equal(Number(fourth.remaining), 0);
  assert.ok(new Date(fourth.reset_at).getTime() > Date.now());

  const stored = await pool.query(
    `select key_hash,hit_count from public_lead_rate_limits where key_hash=$1 order by bucket_start desc limit 1`,
    [key],
  );
  assert.equal(stored.rows[0].key_hash, key);
  assert.equal(Number(stored.rows[0].hit_count), 4);

  await assert.rejects(
    pool.query('select * from consume_public_lead_rate_limit($1,$2,$3)', ['short', 3, 60]),
    /RATE_LIMIT_KEY_INVALID/,
  );

  console.log('PUBLIC_LEAD_RATE_LIMIT_INTEGRATION_OK');
} finally {
  await pool.end();
}
