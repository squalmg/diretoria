# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 3 — Club e pagamento Asaas  
**Estado:** **ASAAS DEFINIDO PARA V1; FLUXO HML PUBLICADO EM FAIL-CLOSED; PAGAMENTO SANDBOX AINDA BLOQUEADO POR SECRETS E POLÍTICAS**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- Fundação/HML-G0: **APROVADOS**;
- núcleo econômico: **APROVADO**;
- Incremento 2 técnico — aquisição/CRM/pré-anúncio: **CONCLUÍDO**;
- Incremento 3: **em andamento**.

Merges relevantes:

- PR #13 — autenticação pública + carteira HML;
- PR #14 — oferta Club + checkout intent;
- PR #15 — notificações provider-neutral;
- PR #16 — contrato seguro de gateway;
- PR #17 — políticas versionadas + gate de aceite;
- PR #19 — repasse integral das taxas Asaas;
- PR #20 — adapter Asaas fail-closed;
- PR #21 — lifecycle transacional Asaas `checkout → payment → credit → quorum → reversal`;
- PR #22 — Edge API HML + webhook Asaas.

Últimos merges:

- PR #21: `c0fefccf0cf71b664ed6860b595dbe1bb037b827`;
- PR #22: `e618b7e6b3d48d92a7d60f3882b4050054b0de44`.

# Decisão canônica de pagamento

## Gateway V1

**Asaas.**

A decisão do projeto é:

> O preço-base da Diretoria deve ser preservado. Taxas do meio de pagamento são cobradas adicionalmente do cliente e não compõem receita protegida/quórum.

Consequências implementadas:

- `base_amount`: preço da Diretoria;
- `processing_fee_amount`: taxa repassada ao cliente;
- `amount_gross`: total cobrado;
- `provider_fee_actual`: taxa efetivamente cobrada pelo Asaas;
- crédito nasce pelo preço-base, nunca pelo total cobrado;
- capital protegido ignora taxa repassada;
- se a taxa real for maior que a taxa repassada, o fluxo falha fechado para reconciliação em vez de corroer silenciosamente a base econômica.

## Cotação

O sistema não fixa taxas públicas como verdade permanente.

Em HML, quando o Sandbox estiver configurado:

1. consulta `GET /v3/myAccount/fees/`;
2. calcula gross-up da taxa da conta;
3. congela base/taxa/total no checkout intent;
4. grava snapshot + hash da fonte da cotação.

Primeiro escopo Sandbox:

- Pix;
- cartão **1x**;
- hosted checkout Asaas;
- nenhum dado de cartão passa pela Diretoria.

Parcelamento maior só deve ser liberado após validar o comportamento real de cobrança/tarifa no Sandbox.

# HML canônico

## Supabase

- projeto/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- migrations aplicadas: `0001–0024`;
- `diretoria-member-api`: **ACTIVE v3**;
- `diretoria-asaas-webhook`: **ACTIVE v1**;
- `diretoria-admin-api`: ACTIVE;
- `diretoria-admin-write-api`: ACTIVE;
- `diretoria-public-api`: ACTIVE;
- `diretoria-crm-api`: ACTIVE;
- `diretoria-pre-ad-api`: ACTIVE.

## Public HML

- `https://diretoria-public-hml.vercel.app`;
- `/`: reativação + waitlist + consent;
- `/account.html`: autenticação + carteira;
- `/club.html`: oferta Club HML.

# Fluxo Asaas já implementado

```text
conta autenticada
   ↓
checkout_intent DRAFT
   ↓
consulta taxa real da conta Asaas
   ↓
freeze quote
base + taxa repassada = total cliente
   ↓
políticas vigentes aceitas?
   ↓ NÃO → BLOQUEIA
   ↓ SIM
hosted checkout Asaas
   ↓
payment interno PENDING
   ↓
webhook autenticado Asaas
   ↓
validação de provider / intent / valor / moeda / método
   ↓
PAID
   ↓
crédito válido apenas pelo PREÇO-BASE
   ↓
quórum recalculado
```

## Timeout / incerteza na criação

`POST /v3/checkouts` **não recebe retry automático cego**.

Se houver timeout, falha de rede ou resposta ambígua:

`checkout_intent.reconciliation_status = required`

O sistema exige reconciliação antes de nova tentativa.

# Webhook

Edge:

`https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook`

Características:

- `verify_jwt=false` por necessidade de integração externa;
- autenticação customizada via `asaas-access-token`;
- comparação constante do token;
- raw body preservado para hash;
- eventos idempotentes por ID do Asaas;
- um `payment` por checkout intent;
- um crédito por payment;
- gateway payment ID não pode trocar silenciosamente;
- refund/chargeback removem o crédito válido e recalculam quórum;
- `paid` tardio após refund não ressuscita crédito automaticamente.

# Evidência de teste do lifecycle

Cenário sintético validado em PostgreSQL 18.6:

- preço-base: **R$ 150,00**;
- taxa repassada: **R$ 5,13**;
- total cliente: **R$ 155,13**;
- custo variável: **R$ 10,00**;
- crédito bruto: **R$ 150,00**;
- capital protegido: **R$ 140,00**;
- taxa não entra no crédito;
- replay não duplica crédito;
- segundo evento de confirmação não duplica crédito;
- refund invalida crédito;
- capital protegido válido volta a zero;
- evento paid tardio após refund é bloqueado.

No head final do PR #21 todos os 10 pipelines ficaram verdes, incluindo `asaas-orchestrator`, CI completo, Club, member-auth, policies, notifications, aquisição e CRM.

No head final do PR #22 ficaram verdes:

- `asaas-edge-hml`;
- `club-checkout`;
- `member-auth`;
- `public-leads`;
- `pre-ad-gate`;
- `crm-read`;
- `ci` completo com backup/restore.

# Estado de segurança atual

As Edge Functions Asaas foram publicadas **sem secrets no repositório**.

Enquanto não existirem no Supabase HML:

- `ASAAS_ACCESS_TOKEN`;
- `ASAAS_WEBHOOK_AUTH_TOKEN`;

as chamadas de pagamento falham fechado.

Nenhuma credencial Asaas deve ser colada em chat, código, issue, commit ou relatório.

# Policy gate

Antes de iniciar checkout, o backend exige versões ativas e aceitas para:

- `club_terms`;
- `non_achievement_policy`.

Contexto de aceite:

`club_checkout`

As tabelas estão prontas, mas **o conteúdo jurídico real não deve ser inventado pelo código**.

# O que falta para o primeiro pagamento SANDBOX

1. criar/usar conta Sandbox Asaas;
2. gerar API key Sandbox;
3. gerar token forte exclusivo do webhook;
4. cadastrar ambos como secrets no Supabase HML;
5. configurar no Asaas Sandbox o webhook da Diretoria com o mesmo token;
6. cadastrar políticas de teste/aprovadas e ativá-las;
7. registrar aceite de um usuário HML;
8. atualizar `/club.html` para a UX final `escolher método → cotar taxa → mostrar base/taxa/total → iniciar hosted checkout`;
9. executar pagamento Pix Sandbox;
10. validar webhook → payment → crédito → quórum;
11. repetir com cartão 1x;
12. testar webhook duplicado, timeout, refund e evento fora de ordem.

# O que falta antes de PRODUÇÃO

- credencial Asaas de produção separada do Sandbox;
- confirmar taxas efetivas da conta de produção;
- políticas jurídicas/comerciais finais;
- regra final de reembolso/rollover, incluindo tratamento da taxa do Asaas que não seja devolvida pelo provedor;
- preço fundador definitivo;
- testes completos de Sandbox;
- observabilidade/alertas do webhook e reconciliação;
- revisão de segurança;
- nenhuma promoção automática de secrets HML para produção.

# Progresso macro

- Incremento 0 — Fundação: **concluído**;
- Incremento 1 — Núcleo econômico: **concluído**;
- Incremento 2 — Reativação/aquisição técnico: **concluído**;
- Incremento 3 — Club/pagamento: **Asaas escolhido e infraestrutura/lifecycle HML implementados; falta configurar Sandbox e validar pagamentos reais de teste**;
- Incremento 4 — Confirmação/venda pública/ticketing: **não iniciado como slice completo**;
- Incremento 5 — Produção/financeiro: **não iniciado**;
- Incremento 6 — Event Day: **não iniciado**;
- Incremento 7 — Bar/fechamento: **não iniciado**;
- Incremento 8 — Retenção: **não iniciado**.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
