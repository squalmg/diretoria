export interface AsaasCreditCardFees {
  operationValue?: number | null;
  oneInstallmentPercentage?: number | null;
  upToSixInstallmentsPercentage?: number | null;
  upToTwelveInstallmentsPercentage?: number | null;
  upToTwentyOneInstallmentsPercentage?: number | null;
  discountOneInstallmentPercentage?: number | null;
  discountUpToSixInstallmentsPercentage?: number | null;
  discountUpToTwelveInstallmentsPercentage?: number | null;
  discountUpToTwentyOneInstallmentsPercentage?: number | null;
  discountExpiration?: string | null;
  daysToReceive?: number | null;
}

export interface AsaasPixFees {
  fixedFeeValue?: number | null;
  fixedFeeValueWithDiscount?: number | null;
  percentageFee?: number | null;
  minimumFeeValue?: number | null;
  maximumFeeValue?: number | null;
  discountExpiration?: string | null;
  monthlyCreditsWithoutFee?: number | null;
  creditsReceivedOfCurrentMonth?: number | null;
}

export interface AsaasAccountFeesResponse {
  payment?: {
    creditCard?: AsaasCreditCardFees | null;
    pix?: AsaasPixFees | null;
  } | null;
}

export type AsaasQuoteMethod =
  | { method: 'pix' }
  | { method: 'card'; installments: number };

export interface AsaasPassThroughQuote {
  provider: 'asaas';
  method: 'pix' | 'card';
  installments: number | null;
  baseMinor: bigint;
  processingFeeMinor: bigint;
  totalMinor: bigint;
  providerFeeOnTotalMinor: bigint;
  netAfterProviderFeeMinor: bigint;
  feeModel: {
    mode: 'fixed' | 'percentage' | 'fixed_plus_percentage';
    fixedMinor: bigint;
    percentageBasisPoints: bigint;
    minimumMinor: bigint | null;
    maximumMinor: bigint | null;
    promotional: boolean;
    discountExpiration: string | null;
  };
}

function toMinor(value: number | null | undefined, code: string): bigint | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return BigInt(Math.round(value * 100));
}

function percentageToBasisPoints(value: number | null | undefined, code: string): bigint | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value >= 100) throw new Error(code);
  return BigInt(Math.round(value * 100));
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('ASAAS_FEE_INVALID_DENOMINATOR');
  if (numerator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

function promotionActive(expiration: string | null | undefined, quotedAt: Date): boolean {
  if (!expiration) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(expiration)
    ? `${expiration}T23:59:59.999-03:00`
    : expiration;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) && quotedAt.getTime() <= timestamp;
}

function cardPercentage(fees: AsaasCreditCardFees, installments: number, quotedAt: Date): { percentage: number; promotional: boolean } {
  if (!Number.isInteger(installments) || installments < 1 || installments > 21) {
    throw new Error('ASAAS_CARD_INSTALLMENTS_INVALID');
  }

  const regular = installments === 1
    ? fees.oneInstallmentPercentage
    : installments <= 6
      ? fees.upToSixInstallmentsPercentage
      : installments <= 12
        ? fees.upToTwelveInstallmentsPercentage
        : fees.upToTwentyOneInstallmentsPercentage;

  const discounted = installments === 1
    ? fees.discountOneInstallmentPercentage
    : installments <= 6
      ? fees.discountUpToSixInstallmentsPercentage
      : installments <= 12
        ? fees.discountUpToTwelveInstallmentsPercentage
        : fees.discountUpToTwentyOneInstallmentsPercentage;

  const useDiscount = promotionActive(fees.discountExpiration, quotedAt) && discounted != null;
  const selected = useDiscount ? discounted : regular;
  if (selected == null || !Number.isFinite(selected) || selected < 0 || selected >= 100) {
    throw new Error('ASAAS_CARD_FEE_NOT_AVAILABLE');
  }
  return { percentage: selected, promotional: useDiscount };
}

function pixFeeModel(fees: AsaasPixFees, quotedAt: Date) {
  const useDiscount = promotionActive(fees.discountExpiration, quotedAt) && fees.fixedFeeValueWithDiscount != null;
  const fixedSelected = useDiscount ? fees.fixedFeeValueWithDiscount : fees.fixedFeeValue;
  const fixedMinor = toMinor(fixedSelected, 'ASAAS_PIX_FIXED_FEE_INVALID');
  const percentageBps = percentageToBasisPoints(fees.percentageFee, 'ASAAS_PIX_PERCENTAGE_FEE_INVALID');

  // A resposta do Asaas suporta cobrança fixa ou percentual com mínimo/máximo.
  // Quando uma tarifa fixa está presente, ela é a regra operacional preferida.
  if (fixedMinor != null) {
    return {
      mode: 'fixed' as const,
      fixedMinor,
      percentageBasisPoints: 0n,
      minimumMinor: null,
      maximumMinor: null,
      promotional: useDiscount,
      discountExpiration: fees.discountExpiration ?? null,
    };
  }
  if (percentageBps != null) {
    const minimumMinor = toMinor(fees.minimumFeeValue, 'ASAAS_PIX_MINIMUM_FEE_INVALID');
    const maximumMinor = toMinor(fees.maximumFeeValue, 'ASAAS_PIX_MAXIMUM_FEE_INVALID');
    if (minimumMinor != null && maximumMinor != null && minimumMinor > maximumMinor) {
      throw new Error('ASAAS_PIX_FEE_LIMITS_INVALID');
    }
    return {
      mode: 'percentage' as const,
      fixedMinor: 0n,
      percentageBasisPoints: percentageBps,
      minimumMinor,
      maximumMinor,
      promotional: false,
      discountExpiration: fees.discountExpiration ?? null,
    };
  }
  throw new Error('ASAAS_PIX_FEE_NOT_AVAILABLE');
}

function cardFeeModel(fees: AsaasCreditCardFees, installments: number, quotedAt: Date) {
  const fixedMinor = toMinor(fees.operationValue, 'ASAAS_CARD_OPERATION_FEE_INVALID') ?? 0n;
  const percentage = cardPercentage(fees, installments, quotedAt);
  const percentageBasisPoints = percentageToBasisPoints(percentage.percentage, 'ASAAS_CARD_PERCENTAGE_FEE_INVALID');
  if (percentageBasisPoints == null) throw new Error('ASAAS_CARD_FEE_NOT_AVAILABLE');
  return {
    mode: fixedMinor > 0n ? 'fixed_plus_percentage' as const : 'percentage' as const,
    fixedMinor,
    percentageBasisPoints,
    minimumMinor: null,
    maximumMinor: null,
    promotional: percentage.promotional,
    discountExpiration: fees.discountExpiration ?? null,
  };
}

type FeeModel = ReturnType<typeof pixFeeModel> | ReturnType<typeof cardFeeModel>;

export function providerFeeMinor(totalMinor: bigint, model: FeeModel): bigint {
  if (totalMinor <= 0n) throw new Error('ASAAS_TOTAL_MUST_BE_POSITIVE');
  let variable = model.percentageBasisPoints > 0n
    ? ceilDiv(totalMinor * model.percentageBasisPoints, 10_000n)
    : 0n;
  if (model.minimumMinor != null && variable < model.minimumMinor) variable = model.minimumMinor;
  if (model.maximumMinor != null && variable > model.maximumMinor) variable = model.maximumMinor;
  return model.fixedMinor + variable;
}

function grossUp(baseMinor: bigint, model: FeeModel): { totalMinor: bigint; feeMinor: bigint } {
  if (baseMinor <= 0n) throw new Error('ASAAS_BASE_AMOUNT_MUST_BE_POSITIVE');
  if (model.percentageBasisPoints >= 10_000n) throw new Error('ASAAS_FEE_PERCENTAGE_TOO_HIGH');

  const net = (gross: bigint) => gross - providerFeeMinor(gross, model);
  let low = baseMinor;
  let high = baseMinor + model.fixedMinor + 1n;
  while (net(high) < baseMinor) {
    high *= 2n;
    if (high > baseMinor * 100n + 100_000_000n) throw new Error('ASAAS_FEE_GROSS_UP_UNBOUNDED');
  }
  while (low < high) {
    const mid = (low + high) / 2n;
    if (net(mid) >= baseMinor) high = mid;
    else low = mid + 1n;
  }
  const feeMinor = providerFeeMinor(low, model);
  return { totalMinor: low, feeMinor };
}

export function quoteAsaasPassThrough(
  baseMinor: bigint,
  method: AsaasQuoteMethod,
  accountFees: AsaasAccountFeesResponse,
  quotedAt = new Date(),
): AsaasPassThroughQuote {
  if (baseMinor <= 0n) throw new Error('ASAAS_BASE_AMOUNT_MUST_BE_POSITIVE');
  if (!(quotedAt instanceof Date) || Number.isNaN(quotedAt.getTime())) throw new Error('ASAAS_QUOTE_DATE_INVALID');

  let model: FeeModel;
  let installments: number | null;
  if (method.method === 'pix') {
    const fees = accountFees.payment?.pix;
    if (!fees) throw new Error('ASAAS_PIX_FEES_MISSING');
    model = pixFeeModel(fees, quotedAt);
    installments = null;
  } else {
    const fees = accountFees.payment?.creditCard;
    if (!fees) throw new Error('ASAAS_CARD_FEES_MISSING');
    model = cardFeeModel(fees, method.installments, quotedAt);
    installments = method.installments;
  }

  const { totalMinor, feeMinor } = grossUp(baseMinor, model);
  const processingFeeMinor = totalMinor - baseMinor;
  const netAfterProviderFeeMinor = totalMinor - feeMinor;
  if (netAfterProviderFeeMinor < baseMinor) throw new Error('ASAAS_FEE_PASS_THROUGH_INSUFFICIENT');

  return {
    provider: 'asaas',
    method: method.method,
    installments,
    baseMinor,
    processingFeeMinor,
    totalMinor,
    providerFeeOnTotalMinor: feeMinor,
    netAfterProviderFeeMinor,
    feeModel: model,
  };
}
