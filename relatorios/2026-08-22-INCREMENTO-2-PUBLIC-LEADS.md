# Relatório — Incremento 2 / API Pública e Lista de Espera HML

**Data:** 22/08/2026  
**Projeto:** Diretoria  
**Ambiente:** HML

## Objetivo

Validar a primeira fronteira pública de reativação sem liberar tráfego pago real, checkout ou dados pessoais reais.

Fluxo-alvo:

```text
Visitante
→ Home HML
→ formulário
→ diretoria-public-api
→ rate limit / consentimento
→ PostgresAcquisitionCore
→ profile único
→ consentimentos
→ atribuição
→ CRM
→ analytics
→ auditoria
```

## API pública

Edge Function:

`diretoria-public-api`

Estado no Supabase HML:

`ACTIVE`

Rotas:

- `GET /health`;
- `GET /state`;
- `POST /leads`.

O endpoint de escrita não retorna `profile_id` nem informa se a identidade já existia.

## Segurança e anti-abuso

### CORS

Permitido somente para:

- `https://diretoria-public-hml.vercel.app`;
- localhost de homologação.

Chamadas server-to-server sem `Origin` continuam possíveis para health/smoke.

### Rate limit

Migration:

`0016_public_lead_rate_limit.sql`

Tabela:

`public_lead_rate_limits`

A tabela armazena somente chave hash e bucket temporal. IP bruto não é persistido nessa tabela.

Função:

`consume_public_lead_rate_limit`

Propriedades:

- SECURITY DEFINER;
- `search_path = public, pg_temp`;
- execução pública/anon/authenticated revogada;
- service role habilitado quando disponível;
- incremento atômico por bucket.

Política HML:

`5 requisições / 600 segundos`.

### Honeypot

Campo invisível `website` preenchido resulta em resposta genérica `202`, sem gerar dado de CRM.

### Payload

Limite aplicado no boundary público.

### Consentimento

Privacy é obrigatório.

Versão HML fixada no servidor:

`privacy-hml-2026-08-v1`

O navegador não escolhe a versão da política.

## Normalização

Módulo:

`packages/domain/src/public-lead.ts`

Cobertura:

- nome;
- e-mail;
- telefone brasileiro amigável → E.164;
- E.164 internacional;
- UTM/referral;
- landing path local.

Landing externa ou protocol-relative é rejeitada.

## Home HML

Projeto Vercel:

`diretoria-public-hml`

Project id:

`prj_2TBT4bKM9SmIj9Txx2CZP7Vuud7Y`

URL:

`https://diretoria-public-hml.vercel.app`

Deployment validado:

`dpl_2424GGAYCX3py1n2ibF8z8YLws8v`

HTTP:

- `/` → 200;
- `/app.js` → 200;
- `/api/health` → 200.

Health observado:

- API pública online;
- banco conectado;
- captura HML habilitada;
- rate limit 5/600.

A página está marcada claramente como HML e instrui o operador a usar apenas dados sintéticos.

## Estado dinâmico

A Home chama `GET /state` e adapta hero/CTA conforme a máquina de estados da edição.

Quando existe snapshot de quórum, pode mostrar:

- membros válidos;
- quórum mínimo;
- percentual protegido.

Não expõe custos financeiros internos.

## CI

### Pipeline principal

Run:

`32567366490`

Resultado:

`SUCCESS`

Inclui domínio, migrations, economic core, acquisition core e restore.

### Fronteira pública

Run:

`32567366492`

Resultado:

`SUCCESS`

Prova:

- migration limpa;
- RLS;
- SECURITY DEFINER;
- search_path;
- rate limit atômico;
- 4ª chamada bloqueada após limite 3 no cenário de teste.

## Smoke HTTP real

Workflow:

`public-hml-smoke`

Run:

`32567590292`

Conclusão:

`SUCCESS`

Evento:

`push` único por arquivo-gatilho.

Lead sintético:

- `Public Smoke HML`;
- `public-smoke-32567590292@example.invalid`;
- `+5564967590292`.

O telefone enviado pelo smoke foi normalizado e persistido em E.164.

## Evidência no banco

Para o profile criado pelo smoke:

| Fato | Quantidade/valor |
|---|---:|
| consents | 4 |
| acquisition_attributions | 1 |
| crm_stage_history | 1 |
| crm_interactions | 1 |
| analytics_events | 1 |
| audit_logs lead.captured | 1 |

Estado CRM:

`lead`

Interação:

`lead_capture`

Analytics:

`lead_created`

Consentimentos:

- privacy = true;
- marketing = true;
- whatsapp = true;
- email = false.

Atribuição:

- source = `github_smoke`;
- medium = `ci`;
- campaign = `public_hml_v1`;
- content = `workflow`;
- referral = `SMOKE-V1`;
- session = `gh-32567590292`.

## Advisors

Após migrations 0015/0016:

### Segurança

Nenhum novo ERROR/WARN.

`rls_enabled_no_policy` permanece INFO e é intencional enquanto acesso direto ao PostgREST permanece default-deny.

### Performance

Somente INFO de índices ainda não utilizados, esperado no HML com tráfego quase nulo.

## Limites deste slice

Não foram liberados:

- produção;
- domínio público definitivo;
- pixels externos;
- campanhas reais;
- política jurídica final;
- checkout;
- pagamento real;
- ingresso real;
- comunicação automática para contatos reais.

## Próximo passo

Construir CRM administrativo mínimo para a equipe conseguir enxergar aquilo que a Home já captura:

1. lista/funil;
2. perfil 360;
3. origem/campanha;
4. consentimentos;
5. interações;
6. métricas básicas de aquisição.

Depois entram pixels/consent mode, acervo final e o gate de primeiro anúncio.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
