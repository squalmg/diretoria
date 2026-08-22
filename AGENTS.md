# AGENTS.md — Diretoria

Este arquivo orienta agentes de IA e desenvolvedores automáticos que trabalharem neste repositório.

## Antes de qualquer alteração

1. Leia `goal.md`.
2. Leia o relatório mais recente em `relatorios/`, começando por `relatorios/STATUS-ATUAL.md`.
3. Consulte `docs/06-backlog-v1.md` e identifique a story/feature correspondente.
4. Consulte o documento de domínio relacionado em `docs/`.
5. Não invente decisões listadas em `docs/10-decisoes-abertas.md`.

## Fonte de verdade

- Regras de negócio: `goal.md` + `docs/03-arquitetura-funcional.md`.
- Visão completa: `docs/01-blueprint-mestre-diretoria.md`.
- Integridade: `docs/04-modelo-de-dados.md`.
- Fluxos de interface: `docs/05-ux-flow.md`.
- Ordem de execução: `docs/06-backlog-v1.md` e `docs/09-roadmap-implementacao.md`.
- Infraestrutura: `docs/07-arquitetura-tecnica.md`.
- Aceitação: `docs/08-plano-hml-e-testes.md` e `docs/11-matriz-rastreabilidade.md`.

## Proibições

- Não colocar segredos no código, logs, prompts ou documentação.
- Não alterar produção para testar.
- Não criar botão que force `paid`, `VIAVEL`, `CONFIRMADO` ou saldos derivados.
- Não apagar fatos financeiros; usar cancelamento, reversão ou compensação.
- Não usar analytics como fonte de verdade financeira.
- Não transformar bar esperado em receita de quórum.
- Não editar saldo de estoque, saldo de sócio ou capital protegido diretamente.

## Ciclo de execução

`ler → implementar → testar → validar invariantes → registrar relatório`

Se uma correção falhar duas vezes pelo mesmo caminho, mudar de abordagem e buscar a informação/arquivo necessário em vez de repetir a mesma tentativa.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
