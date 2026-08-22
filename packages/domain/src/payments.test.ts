import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaymentEligibleForCredit, isPaymentEligibleForProtectedCapital } from './payments.ts';

const notPaid = ['created','pending','failed','expired','refunded','chargeback'] as const;

test('apenas paid é elegível para crédito/capital protegido', () => {
  assert.equal(isPaymentEligibleForCredit('paid'), true);
  assert.equal(isPaymentEligibleForProtectedCapital('paid'), true);
  for (const status of notPaid) {
    assert.equal(isPaymentEligibleForCredit(status), false, status);
    assert.equal(isPaymentEligibleForProtectedCapital(status), false, status);
  }
});
