# LEIA PRIMEIRO — Diretoria

**Projeto:** Diretoria  
**Produto inicial:** Diretoria Club  
**Pacote documental:** V0.1  
**Data-base:** 21/08/2026

Este diretório é a fonte documental do desenvolvimento. Antes de modificar código, banco, UX ou regras de negócio, ler os documentos na ordem abaixo.

## Ordem de leitura obrigatória

1. `02-goal.md` — regras canônicas e objetivo.
2. `01-blueprint-mestre-diretoria.md` — visão completa do produto e operação.
3. `03-arquitetura-funcional.md` — domínios, responsabilidades e fluxos.
4. `04-modelo-de-dados.md` — entidades, integridade e fatos transacionais.
5. `05-ux-flow.md` — jornadas, telas e bloqueios de interface.
6. `06-backlog-v1.md` — ordem de implementação e critérios de aceite.
7. `07-arquitetura-tecnica.md` — desenho técnico de referência.
8. `08-plano-hml-e-testes.md` — validação antes de produção.
9. `09-roadmap-implementacao.md` — incrementos de entrega.
10. `10-decisoes-abertas.md` — pontos que não podem ser inventados.
11. `11-matriz-rastreabilidade.md` — ligação entre regras, backlog e testes.
12. `relatorios/` — ler o relatório mais recente antes de continuar qualquer execução.

## Hierarquia de autoridade

Quando houver conflito:

`goal.md` → Blueprint → Arquitetura Funcional → Modelo de Dados → UX Flow → Backlog → Arquitetura Técnica → implementação.

Uma decisão posterior formalmente registrada em `10-decisoes-abertas.md` como **DECIDIDA** pode atualizar os documentos anteriores, desde que os documentos canônicos também sejam revisados.

## Regras que nunca devem ser esquecidas

- quórum é financeiro;
- pagamento pendente não aumenta quórum;
- frontend não confirma pagamento;
- bar esperado não financia viabilidade;
- `VIÁVEL != CONFIRMADO`;
- GO/NO-GO negativo bloqueia confirmação;
- capital protegido não é lucro;
- transferência não duplica ingresso;
- ticket só pode ser consumido uma vez;
- internet externa não pode ser ponto único de falha da portaria;
- despesa pessoal gera conta-corrente;
- edição só encerra depois de conciliação e DRE;
- ações críticas são auditáveis;
- DEV/HML antes de produção;
- segredos nunca no código.

## Regra de continuidade

Antes de iniciar uma nova tarefa técnica:

1. ler `02-goal.md`;
2. ler `relatorios/STATUS-ATUAL.md` ou o relatório mais recente;
3. identificar o item do backlog;
4. confirmar dependências;
5. executar em DEV/HML;
6. testar;
7. registrar resultado em `relatorios/`.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
