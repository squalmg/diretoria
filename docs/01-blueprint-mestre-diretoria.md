# BLUEPRINT MESTRE — DIRETORIA

**Projeto:** Diretoria
**Produto inicial:** Diretoria Club
**Versão:** Blueprint V0.1
**Data-base:** 21/08/2026
**Status:** Arquitetura inicial para desenvolvimento
**Objetivo:** transformar a Diretoria de uma operação tradicional de produção de festas baseada em risco antecipado em uma operação orientada por demanda comprovada, dados e controle financeiro integral.

---

# 1. VISÃO DO PROJETO

A Diretoria possui histórico real de realização de eventos, marca conhecida regionalmente, público acumulado, conteúdo visual, relacionamento com atléticas e experiência operacional.

O problema que o novo projeto resolve não é simplesmente "voltar a fazer festas".

O problema é:

> **Como voltar a produzir eventos sem assumir previamente um risco financeiro desproporcional à demanda real?**

A solução será uma combinação de:

* comunidade;
* pré-compromisso financeiro;
* quórum econômico;
* CRM;
* marketing;
* ticketing;
* produção;
* portaria;
* controle operacional;
* controle de bar;
* controle financeiro;
* análise de dados.

A Diretoria passará a operar sobre um software próprio que acompanha o ciclo completo da festa.

---

# 2. TESE CENTRAL

O modelo tradicional funciona assim:

**Planejar → contratar → gastar → anunciar → vender → realizar → descobrir o resultado.**

O modelo Diretoria deverá funcionar assim:

**Criar demanda → captar interessados → converter membros → medir receita protegida → atingir quórum → autorizar produção → confirmar evento → ampliar vendas → realizar → controlar operação → fechar financeiramente → iniciar próxima edição.**

A diferença fundamental é:

> **A Diretoria não deverá comprometer o capital principal da produção antes que exista demanda financeira comprovada suficiente.**

---

# 3. PRINCÍPIO Nº 1 — QUÓRUM É FINANCEIRO

Não consideraremos como quórum:

* curtidas;
* votos;
* comentários;
* respostas em enquete;
* pessoas em grupo;
* seguidores;
* "eu vou";
* RSVP sem pagamento.

Quórum é formado por:

> **dinheiro efetivamente comprometido e considerado válido pelo motor financeiro.**

Exemplo:

850 pessoas disseram que iriam.

Mas apenas 420 pagaram.

### Quórum real: 420.

---

# 4. PRINCÍPIO Nº 2 — O BAR NÃO FINANCIA A VIABILIDADE DA FESTA

O histórico fornecido mostra por que essa regra é necessária.

Na planilha da segunda edição da Inter Atléticas foram registrados aproximadamente:

* receita total: R$ 69.040;
* custos: R$ 50.079;
* resultado: R$ 18.961.

Já no resumo financeiro disponível do TIA 2023 aparecem:

* resultado da festa: **-R$ 7.000**;
* resultado do bar: **+R$ 5.391**;
* resultado combinado indicado: **-R$ 1.609**.

Esses valores históricos não serão tratados como preços válidos para 2026.

Eles serão usados como evidência estrutural.

### Regra Diretoria:

**Ingresso/membros e receitas garantidas deverão cobrir o cenário protegido da produção.**

Bar, estacionamento, camarotes e outras receitas deverão representar:

**upside financeiro**, e não sobrevivência do evento.

---

# 5. PRODUTO INICIAL

O primeiro produto será:

# DIRETORIA CLUB

Não será inicialmente uma assinatura mensal.

Será uma comunidade baseada em ciclos de eventos.

Funcionamento básico:

1. usuário entra no Diretoria;
2. cria sua conta;
3. compra um crédito para a próxima edição;
4. passa a fazer parte do quórum;
5. acompanha a formação;
6. participa das decisões permitidas;
7. quando o evento for confirmado, seu crédito se transforma em ingresso;
8. participa da festa;
9. depois poderá comprar o crédito da próxima edição.

---

# 6. NÃO CONFUNDIR MEMBRO COM COMPRADOR DE INGRESSO

Teremos dois relacionamentos diferentes.

## Membro Diretoria

Participa desde a formação.

Poderá receber:

* preço fundador;
* votação;
* prioridade;
* indicação;
* histórico;
* benefícios;
* transferência;
* recompensas;
* acesso antecipado.

## Comprador público

Entra depois que o evento já estiver confirmado.

Compra:

**um ingresso para uma festa existente.**

Essa diferenciação será mantida no banco de dados, CRM e analytics.

---

# 7. CICLO DE VIDA DE UMA EDIÇÃO

Cada edição terá uma máquina de estados.

## ESTADO 00 — PLANEJAMENTO

Evento privado.

Equipe define:

* conceito;
* tamanho;
* custos estimados;
* possíveis datas;
* possíveis locais;
* ticket de referência;
* capacidade;
* metas.

Nenhuma venda pública ainda.

---

## ESTADO 01 — REATIVAÇÃO

A Diretoria volta à comunicação.

Objetivo:

**reativar memória de marca.**

Conteúdo predominantemente histórico.

---

## ESTADO 02 — LISTA DE ESPERA

Página pública é aberta.

Objetivo:

captar:

* nome;
* telefone;
* e-mail;
* data de nascimento quando pertinente;
* origem;
* preferências.

Ainda não necessariamente existe pagamento.

---

## ESTADO 03 — FORMAÇÃO

Venda do Diretoria Club é aberta.

Cada pagamento válido aumenta o quórum.

Exemplo:

**317 / 700**

---

## ESTADO 04 — QUÓRUM EM ANDAMENTO

Motor financeiro acompanha:

* dinheiro recebido;
* taxas;
* reservas;
* custos;
* reembolsos potenciais;
* patrocínio confirmado;
* exposição financeira.

O sistema calcula continuamente:

### EVENTO AINDA NÃO VIÁVEL

ou

### EVENTO VIÁVEL

---

## ESTADO 05 — VIÁVEL

O limite financeiro mínimo foi alcançado.

Ainda deverá existir uma confirmação administrativa.

Sistema informa:

> QUÓRUM FINANCEIRO ATINGIDO.

Produção definitiva pode ser liberada.

---

## ESTADO 06 — CONFIRMADO

Data definitiva.

Local definitivo.

Produção autorizada.

Ingressos dos membros emitidos.

Comunicação muda completamente.

---

## ESTADO 07 — VENDA PÚBLICA

Começa:

* lote 1;
* lote 2;
* lote 3;
* lote final;
* eventualmente portaria.

Agora a meta principal deixa de ser viabilidade e passa a ser:

**maximização controlada do resultado.**

---

## ESTADO 08 — PRÉ-EVENTO

Operação completa.

Checklists.

Equipe.

Fornecedores.

Bar.

Portaria.

Ingressos.

Segurança.

Estrutura.

---

## ESTADO 09 — AO VIVO

Dashboard operacional muda para:

# DIRETORIA LIVE

Portaria, público, bar, equipe e ocorrências.

---

## ESTADO 10 — FECHAMENTO

Após encerramento:

* fechamento de caixas;
* estoque;
* fornecedores;
* recebíveis;
* adiantamentos;
* pendências.

---

## ESTADO 11 — ENCERRADO

DRE final consolidada.

Evento não aceita novas alterações financeiras sem registro de auditoria.

---

## ESTADO 12 — RETENÇÃO

Começa o ciclo da próxima edição.

---

# 8. HISTÓRICO E MARCA

O Instagram existente demonstra patrimônio de marca relevante.

A Diretoria possui histórico visual relacionado a:

* TIA;
* Inter Atléticas;
* Arraiá;
* outras edições;
* DJs;
* público;
* palco;
* bar;
* produtos;
* copos;
* roupas;
* atléticas.

Não será criada uma nova marca do zero.

## Arquitetura sugerida

# DIRETORIA

Marca principal.

Abaixo:

**Diretoria Club**

**TIA**

**Inter Atléticas**

**Arraiá Diretoria**

**edições especiais futuras**

---

# 9. ACERVO DIRETORIA

Será criada uma biblioteca central de ativos.

Categorias:

* logos;
* identidade;
* flyers;
* fotografias;
* vídeos;
* aftermovies;
* stories;
* reels;
* banners;
* line-ups;
* imprensa;
* comentários;
* depoimentos;
* público;
* artistas;
* estrutura;
* bar;
* bastidores.

Cada ativo deverá possuir metadados.

Exemplo:

**Evento:** TIA 2023
**Tipo:** vídeo
**Conteúdo:** multidão
**Uso:** anúncio permitido
**Qualidade:** alta
**Formato:** vertical
**Direitos:** verificar

Esse acervo alimentará todo o marketing futuro.

---

# 10. ESTRATÉGIA DE REATIVAÇÃO

A campanha não começará vendendo ingresso.

Começará recuperando memória.

## Etapa A — Memória

"Você lembra disso?"

Conteúdo histórico.

---

## Etapa B — Curiosidade

"A Diretoria está voltando."

Sem explicar tudo imediatamente.

---

## Etapa C — Problema

Mostrar por que o modelo de eventos mudou.

---

## Etapa D — Novo modelo

Apresentar Diretoria Club.

---

## Etapa E — Lista

Captura de interessados.

---

## Etapa F — Fundadores

Abertura dos primeiros membros.

---

## Etapa G — Quórum

Campanha baseada em progresso.

Exemplo:

**427 / 700**

---

## Etapa H — Pressão social

"Faltam 72."

---

## Etapa I — Confirmação

# CONSEGUIMOS.

---

## Etapa J — Festa

Passamos a vender o evento confirmado.

---

# 11. SISTEMA DE MARKETING

Todo tráfego deverá ser identificável.

Fontes:

* Meta Ads;
* Instagram orgânico;
* WhatsApp;
* atléticas;
* embaixadores;
* QR físico;
* parceiros;
* tráfego direto;
* Google quando aplicável.

UTMs e identificadores deverão acompanhar o usuário.

Exemplo:

`source=instagram`

`campaign=retorno_diretoria`

`creative=video_tia_multidao`

---

# 12. FUNIL CENTRAL

O sistema acompanhará:

### VISITANTE

↓

### LEAD

↓

### MEMBRO

↓

### MEMBRO CONFIRMADO

↓

### INGRESSO EMITIDO

↓

### PARTICIPANTE

↓

### PARTICIPANTE RECORRENTE

↓

### EMBAIXADOR

---

# 13. IDENTIDADE ÚNICA DO CLIENTE

A mesma pessoa não poderá existir de maneira independente em:

* Instagram;
* site;
* WhatsApp;
* ticket;
* indicação;
* portaria.

O sistema deverá procurar consolidar tudo sob:

### `customer_id`

Exemplo:

`customer_id: 00000849`

Histórico:

* primeira visita;
* origem;
* cadastro;
* pagamento;
* evento;
* indicação;
* transferência;
* presença;
* próximas compras.

---

# 14. SITE PÚBLICO

O site deverá inicialmente funcionar como:

**portal oficial da Diretoria.**

Componentes principais:

## Hero

Estado atual.

Exemplo:

# A DIRETORIA ESTÁ VOLTANDO

**543 / 700 membros**

[Fazer parte]

---

## Quórum

Progresso real.

---

## Funcionamento

Explicação simples.

---

## Datas possíveis

Quando aplicável.

---

## Benefícios

Diretoria Club.

---

## História

Acervo.

---

## FAQ

Explicar:

* pagamento;
* confirmação;
* data;
* transferência;
* reembolso;
* ingresso;
* funcionamento.

---

## Login

Área do membro.

---

# 15. PWA / ÁREA DO MEMBRO

Preferência para V1:

**Progressive Web App.**

Não desenvolver aplicativo nativo inicialmente.

Módulos:

### Home

Próxima Diretoria.

### Carteira

Créditos e ingressos.

### QR

Ingresso.

### Votações

Datas e decisões autorizadas.

### Indicações

Link pessoal.

### Benefícios

Vantagens.

### Histórico

Participações.

### Perfil

Dados pessoais.

### Notificações

Central de comunicação.

---

# 16. CHECKOUT

Deverá aceitar inicialmente:

* Pix;
* cartão.

Cada tentativa de pagamento terá status próprio:

`created`

`pending`

`paid`

`failed`

`expired`

`refunded`

`chargeback`

Nunca considerar usuário membro apenas porque chegou à página de pagamento.

### Membro válido:

`payment_status = paid`

---

# 17. WEBHOOKS E IDEMPOTÊNCIA

Pagamento será confirmado pelo backend.

Jamais pela página do navegador.

Se o gateway enviar o mesmo webhook três vezes:

o sistema processará **uma vez**.

Obrigatório:

* idempotência;
* log;
* assinatura/verificação;
* timestamp;
* histórico.

---

# 18. MOTOR DE QUÓRUM

Este será um dos principais serviços do sistema.

## Entradas

* custos fixos;
* custos variáveis;
* reserva;
* taxas;
* impostos provisionados;
* créditos válidos;
* receita garantida;
* patrocínio confirmado.

## Saída

### Quórum mínimo.

Modelo conceitual:

`necessidade_financeira = custos_protegidos + contingencia - receitas_garantidas`

`contribuicao_liquida_membro = ticket - taxas - custo_variavel`

`quorum = necessidade_financeira / contribuicao_liquida_membro`

Sempre arredondar para cima.

---

# 19. MARGEM DE SEGURANÇA

Nunca calcular quórum apenas pelo orçamento esperado.

Deverá existir:

`reserva_contingencia`

Exemplo:

10%

15%

20%.

A porcentagem será parametrizável.

---

# 20. RECEITAS QUE PODEM REDUZIR QUÓRUM

Somente receitas realmente confirmadas.

Exemplo:

Patrocínio:

**prometido** → não conta.

Contrato assinado mas não pago:

pode receber peso configurável.

Pago:

conta integralmente.

Bar esperado:

### não conta.

---

# 21. STATUS FINANCEIRO DO EVENTO

Dashboard:

### NÃO VIÁVEL

### PRÓXIMO DO QUÓRUM

### VIÁVEL

### PROTEGIDO

### SUPERÁVIT

---

# 22. PAGAMENTO DO CLUBE

O dinheiro arrecadado antes da confirmação deve ser tratado separadamente.

Não poderá ser apresentado ao administrador simplesmente como:

### "saldo disponível".

Teremos:

**Caixa em formação**

**Receita protegida**

**Receita operacional**

**Resultado disponível**

---

# 23. POLÍTICA DE NÃO ATINGIMENTO

Antes da abertura financeira, deverá ser definida formalmente.

Modelo desejado:

Se o evento não atingir seu quórum até o prazo:

usuário escolhe:

* reembolso;
* manter crédito para próxima edição.

Poderá ser utilizado incentivo para rollover.

Exemplo:

"Mantenha seu crédito e receba benefício adicional."

Regras comerciais, contábeis e jurídicas serão validadas antes da publicação.

---

# 24. VOTAÇÕES

Membro poderá votar em decisões determinadas pela organização.

Exemplos:

* datas;
* estilos;
* atrações;
* experiências.

Votações não controlam automaticamente a produção.

Administrador decide quais votações são:

**consultivas**

ou

**vinculantes**.

---

# 25. SISTEMA DE INDICAÇÕES

Cada membro terá:

`referral_code`

Exemplo:

`DIR-TIAGO-849`

Acompanharemos:

* cliques;
* cadastros;
* compras;
* receita;
* recompensa.

---

# 26. EMBAIXADORES

Possível programa:

3 vendas → benefício A

5 → benefício B

10 → benefício C.

Recompensas deverão ter custo financeiro calculado.

Nada será concedido sem registro.

---

# 27. ATLÉTICAS

O histórico mostra comissões e despesas relacionadas às atléticas.

Será criado módulo específico:

# Parceiros

Cada atlética poderá ter:

* cadastro;
* responsável;
* link;
* cupom;
* meta;
* vendas;
* receita;
* comissão;
* valor pago;
* saldo.

Isso permite descobrir objetivamente:

**quem gera receita.**

---

# 28. LOTES

Após confirmação:

### Lote 1

Preço
Quantidade.

### Lote 2

Preço
Quantidade.

### Lote 3

Preço
Quantidade.

Quando quantidade esgota:

lote seguinte inicia automaticamente.

Poderá existir também:

* data de virada;
* quantidade;
* gatilho híbrido.

---

# 29. INGRESSOS

Ingresso conterá:

* `ticket_id`;
* evento;
* proprietário;
* categoria;
* lote;
* status;
* QR;
* histórico.

Estados:

`active`

`transferred`

`used`

`cancelled`

`refunded`

`blocked`

---

# 30. TRANSFERÊNCIA

O titular poderá transferir o ingresso.

Processo:

1. solicita transferência;
2. informa novo titular;
3. sistema verifica regras;
4. ingresso anterior é invalidado;
5. novo titular recebe ingresso válido;
6. auditoria registra a operação.

Não existirão dois ingressos válidos simultaneamente.

---

# 31. REPASSE ENTRE PESSOAS

Marketplace financeiro completo não será requisito obrigatório da V1.

A V1 poderá oferecer:

### transferência direta.

Marketplace interno poderá vir posteriormente.

---

# 32. QR CODE

QR não deverá armazenar dados pessoais legíveis.

Ideal:

token assinado.

Scanner consulta:

`ticket_id`

`signature`

Status retornado pelo servidor.

---

# 33. ANTIFRAUDE

Medidas:

* token imprevisível;
* assinatura;
* status único;
* bloqueio após uso;
* log de scan;
* dispositivo;
* operador;
* horário.

Futuramente:

QR dinâmico/rotativo.

---

# 34. PORTARIA

Aplicativo/PWA específico.

Tela extremamente simples.

## Resultado

### VERDE

Válido.

### VERMELHO

Inválido.

### AMARELO

Requer verificação.

---

# 35. PORTARIA OFFLINE

Internet pública não poderá ser ponto único de falha.

Arquitetura desejada:

### servidor/gateway local

*

### rede Wi-Fi interna

Scanners se comunicam localmente.

Mesmo sem internet externa:

check-ins continuam sincronizados entre portões.

Quando internet retorna:

dados são enviados à nuvem.

---

# 36. PRODUÇÃO

Cada edição terá um projeto operacional.

Categorias históricas fornecidas mostram exemplos como:

* local;
* som;
* iluminação;
* segurança;
* gerador;
* sofás;
* atrações;
* brigadistas;
* bombeiros;
* alvará;
* ART;
* ECAD;
* gelo;
* bebidas;
* fotógrafos;
* freezers;
* hotel;
* bar;
* equipes;
* publicidade.

Essas categorias serão transformadas em estrutura padronizada.

---

# 37. FORNECEDORES

Cada fornecedor terá cadastro.

Campos:

Nome
Categoria
Contato
Documento
Dados financeiros
Eventos anteriores
Avaliação.

---

# 38. CONTRATOS

Cada contratação poderá possuir:

* fornecedor;
* valor;
* sinal;
* saldo;
* vencimento;
* contrato;
* observações;
* responsável.

---

# 39. CONTAS A PAGAR

Estados:

`planned`

`approved`

`partial`

`paid`

`cancelled`

`overdue`

---

# 40. ADIANTAMENTOS DOS SÓCIOS

Esta função é obrigatória.

Os materiais históricos registram situações como:

* "Tiago pagou";
* "Pago por Magrin";
* "Pago pelo bar";
* "Falta pagar";
* dinheiro em mãos.

No sistema:

### DESPESA

R$ 600

Fotógrafo.

Pago por:

**Tiago — recursos pessoais**

Automaticamente:

### Diretoria deve R$600 a Tiago.

---

# 41. CONTA-CORRENTE POR PESSOA

Cada sócio/responsável poderá ter:

Entradas
Adiantamentos
Reembolsos
Recebimentos
Saldo.

Nunca depender de reconstrução posterior.

---

# 42. CENTROS FINANCEIROS

Separar:

## Formação

## Produção

## Bar

## Portaria

## Estacionamento

## Patrocínio

## Outros.

---

# 43. MEIOS DE PAGAMENTO

O histórico mostra múltiplas maquininhas, dinheiro e diferentes entradas financeiras.

O sistema deverá distinguir:

* gateway online;
* Pix;
* maquininha A;
* maquininha B;
* dinheiro;
* transferência;
* outro.

---

# 44. CONCILIAÇÃO

Para cada canal:

Venda bruta
Taxa
Cancelamentos
Líquido esperado
Líquido recebido
Diferença.

Exemplo:

Bruto:

R$30.000.

Taxa:

R$1.200.

Esperado:

R$28.800.

Recebido:

R$28.796.

Diferença:

R$4.

---

# 45. BAR

O bar será tratado como unidade financeira própria.

Não apenas:

"vendeu R$30 mil."

Precisaremos conhecer:

### receita

menos

### CMV real

menos

### equipe

menos

### perdas

menos

### taxas.

---

# 46. ESTOQUE DO BAR

Produto:

Heineken.

Campos:

Quantidade comprada
Custo unitário
Fornecedor
Consignado
Estoque inicial
Reposição
Venda
Cortesia
Quebra/perda
Estoque final.

---

# 47. CONSIGNAÇÃO

O histórico possui referência a produtos consignados.

O sistema deverá diferenciar:

### comprado

vs.

### consignado.

Isso altera cálculo de estoque e CMV.

---

# 48. CORTESIAS

Toda cortesia deverá existir no sistema.

Categorias:

* artista;
* patrocinador;
* parceiro;
* equipe;
* atlética;
* sócio;
* promocional.

Nada de cortesias invisíveis.

---

# 49. PDV

V1 não precisa desenvolver um PDV completo próprio.

Podemos integrar ou importar dados de solução existente.

Objetivo inicialmente:

**capturar os dados.**

Posteriormente poderá existir PDV Diretoria.

---

# 50. DIRETORIA LIVE

Durante evento:

dashboard especial.

Exemplo:

# DIRETORIA LIVE

Ingressos emitidos: 1.520

Entraram: 987

Entrada últimos 15 min: 104

Bar bruto: R$31.842

Ticket médio atual: R$32,26

Estoque crítico: Red Bull

Ocorrências abertas: 2

Scanners online: 6/6

---

# 51. OCORRÊNCIAS

Registro operacional.

Tipos:

* segurança;
* saúde;
* estrutura;
* bar;
* portaria;
* sistema;
* fornecedor.

Campos:

horário
responsável
descrição
ação tomada
status.

---

# 52. EQUIPE

Perfis:

### Super Admin

Sócios.

### Financeiro

Finanças.

### Produção

Fornecedores/checklist.

### Marketing

Campanhas.

### Atendimento

CRM.

### Portaria Supervisor

Check-in completo.

### Scanner

Somente leitura de ingresso.

### Bar

Dados permitidos.

---

# 53. RBAC

Permissões por função.

Exemplo:

Scanner não poderá visualizar:

* lucro;
* clientes completos;
* fornecedores;
* pagamentos.

---

# 54. AUDITORIA

Toda ação crítica será registrada.

Exemplos:

Tiago alterou custo de segurança.

Adson confirmou fornecedor.

Operador X cancelou ingresso.

Financeiro realizou reembolso.

Registro:

* usuário;
* ação;
* antes;
* depois;
* horário;
* IP/dispositivo quando pertinente.

---

# 55. CRM

Cada pessoa possuirá:

dados básicos
origem
status
eventos
compras
interações
indicações
presença.

Segmentos automáticos.

---

# 56. SEGMENTOS

Exemplos:

### Lead não comprador

### Membro

### Participou da última

### No-show

### Comprou 2+

### Comprou 5+

### Embaixador

### Alto valor

### Inativo.

---

# 57. WHATSAPP

Canal transacional e de relacionamento.

Exemplos:

Pagamento confirmado.

Quórum atualizado.

Evento confirmado.

Votação aberta.

Ingresso disponível.

Lembrete.

Transferência.

Pós-evento.

---

# 58. NOTIFICAÇÕES

Arquitetura multicanal.

Prioridade inicial:

1. WhatsApp;
2. e-mail;
3. push PWA.

Cada comunicação terá:

template
evento
usuário
status
envio
leitura quando disponível.

---

# 59. FREQUENCY CAP

O sistema deverá controlar excesso de mensagens.

Não bombardear o cliente.

Marketing e notificações transacionais serão diferenciados.

---

# 60. ANALYTICS

Eventos mínimos:

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

---

# 61. KPIs DE AQUISIÇÃO

* alcance;
* visitas;
* CTR;
* CPC;
* leads;
* CPL;
* checkout;
* conversão;
* CAC membro.

---

# 62. KPIs DO QUÓRUM

* membros;
* membros/dia;
* receita protegida;
* % da meta;
* velocidade do quórum;
* projeção de conclusão.

---

# 63. KPIs DO EVENTO

* ingressos;
* presentes;
* no-show;
* entrada por hora;
* capacidade.

---

# 64. KPIs DO BAR

* receita;
* CMV;
* margem;
* receita/pessoa;
* itens;
* perdas.

---

# 65. KPIs FINANCEIROS

* receita bruta;
* receita líquida;
* custos;
* margem;
* lucro;
* lucro/pessoa;
* CAC;
* ROAS;
* ROI.

---

# 66. KPIs DE RETENÇÃO

* recompra;
* intervalo entre compras;
* membros recorrentes;
* LTV;
* indicação;
* churn da comunidade.

---

# 67. DRE AUTOMÁTICA

Ao final:

## Receita

Membros
Ingressos
Bar
Estacionamento
Patrocínio
Camarote
Outros.

## (-) Custos diretos

## (-) Produção

## (-) Marketing

## (-) taxas

## (-) equipe

## (-) impostos provisionados

## (-) perdas

=

# RESULTADO OPERACIONAL

---

# 68. FECHAMENTO DA FESTA

Evento não é considerado encerrado quando acaba a música.

Fluxo:

### Público saiu

↓

### Portaria encerrada

↓

### Caixas fechados

↓

### Estoque contado

↓

### Maquininhas conciliadas

↓

### Fornecedores conferidos

↓

### Adiantamentos conciliados

↓

### Pendências identificadas

↓

### DRE provisória

↓

### Recebíveis compensados

↓

### DRE final.

---

# 69. ACERTO DOS SÓCIOS

Sistema calculará:

Empresa deve para Tiago.

Empresa deve para Adson.

Tiago deve prestar contas.

Adson deve prestar contas.

Fornecedores pendentes.

Caixa disponível.

Somente então:

### saldo distribuível.

---

# 70. RELATÓRIO FINAL

Cada edição produzirá automaticamente:

# Relatório Diretoria #XX

Público
Receitas
Custos
Lucro
Bar
Marketing
CAC
ROAS
Quórum
Presença
Indicação
Aprendizados.

---

# 71. LOOP DE MELHORIA

Os resultados alimentam automaticamente o planejamento da próxima.

Exemplo:

Diretoria #01 mostrou:

CAC R$17.

Bar/pessoa R$48.

No-show 7%.

Então Diretoria #02 utiliza esses valores como referência.

---

# 72. PRÓXIMA EDIÇÃO

Não esperar semanas.

Durante o evento atual poderá começar:

### lista da próxima Diretoria.

Após evento:

campanha para presentes.

"Você esteve lá."

CTA:

### Garantir próxima.

---

# 73. BANCO DE DADOS — ENTIDADES PRINCIPAIS

Estrutura inicial:

`users`

`profiles`

`events`

`event_phases`

`memberships`

`credits`

`payments`

`refunds`

`tickets`

`ticket_transfers`

`checkins`

`votes`

`polls`

`referrals`

`partners`

`partner_sales`

`suppliers`

`contracts`

`expenses`

`advances`

`revenues`

`reconciliations`

`products`

`inventory`

`bar_transactions`

`staff`

`roles`

`permissions`

`notifications`

`audit_logs`

`analytics_events`

---

# 74. RELAÇÕES IMPORTANTES

Um usuário:

pode ter vários créditos.

Um crédito:

pertence a uma edição.

Um crédito convertido:

gera ingresso.

Um ingresso:

pode sofrer transferências.

Um ingresso válido:

só pode ser utilizado uma vez.

---

# 75. ARQUITETURA TÉCNICA

Blueprint permanece inicialmente independente de fornecedor.

Componentes:

### Frontend

Web/PWA.

### API

Backend.

### Database

PostgreSQL.

### Storage

Arquivos.

### Queue

Jobs assíncronos.

### Payment Provider

Pix/cartão.

### Messaging

WhatsApp/e-mail/push.

### Analytics

eventos.

### Event Gateway

operação local da portaria.

---

# 76. AMBIENTES

Obrigatório:

### LOCAL/DEV

### HML

### PRODUÇÃO

Nunca testar pagamentos, ingressos ou alterações críticas diretamente em produção.

---

# 77. SEGREDOS

Nunca no código.

Variáveis sensíveis em ambiente seguro.

Logs jamais devem expor:

* senha;
* token;
* cartão;
* segredo;
* credenciais.

---

# 78. BACKUPS

Banco:

backup periódico.

Antes de mudanças críticas:

snapshot.

Logs financeiros:

retenção prolongada.

---

# 79. OBSERVABILIDADE

Sistema deverá possuir:

* logs;
* erros;
* uptime;
* webhooks;
* falhas de pagamento;
* falhas de notificação.

---

# 80. RESILIÊNCIA

Não poderá existir ponto único de falha crítico no dia da festa.

Principalmente:

* portaria;
* banco local de tickets;
* rede;
* energia;
* dispositivos.

---

# 81. O QUE NÃO CONSTRUIR NA PRIMEIRA VERSÃO

Para evitar excesso de desenvolvimento:

Não obrigatório na V1:

* app Android/iOS nativo;
* PDV completo próprio;
* marketplace avançado de ingressos;
* cashless próprio;
* IA autônoma;
* programa sofisticado de pontos;
* plataforma white-label;
* portal completo para patrocinadores.

---

# 82. V1 OBRIGATÓRIA

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

# 83. O QUE DEVE EXISTIR ANTES DO PRIMEIRO ANÚNCIO

Não precisamos do sistema inteiro.

Precisamos de:

### Marca pronta

### Site de reativação

### Analytics

### Pixels

### CRM

### Captura de leads

### Consentimentos necessários

### Dashboard básico

### Acervo organizado

### Campanhas prontas

### Monitoramento de erro.

Assim podemos começar a formar público enquanto os módulos posteriores são desenvolvidos.

---

# 84. O QUE PRECISA EXISTIR ANTES DE RECEBER O PRIMEIRO PAGAMENTO

Obrigatório:

* conta;
* checkout;
* gateway;
* webhook;
* política comercial;
* regras do clube;
* termos;
* política de privacidade;
* motor de créditos;
* reembolsos;
* logs;
* backup;
* painel financeiro.

---

# 85. O QUE PRECISA EXISTIR ANTES DE CONFIRMAR A FESTA

* motor de quórum validado;
* orçamento;
* fornecedores;
* contratos;
* custos;
* reserva;
* capacidade;
* data;
* local;
* responsabilidade operacional.

---

# 86. O QUE PRECISA EXISTIR ANTES DA FESTA

* ticketing;
* QR;
* transferência;
* scanners;
* contingência offline;
* equipe;
* checklists;
* estoque;
* portaria;
* financeiro;
* testes de carga.

---

# 87. O QUE PRECISA EXISTIR ANTES DO FECHAMENTO

* conciliação;
* estoque;
* adiantamentos;
* contas a pagar;
* recebíveis;
* DRE.

---

# 88. FASES DE DESENVOLVIMENTO

## FASE 0 — Fundação

Blueprint
Branding
Domínio
Arquitetura
Banco
Infraestrutura.

---

## FASE 1 — Reativação

Site público
Acervo
Analytics
CRM
Lista de espera.

---

## FASE 2 — Club

Conta
Checkout
Pagamento
Crédito
Área do membro.

---

## FASE 3 — Quórum

Motor financeiro
Dashboard
Votações
Indicações.

---

## FASE 4 — Confirmação

Ticketing
Lotes
Transferências.

---

## FASE 5 — Produção

Fornecedores
Contratos
Custos
Checklists
Financeiro.

---

## FASE 6 — Event Day

Portaria
Offline
Live dashboard.

---

## FASE 7 — Fechamento

Conciliação
DRE
Sócios
Relatórios.

---

## FASE 8 — Escala

Automação
IA
Marketplace
PDV
White-label.

---

# 89. CRITÉRIO FUNDAMENTAL DE GO/NO-GO

Nenhum evento passa para **CONFIRMADO** se o sistema não responder satisfatoriamente:

### "Se não vendermos mais nenhum ingresso e o bar tiver resultado zero, conseguimos realizar esse evento sem ultrapassar a exposição financeira aprovada?"

Se resposta:

### NÃO

não confirmar.

---

# 90. RISCOS PRINCIPAIS

## Público insuficiente

Mitigação:

quórum.

## Custos subestimados

Mitigação:

contingência.

## Caixa confundido com lucro

Mitigação:

centros financeiros.

## Fraude de ingresso

Mitigação:

QR + status.

## Falha de internet

Mitigação:

gateway local.

## Descontrole de bar

Mitigação:

estoque.

## Sócios pagando despesas informalmente

Mitigação:

adiantamentos.

## Comissões sem rastreamento

Mitigação:

links/códigos.

---

# 91. DECISÕES AINDA EM ABERTO

O blueprint não deve inventar estas respostas.

Precisaremos decidir:

1. domínio definitivo;
2. ticket fundador;
3. tamanho desejado da primeira festa;
4. cidade/região inicial;
5. possíveis locais;
6. gateway;
7. preço público;
8. benefícios dos membros;
9. regras definitivas de reembolso;
10. limite de transferência;
11. política de meia-entrada e enquadramento jurídico aplicável;
12. política de menores;
13. modelo de bar;
14. parceiros;
15. stack definitiva.

---

# 92. DADOS HISTÓRICOS

Os documentos antigos serão preservados como:

### BASELINE HISTÓRICA.

Não serão tratados como contabilidade atual.

Servirão para:

* categorias;
* comparação;
* aprendizado;
* identificação de riscos.

A segunda edição da Inter Atléticas registra receita total de R$69.040, custos de R$50.079 e resultado de R$18.961.

O material do TIA 2023 evidencia uma operação bastante fragmentada entre custos da festa, bar, maquininhas, pessoas que anteciparam despesas e valores ainda a pagar, exatamente um dos problemas que o novo sistema deverá eliminar.

---

# 93. NORTH STAR METRIC

A métrica principal não será:

### seguidores.

Também não será:

### ingressos vendidos.

A principal métrica estratégica será:

# CAPITAL DE EVENTO PROTEGIDO

Ou seja:

> **quanto da obrigação econômica da próxima edição já está coberta por receita comprometida válida.**

---

# 94. SEGUNDA NORTH STAR

Para o crescimento:

# MEMBROS ATIVOS RECORRENTES

Quantas pessoas participaram de uma edição e já estão comprometidas com a próxima.

---

# 95. OBJETIVO DE LONGO PRAZO

Depois de validar Diretoria:

o software poderá se tornar plataforma para:

* atléticas;
* produtores;
* formaturas;
* festas;
* festivais;
* comunidades.

Nesse estágio, o produto poderá oferecer:

### Event-as-a-Quorum Platform

Um produtor informa:

custos
capacidade
preço
meta.

A plataforma calcula:

quórum.

A comunidade pré-financia.

O evento acontece somente se economicamente viável.

Mas isso não faz parte da missão da primeira versão.

---

# 96. DEFINIÇÃO DE SUCESSO DA PRIMEIRA EDIÇÃO

A primeira edição não será considerada sucesso simplesmente se estiver lotada.

Será sucesso se:

1. quórum for atingido;
2. evento for confirmado sem exposição indevida;
3. sistema suportar as vendas;
4. portaria funcionar;
5. finanças fecharem;
6. estoque for reconciliado;
7. DRE for confiável;
8. sócios conseguirem acertar contas rapidamente;
9. público demonstrar satisfação;
10. uma parcela relevante iniciar o próximo ciclo.

---

# 97. VISÃO FINAL

A Diretoria deixará de funcionar como:

> **uma festa que precisa torcer para vender.**

Passará a funcionar como:

> **uma comunidade que determina quando existe demanda suficiente para uma festa economicamente segura.**

O software controla:

**demanda → dinheiro → risco → produção → acesso → operação → resultado → recorrência.**

Esse será o diferencial estrutural da nova Diretoria.

---

# 98. REGRA CANÔNICA DO PROJETO

Toda funcionalidade proposta no futuro deverá responder pelo menos uma destas perguntas:

### Ela aumenta aquisição?

### Ela aumenta conversão?

### Ela reduz risco?

### Ela melhora experiência?

### Ela aumenta receita?

### Ela reduz custo?

### Ela melhora controle?

### Ela aumenta retenção?

Se não fizer nenhuma dessas coisas:

não é prioridade.

---

# 99. PRÓXIMA ETAPA DO PROJETO

Com este Blueprint Mestre aprovado, o desenvolvimento deve avançar nesta ordem:

### 1. `goal.md`

Objetivo canônico e regras não negociáveis.

### 2. Arquitetura funcional

Mapa completo dos módulos e suas relações.

### 3. Modelo de dados

Entidades, estados e relacionamentos.

### 4. UX Flow

Tela por tela.

### 5. Backlog V1

Epics, stories e critérios de aceite.

### 6. Arquitetura técnica

Stack e infraestrutura.

### 7. HML

Construção.

### 8. Testes

### 9. Produção.

---

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
