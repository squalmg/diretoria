# CHECKLIST DE POLÍTICAS — DIRETORIA CLUB HML

Este arquivo **não é conteúdo jurídico**. Ele apenas lista o que precisa ser decidido/revisado antes de ativar os documentos do checkout.

## 1. `club_terms`

O texto aprovado deve ser coerente com as regras canônicas já implementadas:

- o produto pré-confirmação é **crédito Diretoria Club**, não ingresso;
- pagamento pendente não cria crédito válido;
- confirmação financeira depende do backend/webhook;
- `VIÁVEL` não significa `CONFIRMADO`;
- o preço-base da Diretoria é separado da taxa repassada do Asaas;
- a taxa repassada não aumenta crédito nem capital protegido/quórum;
- benefícios, transferências e conversão em ingresso só podem prometer o que estiver formalmente definido.

Pendências comerciais/jurídicas que não devem ser inventadas:

- benefícios finais do membro;
- preço fundador definitivo;
- regras finais de transferência;
- enquadramento/meia-entrada quando aplicável;
- política de menores.

## 2. `non_achievement_policy`

Precisa definir de forma aprovada:

- prazo de formação/quórum;
- o que caracteriza não atingimento;
- opção de reembolso, rollover ou ambas;
- prazo e modo de escolha do usuário;
- tratamento comercial do rollover;
- tratamento da taxa Asaas quando o provedor não a devolver integralmente;
- prazo operacional de processamento do reembolso;
- casos de chargeback/disputa;
- comunicação ao membro.

A V1 local assume **estorno integral** para o teste técnico. Isso não substitui a política comercial/jurídica definitiva.

## 3. `privacy_policy`

Precisa definir de forma aprovada, entre outros pontos pertinentes ao projeto:

- controlador/identificação da operação;
- categorias de dados tratadas;
- finalidades;
- bases e consentimentos quando aplicáveis;
- provedores/operadores relevantes;
- retenção;
- direitos do titular e canal de contato;
- segurança;
- transferências/compartilhamentos pertinentes;
- cookies/analytics/marketing quando ativados.

O checkout registrará a versão exata aceita no backend. O banner de analytics em `localStorage` não substitui este aceite.

## Critério de ativação HML

Para cada documento:

1. conteúdo entregue/revisado;
2. título final definido;
3. criar rascunho na tela HML;
4. revisar hash/versão;
5. ativar explicitamente;
6. confirmar bundle com os 3 documentos;
7. executar checkout apenas depois disso.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
