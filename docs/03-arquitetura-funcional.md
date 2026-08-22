# ARQUITETURA FUNCIONAL — DIRETORIA

**Projeto:** Diretoria  
**Produto inicial:** Diretoria Club  
**Documento:** Arquitetura Funcional V0.1  
**Data-base:** 21/08/2026  
**Dependências canônicas:** `blue-print-clube-diretoria` + `goal.md`  
**Status:** Base para modelagem de dados, UX Flow e Backlog V1

---

# 1. OBJETIVO DESTE DOCUMENTO

Este documento define **como o produto funciona como sistema**, antes de escolher telas, banco de dados definitivo ou stack técnica.

Ele responde:

- quais são os módulos;
- qual é a responsabilidade de cada módulo;
- quais módulos podem alterar dinheiro;
- quais módulos podem alterar estado de uma edição;
- quais dados entram e saem de cada domínio;
- quais eventos de negócio ligam os módulos;
- quais dependências são obrigatórias;
- quais fluxos formam a primeira versão;
- onde estão os pontos de controle e auditoria.

A regra é:

> **Nenhuma tela deve inventar uma regra de negócio que não exista na arquitetura funcional.**

---

# 2. PRINCÍPIO DE ARQUITETURA

A Diretoria deverá ser organizada em domínios funcionais independentes, mas integrados por eventos e regras canônicas.

O sistema completo pode ser representado como:

`AQUISIÇÃO`

→ `IDENTIDADE`

→ `CLUB`

→ `PAGAMENTO`

→ `CRÉDITO`

→ `QUÓRUM`

→ `CONFIRMAÇÃO`

→ `TICKETING`

→ `PORTARIA`

→ `OPERAÇÃO`

→ `FINANCEIRO`

→ `FECHAMENTO`

→ `RETENÇÃO`

Paralelamente:

`PRODUÇÃO → FORNECEDORES → CONTRATOS → DESPESAS → ADIANTAMENTOS → CONCILIAÇÃO`

E:

`BAR → ESTOQUE → VENDAS → PERDAS/CORTESIAS → CMV → RESULTADO`

Todos convergem para:

`DRE + RELATÓRIO FINAL + PRÓXIMA EDIÇÃO`

---

# 3. DOMÍNIOS FUNCIONAIS

A V1 será organizada nos seguintes domínios:

1. **Identidade e Acesso**
2. **CRM e Aquisição**
3. **Edições**
4. **Diretoria Club**
5. **Pagamentos**
6. **Créditos**
7. **Motor Financeiro e Quórum**
8. **Confirmação e Go/No-Go**
9. **Lotes e Venda Pública**
10. **Ingressos**
11. **Transferências**
12. **Votações**
13. **Indicações e Embaixadores**
14. **Parceiros e Atléticas**
15. **Notificações**
16. **Produção**
17. **Fornecedores**
18. **Contratos e Contas a Pagar**
19. **Adiantamentos e Conta-Corrente**
20. **Receitas e Conciliação**
21. **Bar e Estoque**
22. **Portaria**
23. **Diretoria Live**
24. **Ocorrências**
25. **RBAC e Auditoria**
26. **Analytics**
27. **Relatórios e DRE**
28. **Acervo**
29. **Configurações e Regras**
30. **Observabilidade Operacional**

---

# 4. SUPERFÍCIES DO PRODUTO

O sistema terá quatro grandes superfícies.

## 4.1 Site público

Objetivo:

- reativação;
- lista de espera;
- apresentação do Club;
- quórum;
- venda pública após confirmação;
- login.

Não deve possuir autoridade para confirmar pagamento ou alterar estado financeiro.

---

## 4.2 Área do membro / PWA

Objetivo:

- acompanhar edição;
- carteira;
- créditos;
- ingressos;
- QR;
- votações;
- indicações;
- benefícios;
- histórico;
- perfil;
- notificações.

---

## 4.3 Painel administrativo

Objetivo:

- gestão da edição;
- quórum;
- CRM;
- pagamentos;
- custos;
- fornecedores;
- contratos;
- lotes;
- tickets;
- produção;
- bar;
- conciliação;
- relatórios;
- permissões;
- auditoria.

---

## 4.4 Operação do evento

Subdivide-se em:

### Portaria
Validação e consumo de ingressos.

### Diretoria Live
Visão em tempo real da operação.

### Bar/Estoque
Captura e consolidação operacional quando aplicável.

### Ocorrências
Registro de problemas e ações.

---

# 5. MÓDULO — IDENTIDADE E ACESSO

## Responsabilidade

Garantir que cada pessoa seja reconhecida de forma consistente no sistema.

## Funções

- cadastro;
- login;
- recuperação de acesso;
- perfil;
- consentimentos;
- identificação única;
- consolidação de histórico;
- vínculo de usuário com papéis administrativos.

## Identificador canônico

`customer_id`

## Entradas

- nome;
- telefone;
- e-mail;
- data de nascimento quando pertinente;
- origem;
- consentimentos.

## Saídas

- usuário identificado;
- sessão autenticada;
- customer_id;
- perfil disponível aos demais módulos.

## Dependências

Nenhum pagamento, crédito ou ingresso deverá existir sem referência clara ao titular, salvo casos operacionais formalmente definidos no futuro.

---

# 6. MÓDULO — CRM E AQUISIÇÃO

## Responsabilidade

Controlar o relacionamento desde o primeiro contato até a recorrência.

## Funil

`VISITANTE`

→ `LEAD`

→ `MEMBRO`

→ `MEMBRO_CONFIRMADO`

→ `INGRESSO_EMITIDO`

→ `PARTICIPANTE`

→ `PARTICIPANTE_RECORRENTE`

→ `EMBAIXADOR`

## Funções

- captura de lead;
- origem;
- UTM;
- campanha;
- criativo;
- histórico de interações;
- segmentação;
- filtros;
- status;
- integração com notificações.

## Segmentos previstos

- lead não comprador;
- membro;
- participou da última;
- no-show;
- recorrente;
- embaixador;
- alto valor;
- inativo.

## Regra

CRM não cria status financeiro por conta própria.

Ele reflete eventos confirmados vindos dos módulos de pagamento, crédito, ingresso e presença.

---

# 7. MÓDULO — EDIÇÕES

## Responsabilidade

Ser o objeto central que agrupa todo o ciclo de uma festa.

Cada edição deverá possuir:

- nome;
- código;
- conceito;
- status;
- capacidade;
- datas possíveis;
- data definitiva;
- locais possíveis;
- local definitivo;
- ticket de referência;
- parâmetros financeiros;
- metas;
- período de formação;
- prazo de quórum;
- configurações operacionais.

## Máquina de estados canônica

`PLANEJAMENTO`

→ `REATIVAÇÃO`

→ `LISTA_DE_ESPERA`

→ `FORMAÇÃO`

→ `QUORUM_EM_ANDAMENTO`

→ `VIAVEL`

→ `CONFIRMADO`

→ `VENDA_PUBLICA`

→ `PRE_EVENTO`

→ `AO_VIVO`

→ `FECHAMENTO`

→ `ENCERRADO`

→ `RETENCAO`

## Regra

Toda transição crítica deverá:

- validar pré-condições;
- registrar usuário/processo responsável;
- registrar data/hora;
- gerar auditoria;
- disparar eventos para os módulos interessados.

---

# 8. MÓDULO — DIRETORIA CLUB

## Responsabilidade

Controlar o relacionamento do membro durante a formação de uma edição.

## Funções

- oferta de crédito fundador;
- benefícios;
- status do membro;
- carteira;
- acesso antecipado;
- regras de prioridade;
- participação em votação;
- indicação;
- histórico.

## Regra central

Membro de formação não é igual a comprador público.

O sistema deverá permitir identificar:

- membro que ajudou a formar a edição;
- comprador de ingresso pós-confirmação.

---

# 9. MÓDULO — PAGAMENTOS

## Responsabilidade

Registrar tentativas de pagamento e seu estado real.

## Estados

`created`

`pending`

`paid`

`failed`

`expired`

`refunded`

`chargeback`

## Funções

- criação de cobrança;
- Pix;
- cartão;
- retorno do gateway;
- webhook;
- idempotência;
- reembolso;
- chargeback;
- consulta de status;
- logs.

## Regra de autoridade

Somente backend/webhook validado poderá converter uma tentativa em pagamento confirmado.

## Evento principal

`PAYMENT_CONFIRMED`

Esse evento poderá:

- gerar/validar crédito;
- atualizar CRM;
- atualizar quórum;
- gerar notificação;
- registrar analytics.

---

# 10. MÓDULO — CRÉDITOS

## Responsabilidade

Representar o compromisso financeiro válido de um membro com uma edição.

## Relações

Um usuário pode possuir vários créditos.

Um crédito pertence a:

- um usuário;
- uma edição;
- um pagamento ou origem financeira válida.

## Estados funcionais sugeridos

`pending`

`valid`

`converted`

`rolled_over`

`refund_requested`

`refunded`

`cancelled`

## Funções

- emissão;
- validação;
- conversão;
- rollover;
- cancelamento;
- reembolso;
- histórico.

## Regra

Somente créditos considerados válidos pelo domínio financeiro podem compor o capital protegido.

---

# 11. MÓDULO — MOTOR FINANCEIRO E QUÓRUM

## Responsabilidade

Determinar continuamente a proteção econômica da edição.

É o principal motor de decisão do produto.

## Entradas

- custos protegidos;
- custos variáveis;
- contingência;
- impostos provisionados;
- taxas;
- créditos válidos;
- receitas garantidas;
- patrocínios válidos;
- reembolsos;
- chargebacks;
- outros ajustes autorizados.

## Cálculo conceitual

`necessidade_financeira = custos_protegidos + contingencia - receitas_garantidas`

`contribuicao_liquida = ticket - taxas - custo_variavel`

`quorum_minimo = ceil(necessidade_financeira / contribuicao_liquida)`

## Saídas

- necessidade financeira;
- capital protegido;
- percentual protegido;
- quantidade de membros válidos;
- quórum mínimo;
- déficit;
- excedente;
- status financeiro;
- projeção.

## Status previstos

`NAO_VIAVEL`

`PROXIMO_DO_QUORUM`

`VIAVEL`

`PROTEGIDO`

`SUPERAVIT`

## Regra

O motor deve ser recalculado por eventos relevantes, e não depender de atualização manual da tela.

---

# 12. MÓDULO — CONFIRMAÇÃO E GO/NO-GO

## Responsabilidade

Separar matematicamente `VIÁVEL` de administrativamente `CONFIRMADO`.

## Pré-condições financeiras

- quórum atingido;
- capital protegido suficiente;
- contingência válida;
- custos atualizados.

## Pré-condições administrativas

- data definida;
- local definido;
- capacidade validada;
- responsáveis definidos;
- principais fornecedores verificados;
- contratos/requisitos mínimos conforme política operacional.

## Pergunta canônica

> Se não vendermos mais nenhum ingresso e o bar tiver resultado zero, conseguimos realizar este evento sem ultrapassar a exposição financeira aprovada?

## Resultado

Se não:

`CONFIRMAÇÃO BLOQUEADA`

Se sim e pré-condições administrativas forem atendidas:

`CONFIRMADO`

## Evento

`EVENT_CONFIRMED`

Esse evento deverá disparar:

- conversão/emissão prevista de ingressos dos membros;
- mudança de comunicação;
- abertura futura de lotes;
- notificações;
- liberação de produção definitiva;
- analytics.

---

# 13. MÓDULO — LOTES E VENDA PÚBLICA

## Responsabilidade

Controlar venda após confirmação.

## Funções

- criar lotes;
- preço;
- quantidade;
- vigência;
- limite;
- virada automática;
- lote esgotado;
- venda de portaria quando autorizada.

## Gatilhos de virada

- quantidade;
- data/hora;
- híbrido.

## Regra

Venda pública não deve interferir retroativamente na definição de viabilidade que permitiu a confirmação.

Ela passa a otimizar resultado e ocupação.

---

# 14. MÓDULO — INGRESSOS

## Responsabilidade

Representar o direito de acesso à edição confirmada.

## Campos funcionais

- ticket_id;
- edição;
- titular;
- categoria;
- origem;
- lote;
- status;
- token/QR;
- histórico.

## Estados

`active`

`transferred`

`used`

`cancelled`

`refunded`

`blocked`

## Regra

Um ingresso ativo só pode ser consumido uma vez.

---

# 15. MÓDULO — TRANSFERÊNCIAS

## Responsabilidade

Permitir troca de titular sem duplicação de acesso.

## Fluxo

1. titular solicita;
2. novo titular é informado;
3. regras são validadas;
4. estado anterior é invalidado/transferido;
5. novo titular recebe o direito;
6. nova credencial de acesso é disponibilizada;
7. auditoria registra a operação.

## Regra

Nunca existirão dois direitos de acesso ativos originados da mesma transferência.

---

# 16. MÓDULO — VOTAÇÕES

## Responsabilidade

Permitir participação dos membros em decisões selecionadas.

## Tipos

`consultiva`

`vinculante`

## Exemplos

- datas;
- estilos;
- atrações;
- experiências.

## Regra

Votação não altera produção automaticamente, a menos que tenha sido explicitamente configurada como vinculante dentro de uma regra autorizada.

---

# 17. MÓDULO — INDICAÇÕES E EMBAIXADORES

## Responsabilidade

Atribuir crescimento e recompensas.

## Identificador

`referral_code`

## Rastrear

- clique;
- cadastro;
- compra;
- receita;
- conversão;
- recompensa.

## Regra

Nenhuma recompensa deve existir sem:

- origem;
- condição;
- custo;
- beneficiário;
- registro.

---

# 18. MÓDULO — PARCEIROS E ATLÉTICAS

## Responsabilidade

Medir objetivamente contribuição comercial de parceiros.

## Dados

- parceiro;
- responsável;
- link;
- cupom;
- meta;
- vendas;
- receita;
- comissão;
- valor pago;
- saldo.

## Saída

Responder:

> Quem realmente gera receita e qual o custo dessa aquisição?

---

# 19. MÓDULO — NOTIFICAÇÕES

## Responsabilidade

Gerenciar comunicações transacionais e de relacionamento.

## Prioridade inicial

1. WhatsApp
2. e-mail
3. push PWA

## Eventos possíveis

- cadastro;
- pagamento confirmado;
- quórum;
- evento viável;
- confirmação;
- votação;
- ingresso emitido;
- transferência;
- lembrete;
- pós-evento;
- próxima edição.

## Regras

- templates;
- histórico;
- status de envio;
- retries;
- frequency cap;
- separação entre marketing e transacional.

---

# 20. MÓDULO — PRODUÇÃO

## Responsabilidade

Organizar a execução física da edição.

## Categorias previstas

- local;
- som;
- iluminação;
- segurança;
- gerador;
- estrutura;
- atrações;
- brigadistas;
- bombeiros;
- alvará;
- ART;
- ECAD;
- gelo;
- bebidas;
- fotógrafos;
- freezers;
- hotel;
- equipe;
- publicidade.

## Funções

- tarefas;
- responsáveis;
- prazo;
- status;
- dependências;
- checklist;
- evidências/anexos.

---

# 21. MÓDULO — FORNECEDORES

## Responsabilidade

Criar histórico estruturado de fornecedores.

## Dados

- nome;
- categoria;
- contato;
- documento;
- dados financeiros;
- eventos atendidos;
- avaliação;
- observações;
- arquivos.

## Relações

Fornecedor poderá possuir:

- propostas;
- contratos;
- despesas;
- pagamentos;
- avaliações.

---

# 22. MÓDULO — CONTRATOS E CONTAS A PAGAR

## Responsabilidade

Controlar obrigações financeiras assumidas pela produção.

## Contrato

- fornecedor;
- edição;
- valor;
- sinal;
- saldo;
- vencimentos;
- arquivo;
- responsável;
- observações.

## Estados de contas a pagar

`planned`

`approved`

`partial`

`paid`

`cancelled`

`overdue`

## Regra

Uma despesa planejada deve ser distinguida de obrigação aprovada e de pagamento realizado.

---

# 23. MÓDULO — ADIANTAMENTOS E CONTA-CORRENTE

## Responsabilidade

Eliminar controles informais como “Tiago pagou” ou “Adson recebeu”.

## Quando alguém paga por conta própria

O sistema registra:

- despesa;
- pagador;
- origem do recurso;
- valor;
- edição;
- centro financeiro.

E gera posição de conta-corrente.

## Conta-corrente por pessoa

- adiantamentos;
- reembolsos;
- valores recebidos;
- prestações de conta;
- ajustes;
- saldo.

## Regra

Saldo distribuível só existe depois de considerar essas posições.

---

# 24. MÓDULO — RECEITAS E CONCILIAÇÃO

## Responsabilidade

Distinguir venda registrada de dinheiro efetivamente recebido.

## Meios

- gateway online;
- Pix;
- maquininha A;
- maquininha B;
- dinheiro;
- transferência;
- outros.

## Por canal

- bruto;
- taxa;
- cancelamentos;
- líquido esperado;
- líquido recebido;
- diferença.

## Regra

Diferença precisa ser visível e investigável.

---

# 25. MÓDULO — BAR E ESTOQUE

## Responsabilidade

Tratar o bar como unidade econômica própria.

## Produto

Registrar:

- quantidade comprada;
- custo;
- fornecedor;
- comprado/consignado;
- estoque inicial;
- reposição;
- venda;
- cortesia;
- quebra/perda;
- estoque final.

## Resultado

`receita - CMV - equipe - perdas - taxas = resultado_bar`

## Regra

Resultado do bar não entra como condição necessária para confirmar a festa.

---

# 26. MÓDULO — PORTARIA

## Responsabilidade

Validar direito de acesso e registrar presença.

## Respostas operacionais

`VALIDO`

`INVALIDO`

`VERIFICACAO`

## Ações

- escanear;
- consultar ticket;
- validar assinatura/token;
- bloquear reutilização;
- registrar check-in;
- registrar operador;
- registrar dispositivo;
- registrar horário.

## Regra crítica

Internet pública não pode ser ponto único de falha.

---

# 27. MÓDULO — CONTINGÊNCIA OFFLINE DA PORTARIA

## Responsabilidade

Manter check-in mesmo sem conexão externa.

## Arquitetura funcional desejada

`Nuvem`

↕

`Gateway/Servidor local`

↕

`Rede interna`

↕

`Scanners`

## Comportamento

Sem internet externa:

- scanners continuam validando contra base local autorizada;
- check-ins são sincronizados entre dispositivos;
- duplicidade continua bloqueada dentro da rede local;
- eventos ficam pendentes para sincronização com a nuvem.

Quando conexão retorna:

- sincronizar;
- resolver conflitos segundo regra definida;
- registrar auditoria.

---

# 28. MÓDULO — DIRETORIA LIVE

## Responsabilidade

Oferecer visão operacional durante o evento.

## Indicadores possíveis

- ingressos emitidos;
- entradas;
- entradas por período;
- capacidade;
- scanners online;
- bar bruto;
- ticket médio;
- estoque crítico;
- ocorrências abertas.

## Regra

O Live é painel de observação e operação.

Não deve permitir alterações financeiras críticas sem permissões e auditoria.

---

# 29. MÓDULO — OCORRÊNCIAS

## Responsabilidade

Registrar problemas da operação.

## Tipos

- segurança;
- saúde;
- estrutura;
- bar;
- portaria;
- sistema;
- fornecedor.

## Dados

- edição;
- horário;
- tipo;
- descrição;
- responsável;
- ação tomada;
- status;
- evidências.

---

# 30. MÓDULO — RBAC E AUDITORIA

## Responsabilidade

Controlar quem pode fazer o quê e manter rastreabilidade.

## Perfis iniciais

### Super Admin
Acesso integral.

### Financeiro
Finanças, pagamentos, conciliação, DRE.

### Produção
Fornecedores, contratos, checklists.

### Marketing
CRM, campanhas e analytics permitidos.

### Atendimento
Clientes e operações permitidas.

### Portaria Supervisor
Gestão da portaria.

### Scanner
Somente validação necessária.

### Bar
Dados operacionais autorizados.

## Auditoria crítica

Registrar:

- ator;
- ação;
- entidade;
- antes;
- depois;
- data/hora;
- contexto;
- IP/dispositivo quando pertinente.

---

# 31. MÓDULO — ANALYTICS

## Responsabilidade

Registrar comportamento e conversão sem substituir os registros transacionais.

## Eventos mínimos

`page_view`

`lead_created`

`checkout_started`

`payment_created`

`payment_confirmed`

`member_created`

`vote_submitted`

`referral_clicked`

`referral_converted`

`ticket_issued`

`ticket_transferred`

`ticket_scanned`

`ticket_used`

`refund_requested`

## Regra

Analytics pode perder um evento sem comprometer o financeiro.

Financeiro não pode depender de analytics para determinar a verdade transacional.

---

# 32. MÓDULO — RELATÓRIOS E DRE

## Responsabilidade

Consolidar a edição após reconciliação.

## Receita

- membros;
- ingressos;
- bar;
- estacionamento;
- patrocínio;
- camarote;
- outros.

## Custos

- diretos;
- produção;
- marketing;
- taxas;
- equipe;
- impostos provisionados;
- perdas;
- outros.

## Resultado

`RESULTADO_OPERACIONAL`

## Relatório final

- público;
- receitas;
- custos;
- lucro/prejuízo;
- bar;
- marketing;
- CAC;
- ROAS;
- quórum;
- presença;
- indicação;
- aprendizados.

---

# 33. MÓDULO — ACERVO

## Responsabilidade

Centralizar ativos históricos e de comunicação.

## Categorias

- logos;
- flyers;
- fotos;
- vídeos;
- aftermovies;
- stories;
- reels;
- banners;
- line-ups;
- imprensa;
- depoimentos;
- artistas;
- público;
- bar;
- bastidores.

## Metadados

- evento;
- tipo;
- conteúdo;
- qualidade;
- formato;
- uso permitido;
- direitos;
- tags.

---

# 34. MÓDULO — CONFIGURAÇÕES E REGRAS

## Responsabilidade

Evitar valores críticos fixos no código.

## Parâmetros possíveis

- contingência;
- prazo do quórum;
- limites de transferência;
- regras de rollover;
- critérios de status financeiro;
- políticas de parceiros;
- parâmetros de notificações;
- capacidades;
- permissões;
- taxas de referência.

## Regra

Alterações de parâmetros financeiros relevantes devem ser auditadas.

---

# 35. MÓDULO — OBSERVABILIDADE OPERACIONAL

## Responsabilidade

Permitir saber se o sistema está funcionando.

## Monitorar

- erros;
- webhooks;
- pagamentos;
- jobs;
- notificações;
- scanners;
- gateway local;
- sincronizações;
- uptime;
- filas pendentes.

## Regra

Falhas críticas devem ser visíveis antes de se transformarem em problema operacional.

---

# 36. EVENTOS DE NEGÓCIO PRINCIPAIS

A comunicação entre módulos deverá ser organizada em torno de fatos do domínio.

Eventos principais:

`LEAD_CREATED`

`USER_REGISTERED`

`CHECKOUT_STARTED`

`PAYMENT_CREATED`

`PAYMENT_CONFIRMED`

`PAYMENT_REFUNDED`

`PAYMENT_CHARGEBACK`

`CREDIT_VALIDATED`

`CREDIT_CANCELLED`

`QUORUM_RECALCULATED`

`QUORUM_REACHED`

`EVENT_BECAME_VIABLE`

`EVENT_CONFIRMED`

`PUBLIC_SALES_OPENED`

`TICKET_ISSUED`

`TICKET_TRANSFERRED`

`TICKET_USED`

`CHECKIN_REGISTERED`

`EXPENSE_APPROVED`

`EXPENSE_PAID`

`ADVANCE_REGISTERED`

`REVENUE_RECONCILED`

`INVENTORY_ADJUSTED`

`INCIDENT_CREATED`

`EVENT_CLOSED`

`DRE_FINALIZED`

`NEXT_CYCLE_STARTED`

---

# 37. FLUXO 01 — REATIVAÇÃO ATÉ LEAD

1. visitante chega ao site;
2. origem/UTM é capturada;
3. visitante consome conteúdo;
4. envia cadastro;
5. identidade é criada ou consolidada;
6. CRM recebe lead;
7. consentimentos são registrados;
8. analytics registra conversão;
9. comunicação de relacionamento pode ser iniciada.

Saída:

`LEAD`

---

# 38. FLUXO 02 — LEAD ATÉ MEMBRO VÁLIDO

1. lead acessa oferta do Club;
2. autentica ou cria conta;
3. inicia checkout;
4. pagamento é criado;
5. gateway processa;
6. backend recebe confirmação válida;
7. pagamento muda para `paid`;
8. crédito é validado;
9. CRM muda estado;
10. motor de quórum recalcula;
11. usuário recebe confirmação.

Saída:

`MEMBRO + CRÉDITO VÁLIDO`

---

# 39. FLUXO 03 — RECÁLCULO DE QUÓRUM

Qualquer mudança relevante dispara recálculo.

Exemplos:

- novo pagamento válido;
- reembolso;
- chargeback;
- alteração aprovada de custo;
- alteração de contingência;
- nova receita garantida;
- cancelamento de receita.

Motor calcula:

- necessidade;
- capital protegido;
- déficit;
- percentual;
- quórum;
- status.

Se cruzar limite:

`EVENT_BECAME_VIABLE`

---

# 40. FLUXO 04 — VIÁVEL ATÉ CONFIRMADO

1. motor marca edição como `VIAVEL`;
2. painel informa quórum financeiro atingido;
3. administrador revisa checklist de confirmação;
4. data é validada;
5. local é validado;
6. capacidade é validada;
7. orçamento é atualizado;
8. fornecedores/obrigações mínimas são verificados;
9. regra GO/NO-GO é executada;
10. administrador autorizado confirma;
11. auditoria registra;
12. evento passa para `CONFIRMADO`;
13. ingressos dos membros são preparados/emitidos conforme regra;
14. comunicação muda;
15. venda pública pode ser programada.

---

# 41. FLUXO 05 — VENDA PÚBLICA

1. edição está confirmada;
2. lotes são configurados;
3. lote ativo é publicado;
4. comprador inicia checkout;
5. pagamento confirmado;
6. ingresso é emitido;
7. CRM é atualizado;
8. lote reduz disponibilidade;
9. se atingir gatilho, próximo lote entra;
10. analytics registra venda.

---

# 42. FLUXO 06 — TRANSFERÊNCIA

1. titular solicita;
2. sistema verifica status;
3. verifica política da edição;
4. identifica novo titular;
5. invalida vínculo anterior conforme regra;
6. cria novo vínculo válido;
7. atualiza credencial/QR;
8. notifica envolvidos;
9. auditoria registra.

---

# 43. FLUXO 07 — PRODUÇÃO E DESPESA

1. necessidade é criada;
2. fornecedor é associado;
3. proposta/contrato é registrado;
4. despesa passa de planejada para aprovada;
5. pagamento é realizado;
6. meio e pagador são registrados;
7. se recurso pessoal, gera adiantamento;
8. financeiro atualiza posição;
9. auditoria registra alterações.

---

# 44. FLUXO 08 — EVENT DAY / CHECK-IN

1. ingresso chega ao scanner;
2. token é lido;
3. status é consultado localmente/nuvem conforme condição;
4. regras antifraude são verificadas;
5. resposta operacional é exibida;
6. se válido, ticket passa a `used`;
7. check-in é registrado;
8. Diretoria Live atualiza;
9. analytics operacional recebe evento;
10. sincronização ocorre quando necessário.

---

# 45. FLUXO 09 — BAR

1. estoque inicial é confirmado;
2. compras e consignações são registradas;
3. reposições são registradas;
4. vendas/importações de PDV alimentam receita;
5. cortesias são registradas;
6. perdas são registradas;
7. estoque final é contado;
8. CMV é calculado;
9. resultado do bar é consolidado;
10. conciliação financeira compara vendas e recebimentos.

---

# 46. FLUXO 10 — FECHAMENTO

1. portaria é encerrada;
2. caixas são fechados;
3. estoque é contado;
4. meios de pagamento são conciliados;
5. fornecedores são conferidos;
6. adiantamentos são conciliados;
7. recebíveis pendentes são identificados;
8. DRE provisória é produzida;
9. diferenças são tratadas;
10. recebíveis finais são compensados;
11. DRE final é consolidada;
12. conta-corrente dos sócios é fechada;
13. saldo distribuível é calculado;
14. relatório final é emitido;
15. edição passa para `ENCERRADO`.

---

# 47. FLUXO 11 — RETENÇÃO

1. participantes são segmentados;
2. presença/no-show é registrada;
3. histórico da edição alimenta CRM;
4. público recebe comunicação pós-evento;
5. próxima edição/lista pode ser aberta;
6. recorrentes são identificados;
7. crédito da próxima edição pode ser ofertado;
8. ciclo reinicia.

---

# 48. DEPENDÊNCIAS ENTRE MÓDULOS

## Dependências rígidas

### Crédito depende de:
- identidade;
- edição;
- pagamento válido.

### Quórum depende de:
- edição;
- créditos;
- custos;
- receitas garantidas;
- parâmetros financeiros.

### Confirmação depende de:
- quórum;
- produção mínima;
- regras administrativas.

### Ingresso depende de:
- edição confirmada;
- identidade;
- origem comercial válida.

### Portaria depende de:
- ingresso;
- token/QR;
- estado de uso.

### DRE depende de:
- receitas;
- despesas;
- conciliação;
- bar;
- adiantamentos.

---

# 49. MATRIZ DE AUTORIDADE FUNCIONAL

## Pode alterar verdade financeira

- Pagamentos
- Créditos
- Motor Financeiro
- Financeiro/Conciliação
- Adiantamentos
- Bar/Estoque quando consolidado
- DRE

## Pode alterar estado da edição

- Motor Financeiro: até `VIAVEL`
- Administração autorizada: `CONFIRMADO`
- Operação autorizada: transições posteriores conforme regras

## Não pode alterar verdade financeira

- Site público
- Analytics
- CRM isoladamente
- Interface do scanner
- Conteúdo/Acervo

---

# 50. INVARIANTES DO SISTEMA

As seguintes regras deverão permanecer verdadeiras em qualquer implementação.

1. Pagamento pendente não aumenta quórum.
2. Checkout iniciado não cria membro válido.
3. Reembolso/chargeback reduz a posição financeira conforme regra.
4. Bar esperado não torna evento viável.
5. `VIAVEL` não significa `CONFIRMADO`.
6. Evento não é confirmado se GO/NO-GO falhar.
7. Crédito pertence a uma edição.
8. Ingresso válido só pode ser usado uma vez.
9. Transferência não duplica acesso.
10. Dinheiro protegido não é apresentado como lucro livre.
11. Despesa paga por pessoa gera posição na conta-corrente.
12. Cortesia e perda de estoque não podem ser invisíveis.
13. Alterações críticas geram auditoria.
14. Scanner não precisa conhecer dados financeiros.
15. Analytics não é fonte de verdade transacional.
16. Internet externa não pode ser ponto único de falha da portaria.
17. Edição não é financeiramente encerrada antes de conciliação e DRE.
18. Novas funções não podem quebrar regras canônicas para simplificar UI.

---

# 51. PRIORIZAÇÃO DA V1 POR CAMADAS

## Camada A — Fundação do domínio

- identidade;
- edição;
- estados;
- RBAC;
- auditoria;
- parâmetros.

## Camada B — Formação de demanda

- site;
- CRM;
- lista de espera;
- analytics;
- notificações básicas.

## Camada C — Núcleo econômico

- checkout;
- pagamentos;
- créditos;
- custos;
- receitas garantidas;
- motor de quórum;
- GO/NO-GO.

## Camada D — Confirmação e venda

- confirmação;
- lotes;
- ingressos;
- transferência.

## Camada E — Produção

- fornecedores;
- contratos;
- despesas;
- adiantamentos;
- checklists.

## Camada F — Evento

- QR;
- scanner;
- portaria;
- contingência offline;
- Live;
- ocorrências.

## Camada G — Fechamento

- conciliação;
- estoque/bar;
- DRE;
- conta-corrente;
- relatório.

## Camada H — Retenção

- segmentos;
- próxima edição;
- recorrência;
- indicação.

---

# 52. PRIMEIRO VERTICAL SLICE DE HML

A primeira entrega funcional de HML não deverá tentar representar todo o produto.

Ela deverá provar o núcleo econômico.

## Escopo

### Administração
- login administrativo;
- criar edição;
- definir status inicial;
- cadastrar custos protegidos;
- cadastrar contingência;
- cadastrar receitas garantidas;
- definir ticket/contribuição;
- visualizar quórum calculado.

### Simulação financeira
- criar usuário de teste;
- registrar pagamento de teste;
- confirmar pagamento pelo fluxo de backend de HML;
- gerar crédito;
- recalcular quórum;
- simular reembolso;
- recalcular novamente.

### Gate
- tentar confirmar edição abaixo do limite;
- sistema deve bloquear;
- atingir viabilidade;
- sistema deve marcar `VIAVEL`;
- confirmação administrativa deve exigir pré-condições;
- mudança deve ser auditada.

## Resultado esperado

Ao final desse slice, o sistema deverá provar:

> **o status econômico da edição é consequência dos fatos financeiros registrados, e não de uma edição manual da interface.**

---

# 53. CRITÉRIOS DE ACEITE DA ARQUITETURA FUNCIONAL

Este documento estará validado quando for possível responder sem ambiguidade:

1. onde nasce um lead;
2. onde nasce um pagamento;
3. quem confirma pagamento;
4. quando nasce um crédito;
5. o que entra no quórum;
6. o que não entra no quórum;
7. quem determina `VIAVEL`;
8. quem pode determinar `CONFIRMADO`;
9. quando nasce um ingresso;
10. como transferência mantém unicidade;
11. como a portaria consome ingresso;
12. como despesa pessoal vira dívida da Diretoria;
13. como bar é separado da viabilidade;
14. como receitas são conciliadas;
15. quando a edição pode ser encerrada;
16. como a próxima edição reutiliza os dados anteriores.

---

# 54. PRÓXIMO DOCUMENTO

Depois da aprovação desta arquitetura funcional, o próximo passo canônico é:

# MODELO DE DADOS

O modelo de dados deverá transformar cada domínio deste documento em:

- entidades;
- atributos;
- chaves;
- relacionamentos;
- estados;
- constraints;
- índices;
- histórico/auditoria;
- regras de integridade.

A modelagem não deverá começar pelas telas.

Deverá começar pelos fatos de negócio definidos aqui.

---

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
