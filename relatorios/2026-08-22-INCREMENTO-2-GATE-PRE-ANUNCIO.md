# RELATÓRIO — INCREMENTO 2 / GATE TÉCNICO PRÉ-ANÚNCIO

**Data:** 22/08/2026  
**Escopo:** infraestrutura técnica executável sem inventar dependências externas.

## Resultado

O bloco técnico do Incremento 2 foi concluído e mergeado no `main` pelo PR #11.

Merge:

`4364fd8d6a6dc038740a04b57630edd44774f724`

Isso **não significa autorização para primeiro anúncio real**.

## Entregas concluídas

### Reativação e captura

- Public HML ativo;
- lista de espera/captura first-party;
- UTM/referral;
- consentimentos;
- rate-limit;
- CRM e perfil 360;
- analytics first-party.

### Acervo

- catálogo de metadados;
- status de direitos;
- uso permitido;
- tags;
- evento histórico/data de captura;
- fonte/crédito;
- auditoria de mudanças relevantes.

### Consent mode

- analytics/marketing negados por padrão;
- IDs GA4/Meta nulos;
- nenhum loader externo ativo;
- arquitetura pronta para ativação posterior somente com IDs/política aprovados.

### Observabilidade

- health público/admin;
- workflow periódico `hml-health-monitor`;
- CI específico `pre-ad-gate`.

## Evidência automatizada

Último head validado do PR #11:

`23e2970311713a762aa31e92f08cba60c14a3421`

Todos verdes:

- `ci`;
- `pre-ad-gate`;
- `crm-read`;
- `public-leads`;
- `hml-health-monitor`.

A falha inicial do `pre-ad-gate` foi corrigida: PostgreSQL 18 exigiu alias explícito na query diária de insights. A consulta foi alterada para aliases `AS` explícitos e o gate passou integralmente.

## HML observado

Admin:

- `/` — 200;
- `/crm.html` — 200;
- `/writes.html` — 200;
- `/pre-ad.html` — 200;
- `/api/edge-health` — 200 e DB connected.

Public:

- `consent.js` — 200;
- estado padrão: analytics=false, marketing=false;
- IDs de mídia: não configurados.

Supabase:

- migration `0017` aplicada;
- `diretoria-pre-ad-api` ACTIVE;
- advisors sem erro de segurança.

## Incidente de deploy corrigido

Durante a publicação manual do snapshot Admin HML, um deploy intermediário simplificou CRM/console econômica. A regressão foi identificada durante smoke test e substituída por novo snapshot completo antes do fechamento deste relatório.

Estado final observado: páginas integrais restauradas e gate pré-anúncio adicionado.

## Bloqueios externos reais

O primeiro anúncio continua proibido até existir:

1. política/textos jurídicos finais;
2. IDs reais Meta/Google/etc.;
3. domínio público definitivo;
4. acervo real selecionado;
5. direitos de uso confirmados;
6. criativos/campanhas aprovados.

## Continuidade

O trabalho técnico pode avançar em paralelo para o Incremento 3 sem ativar dinheiro real:

`auth pública HML → vínculo customer_id → área do membro → carteira read-only`

Gateway, preço real e política comercial não devem ser inferidos.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
