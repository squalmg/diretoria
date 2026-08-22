import test from 'node:test';
import assert from 'node:assert/strict';
import { providerFeeMinor, quoteAsaasPassThrough, type AsaasAccountFeesResponse } from './asaas-fees.ts';

const standardFees: AsaasAccountFeesResponse = {
  payment: {
    pix: {
      fixedFeeValue: 1.99,
      fixedFeeValueWithDiscount: null,
      percentageFee: null,
      minimumFeeValue: null,
      maximumFeeValue: null,
      discountExpiration: null,
    },
    creditCard: {
      operationValue: 0.49,
      oneInstallmentPercentage: 2.99,
      upToSixInstallmentsPercentage: 3.49,
      upToTwelveInstallmentsPercentage: 3.99,
      upToTwentyOneInstallmentsPercentage: 4.29,
      discountExpiration: null,
    },
  },
};

test('Pix: preço-base de R$ 150 permanece R$ 150 líquidos após taxa fixa', () => {
  const quote = quoteAsaasPassThrough(15_000n, { method: 'pix' }, standardFees, new Date('2026-08-22T12:00:00-03:00'));
  assert.equal(quote.baseMinor, 15_000n);
  assert.equal(quote.processingFeeMinor, 199n);
  assert.equal(quote.totalMinor, 15_199n);
  assert.equal(quote.providerFeeOnTotalMinor, 199n);
  assert.equal(quote.netAfterProviderFeeMinor, 15_000n);
});

test('Cartão 1x: gross-up cobre R$ 0,49 + 2,99% calculados sobre o total cobrado', () => {
  const quote = quoteAsaasPassThrough(15_000n, { method: 'card', installments: 1 }, standardFees, new Date('2026-08-22T12:00:00-03:00'));
  assert.equal(quote.processingFeeMinor, 513n);
  assert.equal(quote.totalMinor, 15_513n);
  assert.equal(quote.providerFeeOnTotalMinor, 513n);
  assert.equal(quote.netAfterProviderFeeMinor, 15_000n);
});

test('Cartão parcelado seleciona a faixa de percentual correspondente', () => {
  const six = quoteAsaasPassThrough(20_000n, { method: 'card', installments: 6 }, standardFees);
  const twelve = quoteAsaasPassThrough(20_000n, { method: 'card', installments: 12 }, standardFees);
  assert.equal(six.feeModel.percentageBasisPoints, 349n);
  assert.equal(twelve.feeModel.percentageBasisPoints, 399n);
  assert.ok(twelve.totalMinor > six.totalMinor);
});

test('promoção de cartão é usada somente enquanto estiver vigente', () => {
  const fees: AsaasAccountFeesResponse = structuredClone(standardFees);
  fees.payment!.creditCard!.discountOneInstallmentPercentage = 1.5;
  fees.payment!.creditCard!.discountExpiration = '2026-08-31';

  const during = quoteAsaasPassThrough(10_000n, { method: 'card', installments: 1 }, fees, new Date('2026-08-22T12:00:00-03:00'));
  const after = quoteAsaasPassThrough(10_000n, { method: 'card', installments: 1 }, fees, new Date('2026-09-01T12:00:00-03:00'));
  assert.equal(during.feeModel.promotional, true);
  assert.equal(during.feeModel.percentageBasisPoints, 150n);
  assert.equal(after.feeModel.promotional, false);
  assert.equal(after.feeModel.percentageBasisPoints, 299n);
  assert.ok(during.totalMinor < after.totalMinor);
});

test('Pix percentual respeita tarifa mínima e máxima', () => {
  const fees: AsaasAccountFeesResponse = {
    payment: { pix: { fixedFeeValue: null, percentageFee: 1, minimumFeeValue: 1, maximumFeeValue: 5 } },
  };
  const small = quoteAsaasPassThrough(2_000n, { method: 'pix' }, fees);
  const large = quoteAsaasPassThrough(100_000n, { method: 'pix' }, fees);
  assert.equal(small.providerFeeOnTotalMinor, 100n);
  assert.equal(large.providerFeeOnTotalMinor, 500n);
});

test('gross-up é mínimo: um centavo a menos não preserva o preço-base', () => {
  const quote = quoteAsaasPassThrough(15_000n, { method: 'card', installments: 1 }, standardFees);
  const previous = quote.totalMinor - 1n;
  assert.ok(previous - providerFeeMinor(previous, quote.feeModel) < 15_000n);
});

test('parcelamento fora de 1 a 21 é bloqueado', () => {
  assert.throws(
    () => quoteAsaasPassThrough(15_000n, { method: 'card', installments: 22 }, standardFees),
    /ASAAS_CARD_INSTALLMENTS_INVALID/,
  );
});
