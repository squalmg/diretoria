import { readFileSync } from 'node:fs';

const sql = readFileSync('packages/db/migrations/0001_core_foundation.sql','utf8');
const required = [
  'CREATE TABLE profiles',
  'CREATE TABLE users',
  'CREATE TABLE events',
  'CREATE TABLE payments',
  'CREATE TABLE payment_webhook_receipts',
  'UNIQUE(gateway, gateway_event_id)',
  'CREATE TABLE credits',
  'CREATE TABLE quorum_snapshots',
  'CREATE TABLE event_go_no_go_reviews',
  'bar_revenue_assumed = 0',
  'CREATE TABLE financial_transactions',
  'CREATE TABLE financial_postings',
  'CREATE TABLE audit_logs'
];
const missing = required.filter(x => !sql.includes(x));
if (missing.length) {
  console.error('Migration incompleta:', missing);
  process.exit(1);
}
if (!sql.trim().startsWith('BEGIN;') || !sql.trim().endsWith('COMMIT;')) {
  console.error('Migration principal deve ser transacional.');
  process.exit(1);
}
console.log('OK: estrutura mínima das migrations validada estaticamente.');
