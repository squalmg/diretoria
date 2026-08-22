# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 2 — Reativação e Aquisição  
**Estado:** **CRM ADMIN HML HOMOLOGADO; PRÓXIMO GATE É ANALYTICS/ACERVO/POLÍTICA PARA PRIMEIRO ANÚNCIO**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- HML-G0: **APROVADO**;
- core econômico transacional: **APROVADO**;
- Admin HML econômico: **APROVADO e publicado**;
- núcleo aquisição/CRM: **APROVADO**;
- API pública + lista de espera HML: **APROVADAS e publicadas**;
- PR #10: CRM Admin read-only, CI e deploy HML aprovados.

## HML administrativo

### Vercel

- projeto: `diretoria-hml`;
- project id: `prj_CSbGzOVsvIkkJLosiemlHmvcG7XV`;
- URL: `https://diretoria-hml.vercel.app`;
- deployment final alinhado ao GitHub: `dpl_CTeVMkPpHTKocgnD6up9rSzu2qx3`;
- `/`: HTTP 200;
- `/writes.html`: HTTP 200;
- `/crm.html`: HTTP 200;
- `/crm.js`: HTTP 200;
- `/api/edge-health`: HTTP 200.

O snapshot Vercel foi refeito com os arquivos exatos do branch. A divergência temporária causada por uma versão simplificada da console econômica foi eliminada; não permanece `writes-core.html` ou iframe não versionado no deploy canônico.

### Supabase

- project/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- Edge `diretoria-admin-api`: ACTIVE;
- Edge `diretoria-admin-write-api`: ACTIVE;
- Edge `diretoria-crm-api`: **ACTIVE**;
- Edge `diretoria-public-api`: ACTIVE;
- migrations aplicadas: `0001–0016`.

## CRM Admin implementado

### Backend canônico

`packages/db/src/crm-read.ts`

`PostgresCrmRead` fornece:

1. health do Postgres;
2. overview de perfis;
3. contagem 24h/7d;
4. distribuição por estágio;
5. origens mais frequentes;
6. campanhas mais frequentes;
7. resumo de consentimentos concedidos/negados;
8. lista paginada de profiles;
9. busca por nome/e-mail/telefone;
10. filtros por estágio/origem/campanha;
11. consentimentos atuais na listagem;
12. perfil 360.

### Perfil 360

Inclui:

- identidade;
- lifecycle CRM;
- histórico de atribuições;
- histórico de consentimentos;
- interações;
- analytics first-party;
- pagamentos;
- créditos;
- auditoria.

O CRM é **read-only** neste slice. Não existe botão/API para mudar manualmente lifecycle ou consentimentos.

### Edge API

`diretoria-crm-api`

Rotas HML protegidas pela mesma sessão temporária do Admin:

- `GET /health`;
- `GET /overview`;
- `GET /profiles`;
- `GET /profiles/:id`.

CORS limitado ao Admin HML + localhost.

A função delega as consultas ao `PostgresCrmRead` canônico; SQL de CRM não é duplicado entre teste e runtime.

### Interface

`/crm.html` + `/crm.js`

Recursos:

- dashboard de perfis;
- barras/filtros por estágio;
- busca;
- filtro de origem;
- filtro de campanha;
- lista de pessoas;
- chips de consentimento;
- perfil 360 completo;
- navegação entre portal/CRM/econômico.

## Evidência automatizada do CRM

### CRM read

Run `32567993967`: **SUCCESS**.

Cenário:

`PostgresAcquisitionCore → lead sintético → PostgresCrmRead`

Provado:

- overview;
- stage `lead`;
- source/campaign;
- consentimentos;
- busca e filtros;
- perfil 360;
- interação `lead_capture`;
- analytics `lead_created`;
- auditoria `lead.captured`;
- paginação inválida rejeitada;
- UUID inválido rejeitado.

### Regressão

- CI geral `32567993932`: SUCCESS;
- public-leads `32567993965`: SUCCESS.

Portanto o CRM não quebrou núcleo econômico, aquisição, captura pública ou restore.

## HML público de reativação

- Vercel: `https://diretoria-public-hml.vercel.app`;
- project id: `prj_2TBT4bKM9SmIj9Txx2CZP7Vuud7Y`;
- Edge `diretoria-public-api`: ACTIVE;
- smoke HTTP real `32567590292`: SUCCESS;
- captura pública, consentimentos, atribuição, CRM e analytics confirmados no banco.

## Ainda necessário antes do primeiro anúncio real

1. textos/política jurídica definitivos de privacidade e marketing;
2. marca e acervo final da campanha;
3. catalogação dos direitos de uso do acervo histórico;
4. pixels/analytics externos com consent mode;
5. IDs reais das plataformas de mídia — não inventar;
6. monitoramento/alertas da captura pública;
7. campanhas e criativos finais;
8. domínio público definitivo.

## Próximo passo

# Gate “PRONTO PARA PRIMEIRO ANÚNCIO”

Desenvolvimento que pode continuar sem decisões externas:

1. catálogo/admin do acervo;
2. dashboard first-party de aquisição já baseado em `analytics_events`;
3. monitoramento técnico da captura pública;
4. camada de consent mode que não carrega pixels sem autorização.

Dependências que deverão ser fornecidas/decididas antes da ativação real:

- política jurídica final;
- IDs Meta/Google/etc.;
- domínio público;
- arquivos/fotos/vídeos finais e respectivos direitos;
- peças/campanhas finais.

Nenhum primeiro anúncio real deve ser liberado antes dessas dependências e do gate completo.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
