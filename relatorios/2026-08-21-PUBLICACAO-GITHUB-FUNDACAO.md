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

## CI

O workflow `.github/workflows/ci.yml` executa:

1. Node 24.19;
2. testes de domínio e verificações estáticas;
3. PostgreSQL 18.6;
4. migration `0001_core_foundation.sql` do zero;
5. seed RBAC;
6. verificação da existência das tabelas centrais.

Como o conector atual não retorna runs de `push`, foi criada a branch `chore/foundation-status` e será aberto PR para exercitar e inspecionar o fluxo `pull_request` do mesmo workflow.

## Correção pós-publicação

Foi corrigido `AGENTS.md` para apontar explicitamente para os caminhos reais em `docs/`, evitando que agentes futuros procurem arquivos canônicos inexistentes na raiz.

## Regra de promoção

A publicação no GitHub não equivale a HML aprovado.

HML-G0 só poderá ser considerado concluído depois de CI verde e das evidências exigidas pelo plano de homologação.

## Próximo passo

- abrir PR da branch `chore/foundation-status`;
- inspecionar CI;
- corrigir falhas se houver;
- mergear;
- registrar HML-G0;
- iniciar Incremento 1.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
