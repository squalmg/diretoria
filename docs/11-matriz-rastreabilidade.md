# MATRIZ DE RASTREABILIDADE — DIRETORIA

**Documento:** Rastreabilidade V0.1

| Regra/Objetivo | Fonte canônica | Implementação principal | Teste/Gate |
|---|---|---|---|
| Quórum é financeiro | Goal §4 | E03 | TST-DOM-001/002/003 |
| Bar não financia viabilidade | Goal §5 | DIR-0302/0303 | TST-DOM-004 |
| VIÁVEL != CONFIRMADO | Goal §3/10 | E06 | TST-DOM-005 |
| GO/NO-GO obrigatório | Goal §3 | DIR-0602/0603/0604 | TST-DOM-006/007 |
| Frontend não confirma pagamento | Goal §13 | DIR-0503/0504 | TST-DOM-002 |
| Idempotência de webhook | Arquitetura/Modelo | DIR-0503 | TST-DOM-002 |
| Crédito depende de pagamento válido | Modelo RI-03 | DIR-0505 | TST-DOM-001/008 |
| Reembolso repercute no quórum | Goal §13 | DIR-0506 | TST-DOM-003 |
| Capital protegido não é lucro | Goal §12 | E03/E09 | fechamento/ledger |
| Crédito != ingresso | Goal §14 | E05/E07 | conversão |
| Transferência não duplica acesso | Goal §14 | DIR-0706 | TST-DOM-010 |
| Ticket só usa uma vez | Goal §14/15 | DIR-1003 | TST-DOM-011 |
| Portaria não depende da internet externa | Goal §15 | DIR-1005/1006 | offline test |
| Scanner não vê financeiro | Goal §19 | RBAC/E10 | autorização |
| Pagamento pessoal gera obrigação | Goal §16 | DIR-0806/0807 | TST-DOM-012 |
| Estoque é derivado | Modelo RI-12 | E11 | TST-DOM-014 |
| DRE final exige fechamento | Goal §20 | E12 | TST-DOM-015 |
| Auditoria crítica | Goal §19 | DIR-0105 | todos gates |
| Analytics não é fonte financeira | Arquitetura §24 | DIR-0404 | integração |
| DEV/HML antes de produção | Goal §25 | E00 | HML-G0..G5 |
| Segredos nunca no código | Goal §25 | DIR-0003 | security tests |

# Gates e documentos

## Primeiro anúncio
Blueprint §83 + Goal §24 → Backlog Gate A → HML-G0 + aquisição.

## Primeiro pagamento
Blueprint §84 + Goal §24 → Backlog Gate B → HML-G1/G2.

## Confirmar festa
Blueprint §85 + Goal §24 → Backlog Gate C → HML-G3.

## Dia do evento
Blueprint §86 + Goal §24 → Backlog Gate D → HML-G4.

## Fechamento
Blueprint §87 + Goal §24 → Backlog Gate E → HML-G5.

# Uso

Ao criar uma nova story crítica, adicionar sua ligação nesta matriz. Isso evita feature sem regra e regra sem teste.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
