import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const roots=['apps','supabase','packages','scripts'];
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(js|mjs|ts|html|json|md)$/.test(entry.name))files.push(full);}}
for(const root of roots)walk(root);
const content=files.map(file=>[file,fs.readFileSync(file,'utf8')]);
for(const [file,text] of content){
  assert.doesNotMatch(text,/\$aact_[A-Za-z0-9_-]{12,}/,`Asaas access token em ${file}`);
  assert.doesNotMatch(text,/whsec_[A-Za-z0-9_-]{12,}/,`Webhook secret em ${file}`);
  if(file.includes('public-hml'))assert.doesNotMatch(text,/\b(cardNumber|creditCardNumber|securityCode|cvv)\b/i,`Campo de cartão em ${file}`);
}
const publicSources=content.filter(([file])=>file.includes('apps/public-hml')).map(([,text])=>text).join('\n');
assert.doesNotMatch(publicSources,/Deno\.env|SUPABASE_DB_URL|ASAAS_ACCESS_TOKEN|ASAAS_WEBHOOK_AUTH_TOKEN/);

// O repositório possui adapters genéricos/legados com suporte futuro a produção.
// A proibição de endpoint de produção aplica-se somente à superfície executável
// do pacote HML V3, que deve ser Sandbox-only por construção.
const hmlV3ProductionBan = files.filter(file =>
  file.startsWith('supabase/functions/diretoria-asaas-') ||
  file.startsWith('supabase/functions/diretoria-checkout-') ||
  file === 'supabase/functions/diretoria-policy-admin/index.ts' ||
  file.startsWith('apps/hml/') ||
  file.startsWith('apps/public-hml/') ||
  file === 'packages/payments/asaas-checkout-webhook.ts'
);
const forbiddenProdAsaas='https://api.'+'asaas.com';
for(const file of hmlV3ProductionBan){
  if(!/\.(?:ts|js|mjs|html)$/.test(file))continue;
  const source=fs.readFileSync(file,'utf8');
  if(source.includes(forbiddenProdAsaas))throw new Error(`PRODUCTION_ASAAS_API_FORBIDDEN_IN_HML_V3:${file}`);
}
console.log(`OK: security scan local em ${files.length} arquivos; ${hmlV3ProductionBan.length} superfícies HML V3 sandbox-only`);
