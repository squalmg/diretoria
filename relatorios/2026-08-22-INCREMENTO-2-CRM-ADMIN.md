# Relatório — Incremento 2 / CRM Admin HML

**Data:** 22/08/2026  
**Projeto:** Diretoria  
**Ambiente:** HML

## Objetivo

Tornar navegáveis, no Admin HML, os dados que a lista de espera pública já captura, sem criar uma segunda verdade de CRM e sem liberar mutations de lifecycle.

Fluxo:

```text
Home/Lista HML
→ diretoria-public-api
→ PostgresAcquisitionCore
→ profiles + consent + attribution + CRM + analytics
→ PostgresCrmRead
→ diretoria-crm-api
→ CRM Admin HML
```

## Backend

Módulo canônico:

`packages/db/src/crm-read.ts`

Classe:

`PostgresCrmRead`

Consultas disponíveis:

- `health()`;
- `overview()`;
- `listProfiles(filters)`;
- `profile360(profileId)`.

Filtros aceitos:

- busca textual;
- estágio;
- origem;
- campanha;
- limite/offset validados.

## Overview

Consolida:

- total de profiles não sintéticos do Admin;
- profiles das últimas 24h;
- profiles dos últimos 7 dias;
- lifecycle atual;
- origens;
- campanhas;
- consentimentos atuais concedidos e negados.

`HML-OPERATOR` e `HML-CUSTOMER` não entram nas métricas de aquisição.

## Perfil 360

Uma pessoa pode ser analisada sem reconstruir seu histórico manualmente.

O painel reúne:

- identidade;
- primeira origem/campanha;
- histórico de stages;
- histórico de atribuições;
- histórico de consentimentos;
- interações CRM;
- analytics first-party;
- pagamentos;
- créditos;
- auditoria.

## API HML

Edge Function:

`diretoria-crm-api`

Status no Supabase:

`ACTIVE`

Autorização:

- bearer de sessão HML temporária;
- hash validado em `hml_admin_sessions`;
- sessão revogada/expirada recebe 401;
- nenhuma mutation é exposta.

Rotas:

- `GET /health`;
- `GET /overview`;
- `GET /profiles`;
- `GET /profiles/:id`.

O Edge importa o `PostgresCrmRead` canônico por commit imutável e não mantém uma segunda implementação das queries.

## Interface

Arquivos:

- `apps/hml/crm.html`;
- `apps/hml/crm.js`.

Recursos:

- indicadores gerais;
- distribuição de stages;
- busca por pessoa;
- filtro por stage;
- filtro por source;
- filtro por campaign;
- consentimentos atuais em chips;
- perfil 360;
- links portal/econômico.

Não há:

- mudança manual de stage;
- edição de consentimento;
- disparo de mensagem;
- exclusão de fatos.

## CI

### CRM read

Run:

`32567993967`

Resultado:

`SUCCESS`

O teste cria um lead via `PostgresAcquisitionCore` e consulta os mesmos dados pelo `PostgresCrmRead` usado pelo Edge.

Valida:

- health;
- overview;
- stage `lead`;
- source `crm_test`;
- campaign `crm_campaign`;
- consentimentos atuais;
- busca/filtros;
- profile 360;
- `lead_capture`;
- `lead_created`;
- `lead.captured`;
- limite inválido;
- UUID inválido.

### Regressão

- CI geral `32567993932`: SUCCESS;
- public-leads `32567993965`: SUCCESS.

## Vercel

Projeto:

`diretoria-hml`

Deployment final alinhado ao GitHub:

`dpl_CTeVMkPpHTKocgnD6up9rSzu2qx3`

Estado:

`READY`

Validações:

- `/` → 200;
- `/writes.html` → 200;
- `/crm.html` → 200;
- `/crm.js` → 200;
- `/api/edge-health` → 200.

### Correção de consistência

Durante a implantação houve um snapshot Vercel intermediário com uma versão simplificada da console econômica. Ele foi detectado antes do merge e substituído.

O deployment canônico acima usa a árvore exata do branch:

- portal atualizado;
- `writes.html` rico versionado;
- `writes.js` versionado;
- `crm.html`;
- `crm.js`;
- health endpoints.

Nenhum `writes-core.html` ou iframe não versionado permanece no deployment atual.

## Limite de homologação

Não foi criado um segredo de sessão dentro de CI apenas para automatizar clique autenticado no CRM. A segurança não foi reduzida para facilitar teste.

A camada de queries foi validada em PostgreSQL real e o Edge foi compilado/ativado no Supabase. A navegação HML exige a sessão temporária já existente.

## Próximo gate

Para chegar a `PRONTO PARA PRIMEIRO ANÚNCIO` ainda faltam principalmente:

1. política/textos legais finais;
2. acervo final e direitos de uso;
3. consent mode/pixels;
4. IDs reais de mídia;
5. monitoramento da captura;
6. criativos/campanhas finais;
7. domínio público definitivo.

Trabalho técnico que pode continuar antes dessas decisões:

- Admin de acervo;
- dashboard first-party de aquisição;
- observabilidade da captura;
- infraestrutura de consent mode com pixels desligados por padrão.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
