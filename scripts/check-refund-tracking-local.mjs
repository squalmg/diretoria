import fs from 'node:fs';import assert from 'node:assert/strict';
const webhook=fs.readFileSync(new URL('../supabase/functions/diretoria-asaas-webhook/index.ts',import.meta.url),'utf8');
const recon=fs.readFileSync(new URL('../supabase/functions/diretoria-asaas-webhook/checkout-reconciliation.ts',import.meta.url),'utf8');
assert.match(webhook,/markRefundFinal\(result\.paymentId\)/);
assert.match(recon,/ASAAS_WEBHOOK_EXTERNAL_REFUND/);
assert.match(recon,/update refunds set status='paid'/);
assert.match(recon,/recordPartialRefundReconciliation/);
assert.match(recon,/payment\.partial_refund_reconciliation/);
assert.match(recon,/reconciliation_status='required'/);
assert.match(webhook,/PAYMENT_PARTIALLY_REFUNDED/);
assert.match(webhook,/reconciliationRequired:true/);
console.log('OK: refund webhook finaliza refunds, parcial exige reconciliação e lifecycle progress/denied é não-econômico');
assert.match(recon,/recordRefundProgress/);
assert.match(recon,/payment\.refund_in_progress/);
assert.match(recon,/ASAAS_WEBHOOK_EXTERNAL_REFUND_IN_PROGRESS/);
assert.match(recon,/recordRefundDenied/);
assert.match(recon,/payment\.refund_denied/);
assert.match(recon,/ASAAS_REFUND_DENIED_TERMINAL/);
assert.match(webhook,/PAYMENT_REFUND_IN_PROGRESS/);
assert.match(webhook,/PAYMENT_REFUND_DENIED/);
assert.match(webhook,/economicStateChanged:false/);


assert.match(recon,/reconciliation_status=case when reconciliation_status in\('pending','required'\) then 'resolved'/);
