# BACKLOG V1 — DIRETORIA

**Documento:** Backlog V1 V0.1  
**Objetivo:** converter Blueprint, Goal, Arquitetura Funcional, Modelo de Dados e UX Flow em uma ordem executável de desenvolvimento.

## Convenções

- **P0:** bloqueia um gate obrigatório.
- **P1:** necessário para a primeira edição, mas pode entrar depois do primeiro vertical slice.
- **P2:** melhoria posterior à primeira validação.
- Cada story só é `DONE` quando código, testes, autorização, auditoria e documentação pertinente estiverem concluídos.

# EPIC E00 — Fundação do repositório e ambientes

### DIR-0001 — Estruturar repositório
**P0**  
Criar estrutura de aplicações/pacotes, documentação, migrations e relatórios.  
**Aceite:** build reproduzível; `goal.md` e `AGENTS.md` na raiz; pasta `relatorios/`; nenhum segredo versionado.

### DIR-0002 — Ambientes DEV/HML/PROD
**P0**  
**Aceite:** configurações isoladas; HML não usa credenciais/recursos produtivos; indicador visual de ambiente no admin.

### DIR-0003 — Gestão de segredos
**P0**  
**Aceite:** segredos externos ao código; rotação possível; logs sanitizados.

### DIR-0004 — CI
**P0**  
**Aceite:** lint, typecheck, testes e migration check antes de merge/deploy.

### DIR-0005 — Observabilidade base
**P0**  
**Aceite:** erros backend/frontend, jobs e webhooks rastreáveis por correlation id.

# EPIC E01 — Identidade, acesso, RBAC e auditoria

### DIR-0101 — Profiles/customer_id
**P0**  
**Aceite:** lead pode existir sem conta; e-mail/telefone normalizados; duplicidade básica bloqueada.

### DIR-0102 — Autenticação
**P0**  
**Aceite:** cadastro, login, recuperação; senha nunca em texto puro.

### DIR-0103 — RBAC
**P0**  
**Aceite:** Super Admin, Financeiro, Produção, Marketing, Atendimento, Portaria Supervisor, Scanner e Bar; backend valida permissões.

### DIR-0104 — Consentimentos
**P0 para anúncio/pagamento**  
**Aceite:** versão, finalidade, origem e revogação registráveis.

### DIR-0105 — Audit log append-only
**P0**  
**Aceite:** alteração crítica registra ator, antes/depois, horário e entidade; usuário comum não edita/apaga log.

# EPIC E02 — Núcleo de edição

### DIR-0201 — Criar edição em PLANEJAMENTO
**P0**  
**Aceite:** código único; timezone; capacidade; nenhuma edição nasce confirmada.

### DIR-0202 — Máquina de estados
**P0**  
**Aceite:** transições somente por comandos válidos; histórico obrigatório; dropdown livre de status proibido.

### DIR-0203 — Configuração financeira versionada
**P0**  
**Aceite:** ticket, taxa, custo variável, contingência e exposição; alteração cria nova versão.

### DIR-0204 — Locais candidatos
**P1**  
**Aceite:** candidatos, negociação, selecionado; no máximo um local final selecionado.

# EPIC E03 — Custos, receitas garantidas e motor de quórum

### DIR-0301 — Custos protegidos
**P0**  
**Aceite:** estimado/aprovado, categoria, protegido, status; mudanças aprovadas auditadas.

### DIR-0302 — Receitas garantidas
**P0**  
**Aceite:** prometido não conta por padrão; elegibilidade explícita; bar não pode ser fonte elegível.

### DIR-0303 — Motor de quórum
**P0**  
**Aceite:** calcula necessidade, capital protegido, déficit/superávit, quórum mínimo e status; arredondamento para cima.

### DIR-0304 — Snapshots imutáveis
**P0**  
**Aceite:** todo recálculo relevante gera snapshot com gatilho e versão financeira.

### DIR-0305 — Recalcular por eventos
**P0**  
**Aceite:** pagamento, reembolso, chargeback, custo e receita elegível disparam recálculo idempotente.

### DIR-0306 — Simulador separado
**P1**  
**Aceite:** simulação visualmente identificada; não altera verdade oficial sem aprovação formal.

# EPIC E04 — Site, CRM e aquisição

### DIR-0401 — Home reativa por estado
**P0 antes do primeiro anúncio**  
**Aceite:** CTA e mensagem mudam por fase; nenhum estado falso de confirmação.

### DIR-0402 — Captura de lead
**P0 antes do primeiro anúncio**  
**Aceite:** nome/contato; UTM/referral; consentimento; cria/consolida profile.

### DIR-0403 — CRM básico
**P0 antes do primeiro anúncio**  
**Aceite:** lista, perfil, origem, estágio e timeline.

### DIR-0404 — Analytics mínimos
**P0 antes do primeiro anúncio**  
**Aceite:** eventos do Goal; analytics não altera dados transacionais.

### DIR-0405 — Acervo básico
**P0 antes do primeiro anúncio**  
**Aceite:** upload/referência, tags, evento, direitos/status de uso.

# EPIC E05 — Club, checkout, pagamentos e créditos

### DIR-0501 — Oferta Club
**P0 antes do primeiro pagamento**  
**Aceite:** chama produto de crédito antes de confirmação; apresenta política vigente.

### DIR-0502 — Checkout
**P0**  
**Aceite:** Pix/cartão via adapter; tentativa gera `created/pending`; dupla submissão bloqueada.

### DIR-0503 — Webhook seguro/idempotente
**P0**  
**Aceite:** assinatura validada; `gateway_event_id` único; webhook repetido produz um efeito.

### DIR-0504 — PAYMENT_CONFIRMED
**P0**  
**Aceite:** somente backend muda para paid; gera evento, crédito e fato financeiro atomicamente.

### DIR-0505 — Crédito válido
**P0**  
**Aceite:** vinculado a profile+event+origem; pagamento pending nunca gera crédito valid.

### DIR-0506 — Reembolso
**P0 antes de pagamento real**  
**Aceite:** fluxo auditado; crédito perde elegibilidade; quórum recalcula.

### DIR-0507 — Chargeback
**P1**  
**Aceite:** mesmo efeito de proteção conforme regra; alerta financeiro.

### DIR-0508 — Carteira do membro
**P1**  
**Aceite:** separa créditos de ingressos e mostra estado real.

# EPIC E06 — GO/NO-GO e confirmação

### DIR-0601 — Checklist administrativo
**P0 antes de confirmar**  
**Aceite:** data, local, capacidade, orçamento e itens críticos obrigatórios configuráveis.

### DIR-0602 — Review GO/NO-GO
**P0**  
**Aceite:** usa snapshot atual; futuras vendas = zero; bar = zero; exposição calculada vs autorizada.

### DIR-0603 — Bloqueio de confirmação
**P0**  
**Aceite:** abaixo da condição ou checklist incompleto retorna razões e não altera estado.

### DIR-0604 — Confirmar edição atomicamente
**P0**  
**Aceite:** revalida tudo no backend; grava histórico/auditoria; dispara `EVENT_CONFIRMED`.

### DIR-0605 — Revalidação contra tela desatualizada
**P0**  
**Aceite:** se quórum cair entre carregar e confirmar, backend bloqueia.

# EPIC E07 — Venda pública, lotes e ingressos

### DIR-0701 — Lotes
**P1**  
**Aceite:** sequência, preço, limite, janela, gatilho por quantidade/data/híbrido.

### DIR-0702 — Checkout público
**P1**  
**Aceite:** somente edição confirmada; pagamento confirmado gera ticket, não membership fundador.

### DIR-0703 — Conversão crédito→ticket
**P1**  
**Aceite:** atomicamente; um crédito não gera dois tickets ativos.

### DIR-0704 — Ticket/token
**P1**  
**Aceite:** token imprevisível/assinado ou hash único; sem PII legível no QR.

### DIR-0705 — Área “Meu ingresso”
**P1**  
**Aceite:** status, QR e orientações; ticket bloqueado/cancelado não se apresenta como válido.

### DIR-0706 — Transferência
**P1**  
**Aceite:** operação atômica; QR anterior invalidado; dois tickets válidos nunca coexistem.

# EPIC E08 — Produção e financeiro operacional

### DIR-0801 — Fornecedores
**P1**  
**Aceite:** cadastro, histórico e categoria.

### DIR-0802 — Contratos
**P1**  
**Aceite:** valor, sinal, saldo, vencimentos, documento e status.

### DIR-0803 — Tarefas de produção
**P1**  
**Aceite:** responsável, prazo, categoria, estado e evidência.

### DIR-0804 — Despesas
**P1**  
**Aceite:** planned/approved/partial/paid/cancelled/overdue; não confundir planejado com obrigação.

### DIR-0805 — Pagamento de despesa
**P1**  
**Aceite:** canal e pagador registrados.

### DIR-0806 — Adiantamento automático
**P1**  
**Aceite:** pagamento pessoal gera obrigação em conta-corrente na mesma transação.

### DIR-0807 — Conta-corrente por pessoa
**P1**  
**Aceite:** saldo derivado de movimentos; não editável diretamente.

# EPIC E09 — Conciliação e subledger

### DIR-0901 — Subledger financeiro
**P0 recomendado / P1 mínimo**  
**Aceite:** transações imutáveis; correção por reversão; débitos = créditos.

### DIR-0902 — Conciliação por canal
**P1**  
**Aceite:** bruto, taxa, cancelamento, esperado, recebido, diferença.

### DIR-0903 — Divergências
**P1**  
**Aceite:** diferença nunca desaparece sem resolução registrada.

# EPIC E10 — Portaria, offline e Live

### DIR-1001 — Emissão/registro de dispositivos
**P1 antes do evento**  
**Aceite:** dispositivo ligado a edição; revogável; heartbeat.

### DIR-1002 — Scanner PWA
**P1**  
**Aceite:** câmera + resultado; RBAC mínimo; sem financeiro.

### DIR-1003 — Consumo atômico
**P1**  
**Aceite:** dois scans simultâneos resultam em um único check-in válido.

### DIR-1004 — Resultado verde/vermelho/amarelo
**P1**  
**Aceite:** texto + feedback; motivo operacional.

### DIR-1005 — Gateway local
**P1 crítico**  
**Aceite:** operação local sem internet externa; base autorizada; sincronização entre scanners.

### DIR-1006 — Sync idempotente
**P1 crítico**  
**Aceite:** `device_id+local_event_id` único; conflitos registrados.

### DIR-1007 — Diretoria Live
**P1**  
**Aceite:** entradas, ocupação, scanners e alertas; leitura operacional.

### DIR-1008 — Ocorrências
**P1**  
**Aceite:** tipo, severidade, responsável, ação e estado.

# EPIC E11 — Bar e estoque

### DIR-1101 — Produtos/locais
**P1**  
**Aceite:** SKU, unidade, locais de estoque.

### DIR-1102 — Movimentos de estoque
**P1**  
**Aceite:** compra, consignação, transferências, venda, cortesia, perda, quebra, devolução e ajuste.

### DIR-1103 — Contagem de abertura/fechamento
**P1**  
**Aceite:** sistema x contado; diferença justificada.

### DIR-1104 — Importação de PDV
**P1**  
**Aceite:** origem + external id idempotente.

### DIR-1105 — CMV e resultado do bar
**P1**  
**Aceite:** receita, CMV, equipe/perdas/taxas; separado do quórum.

# EPIC E12 — Fechamento, DRE, relatório e retenção

### DIR-1201 — Central de fechamento
**P1**  
**Aceite:** checklist sequencial com pendências visíveis.

### DIR-1202 — DRE provisória
**P1**  
**Aceite:** reproduzível dos fatos; marcada como provisória.

### DIR-1203 — Acerto dos sócios
**P1**  
**Aceite:** mostra obrigações/prestações de conta antes de saldo distribuível.

### DIR-1204 — DRE final
**P1**  
**Aceite:** exige gates de fechamento; versão imutável/finalizada.

### DIR-1205 — Relatório final
**P1**  
**Aceite:** público, receitas, custos, resultado, bar, CAC, ROAS, quórum, presença, indicação e aprendizados.

### DIR-1206 — Retenção
**P1**  
**Aceite:** segmentos pós-evento; próxima lista/crédito; recorrência medida.

# GATES DE NEGÓCIO

## GATE A — Primeiro anúncio
Obrigatório: DIR-0001..0005, DIR-0101/0104, DIR-0401..0405 e monitoramento mínimo.

## GATE B — Primeiro pagamento real
Obrigatório: identidade/autenticação, checkout, gateway adapter, webhook idempotente, crédito, reembolso, políticas/termos, logs, backup e painel financeiro.

## GATE C — Confirmar festa
Obrigatório: motor validado, custos, receitas, config, checklist, local/data/capacidade, GO/NO-GO e auditoria.

## GATE D — Dia do evento
Obrigatório: ticketing, transferência, scanners, gateway local, contingência offline, testes de concorrência/carga, produção e financeiro operacional.

## GATE E — Encerramento
Obrigatório: conciliação, estoque, adiantamentos, recebíveis, DRE e acerto de sócios.

# ORDEM DO PRIMEIRO VERTICAL SLICE

1. E00 Fundação
2. E01 Identidade/RBAC/Auditoria
3. E02 Edição/configuração
4. E03 Custos/receitas/quórum
5. E05 pagamento HML/crédito/reembolso
6. E06 GO/NO-GO/confirmar
7. testes do `08-plano-hml-e-testes.md`

Esse slice deve provar a tese antes do restante da interface pública.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
