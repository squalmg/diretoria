# UX FLOW — DIRETORIA

**Projeto:** Diretoria  
**Produto inicial:** Diretoria Club  
**Documento:** UX Flow V0.1  
**Data-base:** 21/08/2026  
**Base canônica:** Blueprint Mestre + `goal.md` + Arquitetura Funcional V0.1 + Modelo de Dados V0.1  
**Status:** Base para Backlog V1, wireframes e implementação

---

# 1. OBJETIVO

Traduzir as regras de negócio da Diretoria em **jornadas, telas, estados, ações e bloqueios de interface**.

Este documento define:

- quem usa cada superfície;
- por onde entra;
- o que vê;
- o que pode fazer;
- o que não pode fazer;
- quais informações são prioritárias;
- quais estados devem ser comunicados;
- quais ações exigem confirmação;
- quais ações dependem de backend;
- quais mudanças geram auditoria;
- como a UX muda conforme a edição avança.

A regra principal é:

> **A interface apresenta e opera a verdade do domínio; ela não cria uma verdade paralela.**

---

# 2. SUPERFÍCIES

A V1 possui quatro superfícies principais.

## A. Site público

Usado por:

- visitante;
- lead;
- potencial membro;
- comprador público.

Objetivos:

- reativar marca;
- captar lead;
- explicar Diretoria Club;
- mostrar quórum;
- converter membro;
- vender ingresso após confirmação;
- encaminhar para login.

---

## B. Área do membro / PWA

Usada por:

- membro;
- comprador público;
- participante recorrente.

Objetivos:

- acompanhar edição;
- ver crédito;
- ver ingresso;
- acessar QR;
- votar;
- indicar;
- transferir;
- acompanhar benefícios;
- acessar histórico;
- receber notificações.

---

## C. Painel administrativo

Usado por:

- Super Admin;
- Financeiro;
- Produção;
- Marketing;
- Atendimento;
- Portaria Supervisor;
- Bar.

Objetivos:

- criar edição;
- configurar economia;
- acompanhar quórum;
- gerir CRM;
- confirmar evento;
- organizar produção;
- controlar financeiro;
- operar ticketing;
- fechar DRE.

---

## D. Operação do evento

Usada por:

- Scanner;
- Portaria Supervisor;
- Produção;
- Bar;
- Super Admin.

Objetivos:

- validar ingresso;
- registrar entrada;
- operar offline;
- acompanhar Diretoria Live;
- registrar ocorrências;
- controlar bar e estoque.

---

# 3. PERSONAS OPERACIONAIS

## P1 — Visitante

Ainda não forneceu dados.

Precisa entender rapidamente:

- o que é a Diretoria;
- em que estado está a próxima edição;
- o que pode fazer agora.

---

## P2 — Lead

Já forneceu contato.

Precisa:

- acompanhar evolução;
- entender o Club;
- converter quando abertura financeira ocorrer.

---

## P3 — Membro

Possui crédito válido para a edição.

Precisa:

- saber que seu dinheiro foi reconhecido;
- acompanhar quórum;
- entender o que acontece se a festa não for confirmada;
- votar quando permitido;
- receber ingresso após confirmação.

---

## P4 — Comprador público

Compra ingresso depois da confirmação.

Não deve ser confundido com membro fundador.

---

## P5 — Administrador

Precisa enxergar:

- risco;
- capital protegido;
- custos;
- receitas garantidas;
- pendências;
- estado da edição;
- decisões permitidas.

---

## P6 — Financeiro

Precisa operar fatos financeiros sem depender de planilhas paralelas.

---

## P7 — Produção

Precisa executar tarefas e fornecedores sem acesso desnecessário a dados financeiros sensíveis.

---

## P8 — Scanner

Precisa apenas de:

- câmera;
- resposta;
- próximo scan.

Nada além disso deve competir com a operação.

---

# 4. PRINCÍPIOS DE UX

## 4.1 Estado sempre explícito

Toda edição deverá mostrar seu estado atual.

Exemplo:

`QUÓRUM EM ANDAMENTO`

Nunca depender apenas de cor.

---

## 4.2 Próxima ação evidente

Cada tela deve responder:

> **O que o usuário deve fazer agora?**

---

## 4.3 Dinheiro protegido não parecer saldo livre

Nunca exibir apenas:

`Saldo: R$ 72.000`

Preferir:

- Caixa em formação;
- Capital protegido;
- Necessidade;
- Déficit/excedente;
- Resultado disponível.

---

## 4.4 Estados financeiros usam texto + número

Exemplo:

**AINDA NÃO VIÁVEL**

`R$ 44.000 / R$ 70.500 protegidos`

---

## 4.5 Bloqueio deve explicar motivo

Não basta desabilitar botão.

Exemplo:

`Confirmar edição`

Bloqueado porque:

- local não definido;
- capital protegido insuficiente;
- GO/NO-GO = NO_GO.

---

## 4.6 Ação destrutiva exige contexto

Reembolso, cancelamento, bloqueio de ticket, alteração de custo crítico e encerramento exigem:

- confirmação;
- motivo;
- impacto;
- auditoria.

---

## 4.7 Não usar interface para “forçar” estado

Não haverá campo livre:

`Status da edição: [dropdown]`

Transições importantes acontecem através de fluxos validados.

---

# 5. ARQUITETURA DE NAVEGAÇÃO — SITE PÚBLICO

Navegação principal:

- Início
- Como funciona
- Próxima Diretoria
- História
- FAQ
- Entrar

CTA principal muda conforme estado da edição.

### REATIVAÇÃO

`Quero saber quando voltar`

### LISTA DE ESPERA

`Entrar na lista`

### FORMAÇÃO

`Fazer parte`

### VIÁVEL

`Quero participar`

### CONFIRMADO / VENDA PÚBLICA

`Comprar ingresso`

### EVENTO ESGOTADO

`Entrar na próxima lista`

---

# 6. ARQUITETURA DE NAVEGAÇÃO — ÁREA DO MEMBRO

Menu principal:

- Início
- Carteira
- Votações
- Indicações
- Benefícios
- Histórico
- Notificações
- Perfil

Quando existir ingresso ativo:

`Meu ingresso`

ganha destaque.

No dia do evento:

`QR de entrada`

torna-se a ação principal.

---

# 7. ARQUITETURA DE NAVEGAÇÃO — ADMIN

Menu principal:

- Visão Geral
- Edições
- CRM
- Financeiro
- Pagamentos
- Produção
- Fornecedores
- Ingressos
- Parceiros
- Bar
- Relatórios
- Acervo
- Auditoria
- Configurações

Dentro de uma edição:

- Resumo
- Quórum
- Membros
- Custos
- Receitas
- Confirmação
- Lotes
- Ingressos
- Produção
- Financeiro
- Bar
- Portaria
- Live
- Relatório

---

# 8. SITE PÚBLICO — COMPORTAMENTO POR ESTADO

A Home não será estática.

O bloco principal deverá refletir a edição ativa.

## PLANEJAMENTO

Não expor edição ainda.

Home institucional.

---

## REATIVAÇÃO

Hero:

# A DIRETORIA ESTÁ VOLTANDO

CTA:

`Quero receber novidades`

---

## LISTA DE ESPERA

Hero:

# A PRÓXIMA DIRETORIA ESTÁ SENDO FORMADA

CTA:

`Entrar na lista`

---

## FORMAÇÃO / QUÓRUM

Hero:

# FAÇA PARTE DA PRÓXIMA DIRETORIA

Mostrar:

`317 / 641 membros`

ou preferencialmente também:

`49,5% do capital necessário protegido`

CTA:

`Entrar para o Diretoria Club`

---

## VIÁVEL

Hero:

# O QUÓRUM FOI ATINGIDO

Complemento:

`Estamos concluindo as validações para confirmação.`

Não comunicar ainda como festa confirmada.

---

## CONFIRMADO

Hero:

# ESTÁ CONFIRMADO

Data, local, CTA de ingresso.

---

## VENDA PÚBLICA

Hero comercial.

Mostrar lote atual.

---

## PRÉ-EVENTO

Informação operacional:

- data;
- horário;
- local;
- ingresso;
- FAQ.

---

## AO VIVO

Site pode apresentar:

`A Diretoria está acontecendo agora`

Sem expor dados internos.

---

## ENCERRADO / RETENÇÃO

Hero:

`Você esteve lá?`

CTA:

`Garantir prioridade na próxima`

---

# 9. PUB-01 — HOME / REATIVAÇÃO

## Objetivo

Reativar memória e captar interesse.

## Componentes

- hero;
- vídeo/foto histórica;
- manifesto curto;
- linha histórica;
- CTA;
- acervo;
- FAQ;
- redes.

## CTA

`Quero saber da volta`

## Resultado

Abre captura rápida.

---

# 10. PUB-02 — CAPTURA DE LEAD

## Campos mínimos

- nome;
- telefone;
- e-mail.

Opcional conforme estratégia:

- data de nascimento;
- preferências.

## Campos invisíveis

- source;
- medium;
- campaign;
- content;
- referral;
- landing page.

## Ação

`Entrar na lista`

## Após envio

Tela de sucesso:

`Você está na lista.`

Mostrar próximo passo real.

Nunca sugerir que lead já é membro.

---

# 11. PUB-03 — COMO FUNCIONA

Explicar visualmente:

`1. Você entra`

→

`2. Compra seu crédito`

→

`3. O quórum cresce`

→

`4. Atingimos viabilidade`

→

`5. Diretoria confirma`

→

`6. Crédito vira ingresso`

→

`7. Festa acontece`

Também explicar:

- o que acontece se não atingir;
- diferença entre membro e comprador público;
- bar não interfere na confirmação.

---

# 12. PUB-04 — PÁGINA DA EDIÇÃO EM FORMAÇÃO

## Bloco principal

- nome da edição;
- estado;
- progresso;
- membros válidos;
- prazo quando aplicável;
- CTA.

## Bloco financeiro simplificado

Para público, não necessariamente mostrar todos os custos.

Mostrar conceito claro:

`Capital protegido: 62%`

`Faltam 241 membros equivalentes`

A apresentação exata dependerá da regra comercial.

## Blocos

- por que existe quórum;
- benefícios;
- possíveis datas;
- perguntas frequentes;
- política de não atingimento;
- histórico da Diretoria.

---

# 13. PUB-05 — OFERTA DIRETORIA CLUB

## Objetivo

Converter lead em membro.

## Mostrar

- valor;
- o que esse valor representa;
- benefícios;
- política de confirmação;
- política de não atingimento;
- regras principais;
- prazo;
- CTA.

## CTA

`Comprar crédito`

Não usar:

`Comprar ingresso`

antes da confirmação.

---

# 14. AUTH-01 — LOGIN / CADASTRO

Entrada unificada.

Opções previstas:

- telefone;
- e-mail;
- provedor futuro.

## Cadastro

Pedir apenas o necessário para prosseguir.

Após identificação:

- consolidar perfil existente;
- evitar duplicidade.

---

# 15. CHK-01 — CHECKOUT DO CLUB

## Cabeçalho

`Crédito Diretoria Club — [Edição]`

## Resumo

- valor bruto;
- taxa se exibida;
- benefício;
- edição;
- política essencial.

## Pagamento

- Pix;
- cartão.

## Checkbox

Termos e políticas aplicáveis.

## CTA

`Ir para pagamento`

---

# 16. CHK-02 — PAGAMENTO PIX PENDENTE

Mostrar:

- QR Pix;
- copia e cola;
- valor;
- expiração;
- status.

Texto:

`Aguardando confirmação do pagamento`

A interface pode consultar status.

Ela não pode se autodeclarar paga.

---

# 17. CHK-03 — CARTÃO PROCESSANDO

Mostrar:

`Estamos aguardando confirmação.`

Evitar dupla submissão.

Botão principal fica indisponível enquanto requisição está ativa.

---

# 18. CHK-04 — PAGAMENTO CONFIRMADO

Aparece somente após backend reconhecer `paid`.

Mostrar:

# PAGAMENTO CONFIRMADO

- crédito emitido;
- edição;
- valor protegido;
- posição atual do quórum.

CTA:

`Ir para minha área`

---

# 19. CHK-05 — PAGAMENTO FALHOU

Mostrar:

- status;
- motivo amigável quando disponível;
- opção de tentar novamente;
- suporte.

Não gerar crédito.

---

# 20. CHK-06 — PAGAMENTO EXPIRADO

Mostrar:

`Essa cobrança expirou.`

CTA:

`Gerar nova cobrança`

Nova cobrança deve possuir novo identificador/idempotência adequada.

---

# 21. MEM-01 — HOME DO MEMBRO EM FORMAÇÃO

## Cabeçalho

`Próxima Diretoria`

## Card principal

Estado:

`QUÓRUM EM ANDAMENTO`

Mostrar:

- progresso;
- capital protegido;
- membros válidos;
- prazo;
- seu status.

## Seu status

`Crédito válido`

## Atalhos

- acompanhar quórum;
- votar;
- indicar;
- regras;
- notificações.

---

# 22. MEM-02 — CARTEIRA

Separar:

## Créditos

Antes da confirmação.

## Ingressos

Depois da conversão/emissão.

Cada item mostra:

- edição;
- valor/origem;
- estado;
- data;
- ação disponível.

---

# 23. MEM-03 — DETALHE DO CRÉDITO

Mostrar:

- edição;
- valor bruto;
- valor considerado válido quando apropriado;
- data;
- status;
- política aplicável.

Estados visuais:

- pendente;
- válido;
- convertido;
- rollover;
- reembolso solicitado;
- reembolsado.

---

# 24. MEM-04 — QUÓRUM

Mostrar:

- estado atual;
- progresso;
- explicação;
- histórico simplificado;
- o que falta.

Quando atingir:

# QUÓRUM FINANCEIRO ATINGIDO

Texto:

`A edição está viável. A confirmação administrativa ainda precisa ser concluída.`

---

# 25. MEM-05 — VOTAÇÕES

Lista:

- abertas;
- encerradas.

Cada votação mostra:

- título;
- tipo quando apropriado;
- prazo;
- estado.

Após voto:

`Seu voto foi registrado.`

Evitar permitir múltiplos votos se regra for voto único.

---

# 26. MEM-06 — INDICAÇÕES

Mostrar:

- código/link;
- cliques;
- cadastros;
- compras qualificadas;
- recompensas.

CTA:

`Compartilhar`

Não prometer recompensa ainda não qualificada.

---

# 27. MEM-07 — EVENTO VIÁVEL

Quando estado passa a `VIAVEL`:

Banner:

# ATINGIMOS O QUÓRUM

Complemento:

`A Diretoria está concluindo as validações de data, local e operação.`

Não mostrar QR ainda.

---

# 28. MEM-08 — EVENTO CONFIRMADO

Após `EVENT_CONFIRMED`:

# ESTÁ CONFIRMADO

Mostrar:

- data;
- local;
- horário;
- ingresso;
- benefícios;
- orientações.

CTA principal:

`Ver meu ingresso`

---

# 29. MEM-09 — MEU INGRESSO

## Mostrar

- evento;
- titular;
- categoria;
- status;
- QR/token visual;
- instruções.

## Ações

- transferir;
- adicionar lembrete;
- suporte.

Não exibir informações pessoais no QR.

---

# 30. MEM-10 — TRANSFERIR INGRESSO

Passos:

### Passo 1
Explicar impacto.

### Passo 2
Informar novo titular.

### Passo 3
Revisar.

### Passo 4
Confirmar.

### Sucesso
`Transferência concluída`

Após conclusão:

QR antigo deixa de ser válido.

---

# 31. MEM-11 — REEMBOLSO / ROLLOVER

Disponível apenas quando política permitir.

Tela deve explicar opções.

## Opção A

`Solicitar reembolso`

## Opção B

`Manter crédito para próxima edição`

Mostrar benefício de rollover se existir.

Antes da confirmação:

mostrar impacto e prazo.

A decisão precisa ficar registrada.

---

# 32. MEM-12 — HISTÓRICO

Linha do tempo:

- entrou na lista;
- virou membro;
- evento confirmado;
- ingresso emitido;
- presença;
- próxima edição.

---

# 33. ADM-01 — LOGIN ADMINISTRATIVO

Entrada separada ou contexto administrativo protegido.

Após login:

RBAC determina menu.

---

# 34. ADM-02 — VISÃO GERAL

Dashboard global.

## Cards

- edição ativa;
- estado;
- capital protegido;
- membros;
- pagamentos;
- pendências críticas;
- próximos vencimentos;
- notificações de sistema.

## Alertas

Exemplos:

`3 webhooks com erro`

`2 contratos vencem esta semana`

`Quórum caiu após reembolso`

---

# 35. ADM-03 — LISTA DE EDIÇÕES

Cada card/linha:

- edição;
- status;
- data;
- capital protegido;
- membros;
- responsável;
- alertas.

Ação:

`Abrir edição`

CTA autorizado:

`Nova edição`

---

# 36. ADM-04 — CRIAR EDIÇÃO

Wizard.

## Etapa 1 — Identidade

- nome;
- código;
- conceito;
- capacidade estimada;
- timezone.

## Etapa 2 — Formação

- início;
- prazo do quórum;
- ticket referência.

## Etapa 3 — Financeiro

- contingência;
- taxas;
- custo variável;
- exposição aprovada.

## Etapa 4 — Revisão

Resumo.

## Ação

`Criar em PLANEJAMENTO`

Nunca criar já como `CONFIRMADO`.

---

# 37. ADM-05 — RESUMO DA EDIÇÃO

É o cockpit administrativo da edição.

## Cabeçalho

- nome;
- estado operacional;
- estado financeiro;
- datas.

## Blocos

### Capital protegido

### Quórum

### Custos protegidos

### Receitas garantidas

### Membros

### Pendências

### Próxima ação

Exemplo:

`Próxima ação: validar local para liberar confirmação.`

---

# 38. ADM-06 — CONFIGURAÇÃO FINANCEIRA

Mostrar versão atual.

Campos:

- ticket bruto;
- taxa estimada;
- custo variável por membro;
- contingência;
- exposição máxima autorizada.

Ao alterar:

`Criar nova versão`

Nunca sobrescrever silenciosamente versão usada em cálculo histórico.

---

# 39. ADM-07 — CUSTOS PROTEGIDOS

Tabela:

- categoria;
- descrição;
- estimado;
- aprovado;
- protegido?;
- fornecedor;
- status.

Ações:

- adicionar;
- editar rascunho;
- aprovar;
- cancelar.

Ao alterar custo aprovado:

mostrar:

`Impacto no quórum`

Exemplo:

`+ R$ 5.000 em custo aumenta o quórum estimado em 46 membros.`

---

# 40. ADM-08 — RECEITAS GARANTIDAS

Tabela:

- tipo;
- contraparte;
- valor;
- status;
- percentual elegível;
- valor elegível.

Prometido:

`R$ 20.000 prometidos`

`R$ 0 elegíveis para quórum`

Pago:

`R$ 20.000 elegíveis`

Bar não aparece como opção elegível.

---

# 41. ADM-09 — QUÓRUM

Tela central.

## Hero numérico

`R$ 44.000 / R$ 70.500`

`62,4% protegido`

## Indicadores

- créditos válidos;
- quórum mínimo;
- déficit;
- excedente;
- velocidade;
- projeção.

## Composição

### Custos protegidos
### Contingência
### Receitas garantidas
### Capital protegido

## Histórico

Gráfico/linha do tempo de snapshots.

## Regra

Nenhum desses valores possui campo “editar total”.

---

# 42. ADM-10 — SIMULADOR DE CENÁRIO

Pode existir como ferramenta analítica separada da verdade oficial.

Permite testar:

- ticket;
- contingência;
- custo;
- patrocínio;
- tamanho.

Identificação visual obrigatória:

# SIMULAÇÃO

Nada alterado aqui afeta quórum real até uma configuração ser formalmente aprovada.

---

# 43. ADM-11 — PAGAMENTOS

Tabela:

- cliente;
- propósito;
- valor;
- método;
- gateway;
- status;
- horário.

Filtros:

- paid;
- pending;
- failed;
- refunded;
- chargeback.

Detalhe mostra:

- eventos do gateway;
- webhook;
- crédito gerado;
- reembolso;
- auditoria.

---

# 44. ADM-12 — DETALHE DO PAGAMENTO

Linha temporal:

`created`

→ `pending`

→ `paid`

→ eventual `refunded`

Mostrar:

- IDs externos;
- idempotência;
- valor;
- taxa;
- líquido;
- crédito relacionado.

Ações permitidas por perfil:

- consultar;
- solicitar reembolso;
- copiar referência.

Nunca oferecer:

`Marcar como pago`

para usuário comum.

---

# 45. ADM-13 — MEMBROS

Tabela:

- cliente;
- contato;
- status;
- crédito;
- origem;
- indicação;
- data de entrada.

Filtros:

- pendente;
- ativo;
- reembolsado;
- rollover.

---

# 46. ADM-14 — GO/NO-GO

Tela de decisão mais importante do sistema.

## Cabeçalho

# CONFIRMAÇÃO DA EDIÇÃO

## Bloco financeiro

- snapshot utilizado;
- capital protegido;
- necessidade;
- exposição necessária;
- exposição autorizada;
- bar assumido: `R$ 0`;
- novas vendas assumidas: `R$ 0`.

## Checklist administrativo

- data definida;
- local definido;
- capacidade;
- orçamento;
- fornecedores críticos;
- responsabilidades.

## Resultado

### NÃO PODE CONFIRMAR

Mostrar motivos.

ou

### EDIÇÃO ELEGÍVEL PARA CONFIRMAÇÃO

CTA autorizado:

`Confirmar edição`

---

# 47. ADM-15 — MODAL DE CONFIRMAÇÃO FINAL

Antes de confirmar:

`Esta ação mudará a edição para CONFIRMADO e poderá emitir ingressos e iniciar obrigações operacionais.`

Mostrar:

- snapshot;
- data;
- local;
- operador;
- impacto.

Campo:

`Motivo/observação`

CTA:

`Confirmar edição`

Após sucesso:

audit log + estado.

---

# 48. ADM-16 — LOTES

Disponível após confirmação.

Cada lote:

- nome;
- sequência;
- preço;
- quantidade;
- início;
- fim;
- gatilho;
- status.

Visualizar:

`Lote atual`

`Próximo lote`

---

# 49. ADM-17 — INGRESSOS

Tabela:

- ticket;
- titular;
- origem;
- lote;
- status;
- emissão;
- uso.

Filtros:

- ativo;
- transferido;
- usado;
- bloqueado;
- cancelado.

Ações autorizadas:

- ver;
- bloquear;
- suporte de transferência.

Toda ação crítica auditada.

---

# 50. ADM-18 — CRM

Views:

### Funil

### Lista

### Segmentos

### Cliente

Segmentos:

- lead não comprador;
- membro;
- comprador;
- presente;
- no-show;
- recorrente;
- embaixador;
- inativo.

---

# 51. ADM-19 — PERFIL 360 DO CLIENTE

Mostrar uma linha do tempo única:

- aquisição;
- consentimentos;
- interações;
- pagamentos;
- créditos;
- ingressos;
- transferências;
- presença;
- indicações;
- notificações.

Esse painel materializa `customer_id`.

---

# 52. ADM-20 — PRODUÇÃO

Visualizações:

- lista;
- Kanban;
- calendário.

Item:

- categoria;
- tarefa;
- responsável;
- prazo;
- fornecedor;
- status;
- bloqueios.

---

# 53. ADM-21 — FORNECEDORES

Lista:

- fornecedor;
- categoria;
- contato;
- eventos atendidos;
- avaliação;
- pendências financeiras.

Detalhe:

- contratos;
- despesas;
- anexos;
- histórico.

---

# 54. ADM-22 — CONTRATOS

Card/tabela:

- fornecedor;
- valor;
- sinal;
- saldo;
- vencimentos;
- status;
- arquivo.

Alertas:

- sem contrato;
- vencimento próximo;
- saldo pendente.

---

# 55. ADM-23 — DESPESAS

Tabela:

- descrição;
- centro;
- fornecedor;
- planejado;
- aprovado;
- pago;
- saldo;
- vencimento;
- status.

Ação:

`Registrar pagamento`

---

# 56. ADM-24 — REGISTRAR PAGAMENTO DE DESPESA

Campos:

- valor;
- data;
- canal;
- quem pagou.

Se:

`Pago por pessoa com recurso próprio`

sistema avisa:

`Será gerado um adiantamento/obrigação da Diretoria para esta pessoa.`

Confirmação explícita.

---

# 57. ADM-25 — CONTA-CORRENTE

Por pessoa:

- adiantamentos;
- valores recebidos;
- reembolsos;
- ajustes;
- saldo.

Mostrar decomposição.

Nunca permitir editar simplesmente:

`Saldo = ...`

---

# 58. ADM-26 — CONCILIAÇÃO

Por canal:

- bruto;
- taxa;
- cancelamentos;
- líquido esperado;
- recebido;
- diferença.

Status:

- aberto;
- conciliado;
- divergência;
- resolvido.

CTA:

`Investigar diferença`

---

# 59. ADM-27 — BAR / ESTOQUE

Dashboard:

- estoque atual;
- compras;
- consignação;
- vendas;
- cortesias;
- perdas;
- CMV estimado/real;
- receita;
- margem.

Produtos críticos destacados.

---

# 60. ADM-28 — MOVIMENTO DE ESTOQUE

Registrar:

- produto;
- local;
- tipo;
- quantidade;
- custo;
- origem;
- consignado?;
- referência.

Tipos:

- compra;
- entrada consignada;
- transferência;
- venda/importação;
- cortesia;
- perda;
- quebra;
- devolução;
- ajuste de contagem.

---

# 61. ADM-29 — CONTAGEM

Fluxo:

1. abrir contagem;
2. escolher local;
3. contar produtos;
4. comparar sistema x contado;
5. revisar diferenças;
6. justificar;
7. fechar contagem.

Diferenças não são ocultadas.

---

# 62. GATE-01 — LOGIN / ATIVAÇÃO DO SCANNER

Tela mínima.

- identificar dispositivo;
- operador quando necessário;
- edição;
- status de sincronização.

---

# 63. GATE-02 — SCANNER

Tela praticamente inteira dedicada à câmera.

Indicadores mínimos:

- conexão;
- sincronização;
- quantidade processada.

Após leitura:

---

# 64. GATE-03 — RESULTADO VERDE

# ENTRADA LIBERADA

Mostrar por poucos segundos:

- nome resumido;
- categoria;
- horário.

Depois:

`Próximo scan`

---

# 65. GATE-04 — RESULTADO VERMELHO

# NÃO LIBERAR

Motivos possíveis:

- já utilizado;
- cancelado;
- bloqueado;
- inválido;
- evento errado.

Ação:

`Próximo scan`

Quando necessário:

`Chamar supervisor`

---

# 66. GATE-05 — RESULTADO AMARELO

# VERIFICAÇÃO NECESSÁRIA

Exemplos:

- dados inconsistentes;
- sincronização pendente;
- política especial.

Ações limitadas.

Scanner comum não resolve exceção financeira.

---

# 67. GATE-06 — MODO OFFLINE

Indicador persistente:

`OPERANDO NA REDE LOCAL`

Mostrar:

- gateway local conectado;
- última sincronização nuvem;
- eventos pendentes.

Não assustar operador se operação local continua saudável.

---

# 68. LIVE-01 — DIRETORIA LIVE

Layout de alta legibilidade.

Indicadores:

- emitidos;
- presentes;
- ocupação;
- entradas últimos 15 min;
- scanners online;
- bar bruto;
- ticket médio;
- estoque crítico;
- ocorrências.

Alertas com prioridade.

---

# 69. OPS-01 — OCORRÊNCIAS

Criar ocorrência em poucos toques.

Campos:

- tipo;
- severidade;
- descrição;
- responsável;
- foto/evidência opcional.

Estados:

- aberta;
- em atendimento;
- resolvida.

---

# 70. CLOSE-01 — CENTRAL DE FECHAMENTO

Checklist sequencial:

1. portaria encerrada;
2. caixas fechados;
3. estoque contado;
4. maquininhas conciliadas;
5. fornecedores conferidos;
6. adiantamentos conciliados;
7. recebíveis revisados;
8. DRE provisória;
9. divergências;
10. DRE final.

Cada passo exibe estado.

---

# 71. CLOSE-02 — DRE PROVISÓRIA

Mostrar:

## Receitas

- membros;
- ingressos;
- bar;
- estacionamento;
- patrocínio;
- outros.

## Custos

- produção;
- marketing;
- taxas;
- equipe;
- impostos;
- perdas;
- outros.

## Resultado

`PROVISÓRIO`

Mostrar pendências que ainda impedem versão final.

---

# 72. CLOSE-03 — DIVERGÊNCIAS

Lista:

- canal;
- esperado;
- recebido;
- diferença;
- responsável;
- status.

Nada some apenas porque valor é pequeno.

Política poderá definir tolerância, mas o registro permanece.

---

# 73. CLOSE-04 — ACERTO DOS SÓCIOS

Mostrar por pessoa:

- Diretoria deve;
- pessoa deve prestar contas;
- já reembolsado;
- saldo líquido.

Somente depois disso:

`Saldo distribuível`

---

# 74. CLOSE-05 — DRE FINAL

Ação:

`Finalizar DRE`

Exige:

- conciliações mínimas;
- estoque fechado;
- adiantamentos tratados;
- permissões.

Após finalização:

edição pode avançar para `ENCERRADO`.

---

# 75. REP-01 — RELATÓRIO FINAL

Painel/exportação:

- público;
- receita;
- custos;
- resultado;
- bar;
- CAC;
- ROAS;
- quórum;
- presença;
- no-show;
- indicação;
- recorrência;
- aprendizados.

---

# 76. RET-01 — RETENÇÃO

Após encerramento:

Segmentos automáticos:

- esteve presente;
- no-show;
- membro fundador;
- comprador público;
- indicou pessoas;
- recorrente.

Ações:

- campanha pós-evento;
- pesquisa;
- próxima lista;
- próximo crédito.

---

# 77. NOT-01 — CENTRAL DE NOTIFICAÇÕES ADMIN

Mostrar:

- template;
- canal;
- finalidade;
- público;
- enviados;
- entregues;
- falhas.

Separar:

`Transacional`

de

`Marketing`

---

# 78. AUD-01 — AUDITORIA

Pesquisa por:

- usuário;
- ação;
- entidade;
- edição;
- período.

Detalhe:

- antes;
- depois;
- motivo;
- horário;
- origem.

Não oferecer edição do log.

---

# 79. SYS-01 — SAÚDE DO SISTEMA

Painel operacional:

- pagamentos;
- webhooks;
- notificações;
- filas;
- scanners;
- gateway local;
- sincronização;
- erros.

Exemplos:

`Webhooks: saudável`

`2 notificações falharam`

`Scanner 4 offline`

---

# 80. FLUXO COMPLETO — VISITANTE ATÉ MEMBRO

```text
Anúncio / Instagram / WhatsApp
        ↓
PUB-01 Home
        ↓
PUB-02 Captura
        ↓
Lead criado
        ↓
PUB-05 Oferta Club
        ↓
AUTH-01 Identificação
        ↓
CHK-01 Checkout
        ↓
Pagamento
        ↓
pending
        ↓
backend/webhook
        ↓
paid
        ↓
crédito validado
        ↓
quórum recalculado
        ↓
CHK-04 Confirmação
        ↓
MEM-01 Área do membro
```

---

# 81. FLUXO COMPLETO — ADMIN CRIA EDIÇÃO

```text
ADM-03 Edições
       ↓
ADM-04 Nova edição
       ↓
PLANEJAMENTO
       ↓
ADM-06 Config financeira
       ↓
ADM-07 Custos
       ↓
ADM-08 Receitas
       ↓
ADM-09 Quórum
       ↓
Abrir REATIVAÇÃO/LISTA/FORMAÇÃO
```

---

# 82. FLUXO COMPLETO — QUÓRUM

```text
PAYMENT_CONFIRMED
       ↓
credit = valid
       ↓
recalcular
       ↓
snapshot
       ↓
ADM-09
       ↓
NAO_VIAVEL / PROXIMO / VIAVEL
```

Sem botão:

`Marcar como viável`

---

# 83. FLUXO COMPLETO — CONFIRMAÇÃO

```text
VIAVEL
  ↓
ADM-14 GO/NO-GO
  ↓
Financeiro OK?
  ↓
Administrativo OK?
  ↓
NO → bloqueado
  ↓
YES
  ↓
ADM-15 Confirmação
  ↓
CONFIRMADO
  ↓
tickets de membros
  ↓
notificações
  ↓
lotes
```

---

# 84. FLUXO COMPLETO — INGRESSO

```text
CONFIRMADO
   ↓
ticket emitido
   ↓
MEM-09
   ↓
opcional MEM-10 transferência
   ↓
dia do evento
   ↓
GATE-02 scanner
   ↓
validar
   ↓
used
   ↓
check-in
```

---

# 85. FLUXO COMPLETO — DESPESA PAGA POR SÓCIO

```text
ADM-23 Despesa
   ↓
ADM-24 Registrar pagamento
   ↓
"Pago por pessoa"
   ↓
expense_payment
   ↓
advance
   ↓
person_account_movement
   ↓
ADM-25 Conta-corrente
```

---

# 86. FLUXO COMPLETO — FECHAMENTO

```text
AO_VIVO
  ↓
FECHAMENTO
  ↓
CLOSE-01
  ↓
Estoque
  ↓
Conciliação
  ↓
Adiantamentos
  ↓
CLOSE-02 DRE provisória
  ↓
CLOSE-03 Divergências
  ↓
CLOSE-04 Sócios
  ↓
CLOSE-05 DRE final
  ↓
ENCERRADO
  ↓
RETENÇÃO
```

---

# 87. ESTADOS DE CARREGAMENTO

Telas críticas deverão distinguir:

- carregando;
- vazio;
- erro;
- indisponível;
- sem permissão;
- dado desatualizado.

Nunca mostrar `R$ 0` quando na verdade o cálculo falhou.

Preferir:

`Não foi possível calcular`

---

# 88. ESTADOS VAZIOS

Exemplos:

## Sem custos

`Nenhum custo protegido cadastrado.`

CTA:

`Adicionar primeiro custo`

## Sem membros

`Ainda não há pagamentos válidos para esta edição.`

## Sem ingressos

`Ingressos serão emitidos após a confirmação.`

---

# 89. ERROS FINANCEIROS

Erro em operação crítica deve informar:

- o que falhou;
- se houve ou não efeito financeiro;
- referência de suporte;
- possibilidade de tentar novamente.

Exemplo:

`Não conseguimos confirmar o reembolso. Nenhuma alteração financeira foi aplicada.`

---

# 90. CONFIRMAÇÕES IMPORTANTES

Exigir confirmação explícita para:

- reembolsar pagamento;
- cancelar crédito;
- alterar custo aprovado;
- alterar configuração financeira;
- confirmar edição;
- bloquear ingresso;
- registrar ajuste de estoque;
- finalizar conciliação;
- finalizar DRE.

---

# 91. MOBILE FIRST

Site, área do membro e portaria devem funcionar prioritariamente em celular.

Admin pode ter experiência desktop mais rica, mas funções críticas devem continuar utilizáveis em tablet/celular quando necessário.

---

# 92. ACESSIBILIDADE OPERACIONAL

Especial atenção à portaria:

- texto grande;
- alto contraste;
- vibração/feedback sonoro opcional;
- não depender apenas de cor;
- botões grandes;
- uso com uma mão.

---

# 93. FREQUENCY CAP NA UX

Central administrativa deverá impedir excesso acidental.

Antes de campanhas:

mostrar:

- tamanho do público;
- última comunicação;
- previsão de envios.

Transacional não deve ser bloqueado por regras de marketing quando necessário à operação.

---

# 94. PERMISSÕES NA INTERFACE

A interface deverá:

- ocultar ações que o papel não possui;
- explicar quando acesso é restrito;
- validar novamente no backend.

Ocultar botão não substitui autorização no servidor.

---

# 95. PRIMEIRO VERTICAL SLICE — TELAS

Para o primeiro HML funcional, implementar apenas:

1. `ADM-01` Login
2. `ADM-03` Lista de edições
3. `ADM-04` Criar edição
4. `ADM-05` Resumo da edição
5. `ADM-06` Configuração financeira
6. `ADM-07` Custos protegidos
7. `ADM-08` Receitas garantidas
8. `ADM-09` Quórum
9. `ADM-11` Pagamentos
10. `ADM-12` Detalhe do pagamento
11. `ADM-14` GO/NO-GO
12. `ADM-15` Confirmação
13. `AUD-01` Auditoria

Mais fluxo de teste:

14. usuário fictício;
15. pagamento HML;
16. crédito;
17. reembolso.

---

# 96. TESTE UX — CENÁRIO A

## Abaixo do quórum

Admin abre `ADM-09`.

Vê:

`R$ 44.000 / R$ 70.500`

`62,4%`

`NAO_VIAVEL`

Vai para confirmação.

Sistema mostra:

# CONFIRMAÇÃO BLOQUEADA

Motivo:

`Capital protegido insuficiente.`

Nenhum caminho visual permite contornar isso.

---

# 97. TESTE UX — CENÁRIO B

## Quórum atingido

Pagamento válido leva capital para:

`R$ 70.510`

Tela muda para:

`VIAVEL`

Administrador ainda vê:

`2 requisitos administrativos pendentes`

Botão de confirmação continua bloqueado.

---

# 98. TESTE UX — CENÁRIO C

## Todos os requisitos concluídos

`VIAVEL`

Financeiro:

OK.

Local:

OK.

Data:

OK.

Capacidade:

OK.

GO/NO-GO:

GO.

Agora:

`Confirmar edição`

fica disponível para usuário autorizado.

---

# 99. TESTE UX — CENÁRIO D

## Reembolso depois de viabilidade, antes de confirmação

Capital protegido cai.

Tela deve atualizar:

`VIAVEL → NAO_VIAVEL`

Se admin estiver com tela antiga aberta, confirmação deve falhar no backend e interface deve atualizar o estado.

---

# 100. TESTE UX — CENÁRIO E

## Dois scanners

Mesmo QR lido quase simultaneamente.

Scanner A:

`ENTRADA LIBERADA`

Scanner B:

`NÃO LIBERAR — INGRESSO JÁ UTILIZADO`

A UX deve refletir o resultado transacional do servidor/gateway, não apenas leitura do QR.

---

# 101. CRITÉRIOS DE ACEITE DO UX FLOW

O UX Flow está pronto para virar backlog quando:

1. todo estado da edição possui comportamento claro;
2. lead nunca parece membro antes do pagamento;
3. pagamento pendente nunca parece confirmado;
4. crédito é distinto de ingresso;
5. `VIAVEL` é visualmente distinto de `CONFIRMADO`;
6. GO/NO-GO não pode ser contornado;
7. bar não aparece como receita necessária ao quórum;
8. financeiro mostra composição e não apenas saldo;
9. transferência invalida acesso anterior;
10. scanner é simples;
11. modo offline é compreensível;
12. fechamento é sequencial;
13. conta-corrente dos sócios é visível;
14. DRE provisória é distinta da final;
15. auditoria é acessível a quem tem permissão;
16. próxima ação é evidente em cada etapa.

---

# 102. ORDEM DE WIREFRAMES

Após este documento, se forem produzidos wireframes, a prioridade deverá ser:

## Bloco 1 — Core administrativo

- ADM-05 Resumo
- ADM-07 Custos
- ADM-08 Receitas
- ADM-09 Quórum
- ADM-14 GO/NO-GO

## Bloco 2 — Formação pública

- PUB-01 Home
- PUB-02 Lead
- PUB-04 Edição
- PUB-05 Oferta
- CHK-01 Checkout

## Bloco 3 — Membro

- MEM-01 Home
- MEM-02 Carteira
- MEM-04 Quórum
- MEM-09 Ingresso

## Bloco 4 — Operação

- GATE-02 Scanner
- GATE-03/04/05 Resultados
- LIVE-01

## Bloco 5 — Financeiro

- ADM-23 Despesas
- ADM-25 Conta-corrente
- ADM-26 Conciliação
- CLOSE-01
- CLOSE-02
- CLOSE-05

---

# 103. PRÓXIMO PASSO CANÔNICO

Com o UX Flow aprovado, a próxima etapa é:

# BACKLOG V1

O Backlog deverá converter este documento em:

- Epics;
- Features;
- User Stories;
- critérios de aceite;
- dependências;
- prioridade;
- ordem de implementação;
- testes;
- Definition of Done.

O Backlog deve separar claramente:

1. o que é necessário para o primeiro anúncio;
2. o que é necessário para o primeiro pagamento;
3. o que é necessário para confirmar a festa;
4. o que é necessário para o dia do evento;
5. o que é necessário para fechar financeiramente.

---

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
