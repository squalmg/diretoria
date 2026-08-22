# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 2 — Reativação e Aquisição  
**Estado:** **NÚCLEO DE AQUISIÇÃO/CRM HOMOLOGADO; PRÓXIMO SLICE É API PÚBLICA + LISTA DE ESPERA**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- HML-G0: **APROVADO**;
- core econômico transacional: **APROVADO**;
- Admin HML econômico: **APROVADO e publicado**;
- PR #8: fundação P0 de aquisição, consentimento e CRM com CI verde e migration aplicada em HML.

## HML persistente

### Aplicação

- Vercel project: `diretoria-hml`;
- URL: `https://diretoria-hml.vercel.app`;
- deployment econômico validado: `dpl_CkPLersGhaZar4hsMHrmGy22dxxJ`;
- `/`, `/writes.html`, `/writes.js` e `/api/edge-health`: HTTP 200.

### Banco / API

- Supabase project: `diretoria-hml`;
- project ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- estado: `ACTIVE_HEALTHY`;
- migrations aplicadas: `0001` a `0015`;
- RLS default-deny mantido nas novas tabelas;
- advisors de segurança: sem ERROR/WARN novo;
- advisors de performance: somente INFO `unused_index`, esperado sem tráfego público.

## Incremento 1 — estado consolidado

O núcleo econômico está implementado, integrado ao PostgreSQL real, exposto no Admin HML e protegido por sessão temporária. O smoke de clique manual pela interface continua como gate de homologação antes de qualquer promoção produtiva, mas não bloqueia o desenvolvimento isolado do Incremento 2.

Regras centrais continuam válidas:

- `pending` não aumenta quórum;
- bar esperado não financia viabilidade;
- `VIAVEL != CONFIRMADO`;
- reembolso reduz proteção;
- confirmação exige snapshot atual + configuração + checklist + GO atual.

## Incremento 2 — concluído neste slice

### Banco

Criadas as entidades:

- `consents`;
- `acquisition_attributions`;
- `crm_stage_history`;
- `crm_interactions`;
- `analytics_events`;
- `assets`;
- `asset_tags`.

### Captura transacional

`PostgresAcquisitionCore` implementa:

1. normalização de e-mail;
2. telefone E.164;
3. exigência de pelo menos um contato;
4. consentimento de privacidade obrigatório;
5. locks transacionais por identidade;
6. criação ou consolidação de `profile/customer_id`;
7. bloqueio de colisão quando e-mail e telefone resolvem para perfis diferentes;
8. registro de UTM/referral/landing/session;
9. histórico explícito de consentimentos concedidos e negados;
10. estágio CRM `lead` sem regredir `member/participant`;
11. interação de captura no CRM;
12. evento analítico `lead_created`;
13. audit log `lead.captured`.

## Evidência automatizada mais recente

GitHub Actions run:

`32566983116`

Resultado:

- testes de domínio: PASS;
- secret scan: PASS;
- migrations `0001–0015`: PASS;
- hardening/RLS: PASS;
- bootstrap/sessão HML: PASS;
- núcleo econômico: PASS;
- **acquisition/CRM integration: PASS**;
- backup/restore incluindo consentimentos: PASS.

Cenários de aquisição provados:

- novo lead cria profile + atribuição + consentimentos + CRM + analytics;
- repetição do mesmo e-mail/telefone consolida no mesmo `customer_id`;
- captura posterior de pessoa já `member` não regride para `lead`;
- e-mail de um perfil + telefone de outro retorna `IDENTITY_COLLISION` e faz rollback;
- sem consentimento de privacidade, nenhum profile é criado;
- opt-in e opt-out são persistidos explicitamente.

Relatório:

`relatorios/2026-08-22-INCREMENTO-2-AQUISICAO-CORE.md`

## Ainda fora deste slice

- endpoint público de captura;
- home reativa;
- lista de espera publicada;
- painel CRM navegável;
- pixels externos;
- upload/gestão visual do acervo;
- comunicação automática.

## Próximo passo

# API pública de lead + Home/Lista de Espera HML

Fluxo:

`Visitante → formulário → API pública controlada → PostgresAcquisitionCore → profile único + consent + attribution + CRM + analytics`

Depois:

1. painel CRM básico;
2. analytics/pixels com consentimento;
3. acervo básico;
4. gate `PRONTO PARA PRIMEIRO ANÚNCIO`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
