# ASAAS SANDBOX READY — DIRETORIA HML

**Data:** 23/08/2026  
**Escopo:** Incremento 3 — Club / pagamento Asaas  
**Ambiente:** HML + Asaas Sandbox  
**Produção:** não alterada

## Resultado

O bloqueio de credenciais do Asaas Sandbox foi encerrado.

Foram configurados no Supabase HML, fora do código:

- `ASAAS_ACCESS_TOKEN`;
- `ASAAS_WEBHOOK_AUTH_TOKEN`.

O webhook `Diretoria HML` também foi configurado e ativado no Asaas Sandbox apontando para:

`https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook`

Nenhum valor secreto foi registrado em chat, código, commit ou relatório.

## Prova ao vivo — member API

O endpoint HML respondeu:

```text
database: connected
checkoutProvider: asaas-sandbox
payments: sandbox-ready
```

Conclusão: os dois secrets estão disponíveis para o runtime da `diretoria-member-api`.

## Prova ao vivo — webhook

O endpoint de health do webhook respondeu:

```text
service: diretoria-asaas-webhook
environment: hml
provider: asaas-sandbox
configured: true
```

Conclusão: `ASAAS_WEBHOOK_AUTH_TOKEN` e `ASAAS_ACCESS_TOKEN` também estão disponíveis para o runtime da função de webhook.

## Estado das Edge Functions observado

- `diretoria-member-api`: ACTIVE;
- `diretoria-asaas-webhook`: ACTIVE.

Atualizações de secrets podem alterar o número de versão exibido pelo Supabase sem representar mudança de código; por isso o estado funcional foi validado pelos endpoints, não apenas pelo número da versão.

## Estado financeiro após a configuração

Checkpoint do banco:

- `policy_documents`: **0**;
- `policy_acceptances`: **0**;
- `checkout_intents`: **0**;
- `payments`: **0**;
- `payment_webhook_receipts`: **0**;
- `credits`: **0**.

Nenhum pagamento, crédito ou efeito de quórum foi criado durante a configuração.

A extensão PostgreSQL `http`, usada temporariamente apenas para executar os probes de health a partir do HML, foi removida ao final. Check final: `http_extension_installed = false`.

## Webhook Sandbox

A configuração manual foi realizada no domínio `sandbox.asaas.com`, mantendo separação da conta de produção.

Configuração usada:

- API v3;
- webhook ativo;
- envio sequencial;
- fila de sincronização ativa;
- token exclusivo de HML;
- somente eventos de pagamento suportados pelo adapter devem ser selecionados.

O outro webhook existente no Sandbox, não relacionado à Diretoria, permanece fora do escopo.

## Bloqueios restantes antes do primeiro Pix Sandbox

O bloqueio de secrets está **resolvido**.

Restam dois gates reais:

### 1. Policy gate

Ainda não existem documentos ativos para:

- `club_terms`;
- `non_achievement_policy`.

A Diretoria não deve iniciar `/start` enquanto essas políticas não existirem e forem aceitas. Não criar texto jurídico definitivo por conveniência técnica.

### 2. Public HML

A nova UX de checkout está mergeada no repositório, mas a URL:

`https://diretoria-public-hml.vercel.app/club.html`

continua servindo a versão anterior da tela.

A tela atual ainda mostra apenas `Preparar checkout HML` e o texto antigo do gate. Portanto não deve ser usada para o primeiro ciclo Asaas completo.

## Próxima sequência segura

```text
políticas HML aprovadas/ativas
→ publicar UI nova no projeto Vercel correto
→ autenticar usuário HML
→ criar checkout intent
→ consultar taxa efetiva Asaas Sandbox
→ freeze quote
→ aceitar políticas
→ criar hosted checkout Pix
→ pagamento Sandbox
→ webhook
→ payment paid
→ crédito R$ 150,00
→ capital protegido R$ 140,00
→ replay do webhook
→ refund
→ reversão do crédito/quórum
→ cartão 1x
→ falhas/reconciliação
```

## Decisão de gate

**GO parcial para integração Asaas Sandbox.**

Credenciais e webhook estão prontos.  
**NO-GO para executar o primeiro pagamento até fechar policy gate e Public HML.**

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**