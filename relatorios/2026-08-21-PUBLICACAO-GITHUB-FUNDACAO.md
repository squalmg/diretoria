# Relatório — Publicação GitHub da Fundação V0.1

**Data:** 21/08/2026  
**Repositório:** `squalmg/diretoria`

## Objetivo

Publicar a Fundação V0.1 no repositório oficial e criar uma validação remota reproduzível antes do Incremento 1.

## Publicação

A Fundação foi publicada em `main` no commit:

`ae2b10ce4348cbf2b8e5cfd3f40a11a36b217980`

Árvore Git:

`da370ad5fa1cab7670c057c1b545f557783b695f`

A árvore remota contém código, migrations, testes, documentação canônica, CI, scripts, relatórios e manifesto.

## Integridade observada

Os documentos canônicos maiores foram conferidos na árvore Git remota e mantiveram os mesmos tamanhos do pack da Fundação:

- Blueprint: 33.396 bytes;
- Goal: 17.354 bytes;
- Arquitetura Funcional: 30.977 bytes;
- Modelo de Dados: 42.535 bytes;
- UX Flow: 33.982 bytes;
- Backlog V1: 12.161 bytes;
- Arquitetura Técnica: 10.875 bytes;
- Plano HML/Testes: 6.768 bytes.

## CI remoto

O PR #1 disparou o workflow `ci` no GitHub Actions.

Run:

`32542061215`

Job:

`foundation`

Resultado:

# SUCCESS

Etapas aprovadas:

1. Set up job;
2. Initialize containers;
3. checkout;
4. Node setup;
5. Domain and static checks;
6. Apply migrations from zero;
7. Assert core tables;
8. encerramento dos containers.

O runner iniciou PostgreSQL 18.6 e aplicou:

- `0001_core_foundation.sql`;
- `0002_seed_rbac.sql`.

Depois verificou com sucesso as tabelas centrais:

- `profiles`;
- `events`;
- `payments`;
- `credits`;
- `quorum_snapshots`;
- `audit_logs`.

## Correção pós-publicação

Foi corrigido `AGENTS.md` para apontar explicitamente para os caminhos reais em `docs/`, evitando que agentes futuros procurem arquivos canônicos inexistentes na raiz.

## Regra de promoção

A publicação no GitHub e o CI verde **não equivalem a HML-G0 concluído**.

O plano de homologação ainda exige um HML persistente operacional e validação básica de backup/restore.

Portanto:

- código/migrations remotos: APROVADOS;
- CI: APROVADO;
- HML-G0: PENDENTE.

## Próximo passo

- concluir CI do último commit documental;
- mergear PR #1;
- provisionar HML persistente;
- validar backup/restore;
- registrar HML-G0;
- iniciar Incremento 1.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
