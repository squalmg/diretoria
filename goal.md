# goal.md — Diretoria

**Projeto:** Diretoria  
**Produto inicial:** Diretoria Club  
**Data-base:** 21/08/2026  
**Status:** Documento canônico para desenvolvimento

---

# 1. Objetivo

Construir a plataforma operacional da Diretoria para que eventos sejam planejados, financiados, confirmados, vendidos, executados e encerrados com base em **demanda financeira comprovada, risco controlado, rastreabilidade e dados confiáveis**.

A Diretoria não deve voltar a operar no modelo:

**planejar → contratar → gastar → anunciar → vender → realizar → descobrir o resultado**

O modelo-alvo é:

**criar demanda → captar interessados → converter membros → proteger capital → atingir quórum → validar operação → confirmar evento → ampliar vendas → realizar → controlar → fechar → reter para a próxima edição**

O software deve controlar:

**demanda → dinheiro → risco → produção → acesso → operação → resultado → recorrência**

---

# 2. Problema central

A pergunta que este projeto deve resolver é:

> **Como produzir eventos sem assumir antecipadamente uma exposição financeira desproporcional à demanda real?**

O objetivo não é simplesmente criar um site de festas.

O objetivo é transformar a Diretoria em uma operação na qual a decisão de realizar uma edição seja sustentada por demanda econômica comprovada e por controle integral do ciclo financeiro e operacional.

---

# 3. Regra fundamental de GO/NO-GO

Nenhuma edição poderá passar para `CONFIRMADO` enquanto o sistema não responder satisfatoriamente:

> **Se não vendermos mais nenhum ingresso e o bar tiver resultado zero, conseguimos realizar este evento sem ultrapassar a exposição financeira aprovada?**

Se a resposta for **não**, o evento não pode ser confirmado.

Atingir o quórum financeiro permite o estado `VIÁVEL`.

`VIÁVEL` não significa automaticamente `CONFIRMADO`.

A confirmação definitiva também depende de validação administrativa e operacional.

---

# 4. Quórum é financeiro

Não contam como quórum:

- seguidores;
- curtidas;
- comentários;
- pessoas em grupos;
- respostas de enquete;
- RSVP;
- “eu vou”;
- checkout iniciado;
- pagamento pendente.

Quórum é:

> **dinheiro efetivamente comprometido e considerado válido pelo motor financeiro.**

Pagamento só contribui para o quórum quando estiver confirmado pelo backend e dentro das regras financeiras da edição.

---

# 5. O bar não financia a viabilidade

Receita esperada de bar não pode ser necessária para tornar a festa viável.

Também não devem reduzir o quórum enquanto não forem consideradas receitas válidas:

- estacionamento esperado;
- camarote esperado;
- patrocínio apenas prometido;
- vendas futuras;
- qualquer receita sem grau de confirmação aceito pelo motor financeiro.

Essas receitas são **upside**.

A viabilidade deve ser sustentada por capital protegido.

---

# 6. North Star Metrics

## Principal

# CAPITAL DE EVENTO PROTEGIDO

> Quanto da obrigação econômica da próxima edição já está coberta por receita comprometida válida.

## Recorrência

# MEMBROS ATIVOS RECORRENTES

> Quantas pessoas participaram de uma edição e já estão comprometidas com a próxima.

Seguidores e ingressos vendidos continuam sendo métricas úteis, mas não são a principal medida estratégica do produto.

---

# 7. Produto inicial — Diretoria Club

O primeiro produto será o **Diretoria Club**.

Na V1 ele não será uma assinatura mensal.

Fluxo:

1. usuário cria conta;
2. compra crédito para uma edição;
3. pagamento confirmado torna o crédito válido;
4. crédito válido integra o capital protegido;
5. usuário acompanha a formação do evento;
6. participa das decisões permitidas;
7. quando a edição for confirmada, o crédito é tratado conforme as regras de conversão em ingresso;
8. após a edição, o usuário pode iniciar o ciclo seguinte.

---

# 8. Membro não é comprador público

O sistema deve manter dois relacionamentos distintos.

## Membro Diretoria

Participa do ciclo de formação da edição e pode possuir benefícios, prioridade, indicação, histórico e votações autorizadas.

## Comprador público

Compra ingresso depois que o evento já está confirmado.

Essa distinção deve existir no banco de dados, CRM, analytics e relatórios.

---

# 9. Identidade única do cliente

O sistema deve buscar consolidar a mesma pessoa sob um identificador único:

`customer_id`

O histórico poderá reunir:

- origem;
- visitas;
- lead;
- pagamento;
- crédito;
- ingresso;
- transferência;
- indicação;
- presença;
- participação;
- recompra.

Não criar identidades independentes e desconectadas por canal.

---

# 10. Máquina de estados da edição

Estados canônicos:

`PLANEJAMENTO`

→ `REATIVAÇÃO`

→ `LISTA_DE_ESPERA`

→ `FORMAÇÃO`

→ `QUÓRUM_EM_ANDAMENTO`

→ `VIÁVEL`

→ `CONFIRMADO`

→ `VENDA_PÚBLICA`

→ `PRÉ_EVENTO`

→ `AO_VIVO`

→ `FECHAMENTO`

→ `ENCERRADO`

→ `RETENÇÃO`

Interfaces e automações devem respeitar essa máquina de estados.

Não criar estados paralelos por conveniência de UI.

---

# 11. Motor financeiro e de quórum

O motor de quórum é componente central do sistema.

Modelo conceitual:

`necessidade_financeira = custos_protegidos + contingencia - receitas_garantidas`

`contribuicao_liquida_membro = ticket - taxas - custo_variavel`

`quorum_minimo = ceil(necessidade_financeira / contribuicao_liquida_membro)`

Entradas previstas:

- custos fixos;
- custos variáveis;
- contingência;
- taxas;
- impostos provisionados;
- créditos válidos;
- receitas garantidas;
- patrocínios confirmados.

A contingência deve ser parametrizável.

O sistema deve recalcular a posição financeira quando fatos relevantes mudarem.

---

# 12. Dinheiro recebido não é automaticamente lucro

O sistema deve separar conceitualmente:

- **Caixa em formação**
- **Receita protegida**
- **Receita operacional**
- **Resultado disponível**

A interface administrativa não pode induzir o usuário a tratar dinheiro comprometido com a realização do evento como saldo livre.

Caixa, receita e lucro não são sinônimos.

---

# 13. Pagamentos

Estados mínimos:

`created`

`pending`

`paid`

`failed`

`expired`

`refunded`

`chargeback`

Regras não negociáveis:

- frontend não confirma pagamento;
- checkout iniciado não gera membro válido;
- pagamento pendente não aumenta quórum;
- confirmação ocorre no backend;
- webhook precisa ser validado;
- processamento precisa ser idempotente;
- eventos financeiros precisam de log;
- reembolso e chargeback precisam repercutir corretamente no capital protegido.

---

# 14. Créditos e ingressos

O crédito representa o compromisso financeiro de um usuário com uma edição.

Ele deve:

- pertencer a um usuário;
- pertencer a uma edição;
- possuir estado próprio;
- depender de pagamento válido;
- ser auditável;
- respeitar a política de reembolso/rollover definida.

Quando aplicável, o crédito convertido gera ingresso.

Estados previstos para ingresso:

`active`

`transferred`

`used`

`cancelled`

`refunded`

`blocked`

Um ingresso válido só pode ser usado uma vez.

Uma transferência nunca pode deixar dois ingressos simultaneamente válidos.

---

# 15. Portaria

QR não deve armazenar dados pessoais legíveis.

A arquitetura deve prever:

- token imprevisível;
- assinatura/validação;
- estado único do ingresso;
- bloqueio após uso;
- log de scan;
- operador/dispositivo quando pertinente.

A portaria deve ter resposta operacional simples:

- verde: válido;
- vermelho: inválido;
- amarelo: requer verificação.

Internet pública não pode ser ponto único de falha.

Antes da primeira edição, deve existir contingência offline/local validada.

---

# 16. Financeiro operacional

O sistema deve substituir controles informais e reconstruções posteriores.

Deve permitir controlar:

- custos;
- fornecedores;
- contratos;
- contas a pagar;
- receitas;
- meios de pagamento;
- recebíveis;
- conciliação;
- adiantamentos;
- conta-corrente de sócios/responsáveis;
- centros financeiros;
- DRE.

Se um sócio pagar uma despesa pessoalmente, o sistema deve registrar a obrigação correspondente da Diretoria.

Exemplo:

`Fotógrafo: R$ 600`

`Pago por Tiago — recurso pessoal`

Resultado:

`Diretoria deve R$ 600 a Tiago`

---

# 17. Bar

O bar será uma unidade financeira própria.

O sistema deve permitir medir:

`receita - CMV - equipe - perdas - taxas = resultado do bar`

Controlar:

- compras;
- consignação;
- estoque inicial;
- reposições;
- vendas;
- cortesias;
- perdas/quebras;
- estoque final.

Cortesias não podem ser invisíveis.

---

# 18. CRM, aquisição e analytics

Funil canônico:

`VISITANTE`

→ `LEAD`

→ `MEMBRO`

→ `MEMBRO CONFIRMADO`

→ `INGRESSO EMITIDO`

→ `PARTICIPANTE`

→ `PARTICIPANTE RECORRENTE`

→ `EMBAIXADOR`

Todo tráfego deve ser identificável por origem/campanha quando tecnicamente possível.

Eventos mínimos de analytics:

- `page_view`
- `lead_created`
- `checkout_started`
- `payment_created`
- `payment_confirmed`
- `member_created`
- `vote_submitted`
- `referral_clicked`
- `referral_converted`
- `ticket_issued`
- `ticket_transferred`
- `ticket_scanned`
- `ticket_used`
- `refund_requested`

---

# 19. Auditoria e permissões

Toda ação crítica deve ser auditável.

Registrar, conforme pertinência:

- usuário;
- ação;
- antes;
- depois;
- data/hora;
- entidade afetada;
- dispositivo/IP quando necessário.

Perfis previstos:

- Super Admin
- Financeiro
- Produção
- Marketing
- Atendimento
- Portaria Supervisor
- Scanner
- Bar

Princípio:

> Cada função acessa apenas o necessário para executar seu trabalho.

---

# 20. Fechamento da edição

A festa não termina quando acaba a música.

Fluxo canônico:

`público saiu`

→ `portaria encerrada`

→ `caixas fechados`

→ `estoque contado`

→ `maquininhas conciliadas`

→ `fornecedores conferidos`

→ `adiantamentos conciliados`

→ `pendências identificadas`

→ `DRE provisória`

→ `recebíveis compensados`

→ `DRE final`

Somente depois disso a edição pode ser tratada como financeiramente encerrada.

Antes de existir saldo distribuível, o sistema deve determinar:

- o que a Diretoria deve a cada pessoa;
- valores a prestar contas;
- fornecedores pendentes;
- recebíveis pendentes;
- caixa efetivamente disponível.

---

# 21. Definição de sucesso da primeira edição

A primeira edição não será considerada sucesso apenas por lotar.

Será considerada sucesso se:

1. quórum for atingido;
2. evento for confirmado sem exposição indevida;
3. sistema suportar vendas;
4. portaria funcionar;
5. finanças puderem ser fechadas;
6. estoque puder ser reconciliado;
7. DRE for confiável;
8. acerto entre sócios puder ser feito rapidamente;
9. público demonstrar satisfação;
10. parte relevante do público iniciar o próximo ciclo.

---

# 22. Escopo obrigatório da V1

Antes da primeira edição real:

1. site;
2. cadastro;
3. autenticação;
4. checkout;
5. pagamento;
6. créditos;
7. quórum;
8. painel administrativo;
9. CRM;
10. notificações;
11. área do membro;
12. lotes;
13. ingresso;
14. QR;
15. transferência;
16. portaria;
17. custos;
18. fornecedores;
19. adiantamentos;
20. conciliação financeira básica;
21. relatório.

---

# 23. Fora da V1

Não é obrigatório inicialmente:

- aplicativo Android/iOS nativo;
- PDV próprio completo;
- marketplace avançado;
- cashless próprio;
- IA autônoma;
- programa sofisticado de pontos;
- plataforma white-label;
- portal completo para patrocinadores.

Não antecipar funcionalidades de escala antes de validar a operação principal.

---

# 24. Gates obrigatórios

## Antes do primeiro anúncio

- marca pronta;
- site de reativação;
- analytics;
- pixels;
- CRM;
- captura de leads;
- consentimentos necessários;
- dashboard básico;
- acervo organizado;
- campanhas prontas;
- monitoramento de erro.

## Antes do primeiro pagamento real

- conta;
- checkout;
- gateway;
- webhook;
- política comercial;
- regras do clube;
- termos;
- política de privacidade;
- motor de créditos;
- regras de reembolso;
- logs;
- backup;
- painel financeiro.

## Antes de confirmar a festa

- motor de quórum validado;
- orçamento;
- fornecedores;
- contratos;
- custos;
- reserva;
- capacidade;
- data;
- local;
- responsabilidade operacional.

## Antes da festa

- ticketing;
- QR;
- transferência;
- scanners;
- contingência offline;
- equipe;
- checklists;
- estoque;
- portaria;
- financeiro;
- testes de carga.

## Antes do encerramento financeiro

- conciliação;
- estoque;
- adiantamentos;
- contas a pagar;
- recebíveis;
- DRE.

---

# 25. Arquitetura e segurança

A stack definitiva ainda será escolhida.

Componentes previstos:

- Frontend Web/PWA
- API/backend
- PostgreSQL
- Storage
- Queue
- Payment Provider
- WhatsApp/e-mail/push
- Analytics
- gateway local para portaria

Ambientes obrigatórios:

- `LOCAL/DEV`
- `HML`
- `PRODUÇÃO`

Regras:

- nunca validar alteração crítica diretamente em produção;
- regras de negócio não podem depender da interface;
- decisões financeiras críticas devem ocorrer no backend;
- segredos nunca entram no código;
- logs não expõem senhas, tokens, credenciais ou dados sensíveis;
- alterações críticas devem possuir backup/snapshot quando pertinente;
- sistema deve possuir logs, erros, uptime e monitoramento de webhooks/pagamentos/notificações.

---

# 26. Regra de priorização

Toda funcionalidade proposta deve responder positivamente a pelo menos uma destas perguntas:

- aumenta aquisição?
- aumenta conversão?
- reduz risco?
- melhora experiência?
- aumenta receita?
- reduz custo?
- melhora controle?
- aumenta retenção?

Se não responder a nenhuma:

> **não é prioridade.**

---

# 27. Ordem canônica de desenvolvimento

1. `goal.md`
2. arquitetura funcional
3. modelo de dados
4. UX Flow
5. backlog V1
6. arquitetura técnica
7. HML
8. testes
9. produção

Fases:

### Fase 0 — Fundação
Blueprint, branding, domínio, arquitetura, banco e infraestrutura.

### Fase 1 — Reativação
Site, acervo, analytics, CRM e lista de espera.

### Fase 2 — Club
Conta, checkout, pagamento, crédito e área do membro.

### Fase 3 — Quórum
Motor financeiro, dashboard, votações e indicações.

### Fase 4 — Confirmação
Ticketing, lotes e transferências.

### Fase 5 — Produção
Fornecedores, contratos, custos, checklists e financeiro.

### Fase 6 — Event Day
Portaria, contingência offline e Diretoria Live.

### Fase 7 — Fechamento
Conciliação, DRE, sócios e relatórios.

### Fase 8 — Escala
Automação, IA, marketplace, PDV e white-label.

---

# 28. Primeiro núcleo técnico a ser validado

O primeiro fluxo de negócio a funcionar em HML deve provar a tese econômica:

1. criar uma edição;
2. cadastrar custos protegidos;
3. cadastrar contingência;
4. cadastrar receitas garantidas;
5. definir contribuição líquida;
6. calcular quórum;
7. registrar pagamentos de teste;
8. gerar créditos válidos;
9. recalcular capital protegido;
10. classificar a edição como não viável ou viável;
11. impedir `CONFIRMADO` quando o GO/NO-GO falhar;
12. manter auditoria das alterações.

Se esse núcleo estiver incorreto, os demais módulos não devem ser considerados confiáveis.

---

# 29. Decisões ainda em aberto

Não inventar estas respostas durante o desenvolvimento:

1. domínio definitivo;
2. ticket fundador;
3. tamanho da primeira festa;
4. cidade/região inicial;
5. possíveis locais;
6. gateway;
7. preço público;
8. benefícios dos membros;
9. regras definitivas de reembolso;
10. limite de transferência;
11. política de meia-entrada e enquadramento jurídico;
12. política de menores;
13. modelo de bar;
14. parceiros;
15. stack definitiva.

Quando uma decisão em aberto bloquear implementação, registrar a dependência em vez de assumir silenciosamente.

---

# 30. Regras para qualquer agente, IA ou desenvolvedor

Antes de alterar o projeto:

1. ler este `goal.md`;
2. verificar compatibilidade com o Blueprint Mestre;
3. não criar regra de negócio por conveniência de UI;
4. não considerar pagamento confirmado pelo navegador;
5. não tratar caixa como lucro;
6. não considerar receita esperada como protegida;
7. não permitir confirmação fora do GO/NO-GO;
8. preservar auditoria financeira e operacional;
9. testar em DEV/HML antes de produção;
10. atualizar documentação quando surgir nova decisão canônica.

Em caso de conflito entre implementação e este arquivo:

> **este `goal.md` prevalece até ser formalmente alterado.**

---

# 31. Critério final do produto

Antes da festa, a plataforma precisa responder de forma confiável:

> **Existe capital protegido suficiente para realizar esta edição dentro da exposição financeira autorizada?**

Depois da festa, precisa responder:

> **De onde veio o dinheiro, para onde ele foi, qual foi o resultado e quanto cada parte tem a receber ou prestar contas?**

Quando essas respostas forem confiáveis e o ciclo puder recomeçar com os dados da edição anterior, o núcleo da Diretoria estará funcionando.

---

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
