# STATUS ATUAL — DIRETORIA

**Data:** 21/08/2026 21:43 BRT  
**Fase:** Incremento 0 — Fundação  
**Estado:** FUNDAÇÃO V0.1 PUBLICADA; CI E MIGRATIONS REMOTOS APROVADOS; HML-G0 AINDA NÃO CONCLUÍDO

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- commit da Fundação V0.1: `ae2b10ce4348cbf2b8e5cfd3f40a11a36b217980`;
- árvore Git da Fundação: `da370ad5fa1cab7670c057c1b545f557783b695f`;
- PR de pós-publicação/validação: `#1`.

## Concluído

- pack documental canônico incorporado ao repositório;
- `goal.md` e `AGENTS.md` na raiz;
- estrutura inicial de monorepo;
- API mínima health/readiness/version;
- admin placeholder de ambiente;
- domínio TypeScript inicial;
- cálculo mínimo do quórum;
- elegibilidade de pagamentos;
- GO/NO-GO;
- máquina de estados mínima;
- testes automatizados;
- migration do primeiro vertical slice;
- RBAC base;
- audit log no schema;
- subledger no schema;
- Docker Compose PostgreSQL 18.6;
- CI para testes + migration limpa;
- secret scan estático;
- manifesto da Fundação;
- árvore remota conferida após publicação;
- caminhos canônicos do `AGENTS.md` corrigidos.

## Evidência local anterior à publicação

- 10/10 testes de domínio: PASS;
- secret scan: PASS;
- migration static check: PASS;
- documentação canônica: PASS;
- API health/readiness: PASS;
- admin smoke test: PASS.

## Evidência GitHub Actions

Workflow: `ci`  
Run: `32542061215`  
Job: `foundation`  
Conclusão: **SUCCESS**

Passaram no runner:

1. inicialização do PostgreSQL 18.6;
2. checkout;
3. Node setup;
4. Domain and static checks;
5. migration `0001_core_foundation.sql` do zero;
6. seed `0002_seed_rbac.sql`;
7. assert das tabelas `profiles`, `events`, `payments`, `credits`, `quorum_snapshots` e `audit_logs`.

## HML-G0

Ainda **não** considerar HML-G0 concluído, porque o plano exige também um ambiente HML operacional e validação básica de backup/restore. O GitHub Actions provou código + migrations em PostgreSQL real, mas não substitui o ambiente de homologação persistente.

## Pendências / decisões abertas

- provedor de HML/cloud ainda não foi formalmente decidido;
- backup/restore básico do HML ainda não foi validado;
- gateway de pagamento continua decisão aberta;
- autenticação real ainda não implementada;
- repositories/commands ainda não ligados ao PostgreSQL;
- observabilidade externa ainda sem vendor.

## Próximo passo

1. finalizar e mergear PR #1 após CI do último commit;
2. decidir/provisionar HML persistente;
3. validar backup/restore e fechar HML-G0;
4. iniciar Incremento 1 — núcleo econômico: edição → configuração → custos → receitas garantidas → pagamento HML → crédito → quórum → reembolso → GO/NO-GO.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
