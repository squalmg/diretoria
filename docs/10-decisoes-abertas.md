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
| DEC-006 | Gateway de pagamento | DECIDIDA | Asaas como gateway V1; Sandbox primeiro; hosted checkout; produção com credenciais separadas |
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

# DEC-006 — Gateway de pagamento

**Status:** DECIDIDA  
**Data:** 22/08/2026  
**Decisão:** usar **Asaas** como gateway de pagamento V1 da Diretoria. A homologação começa exclusivamente no **Asaas Sandbox**, com Pix e cartão 1x, usando hosted checkout. Credenciais de produção serão separadas e só serão configuradas após o ciclo completo de homologação e revisão.  
**Regra econômica associada:** o preço-base da Diretoria é preservado; a taxa do Asaas pode ser repassada adicionalmente ao cliente, mas não compõe crédito nem capital protegido/quórum.  
**Motivo:** o adapter, o lifecycle transacional, a cotação de taxas da conta, o gross-up, a reconciliação, o webhook autenticado e os reversals já foram implementados e testados em HML. Hosted checkout evita que a Diretoria manipule número de cartão ou CVV.  
**Impacto:** `payments.provider = asaas` na V1; Sandbox obrigatório antes de produção; `ASAAS_ACCESS_TOKEN` e `ASAAS_WEBHOOK_AUTH_TOKEN` permanecem somente em secrets do ambiente; nenhuma credencial HML é promovida automaticamente para produção; política jurídica continua sendo gate independente.

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