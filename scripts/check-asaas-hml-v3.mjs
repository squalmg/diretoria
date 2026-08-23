import {spawnSync} from 'node:child_process';
const commands=[
 ['node',['scripts/test-club-flow.mjs']],
 ['node',['scripts/check-club-local.mjs']],
 ['node',['--experimental-strip-types','scripts/test-hosted-checkout-client.mjs']],
 ['node',['scripts/check-member-api-v3-local.mjs']],
 ['node',['scripts/check-checkout-api-local.mjs']],
 ['node',['scripts/check-checkout-start-guard-local.mjs']],
 ['node',['scripts/check-checkout-status-local.mjs']],
 ['node',['--experimental-strip-types','scripts/test-asaas-checkout-webhook.mjs']],
 ['node',['scripts/check-asaas-webhook-local.mjs']],
 ['node',['scripts/check-webhook-support-parity-local.mjs']],
 ['node',['scripts/check-policy-admin-local.mjs']],
 ['node',['scripts/check-checkout-policy-api-local.mjs']],
 ['node',['scripts/check-consent-idempotency-local.mjs']],
 ['node',['scripts/check-asaas-hml-lab-local.mjs']],
 ['node',['scripts/check-refund-tracking-local.mjs']],
 ['node',['scripts/check-webhook-config-manager-local.mjs']],
 ['node',['scripts/check-preflight-local.mjs']],
 ['node',['scripts/check-local-security.mjs']],
 ['node',['scripts/check-release-v3-local.mjs']],
];
for(const [bin,args] of commands){const result=spawnSync(bin,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
console.log(`OK: pacote local Asaas HML V3 — ${commands.length} gates verdes`);
