import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoNoGo } from './go-no-go.ts';
import { moneyFromReais } from './money.ts';

test('GO exige VIAVEL, checklist, zero vendas futuras, zero bar e exposição dentro do limite', () => {
  const result = evaluateGoNoGo({
    financialStatus: 'VIAVEL',
    allRequiredChecksApproved: true,
    approvedExposureLimit: moneyFromReais(5000),
    projectedRequiredExposure: moneyFromReais(4000),
    noFutureSalesAssumed: true,
    barRevenueAssumed: 0n,
  });
  assert.deepEqual(result, { result: 'GO', reasons: [] });
});

test('bar esperado bloqueia GO', () => {
  const result = evaluateGoNoGo({
    financialStatus: 'VIAVEL',
    allRequiredChecksApproved: true,
    approvedExposureLimit: moneyFromReais(5000),
    projectedRequiredExposure: moneyFromReais(4000),
    noFutureSalesAssumed: true,
    barRevenueAssumed: moneyFromReais(1),
  });
  assert.equal(result.result, 'NO_GO');
  assert.ok(result.reasons.includes('BAR_REVENUE_MUST_BE_ZERO_ASSUMPTION'));
});

test('não viável nunca confirma', () => {
  const result = evaluateGoNoGo({
    financialStatus: 'NAO_VIAVEL',
    allRequiredChecksApproved: true,
    approvedExposureLimit: moneyFromReais(5000),
    projectedRequiredExposure: 0n,
    noFutureSalesAssumed: true,
    barRevenueAssumed: 0n,
  });
  assert.equal(result.result, 'NO_GO');
  assert.ok(result.reasons.includes('EVENT_NOT_FINANCIALLY_VIABLE'));
});
