# REGISTRO DE DECISÕES — DIRETORIA

**Documento:** Decision Log V0.1

Não inventar decisões pendentes durante implementação. Quando uma decisão for tomada, preencher status, decisão, data, responsável, motivo e impacto.

| ID | Tema | Status | Decisão atual |
|---|---|---|---|
| DEC-001 | Domínio definitivo | ABERTA | Não definido |
| DEC-002 | Ticket fundador | ABERTA | Não definido |
| DEC-003 | Tamanho da primeira festa | ABERTA | Não definido |
| DEC-004 | Cidade/região inicial | ABERTA | Não definido no documento canônico |
| DEC-005 | Local(is) da primeira edição | ABERTA | Não definido |
| DEC-006 | Gateway de pagamento | ABERTA | Implementar por adapter; fornecedor não definido |
| DEC-007 | Preço público | ABERTA | Não definido |
| DEC-008 | Benefícios do membro | ABERTA | Estrutura prevista; lista final não definida |
| DEC-009 | Política definitiva de reembolso | ABERTA | Modelo reembolso ou rollover; jurídico/contábil pendente |
| DEC-010 | Limite/regra de transferência | ABERTA | Transferência direta prevista; limites não definidos |
| DEC-011 | Meia-entrada/enquadramento jurídico | ABERTA | Validar antes de venda pública |
| DEC-012 | Política de menores | ABERTA | Não definida |
| DEC-013 | Modelo final de bar | ABERTA | Bar separado da viabilidade; operação final não definida |
| DEC-014 | Parceiros iniciais | ABERTA | Não definidos |
| DEC-015 | Stack/provedores definitivos | PARCIAL | PostgreSQL + arquitetura modular definidos; HML usa Supabase + Vercel; produção continua aberta |
| DEC-016 | Provedor WhatsApp | ABERTA | Adapter previsto |
| DEC-017 | Provedor de e-mail | ABERTA | Adapter previsto |
| DEC-018 | Queue/cache | ABERTA | Componente necessário; fornecedor aberto |
| DEC-019 | Object storage | ABERTA | Necessário; fornecedor aberto |
| DEC-020 | Auth provider vs própria | ABERTA | Separação profiles/users definida; provider aberto |
| DEC-021 | Observabilidade vendor | ABERTA | Requisitos definidos; vendor aberto |
| DEC-022 | Hardware do gateway local | ABERTA | Arquitetura funcional definida; hardware aberto |
| DEC-023 | Contingência padrão | ABERTA | Parametrizável; percentual final por edição |
| DEC-024 | Peso de patrocínio contratado não pago | ABERTA | Pode ser configurável; política final pendente |
| DEC-025 | Tolerância de conciliação | ABERTA | Divergências sempre registradas; tolerância ainda não definida |
| DEC-026 | Provedores do HML | DECIDIDA | Banco: Supabase `diretoria-hml` em `sa-east-1`; aplicação: Vercel `diretoria-hml` |

# DEC-026 — Provedores do HML

**Status:** DECIDIDA  
**Data:** 21/08/2026  
**Decisão:** usar Supabase como PostgreSQL persistente do HML e Vercel como superfície persistente da aplicação HML.  
**Supabase ref:** `heckakjcpwomoucobtau`  
**Vercel project id:** `prj_CSbGzOVsvIkkJLosiemlHmvcG7XV`  
**Região Supabase:** `sa-east-1`  
**URL HML:** `https://diretoria-hml.vercel.app`  
**Motivo:** separar homologação de produção, manter PostgreSQL real, migrations verificáveis, URL persistente e capacidade de testar sem tocar em outros projetos.  
**Impacto:** HML-G0 pode ser encerrado; esta decisão não define automaticamente os provedores de produção.

# Como registrar uma decisão

Adicionar abaixo:

```text
DEC-XXX
Status: DECIDIDA
Data:
Responsável:
Decisão:
Motivo:
Alternativas avaliadas:
Impacto em documentos:
Impacto em código/migrations:
```

# Regra

Decisão aberta não deve virar constante silenciosa no código.

Quando uma implementação exigir um valor temporário para HML, usar configuração explicitamente marcada como `TEST/HML`, sem promover automaticamente para produção.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
