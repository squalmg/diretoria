# Relatório — Incremento 0 / Fundação V0.1

## Objetivo

Materializar a documentação canônica em uma base executável, sem inventar decisões de produção.

## Implementado

- monorepo inicial sem dependências externas de runtime;
- domínio TypeScript para regras críticas;
- testes com Node test runner;
- PostgreSQL local definido em Docker Compose;
- schema inicial do vertical slice;
- migrations transacionais;
- CI;
- detecção simples de segredos;
- API de saúde;
- placeholder administrativo explicitamente não-canônico em design.

## Regras testadas

- cenário de quórum R$70.500 / R$110 = 641;
- 400 membros equivalentes = não viável;
- 641 = viável;
- somente `paid` é elegível;
- bar diferente de zero bloqueia GO;
- não viável bloqueia GO;
- PLANEJAMENTO não pula para CONFIRMADO;
- VIAVEL pode recuar para QUORUM_EM_ANDAMENTO antes da confirmação.

## Validação local

- 10/10 testes de domínio: PASS;
- secret scan: PASS;
- migration static check: PASS;
- documentação canônica: PASS;
- API /healthz e /readyz: PASS;
- admin HTTP smoke test: PASS.

## Pendências

- PostgreSQL real ainda precisa executar migrations em CI/HML;
- autenticação real ainda não implementada;
- commands/repositories ainda não ligados ao banco;
- payment adapter ainda mock/sandbox pendente;
- observabilidade externa ainda sem vendor.

## Decisão

**Não promover para produção.** Próximo gate é HML-G0.
