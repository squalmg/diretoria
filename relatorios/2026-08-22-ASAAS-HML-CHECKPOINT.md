# CHECKPOINT ASAAS HML — DIRETORIA

**Data:** 22/08/2026  
**Escopo:** Incremento 3 — Club / pagamento Asaas  
**Ambiente:** somente HML / Asaas Sandbox  
**Produção:** não alterada

## Resultado deste ciclo

A integração avançou até o último ponto seguro antes de usar credenciais e políticas reais.

### GitHub

Merges concluídos neste ciclo:

- PR #23 — atualização do `STATUS-ATUAL.md`;
- PR #24 — completar checkout Asaas Sandbox no Club HML;
- PR #25 — corrigir falso negativo do health do member API.

O PR #24 adicionou o encadeamento funcional:

```text
oferta
→ conta autenticada
→ checkout intent idempotente
→ consulta das taxas efetivas da conta Asaas
→ gross-up / freeze quote
→ preço-base + taxa repassada = total cliente
→ leitura das políticas vigentes
→ aceite por fingerprint vigente
→ hosted checkout Asaas
→ confirmação exclusivamente por webhook
```

O backend continua sem aceitar retorno do navegador como autoridade de pagamento.

### Supabase HML

Projeto:

`heckakjcpwomoucobtau`

Estado após publicação:

- `diretoria-member-api`: **v5 ACTIVE**;
- `diretoria-asaas-webhook`: **v1 ACTIVE**;
- banco verificado ao vivo como `connected`;
- migrations `0001–0024` preservadas;
- nenhuma secret foi colocada em código, commit ou relatório.

O health antigo tinha um falso negativo porque `PostgresMemberAccounts.health()` retorna o nome do banco, enquanto outros módulos retornam `connected`. A Edge comparava os três resultados literalmente com `connected`. O PR #25 passou a considerar o banco saudável quando os três probes resolvem sem erro; qualquer exceção continua produzindo 503.

### Prova ao vivo dos secrets

Foi feita uma chamada ao endpoint público da Edge v5 sem ler nem revelar valores de segredo.

Resposta relevante:

```text
database: connected
checkoutProvider: asaas-sandbox-unconfigured
payments: disabled
```

Conclusão: **`ASAAS_ACCESS_TOKEN` e/ou `ASAAS_WEBHOOK_AUTH_TOKEN` ainda não estão disponíveis para o runtime das Edge Functions do Supabase HML.** Ter os valores em mãos não equivale a tê-los cadastrados no projeto.

A extensão PostgreSQL `http` foi instalada apenas temporariamente para a prova e removida imediatamente depois. Check final: `http_extension_installed = false`.

## Evento sintético preparado para o primeiro teste

Foi criada uma única edição exclusivamente de homologação:

- código: `HML-ASAAS-001`;
- slug: `hml-asaas-sandbox`;
- status: `QUORUM_EM_ANDAMENTO`;
- preço-base: **R$ 150,00**;
- taxa estimada fixa na configuração: **R$ 0,00**;
- `fee_pass_through = true`;
- custo variável por membro: **R$ 10,00**;
- custo protegido sintético aprovado: **R$ 280,00**.

Com essa configuração:

- cada pagamento válido gera crédito de **R$ 150,00**, independentemente da taxa cobrada do cliente;
- cada crédito contribui com **R$ 140,00** de capital protegido;
- 1 crédito não fecha quórum;
- 2 créditos totalizam R$ 280,00 protegidos e permitem validar a virada de viabilidade;
- refund/chargeback deve retirar a contribuição do crédito e recalcular o quórum.

A criação do evento foi acompanhada por `event_status_history` e `audit_logs`. Não foi forçado `VIAVEL` nem `CONFIRMADO`.

## Banco no checkpoint

Contagens finais:

- eventos: **1**;
- `policy_documents`: **0**;
- `policy_acceptances`: **0**;
- `checkout_intents`: **0**;
- `payments`: **0**;
- `payment_webhook_receipts`: **0**;
- `credits`: **0**.

Portanto nenhum pagamento ou crédito foi criado durante a preparação.

## Policy gate

A API agora expõe, de forma autenticada:

- `GET /checkout-policies` — entrega apenas as versões ativas atuais de `club_terms` e `non_achievement_policy`;
- `POST /checkout-policies/accept` — aceita somente o fingerprint do bundle vigente e resolve os IDs no servidor.

O frontend não escolhe documentos arbitrários e bundles desatualizados são rejeitados.

**Não existe conteúdo jurídico cadastrado ainda.** Isso é intencional. Nenhum texto de `club_terms` ou `non_achievement_policy` foi inventado.

## Public HML / Vercel

O novo `club.html` e `club.js` estão mergeados na `main`, porém a aplicação pública `https://diretoria-public-hml.vercel.app` ainda serve a versão anterior da tela.

Validação ao vivo mostrou a UI antiga, que apenas prepara a intenção e informa gateway `unconfigured`.

O projeto Vercel público não está Git-linked e a ferramenta de deploy disponível não permite selecionar explicitamente o project ID. Por segurança, não foi feito deploy ambíguo que pudesse atingir outro projeto.

## Bloqueios reais restantes para o primeiro Pix Sandbox

1. cadastrar de forma segura no Supabase HML os secrets:
   - `ASAAS_ACCESS_TOKEN`;
   - `ASAAS_WEBHOOK_AUTH_TOKEN`;
2. configurar o webhook no Asaas Sandbox com o mesmo token de autenticação e a URL já definida da Edge;
3. cadastrar e ativar textos aprovados para:
   - `club_terms`;
   - `non_achievement_policy`;
4. publicar a UI já mergeada do `apps/public-hml` no projeto Vercel `diretoria-public-hml` por um método que identifique explicitamente o projeto;
5. autenticar um usuário HML e executar o primeiro Pix Sandbox.

## Sequência de teste após os gates

```text
Pix Sandbox
→ cotação de taxa real
→ hosted checkout
→ webhook confirmado
→ payment PAID
→ crédito R$ 150
→ capital protegido R$ 140
→ replay do mesmo webhook
→ refund
→ crédito inválido
→ quórum recalculado
→ novo ciclo para alcançar 2 créditos
→ cartão 1x
→ falhas e reconciliação
```

Nenhuma etapa de produção deve começar antes do fechamento dessa sequência.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**