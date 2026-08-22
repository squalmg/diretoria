# STATUS ATUAL — DIRETORIA

**Data:** 21/08/2026  
**Fase:** Incremento 1 — Núcleo Econômico  
**Estado:** **CORE TRANSACIONAL APROVADO; PRÓXIMO SLICE É API + ADMIN HML**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- HML-G0: **APROVADO**;
- PR ativo do core: `#5 feat: implementar primeiro núcleo econômico transacional`.

## HML persistente

### Aplicação

- Vercel project: `diretoria-hml`;
- project id: `prj_CSbGzOVsvIkkJLosiemlHmvcG7XV`;
- URL: `https://diretoria-hml.vercel.app`;
- `/`: HTTP 200;
- `/api/health`: HTTP 200.

### Banco

- Supabase project: `diretoria-hml`;
- project ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- estado observado: `ACTIVE_HEALTHY`;
- migrations HML aplicadas: `0001` a `0008`.

## Concluído no Incremento 1 — core transacional

- criação de edição;
- configuração financeira versionada;
- custos protegidos;
- receitas garantidas;
- pagamento mock/HML idempotente;
- crédito válido;
- recálculo e snapshots de quórum;
- reembolso e queda do capital protegido;
- checklist de confirmação;
- GO/NO-GO;
- confirmação server-side;
- `refunds` persistido;
- trigger PostgreSQL de máquina de estados;
- RLS default-deny;
- `search_path` fixo na função crítica.

## Evidência principal

GitHub Actions run final:

`32544462072`

Resultado:

- 10/10 testes de domínio: PASS;
- migrations `0001–0008`: PASS;
- schema/RLS/trigger: PASS;
- cenário econômico integrado: PASS;
- backup/restore após cenário: PASS.

Cenário integrado provado:

`640 → NAO_VIAVEL → 641 → VIAVEL → reembolso → 640 → novo pagamento → 641 → GO atual → CONFIRMADO`

Também provado:

- replay de webhook não duplica crédito;
- promessa não reduz quórum;
- bar não é receita garantida elegível;
- GO antigo fica inválido depois de novo snapshot;
- confirmação sem gate é bloqueada.

Relatório:

`relatorios/2026-08-21-INCREMENTO-1-NUCLEO-ECONOMICO.md`

## Supabase Advisors

Segurança:

- sem ERROR de RLS desabilitado;
- sem WARN de `function_search_path_mutable`;
- INFO `rls_enabled_no_policy` permanece intencionalmente: default-deny até políticas explícitas serem necessárias.

Performance:

- apenas INFO de índices ainda sem uso, esperado em HML sem carga real.

## Ainda não concluído no Incremento 1

1. API HML expondo os casos de uso;
2. autorização/RBAC server-side nos endpoints;
3. painel administrativo conectado ao backend;
4. autenticação HML para operadores;
5. fluxos visuais ADM-03 a ADM-15 mínimos.

Gateway de pagamento real, preço real e produção continuam fora deste slice e não devem ser inventados.

## Próximo passo

# Slice API + Admin HML

Fluxo:

`Admin HML → API → PostgresEconomicCore → Supabase HML`

Prioridade:

1. `/api/admin/events`;
2. configuração financeira;
3. custos;
4. receitas garantidas;
5. dashboard/quórum;
6. pagamento mock controlado de HML;
7. reembolso;
8. checklist;
9. GO/NO-GO;
10. confirmar edição.

Depois disso, validar o primeiro fluxo navegável de ponta a ponta no HML.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
