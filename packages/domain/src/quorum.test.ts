import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuorum } from './quorum.ts';
import { moneyFromReais } from './money.ts';

test('cenário canônico: necessidade 70.500 e quórum 641', () => {
  const result = calculateQuorum({
    protectedCosts: moneyFromReais(70000),
    contingency: moneyFromReais(10500),
    guaranteedRevenue: moneyFromReais(10000),
    ticketGross: moneyFromReais(120),
    feePerMember: moneyFromReais(5),
    variableCostPerMember: moneyFromReais(5),
    protectedCapital: moneyFromReais(44000),
  });
  assert.equal(result.financialNeed, moneyFromReais(70500));
  assert.equal(result.netContributionPerMember, moneyFromReais(110));
  assert.equal(result.quorumMinimum, 641n);
  assert.equal(result.status, 'NAO_VIAVEL');
});

test('641 contribuições líquidas de 110 tornam o cenário mínimo VIAVEL', () => {
  const result = calculateQuorum({
    protectedCosts: moneyFromReais(70000),
    contingency: moneyFromReais(10500),
    guaranteedRevenue: moneyFromReais(10000),
    ticketGross: moneyFromReais(120),
    feePerMember: moneyFromReais(5),
    variableCostPerMember: moneyFromReais(5),
    protectedCapital: 641n * moneyFromReais(110),
  });
  assert.equal(result.protectedCapital, moneyFromReais(70510));
  assert.equal(result.status, 'VIAVEL');
  assert.equal(result.surplus, moneyFromReais(10));
});

test('quórum sempre arredonda para cima', () => {
  const result = calculateQuorum({
    protectedCosts: 1001n,
    contingency: 0n,
    guaranteedRevenue: 0n,
    ticketGross: 100n,
    feePerMember: 0n,
    variableCostPerMember: 0n,
    protectedCapital: 0n,
  });
  assert.equal(result.quorumMinimum, 11n);
});
