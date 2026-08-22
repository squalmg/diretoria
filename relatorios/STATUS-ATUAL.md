# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 2 — Reativação e Aquisição  
**Estado:** **INFRAESTRUTURA TÉCNICA DO GATE PRÉ-ANÚNCIO CONCLUÍDA; PRIMEIRO ANÚNCIO AINDA BLOQUEADO POR DEPENDÊNCIAS EXTERNAS**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- merge do gate pré-anúncio: `4364fd8d6a6dc038740a04b57630edd44774f724`;
- HML-G0: **APROVADO**;
- core econômico: **APROVADO**;
- aquisição/CRM: **APROVADOS**;
- Admin HML econômico/CRM/pré-anúncio: **PUBLICADOS**;
- Public HML + lista de espera: **PUBLICADOS**.

## Gate técnico pré-anúncio concluído

### Acervo e direitos

- migration `0017_asset_catalog_metadata` aplicada no Supabase HML;
- catálogo de metadados de acervo;
- evento histórico/data de captura;
- fonte/crédito e URL de origem;
- status de direitos e permissão de uso;
- tags;
- alterações críticas auditadas;
- Admin HML `/pre-ad.html` publicado.

### Analytics first-party

- leads por período;
- distribuição diária;
- origem/source;
- campanha;
- consentimentos atuais;
- pressão de rate-limit 24h;
- sem dependência de pixel externo.

### Consent mode

Public HML mantém:

- `analytics=false` por padrão;
- `marketing=false` por padrão;
- GA4 ID = `null`;
- Meta Pixel ID = `null`;
- nenhum loader de terceiros ativo sem configuração/consentimento.

### Observabilidade

Workflow `hml-health-monitor` validado e verde.

## HML canônico

### Admin

- URL: `https://diretoria-hml.vercel.app`;
- `/`: HTTP 200;
- `/writes.html`: HTTP 200, console econômica completa;
- `/crm.html`: HTTP 200, CRM completo;
- `/pre-ad.html`: HTTP 200, gate técnico pré-anúncio;
- `/api/edge-health`: HTTP 200, banco conectado.

### Public

- URL: `https://diretoria-public-hml.vercel.app`;
- `consent.js`: HTTP 200 e deny-by-default.

### Supabase

- projeto/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- migrations aplicadas: `0001–0017`;
- Edge `diretoria-admin-api`: ACTIVE;
- Edge `diretoria-admin-write-api`: ACTIVE;
- Edge `diretoria-crm-api`: ACTIVE;
- Edge `diretoria-public-api`: ACTIVE;
- Edge `diretoria-pre-ad-api`: ACTIVE.

## Evidências de CI do último head do PR #11

Commit:

`23e2970311713a762aa31e92f08cba60c14a3421`

Workflows:

- `ci`: SUCCESS;
- `pre-ad-gate`: SUCCESS;
- `crm-read`: SUCCESS;
- `public-leads`: SUCCESS;
- `hml-health-monitor`: SUCCESS.

## Advisors Supabase

Segurança:

- sem ERROR/WARN novo;
- `rls_enabled_no_policy` permanece INFO e intencional no modelo default-deny do HML.

Performance:

- somente `unused_index` INFO, esperado em ambiente de homologação com pouca carga.

## Dependências externas que ainda bloqueiam primeiro anúncio real

1. política/textos jurídicos finais;
2. IDs reais Meta/Google e demais plataformas aprovadas;
3. domínio público definitivo;
4. arquivos reais do acervo;
5. confirmação de direitos de uso de cada arquivo utilizado;
6. criativos/campanhas finais.

Nenhuma dessas decisões deve ser inventada no código.

## Próximo trabalho técnico possível

Como o Incremento 2 atingiu o limite técnico sem decisões externas, o desenvolvimento pode avançar em paralelo para o **Incremento 3 — Club e pagamento real**, sem ativar pagamento real ainda.

Primeiro slice recomendado:

1. autenticação pública HML;
2. vínculo `auth user → profile/customer_id → users`;
3. área inicial do membro;
4. carteira read-only de créditos/ingressos;
5. testes de cadastro/login/recuperação em HML;
6. nenhuma oferta/preço/gateway real até as respectivas decisões estarem fechadas.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
