# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 3 — Club e pagamento Asaas  
**Estado:** **BACKEND ASAAS HML PRONTO E FAIL-CLOSED; BANCO CONECTADO; PRIMEIRO PAGAMENTO BLOQUEADO POR SECRETS, POLÍTICAS E DEPLOY DA UI PÚBLICA**

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
- PR #22 — Edge API HML + webhook Asaas;
- PR #23 — checkpoint documental;
- PR #24 — UX/API completa de checkout Sandbox `intent → quote → policies → accept → start`;
- PR #25 — correção do health do member API.

Últimos merges técnicos:

- PR #24: `683df475124d8cd47c6b262f37de7e659c84a0dc`;
- PR #25: `7a17ae7566540cdc3a2ed5ec60842c534be5c4cd`.

# Decisão canônica de pagamento

## Gateway V1

**Asaas.**

DEC-006 está decidida: Sandbox primeiro, hosted checkout, Pix + cartão 1x na fase inicial e credenciais de produção separadas.

Regra econômica:

> O preço-base da Diretoria deve ser preservado. Taxas do meio de pagamento são cobradas adicionalmente do cliente e não compõem crédito nem capital protegido/quórum.

Campos implementados:

- `base_amount`: preço da Diretoria;
- `processing_fee_amount`: taxa repassada ao cliente;
- `amount_gross`: total cobrado;
- `provider_fee_actual`: taxa efetivamente cobrada pelo Asaas.

O crédito nasce pelo preço-base. A taxa repassada não entra no quórum.

## Cotação

O sistema não fixa taxa pública como verdade permanente.

Quando as credenciais Sandbox estiverem disponíveis para a Edge:

1. consulta as taxas efetivas da conta Asaas;
2. calcula gross-up;
3. congela base/taxa/total no checkout intent;
4. grava snapshot + hash da cotação;
5. cria hosted checkout apenas depois dos gates.

# HML canônico

## Supabase

- projeto/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- migrations: `0001–0024`;
- `diretoria-member-api`: **ACTIVE v5**;
- `diretoria-asaas-webhook`: **ACTIVE v1**;
- banco: **connected**, validado ao vivo;
- `diretoria-admin-api`: ACTIVE;
- `diretoria-admin-write-api`: ACTIVE;
- `diretoria-public-api`: ACTIVE;
- `diretoria-crm-api`: ACTIVE;
- `diretoria-pre-ad-api`: ACTIVE.

O falso negativo anterior do health foi corrigido no PR #25. Se qualquer um dos três probes de banco falhar, o endpoint continua respondendo 503.

## Estado real dos secrets

Prova ao vivo da Edge v5:

```text
database: connected
checkoutProvider: asaas-sandbox-unconfigured
payments: disabled
```

Conclusão: `ASAAS_ACCESS_TOKEN` e/ou `ASAAS_WEBHOOK_AUTH_TOKEN` **ainda não estão disponíveis no runtime das Edge Functions HML**.

As credenciais não devem ser enviadas em chat nem gravadas em repositório.

# Evento HML preparado

Edição exclusivamente sintética:

- código: `HML-ASAAS-001`;
- slug: `hml-asaas-sandbox`;
- status: `QUORUM_EM_ANDAMENTO`;
- preço-base: **R$ 150,00**;
- custo variável por membro: **R$ 10,00**;
- taxa fixa na config: **R$ 0,00**;
- `fee_pass_through = true`;
- custo protegido sintético: **R$ 280,00**.

Consequência esperada:

- crédito válido por pagamento: **R$ 150,00**;
- contribuição protegida por crédito: **R$ 140,00**;
- 1 crédito: ainda abaixo do custo protegido;
- 2 créditos: R$ 280,00 protegidos, permitindo validar a mudança de viabilidade pelo núcleo econômico;
- refund/chargeback retira a contribuição e recalcula quórum.

Nenhum `VIAVEL` ou `CONFIRMADO` foi forçado.

# Estado do banco financeiro

Checkpoint atual:

- eventos: **1**;
- `policy_documents`: **0**;
- `policy_acceptances`: **0**;
- `checkout_intents`: **0**;
- `payments`: **0**;
- `payment_webhook_receipts`: **0**;
- `credits`: **0**.

Portanto nenhum pagamento ou crédito foi criado nesta preparação.

# Fluxo Asaas implementado

```text
conta autenticada
   ↓
checkout_intent DRAFT
   ↓
consulta taxa efetiva da conta Asaas
   ↓
freeze quote
base + taxa repassada = total cliente
   ↓
políticas vigentes carregadas
   ↓
aceite do fingerprint vigente
   ↓
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

`POST /v3/checkouts` não recebe retry automático cego.

Timeout, falha de rede ou resposta ambígua colocam a intenção em reconciliação obrigatória antes de qualquer nova criação.

# Policy gate

Antes de `/start`, o backend exige versões ativas e aceitas para:

- `club_terms`;
- `non_achievement_policy`.

Contexto:

`club_checkout`

A API v5 expõe:

- `GET /checkout-policies` — apenas bundle ativo atual;
- `POST /checkout-policies/accept` — aceita apenas o fingerprint vigente e resolve IDs no servidor.

Bundles desatualizados são rejeitados.

**Não há conteúdo jurídico cadastrado.** Nenhum texto será inventado pelo código.

# Webhook

URL HML:

`https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook`

Características:

- `verify_jwt=false` somente para permitir chamada externa do Asaas;
- autenticação própria via `asaas-access-token`;
- comparação constante do token;
- raw body preservado para hash;
- idempotência por evento;
- um payment por checkout intent;
- um crédito por payment;
- gateway payment ID não troca silenciosamente;
- refund/chargeback invalidam crédito e recalculam quórum;
- paid tardio após refund não ressuscita crédito automaticamente.

# Public HML

URL:

`https://diretoria-public-hml.vercel.app`

A nova UX de `/club.html` está mergeada na `main` pelo PR #24 e contém:

- método Pix/cartão 1x;
- cotação da taxa;
- breakdown preço-base/taxa/total;
- leitura das políticas vigentes;
- aceite;
- início do hosted checkout;
- retorno explicitamente não autoritativo.

**Porém o domínio público ainda serve a versão anterior da UI.** A validação ao vivo confirmou isso.

O projeto público Vercel não está Git-linked e a operação de deploy disponível não permite selecionar explicitamente o project ID. Não fazer deploy ambíguo.

# Evidência dos pipelines

PR #24: pipelines relevantes verdes, incluindo `asaas-edge-hml`, `club-checkout`, `member-auth`, `pre-ad-gate`, `public-leads`, `crm-read` e CI.

PR #25: os mesmos 7 pipelines concluíram com sucesso antes do merge.

# Bloqueios imediatos para o primeiro Pix Sandbox

1. cadastrar no Supabase HML, pelo painel seguro, sem expor valores:
   - `ASAAS_ACCESS_TOKEN`;
   - `ASAAS_WEBHOOK_AUTH_TOKEN`;
2. configurar no Asaas Sandbox o webhook da Diretoria usando o mesmo auth token;
3. cadastrar e ativar textos aprovados de `club_terms` e `non_achievement_policy`;
4. publicar `apps/public-hml` no projeto correto `diretoria-public-hml` por mecanismo explicitamente direcionado;
5. autenticar usuário HML e executar Pix Sandbox.

# Sequência após os gates

```text
Pix Sandbox
→ webhook
→ paid
→ crédito R$ 150
→ quórum R$ 140 protegido
→ replay
→ refund
→ reversão do crédito/quórum
→ segundo ciclo para validar 2 créditos
→ cartão 1x
→ falhas/reconciliação
```

# Antes de PRODUÇÃO

- credencial Asaas de produção totalmente separada;
- validar taxas efetivas da conta de produção;
- políticas jurídicas/comerciais finais;
- regra definitiva de reembolso/rollover e tratamento de taxa não devolvida;
- preço fundador definitivo;
- testes completos no Sandbox;
- observabilidade/alertas de webhook e reconciliação;
- revisão de segurança;
- nenhuma promoção automática de secret HML.

# Progresso macro

- Incremento 0 — Fundação: **concluído**;
- Incremento 1 — Núcleo econômico: **concluído**;
- Incremento 2 — Reativação/aquisição técnico: **concluído**;
- Incremento 3 — Club/pagamento: **backend Asaas HML completo; primeiro pagamento depende dos três gates operacionais acima**;
- Incremento 4 — Confirmação/venda pública/ticketing: **não iniciado como slice completo**;
- Incremento 5 — Produção/financeiro: **não iniciado**;
- Incremento 6 — Event Day: **não iniciado**;
- Incremento 7 — Bar/fechamento: **não iniciado**;
- Incremento 8 — Retenção: **não iniciado**.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**