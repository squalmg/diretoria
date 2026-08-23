# ASAAS HML V3 — CHECKPOINT LOCAL

**Data:** 23/08/2026  
**Escopo:** Incremento 3 — Diretoria Club / Asaas Sandbox  
**Base remota validada:** `0315749d9ee13b801074019e5f6cc47ff448a865`

O V3 foi desenvolvido localmente antes da rodada externa. O pacote fechou **19 gates locais verdes**, syntax-check dos executáveis e três integrações PostgreSQL preparadas para o CI final.

Principais invariantes: hosted checkout, separação preço-base/taxa/total, `privacy_policy` junto a `club_terms` e `non_achievement_policy`, aceite atômico com consentimentos terms/privacy, start-lock transacional, cotação idempotente, webhook `CHECKOUT_*` + `PAYMENT_*`, Pix `PAYMENT_CONFIRMED` não final, binding recovery, divergências financeiras em reconciliação, refund integral, `PAYMENT_REFUND_IN_PROGRESS` operacional, `PAYMENT_REFUND_DENIED` terminal sem alterar crédito e parcial em NO-GO/reconciliação.

A `diretoria-member-api` V3 desativa as rotas financeiras legadas (`legacyPaymentRoutes=disabled`) e desloca a orquestração para APIs dedicadas.

A migration `0025_checkout_consent_idempotency.sql` cria unicidade parcial para consentimentos ativos `terms` e `privacy` por versão.

Nenhum secret foi incluído no código. Os helpers HML são Sandbox-only e não contêm endpoint de produção do Asaas.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
