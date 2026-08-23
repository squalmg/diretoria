# DEPLOY MANIFEST — ASAAS HML V3

## Critério de release

- **19 gates locais verdes**;
- CI completo verde;
- integrações PostgreSQL `integration:asaas-hml-v3`, `integration:checkout-policy-v3` e `integration:checkout-start-guard` verdes;
- migrations `0025_checkout_consent_idempotency.sql` e `0026_checkout_intent_status_text.sql` aplicadas no HML;
- member API com `legacyPaymentRoutes=disabled`;
- policy gate com `club_terms`, `non_achievement_policy` e `privacy_policy`;
- webhook sync conforme a lista canônica Sandbox;
- nenhuma reconciliação pendente;
- nenhum estorno em estado não terminal;
- preflight `GO` antes do primeiro Pix.

## Ordem

1. PR/CI/merge.
2. Aplicar migrations 0025 e 0026 no Supabase HML.
3. Publicar `diretoria-member-api` V3.
4. Publicar `diretoria-asaas-checkout-api`.
5. Publicar `diretoria-checkout-status`.
6. Publicar `diretoria-checkout-policy-api`.
7. Publicar `diretoria-policy-admin`.
8. Publicar `diretoria-asaas-webhook` V3.
9. Publicar `diretoria-asaas-hml-lab`.
10. Publicar HML e Public HML nos projetos corretos.
11. No Lab, executar webhook audit e, se necessário, **webhook sync**.
12. Criar/ativar os três documentos aprovados, inclusive `privacy_policy`.
13. Rodar preflight e só testar Pix Sandbox em `GO`.

## Eventos canônicos

`CHECKOUT_CREATED`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`, `CHECKOUT_PAID`, `PAYMENT_CREATED`, `PAYMENT_AWAITING_RISK_ANALYSIS`, `PAYMENT_APPROVED_BY_RISK_ANALYSIS`, `PAYMENT_AUTHORIZED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`.

Marker comum: `asaas-hml-v3-20260823`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
