# AGENTS.md — Diretoria

Este arquivo orienta agentes de IA e desenvolvedores automáticos que trabalharem neste repositório.

## Antes de qualquer alteração

1. Leia `02-goal.md`.
2. Leia o relatório mais recente em `relatorios/`.
3. Consulte `06-backlog-v1.md` e identifique a story/feature correspondente.
4. Consulte o documento de domínio relacionado.
5. Não invente decisões listadas em `10-decisoes-abertas.md`.

## Fonte de verdade

- Regras de negócio: `02-goal.md` + `03-arquitetura-funcional.md`.
- Integridade: `04-modelo-de-dados.md`.
- Fluxos de interface: `05-ux-flow.md`.
- Ordem de execução: `06-backlog-v1.md` e `09-roadmap-implementacao.md`.
- Infraestrutura: `07-arquitetura-tecnica.md`.
- Aceitação: `08-plano-hml-e-testes.md` e `11-matriz-rastreabilidade.md`.

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
