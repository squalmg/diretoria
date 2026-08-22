# RELATÓRIO — INCREMENTO 3 / FUNDAÇÃO PRÉ-PAGAMENTO

**Data:** 22/08/2026  
**Escopo:** Conta pública, Club, checkout-intent, notificações, contrato de gateway e políticas.

## Concluído

1. autenticação pública HML e vínculo seguro ao `customer_id`;
2. área `Minha Diretoria` com carteira read-only;
3. oferta Club baseada na configuração financeira vigente;
4. checkout intent idempotente, sem produzir pagamento/crédito;
5. contrato `PaymentProviderAdapter` fail-closed;
6. fila transacional provider-neutral;
7. políticas versionadas e aceite append-only;
8. migrations HML `0018–0022`;
9. Public HML com `/account.html` e `/club.html`;
10. CI dedicado para member-auth, Club, notifications, payment-provider contract e policy gate.

## Provas principais

- conta nova não vira membro automaticamente;
- lead existente não é tomado por identidade não verificada;
- preço do Club é lido de `event_financial_configs`;
- nova versão financeira só afeta novos intents;
- intent antigo preserva preço/config usados no momento da criação;
- criação de intent deixa `payments=0` e `credits=0`;
- provider desconhecido resolve para `DisabledPaymentProvider`;
- adapter sem verificação de assinatura é rejeitado;
- webhook normalizado precisa bater checkout, valor, moeda e provider;
- notificações não chamam provider quando ele está `unconfigured`;
- template antigo fica pinado em notificações já criadas;
- policy v2 aposenta v1;
- aceite v1 não satisfaz gate v2;
- documento ativo é imutável;
- aceite não pode ser apagado/alterado.

## HML após promoção

Consulta final:

- checkout intents: 0;
- notification templates: 0;
- notifications: 0;
- notification attempts: 0;
- policy documents: 0;
- policy acceptances: 0;
- pagamentos não-mock: 0.

Portanto nenhum efeito comercial real foi gerado.

## Bloqueio atual

O próximo salto para dinheiro real depende de decisões que não podem ser inventadas:

- gateway de pagamento;
- preço fundador/comercial definitivo;
- políticas jurídicas finais;
- provedor transacional de comunicação, caso necessário no primeiro pagamento.

## Regra de continuidade

A primeira integração de gateway deve acontecer somente em HML e deve aderir ao contrato provider-neutral já mergeado. Nenhuma chamada produtiva, credencial real de produção ou liberação de dinheiro deve ser feita antes de sandbox, webhooks idempotentes, refund e policy gate passarem integralmente.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
