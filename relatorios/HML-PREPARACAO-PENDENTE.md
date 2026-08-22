# Preparação HML — Diretoria

**Data:** 21/08/2026
**Status:** EM PREPARAÇÃO

Este arquivo registra a preparação do HML persistente. A criação do banco Supabase aguarda confirmação explícita da organização conectada, conforme exigência da integração.

Arquitetura proposta para HML:

- Vercel: aplicação/painel HML;
- Supabase: PostgreSQL persistente HML;
- GitHub: fonte de código e CI;
- migrations versionadas no repositório;
- health/readiness contra banco real;
- backup/restore validado antes de marcar HML-G0 como concluído.

Nenhum recurso de produção será alterado nesta etapa.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
