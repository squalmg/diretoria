# Relatório — Admin HML com Writes Controlados

**Data:** 22/08/2026  
**Projeto:** Diretoria  
**Ambiente:** HML  
**Escopo:** Incremento 1 — superfície administrativa econômica

## Objetivo

Disponibilizar no HML uma superfície navegável capaz de operar o núcleo econômico já homologado, sem duplicar regras de negócio e sem liberar produção, gateway real ou dados pessoais reais.

## Arquitetura validada

```text
Vercel diretoria-hml
  ├─ portal HML
  ├─ console econômica
  └─ health proxy
          ↓
Supabase Edge
  ├─ diretoria-admin-api (read/auth)
  └─ diretoria-admin-write-api (writes HML)
          ↓
PostgresEconomicCore
          ↓
Supabase PostgreSQL HML
```

A API de writes importa e utiliza o `PostgresEconomicCore` canônico. Quórum, pagamento, reembolso, mudança automática de viabilidade, GO/NO-GO e confirmação permanecem no domínio transacional homologado.

## Segurança

- sessão temporária HML armazenada no banco apenas por SHA-256;
- bootstrap token é de uso único;
- writes aceitos apenas por sessão HML;
- Supabase Auth/allowlist não ganhou permissão de write neste slice;
- `HML-OPERATOR` é ator sintético auditável;
- `HML-CUSTOMER` é cliente sintético sem credencial;
- nenhum e-mail/telefone real foi necessário;
- nenhum segredo/connection string foi commitado;
- Edge API não devolve mensagem SQL/credencial ao cliente;
- valores financeiros chegam como centavos inteiros.

## Banco

Migrations adicionais do slice:

- `0009_hml_admin_allowlist.sql`;
- `0010_hml_bootstrap_tokens.sql`;
- `0011_hml_bootstrap_rpc.sql`;
- `0012_hml_admin_sessions.sql`;
- `0013_hml_admin_session_fk_index.sql`;
- `0014_hml_synthetic_actors.sql`.

As migrations `0001–0014` estão aplicadas no Supabase HML canônico.

## Edge Functions

### `diretoria-admin-api`

Responsável por autenticação/sessão, health e leituras administrativas.

### `diretoria-admin-write-api`

Responsável exclusivamente por mutations do HML. Deploy no Supabase concluído com status `ACTIVE`.

Writes disponíveis:

- edição;
- transição sequencial;
- configuração financeira;
- custo;
- receita garantida;
- recálculo;
- pagamento mock;
- confirmação mock;
- reembolso;
- checklist;
- GO/NO-GO;
- confirmação.

## Vercel

Project:

`diretoria-hml`

Deployment final deste slice:

`dpl_CkPLersGhaZar4hsMHrmGy22dxxJ`

Estado:

`READY`

Validações HTTP:

- `/` → 200;
- `/writes.html` → 200;
- `/writes.js` → 200;
- `/api/edge-health` → 200 e banco conectado.

A console foi separada em HTML + JS externo para reduzir acoplamento e facilitar deploy/revisão.

## CI

Run final anterior à documentação:

`32566538746`

Todos os passos passaram:

- domínio;
- secret scan;
- migrations;
- docs;
- sintaxe HML;
- PostgreSQL limpo;
- hardening;
- sessão/bootstrap;
- integração do core econômico;
- backup/restore.

O checker HML foi ampliado para validar scripts JavaScript externos locais, além de scripts inline.

## Regra de promoção

Nada deste relatório autoriza produção.

O ambiente continua explicitamente HML e utiliza pagamentos/atores/clientes sintéticos.

## Próximo teste

Smoke navegável sintético completo:

```text
PLANEJAMENTO
→ REATIVACAO
→ LISTA_DE_ESPERA
→ FORMACAO
→ QUORUM_EM_ANDAMENTO
→ configuração/custos/receita
→ pagamento pending
→ confirmação/credit
→ reembolso
→ novo pagamento
→ VIAVEL automático
→ checklist
→ GO
→ CONFIRMADO
```

O resultado deve ser documentado antes de considerar o Incremento 1 encerrado.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
