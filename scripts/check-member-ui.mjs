import { readFileSync } from 'node:fs';

const source = readFileSync('apps/public-hml/account.js', 'utf8');

const required = [
  ['publishable Supabase key marker', 'SUPABASE_PUBLISHABLE'],
  ['explicit ticketing-not-implemented marker', 'ticketsImplemented'],
  ['member API bootstrap', '/account/bootstrap'],
  ['read-only wallet', '/wallet'],
];

for (const [label, token] of required) {
  if (!source.includes(token)) {
    console.error(`Missing required member UI capability: ${label} (${token})`);
    process.exit(1);
  }
}

const forbidden = [
  ['checkout', /\bcheckout\b/i],
  ['Stripe', /\bstripe\b/i],
  ['Mercado Pago', /\bmercado\s*pay|\bmercadopago\b/i],
  ['economic admin write API', /diretoria-admin-write-api/i],
  ['mock payment write endpoint', /\/mock-payments(?:\/|['"`])/i],
  ['payment intent', /paymentIntent/i],
  ['refund write endpoint', /\/payments\/[^'"`]+\/refund/i],
];

for (const [label, pattern] of forbidden) {
  const match = source.match(pattern);
  if (match) {
    const index = match.index ?? 0;
    const line = source.slice(0, index).split(/\r?\n/).length;
    console.error(`Forbidden economic capability in member UI: ${label} at line ${line}: ${match[0]}`);
    process.exit(1);
  }
}

console.log('OK: member UI is authentication + read-only wallet only.');
