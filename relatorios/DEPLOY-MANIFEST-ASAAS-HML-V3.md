# MANIFESTO DE PUBLICAÇÃO ÚNICA — ASAAS HML V3

**Objetivo:** concentrar GitHub, Supabase, Vercel e a sincronização do Asaas Sandbox em uma única rodada depois da validação local.

## Base remota observada ao iniciar o desenvolvimento local

`0315749d9ee13b801074019e5f6cc47ff448a865`

**Obrigatório:** reconsultar `main` imediatamente antes de criar a árvore/commit. Não publicar sobre base divergente sem revisão.

## Estratégia GitHub

O conector suporta `create_tree` + `create_commit`.

A publicação final deverá preferir:

1. ler SHA/tree atuais da `main`;
2. criar uma branch única;
3. criar blobs/árvore com todos os arquivos V3;
4. criar **um commit técnico único**;
5. abrir **um PR**;
6. aguardar CI completo;
7. merge somente verde.

Isso evita dezenas de commits intermediários.

## Arquivos novos principais

### Public HML

- `apps/public-hml/club-flow.js`

### HML Admin

- `apps/hml/policies.html`
- `apps/hml/policies.js`
- `apps/hml/asaas-lab.html`
- `apps/hml/asaas-lab.js`

### Banco

- `packages/db/migrations/0025_checkout_consent_idempotency.sql`

### Payment / webhook support

- `packages/payments/asaas-checkout-webhook.ts`

### Edge Functions novas

- `supabase/functions/diretoria-asaas-checkout-api/`
- `supabase/functions/diretoria-checkout-status/`
- `supabase/functions/diretoria-checkout-policy-api/` — inclui `accept-guard.ts` transacional;
- `supabase/functions/diretoria-policy-admin/`
- `supabase/functions/diretoria-asaas-hml-lab/`

### Edge Function atualizada

- `supabase/functions/diretoria-member-api/` — remove orquestração financeira legada;
- `supabase/functions/diretoria-asaas-webhook/` — Checkout + Payment + recovery + reconciliation.

### Checks locais

- `scripts/check-asaas-hml-v3.mjs`
- `scripts/check-member-api-v3-local.mjs`
- `scripts/test-club-flow.mjs`
- `scripts/check-club-local.mjs`
- `scripts/test-hosted-checkout-client.mjs`
- `scripts/check-checkout-api-local.mjs`
- `scripts/check-checkout-start-guard-local.mjs`
- `scripts/check-checkout-status-local.mjs`
- `scripts/test-asaas-checkout-webhook.mjs`
- `scripts/check-asaas-webhook-local.mjs`
- `scripts/check-webhook-support-parity-local.mjs`
- `scripts/check-policy-admin-local.mjs`
- `scripts/check-checkout-policy-api-local.mjs`
- `scripts/check-consent-idempotency-local.mjs`
- `scripts/check-asaas-hml-lab-local.mjs`
- `scripts/check-refund-tracking-local.mjs`
- `scripts/check-webhook-config-manager-local.mjs`
- `scripts/check-preflight-local.mjs`
- `scripts/check-local-security.mjs`

### Integrações PostgreSQL finais

- `scripts/integration-asaas-hml-v3.ts`
- `scripts/integration-checkout-policy-v3.ts`
- `scripts/integration-checkout-start-guard.ts`

## Arquivos atualizados principais

- `apps/public-hml/club.html`
- `apps/public-hml/club.js`
- `apps/hml/index.html`
- `package.json`
- `scripts/check-hml-html.mjs`
- `.github/workflows/ci.yml` — adicionar somente o bloco em `relatorios/CI-PATCH-ASAAS-HML-V3.yml`.

## CI

`npm run check` executará a suíte V3 local.

Depois de aplicar migrations no PostgreSQL 18.6 do CI:

```yaml
- name: Asaas HML V3 database integration
  env:
    DATABASE_URL: postgresql://diretoria:ci_only_password@localhost:5432/diretoria
  run: |
    npm run integration:asaas-hml-v3
    npm run integration:checkout-policy-v3
    npm run integration:checkout-start-guard
```

## Ordem única de publicação HML

1. confirmar SHA atual da `main`;
2. criar um commit/PR V3;
3. CI estático + PostgreSQL totalmente verde;
4. merge;
5. aplicar migration `0025_checkout_consent_idempotency.sql` no Supabase HML;
6. publicar Edge `diretoria-member-api` V3;
7. publicar Edge `diretoria-asaas-checkout-api`;
8. publicar Edge `diretoria-checkout-status`;
9. publicar Edge `diretoria-checkout-policy-api`;
10. publicar Edge `diretoria-policy-admin`;
11. publicar Edge `diretoria-asaas-webhook` V3;
12. publicar Edge `diretoria-asaas-hml-lab`;
13. validar health/fingerprints V3;
14. publicar `apps/hml` no projeto HML correto;
15. publicar `apps/public-hml` no projeto público HML correto;
16. no Asaas Lab, executar `webhook audit`;
17. se necessário, executar **webhook sync** automático no Sandbox;
18. criar/ativar os 3 documentos jurídicos aprovados;
19. executar preflight para `hml-asaas-sandbox`;
20. somente se `GO`, iniciar primeiro Pix Sandbox.

## Eventos canônicos do webhook Sandbox

Checkout:

- `CHECKOUT_CREATED`
- `CHECKOUT_CANCELED`
- `CHECKOUT_EXPIRED`
- `CHECKOUT_PAID`

Payment:

- `PAYMENT_CREATED`
- `PAYMENT_AWAITING_RISK_ANALYSIS`
- `PAYMENT_APPROVED_BY_RISK_ANALYSIS`
- `PAYMENT_AUTHORIZED`
- `PAYMENT_UPDATED`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_REPROVED_BY_RISK_ANALYSIS`
- `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`
- `PAYMENT_REFUNDED`
- `PAYMENT_PARTIALLY_REFUNDED`
- `PAYMENT_REFUND_IN_PROGRESS`
- `PAYMENT_REFUND_DENIED`
- `PAYMENT_CHARGEBACK_REQUESTED`
- `PAYMENT_CHARGEBACK_DISPUTE`
- `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`

**Não configurar manualmente se o Lab V3 estiver publicado.** O Lab audita e sincroniza a lista exata na URL canônica usando o secret HML server-side.

## Políticas obrigatórias

- `club_terms`
- `non_achievement_policy`
- `privacy_policy`

Não incluir texto jurídico no código ou migration.

## Fingerprint V3

Marker comum:

`asaas-hml-v3-20260823`

O preflight exige:

- member API com `legacyPaymentRoutes=disabled`;
- checkout API com start-lock/session persistence;
- webhook com binding recovery;
- policy API com migration 0025;
- policy-admin com privacy;
- status API read-only;
- Public HML com marker V3.

## Critério GO antes do primeiro Pix

- **19 gates locais verdes**;
- syntax-check verde;
- CI completo verde;
- 3 integrações PostgreSQL verdes;
- migration 0025 aplicada;
- nenhum secret no diff;
- nenhum endpoint de produção no pacote HML;
- rotas financeiras legadas da member API desativadas;
- webhook Sandbox conforme;
- 3 documentos ativos e aprovados;
- nenhuma reconciliação pendente;
- nenhum estorno em estado não terminal;
- preflight `GO`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
