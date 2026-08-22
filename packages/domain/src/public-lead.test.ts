import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeLandingPath,
  normalizePublicLeadEmail,
  normalizePublicLeadName,
  normalizePublicLeadPhone,
  normalizePublicSource,
  optionalTrackingValue,
} from './public-lead.ts';

test('telefone brasileiro amigável vira E.164', () => {
  assert.equal(normalizePublicLeadPhone('(64) 99999-0001'), '+5564999990001');
  assert.equal(normalizePublicLeadPhone('55 64 99999-0001'), '+5564999990001');
  assert.equal(normalizePublicLeadPhone('+55 (64) 99999-0001'), '+5564999990001');
});

test('E.164 internacional explícito é preservado', () => {
  assert.equal(normalizePublicLeadPhone('+1 212 555 0100'), '+12125550100');
});

test('telefone inválido é rejeitado', () => {
  assert.throws(() => normalizePublicLeadPhone('123'), /PHONE_INVALID/);
});

test('e-mail e nome são normalizados', () => {
  assert.equal(normalizePublicLeadEmail('  Pessoa@Example.COM '), 'pessoa@example.com');
  assert.equal(normalizePublicLeadName('  Maria   da Silva  '), 'Maria da Silva');
});

test('tracking tem limites e source default', () => {
  assert.equal(normalizePublicSource(undefined), 'direct');
  assert.equal(normalizePublicSource(' Meta '), 'meta');
  assert.equal(optionalTrackingValue(' campanha '), 'campanha');
  assert.throws(() => optionalTrackingValue('x'.repeat(181)), /TRACKING_VALUE_TOO_LONG/);
});

test('landing aceita apenas path local', () => {
  assert.equal(normalizeLandingPath('/lista?utm_source=meta'), '/lista?utm_source=meta');
  assert.throws(() => normalizeLandingPath('https://evil.example/'), /LANDING_PAGE_INVALID/);
  assert.throws(() => normalizeLandingPath('//evil.example/'), /LANDING_PAGE_INVALID/);
});
