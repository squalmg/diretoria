import fs from 'node:fs';
import assert from 'node:assert/strict';
const pkg=fs.readFileSync('packages/payments/asaas-checkout-webhook.ts','utf8');
const edge=fs.readFileSync('supabase/functions/diretoria-asaas-webhook/checkout-support.ts','utf8');
function normalize(source){return source.replace(/^import type \{ PaymentMethod, RawWebhookRequest, VerifiedWebhook \} from .*?;\n/,'__PROVIDER_CONTRACT_IMPORT__\n');}
assert.equal(normalize(edge),normalize(pkg),'Node test helper and Deno edge webhook normalizer diverged');
console.log('OK: normalizador Asaas Node/Deno permanece em paridade byte-a-byte fora do import');
