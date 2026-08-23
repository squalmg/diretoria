# ASAAS HML V3 — CHECKPOINT LOCAL

**Data:** 23/08/2026  
**Escopo:** Incremento 3 — Diretoria Club / Asaas Sandbox  
**Modo:** desenvolvimento consolidado localmente antes da rodada externa única  
**Base remota validada:** `0315749d9ee13b801074019e5f6cc47ff448a865`

## Resultado

O pacote V3 foi endurecido localmente antes de qualquer publicação externa. A suíte local encerrou com **19/19 gates verdes** e o pacote permanece exclusivo de HML/Sandbox.

Principais invariantes consolidadas:

- `base + taxa repassada = total cliente`;
- taxa Asaas não aumenta crédito nem capital protegido;
- Pix `PAYMENT_CONFIRMED` permanece pendente e `PAYMENT_RECEIVED` é o evento final;
- hosted checkout não recebe PAN/CVV;
- start-lock transacional evita dois checkouts concorrentes;
- provider session é persistida antes do bind completo;
- webhook pode recuperar binding/pagamento interno ausente sem criar outro checkout;
- divergência financeira permanente vai para reconciliação e não gera loop de webhook;
- refund integral depende do webhook para reverter crédito/quórum;
- refund parcial é NO-GO e exige reconciliação;
- `PAYMENT_REFUND_IN_PROGRESS` e `PAYMENT_REFUND_DENIED` são rastreados sem alterar indevidamente o crédito;
- políticas exigidas: `club_terms`, `non_achievement_policy` e `privacy_policy`;
- aceite jurídico grava policy acceptances e consentimentos `terms/privacy` atomicamente;
- migration `0025_checkout_consent_idempotency.sql` protege replay concorrente;
- rotas financeiras legadas da `diretoria-member-api` ficam desativadas em favor das APIs V3 dedicadas;
- preflight valida build/fingerprint de todas as Edges, migration, webhook, políticas, reconciliações, refunds e Public HML;
- helpers deste pacote são **sandbox-only por construção** e não contêm endpoint Asaas de produção.

## APIs V3

```text
Public HML
  ├─ diretoria-member-api             → oferta, conta e intent
  ├─ diretoria-checkout-policy-api    → bundle + aceite + consentimentos
  ├─ diretoria-asaas-checkout-api     → cotação + start-lock + hosted checkout
  └─ diretoria-checkout-status        → leitura financeira autenticada

Asaas Sandbox
  └─ diretoria-asaas-webhook          → autoridade externa para efeitos financeiros

HML Admin
  ├─ diretoria-policy-admin           → draft/version/activate
  └─ diretoria-asaas-hml-lab          → preflight/webhook sync/refund Sandbox
```

## CI preparado

O workflow principal usa o PostgreSQL 18.6 existente e passa a executar, após as migrations:

```text
npm run integration:asaas-hml-v3
npm run integration:checkout-policy-v3
npm run integration:checkout-start-guard
```

## Próxima sequência

```text
1 commit técnico
→ 1 PR
→ CI completo
→ merge somente verde
→ migration 0025 no Supabase HML
→ deploy das Edges V3
→ deploy HML/Public HML
→ webhook audit/sync Sandbox
→ ativar 3 políticas aprovadas
→ preflight
→ primeiro Pix Sandbox somente com GO
```

Nenhum secret foi colocado no repositório ou neste relatório. Produção permanece fora do escopo.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
