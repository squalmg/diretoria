# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 1 — Núcleo Econômico  
**Estado:** **ADMIN HML ECONÔMICO IMPLEMENTADO E PUBLICADO**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- HML-G0: **APROVADO**;
- core econômico transacional: **APROVADO**;
- Admin HML read-only: **APROVADO e mergeado no PR #6**;
- Admin HML com writes controlados: **implementado no PR #7, CI e deploy HML aprovados**.

## HML persistente

### Aplicação

- Vercel project: `diretoria-hml`;
- project id: `prj_CSbGzOVsvIkkJLosiemlHmvcG7XV`;
- URL: `https://diretoria-hml.vercel.app`;
- deployment validado: `dpl_CkPLersGhaZar4hsMHrmGy22dxxJ`;
- `/`: HTTP 200;
- `/writes.html`: HTTP 200;
- `/writes.js`: HTTP 200;
- `/api/edge-health`: HTTP 200;
- build Vercel: **READY**, sem erro de build.

### Banco / API

- Supabase project: `diretoria-hml`;
- project ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- estado: `ACTIVE_HEALTHY`;
- migrations aplicadas: `0001` a `0014`;
- Edge Function `diretoria-admin-api`: **ACTIVE**;
- Edge Function `diretoria-admin-write-api`: **ACTIVE**;
- operador sintético: `HML-OPERATOR`;
- cliente sintético: `HML-CUSTOMER`;
- nenhum dado pessoal real utilizado no slice.

## O que está funcional

### Leitura autenticada

- sessão HML temporária;
- bootstrap de uso único armazenado somente por hash;
- lista de edições;
- resumo da edição;
- configuração financeira;
- custos protegidos;
- receitas garantidas;
- snapshot/quórum;
- checklist;
- GO/NO-GO.

### Writes HML controlados

A Edge Function de writes reutiliza o `PostgresEconomicCore` canônico. Não existe segunda implementação de quórum ou GO/NO-GO na camada HTTP.

Operações expostas:

1. criar edição;
2. transição sequencial de fase;
3. criar nova versão financeira;
4. cadastrar custo protegido;
5. cadastrar receita garantida;
6. recalcular quórum;
7. criar pagamento mock `pending`;
8. confirmar pagamento mock;
9. reembolsar pagamento;
10. atualizar checklist;
11. executar GO/NO-GO;
12. confirmar edição pelo gate server-side.

## Regras preservadas

- pagamento `pending` não aumenta quórum;
- promessa não reduz necessidade financeira;
- bar não é receita elegível para tornar a edição viável;
- `VIAVEL != CONFIRMADO`;
- a UI não possui botão para forçar `VIAVEL`;
- a UI não possui campo para editar capital protegido/quórum;
- confirmação revalida snapshot atual + configuração + checklist + GO;
- reembolso recalcula a proteção;
- writes exigem sessão temporária HML válida;
- valores financeiros entram na API como centavos inteiros;
- segredos/connection strings não estão versionados.

## Evidência automatizada mais recente

GitHub Actions run:

`32566538746`

Resultado:

- testes de domínio: PASS;
- secret scan: PASS;
- validação de migrations: PASS;
- validação de documentação: PASS;
- validação JavaScript HML inline + externo: PASS;
- migrations do zero: PASS;
- hardening/RLS: PASS;
- bootstrap/sessão: PASS;
- cenário econômico integrado: PASS;
- backup/restore: PASS.

## Ainda fora do escopo

- gateway de pagamento real;
- preço/ticket comercial definitivo;
- clientes reais;
- produção;
- ticketing/QR/portaria;
- CRM público e aquisição;
- políticas jurídicas definitivas.

## Próximo passo

# Smoke navegável + fechamento do Incremento 1

Executar, somente com dados sintéticos, o fluxo navegável completo no HML:

`criar edição → fases → configuração → custos/receita → quórum → pagamento mock → crédito → reembolso → novo pagamento → VIAVEL → checklist → GO → CONFIRMADO`

Depois registrar evidência final do fluxo e iniciar o próximo incremento funcional conforme `docs/09-roadmap-implementacao.md`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
