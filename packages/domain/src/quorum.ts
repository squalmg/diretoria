import type { MoneyCents } from './money.ts';
import { assertNonNegativeMoney } from './money.ts';

export type MinimumFinancialStatus = 'NAO_VIAVEL' | 'VIAVEL';

export interface QuorumInput {
  protectedCosts: MoneyCents;
  contingency: MoneyCents;
  guaranteedRevenue: MoneyCents;
  ticketGross: MoneyCents;
  feePerMember: MoneyCents;
  variableCostPerMember: MoneyCents;
  protectedCapital: MoneyCents;
}

export interface QuorumResult {
  financialNeed: MoneyCents;
  netContributionPerMember: MoneyCents;
  quorumMinimum: bigint;
  protectedCapital: MoneyCents;
  deficit: MoneyCents;
  surplus: MoneyCents;
  status: MinimumFinancialStatus;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('QUORUM_INVALID_DENOMINATOR');
  if (numerator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

export function calculateQuorum(input: QuorumInput): QuorumResult {
  assertNonNegativeMoney(input.protectedCosts, 'PROTECTED_COSTS_NEGATIVE');
  assertNonNegativeMoney(input.contingency, 'CONTINGENCY_NEGATIVE');
  assertNonNegativeMoney(input.guaranteedRevenue, 'GUARANTEED_REVENUE_NEGATIVE');
  assertNonNegativeMoney(input.ticketGross, 'TICKET_GROSS_NEGATIVE');
  assertNonNegativeMoney(input.feePerMember, 'FEE_NEGATIVE');
  assertNonNegativeMoney(input.variableCostPerMember, 'VARIABLE_COST_NEGATIVE');
  assertNonNegativeMoney(input.protectedCapital, 'PROTECTED_CAPITAL_NEGATIVE');

  const rawNeed = input.protectedCosts + input.contingency - input.guaranteedRevenue;
  const financialNeed = rawNeed > 0n ? rawNeed : 0n;
  const netContributionPerMember = input.ticketGross - input.feePerMember - input.variableCostPerMember;

  if (netContributionPerMember <= 0n) {
    throw new Error('NET_CONTRIBUTION_MUST_BE_POSITIVE');
  }

  const quorumMinimum = ceilDiv(financialNeed, netContributionPerMember);
  const deficit = input.protectedCapital < financialNeed ? financialNeed - input.protectedCapital : 0n;
  const surplus = input.protectedCapital > financialNeed ? input.protectedCapital - financialNeed : 0n;
  const status: MinimumFinancialStatus = input.protectedCapital >= financialNeed ? 'VIAVEL' : 'NAO_VIAVEL';

  return {
    financialNeed,
    netContributionPerMember,
    quorumMinimum,
    protectedCapital: input.protectedCapital,
    deficit,
    surplus,
    status,
  };
}
