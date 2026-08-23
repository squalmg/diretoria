import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const roots=['apps','supabase','packages','scripts'];
const files=[];
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(/\.(js|mjs|ts|html|json|md)$/.test(entry.name))files.push(full);
  }
}
for(const root of roots)walk(root);

const content=files.map(file=>[file,fs.readFileSync(file,'utf8')]);
for(const [file,text] of content){
  // Secret material is forbidden everywhere in the repository.
  assert.doesNotMatch(text,/\$aact_[A-Za-z0-9_-]{12,}/,`Asaas access token em ${file}`);
  assert.doesNotMatch(text,/whsec_[A-Za-z0-9_-]{12,}/,`Webhook secret em ${file}`);
  if(file.includes('public-hml'))assert.doesNotMatch(text,/\b(cardNumber|creditCardNumber|securityCode|cvv)\b/i,`Campo de cartão em ${file}`);
}

const publicSources=content.filter(([file])=>file.includes('apps/public-hml')).map(([,text])=>text).join('\n');
assert.doesNotMatch(publicSources,/Deno\.env|SUPABASE_DB_URL|ASAAS_ACCESS_TOKEN|ASAAS_WEBHOOK_AUTH_TOKEN/);

// Legacy/provider-neutral packages may intentionally contain a production endpoint for a future
// production adapter. The HML V3 surfaces themselves are sandbox-only by construction.
const sandboxOnlyPrefixes=[
  'apps/public-hml/club.',
  'apps/hml/asaas-lab.',
  'apps/hml/policies.',
  'packages/payments/asaas-checkout-webhook.ts',
  'supabase/functions/diretoria-member-api/',
  'supabase/functions/diretoria-asaas-checkout-api/',
  'supabase/functions/diretoria-checkout-status/',
  'supabase/functions/diretoria-checkout-policy-api/',
  'supabase/functions/diretoria-policy-admin/',
  'supabase/functions/diretoria-asaas-webhook/',
  'supabase/functions/diretoria-asaas-hml-lab/',
];
const sandboxFiles=content.filter(([file])=>sandboxOnlyPrefixes.some(prefix=>file===prefix||file.startsWith(prefix)));
const forbiddenProdAsaas='https://api.'+'asaas.com';
for(const [file,text] of sandboxFiles){
  if(text.includes(forbiddenProdAsaas))throw new Error(`PRODUCTION_ASAAS_API_FORBIDDEN_IN_HML_V3:${file}`);
}

console.log(`OK: security scan em ${files.length} arquivos; sandbox-only validado em ${sandboxFiles.length} arquivos V3`);
