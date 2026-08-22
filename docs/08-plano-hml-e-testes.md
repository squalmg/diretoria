# PLANO HML E TESTES — DIRETORIA

**Documento:** Plano de Homologação e Testes V0.1

# 1. Objetivo

Garantir que nenhuma regra crítica do Diretoria seja validada apenas por inspeção visual.

A homologação deverá testar domínio, banco, concorrência, integrações, permissões, UX e recuperação de falhas.

# 2. Gates

## HML-G0 — Fundação
- build/deploy reproduzível;
- migrations limpas;
- segredos ausentes do código;
- logs funcionando;
- backup/restore básico validado.

## HML-G1 — Núcleo financeiro
- pagamentos idempotentes;
- créditos;
- quórum;
- reembolso;
- snapshot;
- GO/NO-GO;
- auditoria.

## HML-G2 — Primeiro pagamento real
- gateway sandbox aprovado;
- webhook assinado;
- política/termos;
- falhas/retry;
- painel financeiro;
- refund testado.

## HML-G3 — Confirmação
- checklist;
- revalidação server-side;
- tela desatualizada não contorna gate;
- emissão de tickets idempotente.

## HML-G4 — Evento
- scanner;
- concorrência;
- offline;
- gateway local;
- sync;
- carga;
- plano de contingência.

## HML-G5 — Fechamento
- estoque;
- conciliação;
- adiantamentos;
- DRE;
- relatório.

# 3. Testes obrigatórios — domínio

### TST-DOM-001 Pagamento pending
**Dado** pagamento pending  
**Quando** quórum recalcula  
**Então** capital protegido não muda.

### TST-DOM-002 Webhook triplo
Mesmo evento chega três vezes.  
**Esperado:** um efeito financeiro, um crédito.

### TST-DOM-003 Reembolso
Crédito válido reembolsado.  
**Esperado:** deixa quórum e novo snapshot é criado.

### TST-DOM-004 Bar esperado
Adicionar previsão de R$40.000 de bar.  
**Esperado:** quórum não muda.

### TST-DOM-005 VIAVEL não confirmado
Quórum atingido com checklist incompleto.  
**Esperado:** status financeiro VIAVEL; edição não CONFIRMADO.

### TST-DOM-006 NO_GO
Exposição necessária > autorizada.  
**Esperado:** confirmação bloqueada.

### TST-DOM-007 Reembolso entre tela e clique
Admin carrega tela elegível; reembolso reduz capital; admin confirma.  
**Esperado:** backend recusa.

### TST-DOM-008 Crédito duplicado
Mesmo payment não gera dois créditos ativos.

### TST-DOM-009 Conversão duplicada
Mesmo crédito não gera dois tickets ativos.

### TST-DOM-010 Transferência
Ticket antigo deixa de ser válido antes do novo tornar-se consumível.

### TST-DOM-011 Scan simultâneo
Dois scanners consomem mesmo QR.  
**Esperado:** um valid, outro already-used/invalid.

### TST-DOM-012 Adiantamento
Pessoa paga R$600.  
**Esperado:** despesa + adiantamento + conta-corrente na mesma operação.

### TST-DOM-013 Reversão financeira
Erro em lançamento.  
**Esperado:** lançamento original preservado; reversal criado.

### TST-DOM-014 Estoque
Ajuste exige movimento/contagem; saldo não é editável diretamente.

### TST-DOM-015 DRE final
Com pendência de conciliação obrigatória.  
**Esperado:** finalização bloqueada.

# 4. Testes de cálculo do quórum

Cenário referência:

- custos: R$70.000;
- contingência: R$10.500;
- garantidas: R$10.000;
- necessidade: R$70.500;
- contribuição líquida: R$110;
- quórum: 641.

Validar:

- 0 → NAO_VIAVEL;
- 400 → R$44.000;
- 640 → abaixo da necessidade;
- 641 → R$70.510, mínimo VIAVEL;
- reembolso de 1 → volta abaixo do limite conforme regra.

# 5. Testes de propriedades/invariantes

Gerar combinações de pagamentos, refunds e custos e verificar sempre:

- capital protegido nunca inclui pending;
- capital protegido nunca inclui bar esperado;
- quórum mínimo usa ceil;
- protected_value não é negativo;
- ticket válido não tem dois check-ins válidos;
- ledger balanceia.

# 6. Testes de integração

- PostgreSQL real em ambiente de teste;
- migrations do zero;
- payment adapter sandbox/mock;
- webhook HTTP real;
- queue/worker;
- storage quando usado;
- notificações em sandbox.

# 7. Testes de autorização

Matriz mínima:

- Scanner não lê financeiro;
- Marketing não confirma evento;
- Produção não executa reembolso;
- Financeiro não recebe permissão de Super Admin implicitamente;
- apenas papel autorizado confirma edição;
- audit logs não são editáveis.

# 8. Testes de UX

- loading não aparece como zero;
- erro de cálculo mostra indisponibilidade;
- botão bloqueado explica motivo;
- pagamento pending não mostra sucesso;
- VIAVEL e CONFIRMADO têm comunicação distinta;
- modo offline informa operação local saudável;
- portaria não depende só de cor.

# 9. Testes de concorrência

Obrigatórios:

- webhook simultâneo;
- dois refunds concorrentes;
- duas conversões do mesmo crédito;
- duas transferências;
- dois scans;
- confirmação concorrente com alteração de custo/reembolso.

Usar locks/constraints e verificar resultado final no banco.

# 10. Testes de carga

Antes do evento real:

- bursts de scans;
- picos de venda/checkout;
- múltiplos webhooks;
- atualização do Live;
- sync offline acumulado.

A meta de carga será definida quando capacidade da primeira edição estiver decidida. Até lá, testar múltiplos da capacidade planejada em HML.

# 11. Teste offline da portaria

Cenário:

1. gateway sincronizado;
2. cortar internet externa;
3. manter Wi-Fi local;
4. processar tickets em 2+ scanners;
5. tentar duplicidade;
6. acumular eventos;
7. restaurar internet;
8. sincronizar;
9. validar ausência de duplicação.

# 12. Teste de falha do gateway local

Simular:

- reinício;
- perda de energia;
- restauração;
- preservação de eventos já consumidos;
- scanners reconectando.

Plano físico de redundância será definido mais perto do evento.

# 13. Backup/restore

Antes de produção:

- restaurar backup em ambiente isolado;
- validar payments/credits/audit/ledger;
- medir procedimento;
- documentar passo a passo.

# 14. Segurança

- secrets scan;
- dependências vulneráveis;
- rate limiting;
- autenticação;
- autorização server-side;
- CSRF/session conforme stack;
- payload validation;
- PII em logs;
- URLs assinadas de arquivos;
- QR sem PII.

# 15. Testes de fechamento

Criar evento sintético com:

- vendas gateway;
- Pix;
- maquininha;
- despesa da empresa;
- despesa paga por sócio;
- bar;
- perda;
- conciliação com diferença.

Validar DRE provisória, resolução e DRE final.

# 16. Evidência de homologação

Cada gate deverá gerar relatório em `relatorios/` contendo:

- build/commit;
- ambiente;
- testes executados;
- resultados;
- erros;
- evidências;
- pendências;
- decisão GO/NO-GO para promoção.

# 17. Regra de promoção

PROD só recebe versão homologada em HML.

Exceção emergencial futura deverá possuir procedimento próprio, auditoria e pós-validação; não faz parte do fluxo normal.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
