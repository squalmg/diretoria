import type { MoneyCents } from './money.ts';
import type { MinimumFinancialStatus } from './quorum.ts';

export interface GoNoGoInput {
  financialStatus: MinimumFinancialStatus;
  allRequiredChecksApproved: boolean;
  approvedExposureLimit: MoneyCents;
  projectedRequiredExposure: MoneyCents;
  noFutureSalesAssumed: boolean;
  barRevenueAssumed: MoneyCents;
}

export interface GoNoGoResult {
  result: 'GO' | 'NO_GO';
  reasons: string[];
}

export function evaluateGoNoGo(input: GoNoGoInput): GoNoGoResult {
  const reasons: string[] = [];

  if (input.financialStatus !== 'VIAVEL') reasons.push('EVENT_NOT_FINANCIALLY_VIABLE');
  if (!input.allRequiredChecksApproved) reasons.push('REQUIRED_CHECKS_INCOMPLETE');
  if (!input.noFutureSalesAssumed) reasons.push('FUTURE_SALES_MUST_BE_ZERO_ASSUMPTION');
  if (input.barRevenueAssumed !== 0n) reasons.push('BAR_REVENUE_MUST_BE_ZERO_ASSUMPTION');
  if (input.projectedRequiredExposure > input.approvedExposureLimit) reasons.push('EXPOSURE_LIMIT_EXCEEDED');

  return { result: reasons.length === 0 ? 'GO' : 'NO_GO', reasons };
}
