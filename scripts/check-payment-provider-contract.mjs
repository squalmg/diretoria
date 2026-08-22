import { readFileSync } from 'node:fs';

const source = readFileSync('packages/payments/provider-contract.ts', 'utf8').toLowerCase();

const forbiddenSignatures = [
  'api.mercadopago',
  '@stripe/',
  'stripe.com',
  'api.asaas',
  'asaas.com',
  'api.pagar.me',
  'pagar.me',
  'api.pagseguro',
  'pagseguro.uol',
  'api.gerencianet',
  'api.efipay',
  'efipay.com',
  'api.cielo',
  'cieloecommerce',
  'userede.com.br',
  'api.userede',
];

const found = forbiddenSignatures.filter((signature) => source.includes(signature));
if (found.length) {
  console.error(`Concrete payment provider signature found: ${found.join(', ')}`);
  process.exit(1);
}

for (const required of [
  "name = 'unconfigured'",
  'PAYMENT_PROVIDER_WEBHOOK_VERIFICATION_REQUIRED',
  'PAYMENT_PROVIDER_UNCONFIGURED',
  'signatureVerified: true',
]) {
  if (!source.includes(required.toLowerCase())) {
    console.error(`Missing required fail-closed contract marker: ${required}`);
    process.exit(1);
  }
}

console.log('OK: payment provider contract remains provider-neutral and fail-closed.');
