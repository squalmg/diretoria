export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'chargeback';

export function isPaymentEligibleForCredit(status: PaymentStatus): boolean {
  return status === 'paid';
}

export function isPaymentEligibleForProtectedCapital(status: PaymentStatus): boolean {
  return status === 'paid';
}
