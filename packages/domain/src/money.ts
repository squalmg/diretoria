export type MoneyCents = bigint;

export function moneyFromReais(reais: number): MoneyCents {
  if (!Number.isFinite(reais)) throw new Error('MONEY_INVALID');
  return BigInt(Math.round(reais * 100));
}

export function formatMoneyBRL(cents: MoneyCents): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${grouped},${fraction}`;
}

export function assertNonNegativeMoney(value: MoneyCents, code: string): void {
  if (value < 0n) throw new Error(code);
}
