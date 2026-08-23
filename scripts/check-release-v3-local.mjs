import fs from'node:fs';import assert from'node:assert/strict';import path from'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const required=[
 'package.json',
 'apps/public-hml/club.html','apps/public-hml/club.js','apps/public-hml/club-flow.js',
 'apps/hml/policies.html','apps/hml/policies.js','apps/hml/asaas-lab.html','apps/hml/asaas-lab.js',
 'packages/db/migrations/0025_checkout_consent_idempotency.sql','packages/payments/asaas-checkout-webhook.ts',
 'supabase/functions/diretoria-member-api/index.ts',
 'supabase/functions/diretoria-asaas-checkout-api/index.ts','supabase/functions/diretoria-asaas-checkout-api/start-guard.ts','supabase/functions/diretoria-asaas-checkout-api/hosted-checkout.ts',
 'supabase/functions/diretoria-checkout-status/index.ts','supabase/functions/diretoria-checkout-policy-api/index.ts','supabase/functions/diretoria-policy-admin/index.ts',
 'supabase/functions/diretoria-asaas-webhook/index.ts','supabase/functions/diretoria-asaas-webhook/checkout-reconciliation.ts','supabase/functions/diretoria-asaas-webhook/checkout-support.ts',
 'supabase/functions/diretoria-asaas-hml-lab/index.ts',
 'scripts/check-asaas-hml-v3.mjs','scripts/integration-asaas-hml-v3.ts','scripts/integration-checkout-policy-v3.ts','scripts/integration-checkout-start-guard.ts',
 'relatorios/2026-08-23-ASAAS-HML-V3-LOCAL.md','relatorios/DEPLOY-MANIFEST-ASAAS-HML-V3.md','relatorios/CI-PATCH-ASAAS-HML-V3.yml','relatorios/POLITICAS-HML-CHECKLIST.md','relatorios/PUBLISH-FILESET-ASAAS-HML-V3.txt'
];
for(const file of required)assert.ok(fs.existsSync(path.join(root,file)),`RELEASE_FILE_MISSING:${file}`);
for(const legacy of ['scripts/check-asaas-hml-v2.mjs','scripts/integration-asaas-hml-v2.ts','scripts/integration-checkout-policy-v2.ts','relatorios/2026-08-23-ASAAS-HML-V2-LOCAL.md','relatorios/DEPLOY-MANIFEST-ASAAS-HML-V2.md'])assert.ok(!fs.existsSync(path.join(root,legacy)),`LEGACY_V2_FILE_PRESENT:${legacy}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(pkg.scripts['asaas:hml-v3:check'],'node scripts/check-asaas-hml-v3.mjs');
assert.ok(pkg.scripts.check.includes('asaas:hml-v3:check'));
assert.ok(pkg.scripts['integration:asaas-hml-v3']);assert.ok(pkg.scripts['integration:checkout-policy-v3']);assert.ok(pkg.scripts['integration:checkout-start-guard']);
const ciPatch=fs.readFileSync(path.join(root,'relatorios/CI-PATCH-ASAAS-HML-V3.yml'),'utf8');
for(const cmd of ['npm run integration:asaas-hml-v3','npm run integration:checkout-policy-v3','npm run integration:checkout-start-guard'])assert.ok(ciPatch.includes(cmd),`CI_PATCH_MISSING:${cmd}`);
const deploy=fs.readFileSync(path.join(root,'relatorios/DEPLOY-MANIFEST-ASAAS-HML-V3.md'),'utf8');
for(const needle of ['19 gates locais verdes','0025_checkout_consent_idempotency.sql','legacyPaymentRoutes=disabled','webhook sync','privacy_policy','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_REFUND_DENIED','nenhum estorno em estado não terminal'])assert.ok(deploy.includes(needle),`DEPLOY_MANIFEST_MISSING:${needle}`);
const migration=fs.readFileSync(path.join(root,'packages/db/migrations/0025_checkout_consent_idempotency.sql'),'utf8');
assert.ok(migration.trim().startsWith('BEGIN;')&&migration.trim().endsWith('COMMIT;'));
assert.match(migration,/consent_type IN \('terms','privacy'\)/);
const publish=fs.readFileSync(path.join(root,'relatorios/PUBLISH-FILESET-ASAAS-HML-V3.txt'),'utf8');for(const needle of ['[PATCH_REMOTE]','.github/workflows/ci.yml','[UPSERT_FROM_LOCAL]','[LOCAL_ONLY_DO_NOT_COMMIT]','supabase/functions/diretoria-asaas-hml-lab/index.ts'])assert.ok(publish.includes(needle),`PUBLISH_FILESET_MISSING:${needle}`);
const marker='asaas-hml-v3-20260823';
for(const file of ['apps/public-hml/club.html','supabase/functions/diretoria-member-api/index.ts','supabase/functions/diretoria-asaas-checkout-api/index.ts','supabase/functions/diretoria-checkout-status/index.ts','supabase/functions/diretoria-checkout-policy-api/index.ts','supabase/functions/diretoria-policy-admin/index.ts','supabase/functions/diretoria-asaas-webhook/index.ts','supabase/functions/diretoria-asaas-hml-lab/index.ts'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes(marker),`V3_MARKER_MISSING:${file}`);
console.log(`OK: release manifest V3 consistente em ${required.length} arquivos obrigatórios`);
