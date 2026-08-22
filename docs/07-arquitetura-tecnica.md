# ARQUITETURA TÉCNICA — DIRETORIA

**Documento:** Arquitetura Técnica V0.1  
**Objetivo:** definir uma arquitetura implementável sem acoplar as regras do produto a um fornecedor específico.

# 1. Princípios

- domínio financeiro no backend;
- PostgreSQL como fonte transacional;
- TypeScript ponta a ponta é a recomendação de baseline;
- aplicações separadas por superfície, código de domínio compartilhado;
- integrações externas por adapters;
- jobs assíncronos idempotentes;
- outbox/eventos para efeitos pós-transação;
- migrations versionadas;
- observabilidade desde a primeira entrega;
- zero segredos no repositório;
- DEV → HML → PROD;
- portaria resiliente à perda da internet externa.

# 2. Topologia recomendada

```text
                    ┌────────────────────┐
                    │   Site / PWA Web   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  API / Backend     │
                    │  Domain Services   │
                    └──┬──────┬──────┬───┘
                       │      │      │
             ┌─────────▼┐ ┌──▼────┐ ┌▼──────────┐
             │PostgreSQL│ │ Queue │ │  Storage  │
             └──────────┘ └──┬────┘ └───────────┘
                              │
        ┌─────────────────────┼────────────────────┐
        ▼                     ▼                    ▼
   Pagamentos            Mensageria            Analytics

Evento:
Nuvem/API ↔ Gateway local ↔ Wi-Fi interno ↔ Scanners PWA
                 │
              SQLite/local store
```

# 3. Estrutura de repositório recomendada

```text
/apps
  /web          site público + área do membro
  /admin        painel administrativo
  /gate         scanner/portaria PWA
  /gateway      serviço local do evento
  /worker       jobs assíncronos
/packages
  /domain       regras e casos de uso
  /db           schema, migrations, repositories
  /contracts    DTOs/eventos/OpenAPI
  /payments     adapters
  /messaging    adapters WhatsApp/e-mail/push
  /analytics    eventos de telemetria
  /ui           componentes compartilhados
  /config       validação de configuração sem segredos versionados
/docs
/relatorios
```

Monorepo é recomendado para preservar contratos e reduzir divergência entre web/admin/gate.

# 4. Frontend

Baseline recomendada:

- framework web React/Next.js ou equivalente maduro;
- TypeScript strict;
- PWA para membro e portaria;
- server rendering onde beneficia aquisição/SEO;
- cliente nunca decide `paid`, `VIAVEL`, `CONFIRMADO`, saldo ou check-in final;
- cache deve ser explicitamente invalidado em telas financeiras.

# 5. Backend

Organizar por módulos de domínio:

- identity;
- events;
- commerce;
- quorum;
- finance;
- ticketing;
- operations;
- inventory;
- crm;
- notifications;
- reporting;
- audit.

Casos de uso expõem comandos, não edição arbitrária de tabelas.

Exemplo:

`ConfirmEvent(eventId, actorId)`

internamente:

1. lock da edição;
2. snapshot atual;
3. GO/NO-GO;
4. checklist;
5. status atual;
6. transição;
7. histórico/auditoria;
8. outbox;
9. commit.

# 6. Banco

PostgreSQL.

Regras:

- UUID para IDs principais;
- `NUMERIC` para dinheiro;
- `TIMESTAMPTZ` para fatos temporais;
- índices parciais para unicidades condicionais;
- FK sempre que domínio permitir;
- constraints no banco para invariantes simples;
- transações/locks para invariantes concorrentes;
- append-only para auditoria/ledger/snapshots.

# 7. Migrations

- migration por mudança;
- nunca alterar schema manualmente em PROD;
- migration aplicada primeiro em HML;
- migrations destrutivas exigem estratégia expand/migrate/contract;
- backup/snapshot antes de mudança crítica.

# 8. Transações críticas

Obrigatoriamente atômicas:

- confirmar pagamento;
- gerar crédito;
- converter crédito em ticket;
- transferir ticket;
- consumir ticket;
- pagamento pessoal de despesa + adiantamento;
- confirmar edição;
- reversão financeira.

# 9. Idempotência

Aplicar em:

- webhooks;
- criação de cobrança;
- jobs;
- emissão de ticket;
- notificações transacionais quando necessário;
- sync offline;
- importações de PDV.

Toda integração externa deve possuir chave externa/idempotency key quando disponível.

# 10. Eventos e Outbox

Após commit de fatos transacionais, efeitos secundários devem sair via outbox/queue.

Exemplo:

`PAYMENT_CONFIRMED`

→ validar crédito  
→ recalcular quórum  
→ atualizar CRM  
→ notificar  
→ analytics.

O pagamento não pode depender do sucesso da notificação para ser confirmado.

# 11. Fila/worker

Jobs:

- recálculo de quórum;
- notificações;
- conciliações/importações;
- relatórios;
- sync externo;
- tarefas de manutenção.

Requisitos:

- retry com backoff;
- dead-letter/estado failed;
- idempotência;
- correlation id;
- visibilidade no painel de saúde.

# 12. Pagamentos

Criar interface `PaymentProvider`.

Responsabilidades:

- createCharge;
- getStatus;
- refund;
- verifyWebhook;
- normalizeEvent.

A regra de negócio não deve conhecer detalhes do gateway.

Gateway definitivo permanece decisão aberta.

# 13. Mensageria

Criar interfaces por canal:

- WhatsApp;
- e-mail;
- push.

Templates versionados.

Separar transacional de marketing.

Falha de mensagem não altera o fato financeiro que originou a comunicação.

# 14. Analytics

Telemetria separada do domínio.

Eventos transacionais podem ser espelhados para analytics depois do commit.

Nunca usar plataforma de analytics para calcular:

- pagamento pago;
- capital protegido;
- DRE;
- check-in oficial.

# 15. Storage

Usar object storage compatível com URLs assinadas para:

- contratos;
- evidências;
- acervo;
- anexos;
- relatórios exportados.

Metadados ficam no PostgreSQL.

# 16. Portaria — arquitetura local

Componentes:

- `gate` PWA nos dispositivos;
- `gateway` local na rede do evento;
- banco/local store do gateway;
- sincronização com nuvem.

Antes do evento, o gateway recebe conjunto de tickets/autorização necessário.

Durante queda de internet:

- scanners continuam na rede local;
- consumo é serializado/validado pelo gateway;
- duplicidade é bloqueada;
- eventos recebem `local_event_id`;
- fila local aguarda sincronização.

Quando internet volta:

- upload idempotente;
- reconciliation de eventos;
- conflitos visíveis.

# 17. Segurança do gateway

- credencial por evento/dispositivo;
- rede local protegida;
- allowlist/revogação de dispositivos;
- armazenamento local mínimo;
- dados pessoais reduzidos;
- logs locais sem segredos;
- pacote de autorização com validade limitada à edição.

# 18. Autenticação e autorização

- sessão segura;
- cookies HTTP-only quando aplicável;
- CSRF conforme arquitetura;
- rate limiting em login/checkout/scanner APIs;
- RBAC no backend;
- scanner com escopo mínimo;
- ações financeiras de maior risco podem exigir reautenticação/MFA posteriormente.

# 19. Dados sensíveis

- não armazenar PAN/cartão completo;
- documentos pessoais protegidos;
- dados bancários de fornecedores protegidos;
- tokens criptografados/secret store;
- payloads de webhook com política de minimização/retenção;
- logs sanitizados.

# 20. Subledger financeiro

Recomendado desde a V1 do núcleo financeiro.

Modelo:

`financial_transactions` + `financial_postings`.

Benefícios:

- reversão em vez de edição;
- rastreabilidade;
- caixa em formação separado;
- recebíveis;
- adiantamentos;
- DRE reproduzível.

Regra:

`SUM(debits) == SUM(credits)` por transação.

# 21. API

Recomendação:

- API HTTP tipada para comandos/queries;
- contrato OpenAPI ou schema equivalente;
- endpoints externos versionados;
- erros com códigos de domínio.

Exemplo:

`EVENT_CONFIRMATION_BLOCKED`

payload com motivos estruturados.

# 22. Observabilidade

Obrigatório:

- structured logs;
- correlation/request id;
- error tracking;
- métricas de API;
- fila/jobs;
- webhooks;
- pagamentos;
- notificações;
- gateway/scanners;
- sincronização offline.

Alertas críticos:

- webhook falhando;
- fila parada;
- erro de payment confirmation;
- divergência de ledger;
- gateway local desconectado antes/durante evento;
- sync acumulado.

# 23. Backup e recuperação

- backup automatizado de PostgreSQL;
- retenção definida antes de produção;
- restore testado em HML;
- snapshot antes de migration crítica;
- object storage versionado quando possível;
- export do pacote de autorização da portaria antes do evento.

# 24. Deploy

Pipeline:

`branch/PR → checks → preview/DEV → HML → testes/gates → promoção para PROD`

Sem deploy manual de arquivos isolados como fluxo normal.

# 25. Feature flags

Usar para funcionalidades de risco/lançamento gradual, especialmente:

- pagamentos reais;
- transferência;
- portaria offline;
- novos gateways;
- integração PDV.

# 26. Ambientes

## DEV
Dados fictícios; gateways sandbox/mock.

## HML
Cópia funcional da arquitetura; dados sintéticos; integrações sandbox; teste de migrations e fluxo completo.

## PROD
Somente após gates do plano de testes.

# 27. Dados de teste

Criar seed determinístico:

- edição abaixo do quórum;
- 400 créditos válidos;
- cenário 641 créditos;
- pagamento duplicado;
- reembolso;
- GO e NO_GO;
- ticket ativo/transferido/usado;
- adiantamento;
- estoque com divergência.

# 28. Arquitetura do primeiro vertical slice

Implementar:

- `admin` mínimo;
- backend/domain;
- PostgreSQL;
- worker/outbox;
- payment mock/sandbox adapter;
- audit;
- observabilidade.

Ainda não implementar gateway offline, bar completo ou site premium.

# 29. Decisões técnicas abertas

- provedor de cloud/hosting;
- gateway de pagamento;
- provedor WhatsApp;
- e-mail;
- queue/Redis/provider;
- object storage;
- auth provider versus auth própria;
- observability vendor;
- hardware/topologia final do gateway local.

Registrar decisões em `10-decisoes-abertas.md` antes de acoplar código.

# 30. Definition of Done técnico

Uma feature não está pronta se faltar:

- autorização;
- validação de entrada;
- tratamento de erro;
- teste unitário de regra crítica;
- teste de integração quando transacional;
- auditoria quando crítica;
- observabilidade;
- migration quando necessária;
- documentação/relatório;
- validação em HML.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
