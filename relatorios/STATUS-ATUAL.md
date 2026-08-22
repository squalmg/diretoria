# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 2 — Reativação e Aquisição  
**Estado:** **API PÚBLICA + LISTA DE ESPERA HML HOMOLOGADAS; PRÓXIMO SLICE É CRM ADMIN + ANALYTICS**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- HML-G0: **APROVADO**;
- core econômico transacional: **APROVADO**;
- Admin HML econômico: **APROVADO e publicado**;
- núcleo aquisição/CRM: **APROVADO**;
- PR #9: API pública + Home/Lista de Espera HML com CI, deploy e smoke HTTP aprovados.

## HML administrativo

- Vercel: `https://diretoria-hml.vercel.app`;
- Supabase project/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- Edge `diretoria-admin-api`: ACTIVE;
- Edge `diretoria-admin-write-api`: ACTIVE.

## HML público de reativação

### Vercel

- projeto: `diretoria-public-hml`;
- project id: `prj_2TBT4bKM9SmIj9Txx2CZP7Vuud7Y`;
- URL: `https://diretoria-public-hml.vercel.app`;
- deployment validado: `dpl_2424GGAYCX3py1n2ibF8z8YLws8v`;
- `/`: HTTP 200;
- `/app.js`: HTTP 200;
- `/api/health`: HTTP 200.

### Supabase

- migration aplicada até `0016_public_lead_rate_limit`;
- Edge `diretoria-public-api`: ACTIVE;
- `/health`: banco conectado;
- rate limit: 5 capturas / 600 s por chave hash;
- RLS default-deny mantido;
- advisors: sem novo ERROR/WARN de segurança; somente INFO esperados.

## Fronteira pública implementada

Rotas:

- `GET /health`;
- `GET /state`;
- `POST /leads`.

Proteções:

1. CORS limitado ao HML público e localhost;
2. payload máximo;
3. honeypot;
4. rate limit transacional;
5. chave de rate limit armazenada apenas como hash;
6. política HML definida no servidor;
7. consentimento de privacidade obrigatório;
8. telefone brasileiro normalizado para E.164;
9. resposta pública não revela `profile_id` nem se a pessoa já existia;
10. perfil bloqueado não pode ser enumerado pela resposta;
11. Edge chama o `PostgresAcquisitionCore` canônico;
12. PostgREST não é exposto como fronteira pública de escrita.

## Home/Lista de Espera HML

A Home pública HML:

- adapta o texto ao estado da edição via `/state`;
- mostra progresso de quórum sem expor valores financeiros sensíveis;
- captura nome, WhatsApp e e-mail;
- exige consentimento de privacidade;
- separa opt-in WhatsApp/e-mail;
- captura UTM, referral e session key;
- usa GSAP apenas na apresentação;
- está explicitamente marcada como HML para impedir uso inadvertido de dados reais;
- ainda não possui pixels externos, checkout ou ingresso real.

## Evidência automatizada

### CI principal

Run `32567366490`: PASS completo.

Inclui:

- domínio;
- migrations;
- HML JS;
- econômico;
- aquisição/CRM;
- backup/restore.

### CI da fronteira pública

Run `32567366492`: PASS completo.

Valida:

- migrations do zero;
- RLS do rate limit;
- SECURITY DEFINER;
- `search_path` fixo;
- 3 requisições permitidas e 4ª bloqueada no cenário de teste.

### Smoke HTTP real

Run `32567590292`: **SUCCESS**.

Fluxo real executado contra a Edge Function HML:

`GitHub Actions → POST /leads → Edge API → PostgresAcquisitionCore → Supabase HML`

Lead sintético criado:

- nome: `Public Smoke HML`;
- e-mail: `public-smoke-32567590292@example.invalid`;
- telefone normalizado: `+5564967590292`.

Validação no banco do mesmo `profile_id`:

- 4 consentimentos;
- 1 atribuição;
- 1 estágio CRM (`lead`);
- 1 interação (`lead_capture`);
- 1 analytics (`lead_created`);
- 1 audit log (`lead.captured`).

Consentimentos do smoke:

- privacy: true;
- marketing: true;
- WhatsApp: true;
- e-mail: false;
- policy version: `privacy-hml-2026-08-v1`.

Atribuição do smoke:

- source: `github_smoke`;
- medium: `ci`;
- campaign: `public_hml_v1`;
- content: `workflow`;
- referral: `SMOKE-V1`.

## Ainda necessário antes do primeiro anúncio real

1. painel CRM navegável;
2. definição/validação da política jurídica e textos finais de consentimento;
3. marca/acervo final para a campanha;
4. pixels/analytics externos condicionados ao consentimento adequado;
5. monitoramento operacional da captura pública;
6. campanhas e criativos finais;
7. domínio público definitivo.

Nenhum anúncio real deve ser liberado apenas porque o HML já captura leads.

## Próximo passo

# CRM Admin + Analytics/Atribuição

Prioridade:

1. lista/funil CRM;
2. perfil 360 do lead;
3. filtros por origem/campanha/consentimento;
4. dashboard básico de aquisição;
5. acervo inicial;
6. estratégia de pixels externos e consent mode;
7. fechar gate `PRONTO PARA PRIMEIRO ANÚNCIO`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
