# RELATÓRIO — INCREMENTO 1 / NÚCLEO ECONÔMICO TRANSACIONAL

**Data:** 21/08/2026  
**Escopo:** primeiro vertical slice transacional do Incremento 1  
**Resultado:** **APROVADO NO CI E MIGRATIONS APLICADAS NO HML**

## 1. Entregas

- driver PostgreSQL `pg` fixado na V1 do core;
- repository/casos de uso transacionais para edição;
- configuração financeira versionada;
- custos protegidos;
- receitas garantidas;
- pagamento mock/HML idempotente;
- geração de crédito válido;
- snapshots e recálculo de quórum;
- reembolso com retirada do capital protegido;
- checklist de confirmação;
- review GO/NO-GO;
- confirmação server-side;
- tabela `refunds`;
- trigger de máquina de estados no PostgreSQL;
- hardening de `search_path` da função do trigger.

## 2. Cenário canônico executado em PostgreSQL 18.6

Configuração:

- custos protegidos: R$ 70.000;
- contingência: 15% = R$ 10.500;
- receitas garantidas: R$ 10.000;
- necessidade financeira: R$ 70.500;
- ticket bruto: R$ 120;
- taxa: R$ 5;
- custo variável: R$ 5;
- contribuição líquida protegida: R$ 110;
- quórum mínimo: 641.

Resultados:

- 640 créditos válidos → R$ 70.400 → `NAO_VIAVEL`;
- 641 créditos válidos → R$ 70.510 → `VIAVEL`;
- webhook repetido → não duplica crédito;
- tentativa de confirmar sem gate → bloqueada;
- checklist aprovado + GO atual → elegível;
- reembolso de um membro → volta para 640 e `QUORUM_EM_ANDAMENTO`;
- confirmação depois do reembolso → bloqueada;
- novo pagamento válido → volta a 641 e `VIAVEL`;
- GO antigo → considerado stale;
- novo GO sobre snapshot atual → válido;
- confirmação final → `CONFIRMADO`.

Também foi validado que `bar` não é um `revenue_type` aceito para receita garantida.

## 3. Correções encontradas durante CI

O primeiro CI encontrou ambiguidade de bind parameter no PostgreSQL 18 quando um mesmo parâmetro era usado em coluna `varchar` e em expressão `CASE`.

A correção foi generalizada, normalizando status de domínio pertinentes para `text` e mantendo os `CHECK constraints` como fronteira dos valores válidos.

O advisor do Supabase encontrou ainda `search_path` mutável na função de trigger. A migration `0008_event_guard_search_path` fixou `search_path = public, pg_temp`.

## 4. GitHub Actions

Run final aprovado:

`32544462072`

Passaram:

- instalação de dependências;
- 10/10 testes puros de domínio;
- secret scan;
- migration/static docs check;
- migrations `0001–0008` do zero;
- assertions de schema/RLS/trigger;
- integração econômica completa;
- backup/restore após o cenário.

## 5. Supabase HML

Projeto:

`heckakjcpwomoucobtau` — `diretoria-hml`

Migrations aplicadas no HML:

- `0001_core_foundation`;
- `0002_seed_rbac`;
- `0003_supabase_hml_hardening`;
- `0004_economic_core_refunds`;
- `0005_event_state_guards`;
- `0006_revenue_status_text`;
- `0007_domain_status_text_normalization`;
- `0008_event_guard_search_path`.

Validação HML:

- `refunds` com RLS: PASS;
- trigger `events_state_guard`: presente;
- status normalizados: `text`;
- advisor de segurança: nenhum WARN/ERROR de função mutável;
- apenas INFO `rls_enabled_no_policy`, intencional enquanto o backend permanece a única via autorizada;
- advisor de performance: apenas INFO de índices sem uso em banco sem carga.

## 6. O que ainda NÃO está pronto

Este relatório não declara o Incremento 1 inteiro concluído.

Ainda falta:

- expor os casos de uso por API HML;
- RBAC server-side nos endpoints;
- painel administrativo ligado ao backend;
- autenticação HML adequada;
- pagamento real/gateway real, que pertence ao gate posterior e permanece decisão aberta.

## 7. Próximo passo

Construir a superfície funcional HML:

`Admin → API → PostgresEconomicCore → Supabase HML`

Primeiras telas/endpoints:

1. criar/listar edição;
2. configuração financeira;
3. custos;
4. receitas garantidas;
5. quórum;
6. pagamentos mock;
7. reembolso;
8. checklist;
9. GO/NO-GO;
10. confirmação.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
