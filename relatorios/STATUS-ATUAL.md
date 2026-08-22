# STATUS ATUAL — DIRETORIA

**Data:** 21/08/2026 22:31 BRT  
**Fase:** Incremento 1 — Núcleo Econômico  
**Estado:** **HML-G0 APROVADO; PRONTO PARA DESENVOLVER O NÚCLEO ECONÔMICO**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- commit da Fundação V0.1: `ae2b10ce4348cbf2b8e5cfd3f40a11a36b217980`;
- hardening HML: `7ad961ee394fd3860a9604f3b278387b79612e15`;
- backup/restore CI: `0650a2ff2024e77c0b984ca294161e79caaeefa4`.

## HML persistente

### Aplicação

- Vercel project: `diretoria-hml`;
- project id: `prj_CSbGzOVsvIkkJLosiemlHmvcG7XV`;
- URL: `https://diretoria-hml.vercel.app`;
- `/`: HTTP 200;
- `/api/health`: HTTP 200.

### Banco

- Supabase project: `diretoria-hml`;
- project ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- estado observado: `ACTIVE_HEALTHY`;
- migrations aplicadas: `0001`, `0002`, `0003`.

## HML-G0 — evidências aprovadas

- 10/10 testes de domínio da Fundação: PASS;
- secret scan: PASS;
- migrations do zero em PostgreSQL 18.6: PASS;
- 23/23 tabelas públicas da Fundação com RLS: PASS;
- `user_roles` com PK física: PASS;
- seed RBAC com 8 roles e 11 permissions: PASS;
- advisors de segurança: sem ERROR de RLS desabilitado;
- advisor mantém apenas INFO de RLS sem policy, intencionalmente default-deny;
- logs PostgreSQL disponíveis;
- deploy Vercel persistente: READY;
- health endpoint: PASS;
- backup/restore com PostgreSQL 18: PASS;
- dado sintético, RBAC e RLS preservados após restore: PASS.

Relatório detalhado:

`relatorios/2026-08-21-HML-G0.md`

## Decisão

**HML-G0 = APROVADO.**

A Fundação atende ao gate necessário para iniciar o núcleo econômico sem tocar em produção.

## Incremento atual

# Incremento 1 — Núcleo Econômico

Ordem de execução:

1. casos de uso/repositories para criar edição;
2. configuração financeira versionada;
3. custos protegidos;
4. receitas garantidas;
5. pagamento mock/HML idempotente;
6. geração de crédito;
7. recálculo e persistência de snapshots de quórum;
8. reembolso e queda do capital protegido;
9. checklist de confirmação;
10. GO/NO-GO;
11. confirmação server-side;
12. painel administrativo mínimo ligado ao backend/banco.

## Decisões ainda abertas relevantes

- gateway de pagamento real;
- autenticação real/provider;
- preço/ticket fundador;
- percentual padrão de contingência;
- provedores de produção.

Essas decisões não bloqueiam o fluxo mock/HML do Incremento 1 quando configuradas explicitamente como dados de teste.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
