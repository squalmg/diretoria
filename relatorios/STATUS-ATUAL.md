# STATUS ATUAL — DIRETORIA

**Data:** 22/08/2026  
**Fase:** Incremento 3 — Club e preparação para pagamento real  
**Estado:** **FUNDAÇÃO TÉCNICA PRÉ-PAGAMENTO CONCLUÍDA; DINHEIRO REAL CONTINUA BLOQUEADO POR DECISÕES EXTERNAS**

## Repositório

- GitHub: `squalmg/diretoria`;
- branch principal: `main`;
- Fundação/HML-G0: **APROVADOS**;
- núcleo econômico: **APROVADO**;
- Incremento 2 técnico — aquisição/CRM/pré-anúncio: **CONCLUÍDO**;
- Incremento 3: **em andamento, com conta/Club/checkout-intent/notificações/policies já estruturados**.

Merges recentes do Incremento 3:

- PR #13 — autenticação pública + carteira HML: `8b2c9dfb3a8d43a63a69bf949981248f704b3cc2`;
- PR #14 — oferta Club + checkout intent neutro: `ebc19e8357435cb91b634f0eef1e3b5f6c2e8dff`;
- PR #15 — fundação provider-neutral de notificações: `f9402af6c33c8fbb70f5613d92c80786d8121611`;
- PR #16 — contrato seguro de gateway provider-neutral: `84460ea96d8ece15b13639113c8c3261bfe0686b`;
- PR #17 — políticas versionadas + gate de aceite: `bd9c4fddd87f0437f801f9dfb546ff109dfacaa9`.

## HML canônico

### Supabase

- projeto/ref: `heckakjcpwomoucobtau`;
- região: `sa-east-1`;
- migrations aplicadas: `0001–0022`;
- Edge `diretoria-admin-api`: ACTIVE;
- Edge `diretoria-admin-write-api`: ACTIVE;
- Edge `diretoria-public-api`: ACTIVE;
- Edge `diretoria-crm-api`: ACTIVE;
- Edge `diretoria-pre-ad-api`: ACTIVE;
- Edge `diretoria-member-api`: ACTIVE.

### Admin HML

- URL: `https://diretoria-hml.vercel.app`;
- `/`: portal HML;
- `/writes.html`: console econômica;
- `/crm.html`: CRM / Perfil 360;
- `/pre-ad.html`: analytics/acervo/gate pré-anúncio.

### Public HML

- URL: `https://diretoria-public-hml.vercel.app`;
- `/`: reativação + lista de espera + consent mode;
- `/account.html`: cadastro/login/recuperação + carteira read-only;
- `/club.html`: oferta Club HML e preparação de checkout intent;
- `/api/health`: health público.

O Public HML continua marcado `noindex,nofollow` e não representa produção.

# O que já existe no Incremento 3

## 1. Conta pública / customer_id

- Supabase Auth HML;
- cadastro por e-mail/senha;
- login;
- recuperação de senha;
- identidade externa única por `auth_provider + provider_subject`;
- vínculo seguro `auth user → profile/customer_id → users`;
- lead existente só pode ser assumido por identidade compatível/verificada;
- conflitos de identidade bloqueados;
- criação de conta não promove lifecycle para membro;
- auditoria de criação/vínculo.

## 2. Minha Diretoria / carteira

- dados da conta;
- lifecycle atual;
- créditos existentes;
- histórico de pagamentos HML;
- ticketing explicitamente ainda não implementado;
- nenhum QR fabricado pela interface.

## 3. Oferta Diretoria Club

`PostgresClubCheckout` e `/club.html`:

- oferta somente em `FORMACAO`, `QUORUM_EM_ANDAMENTO` ou `VIAVEL`;
- valor vem de `event_financial_configs.founder_ticket_gross`;
- versão financeira fica explícita;
- sem config/preço válido, oferta bloqueada;
- antes de confirmação, produto continua sendo **crédito**, não ingresso.

## 4. Checkout intent

Migration `0019_checkout_intents`:

- profile/customer_id;
- edição;
- versão financeira;
- preço congelado;
- idempotency key;
- policy version/fingerprint possível;
- provider default `unconfigured`;
- status inicial `draft`.

Propriedade crítica validada:

> criar uma checkout intent NÃO cria `payment`, `credit`, membership ou capital protegido.

## 5. Contrato de gateway

`packages/payments/provider-contract.ts`:

- `PaymentProviderAdapter`;
- capabilities Pix/card/refund;
- criação de checkout normalizada;
- webhook normalizado;
- refund normalizado;
- valores em unidade mínima (`bigint`);
- `DisabledPaymentProvider` como fallback;
- registry fail-closed;
- adapter sem verificação de assinatura é recusado;
- webhook divergente em checkout/valor/moeda/provider/assinatura é bloqueado antes do core econômico.

**Nenhum gateway concreto foi escolhido ou acoplado.**

## 6. Notificações transacionais

Migrations `0020–0021`:

- templates versionados;
- um template ativo por code/channel;
- fila de notificações;
- variables;
- dedupe;
- agendamento;
- tentativas;
- `FOR UPDATE SKIP LOCKED` para claim concorrente;
- provider default `unconfigured`;
- fila transacional não aceita template marketing;
- nenhuma mensagem externa é enviada sem provider configurado.

## 7. Políticas e aceites

Migration `0022_policy_acceptance_gate`:

- documentos versionados;
- SHA-256 do conteúdo;
- `draft / active / retired`;
- uma versão ativa por code;
- conteúdo ativo/retirado é imutável;
- aceite por profile + documento + contexto;
- aceite append-only;
- bundle/fingerprint da política vigente;
- nova versão ativa faz o aceite antigo deixar de satisfazer o gate corrente.

**Nenhum texto jurídico real foi criado ou ativado.**

# Estado real do HML após as promoções

Consulta em 22/08/2026:

- checkout intents: **0**;
- notification templates: **0**;
- notifications: **0**;
- notification attempts: **0**;
- policy documents: **0**;
- policy acceptances: **0**;
- pagamentos com gateway diferente de `mock`: **0**.

Isso confirma que a infraestrutura foi promovida sem efeito comercial real.

# Gates técnicos já comprovados

- pagamentos mock confirmados apenas no backend;
- webhook mock idempotente;
- crédito válido nasce de pagamento confirmado;
- reembolso reduz capital protegido;
- quórum recalcula;
- `VIAVEL != CONFIRMADO`;
- GO/NO-GO obrigatório;
- bar esperado não financia viabilidade;
- checkout intent não é pagamento;
- gateway desconhecido falha fechado;
- adapter real futuro precisa verificar assinatura;
- política vigente precisa ser aceita para o futuro gate de pagamento;
- notificações ficam na fila sem provider.

# Dependências externas que agora bloqueiam o primeiro pagamento real

## Obrigatórias

1. **Gateway definitivo** e credenciais sandbox;
2. **preço fundador/comercial definitivo**;
3. **política jurídica final**:
   - termos do Club;
   - política de não atingimento;
   - reembolso/rollover;
   - privacidade/marketing quando aplicável;
4. **provedor/canal transacional** para WhatsApp/e-mail, se for obrigatório no primeiro pagamento;
5. textos finais da oferta Club.

Nenhuma dessas decisões deve ser inventada no código.

# Ainda bloqueando o primeiro anúncio real

- política/textos jurídicos finais;
- IDs Meta/Google aprovados;
- domínio público definitivo;
- arquivos reais do acervo e direitos de uso;
- criativos/campanhas finais.

# Próximo passo de desenvolvimento após decisões externas

## Gateway sandbox

Quando o gateway for escolhido:

1. implementar adapter aderente a `PaymentProviderAdapter`;
2. configurar secrets somente no HML;
3. criar cobrança sandbox a partir de `checkout_intent`;
4. validar assinatura do webhook;
5. normalizar evento;
6. conferir checkout/valor/moeda/provider;
7. criar/atualizar `payment` no backend;
8. apenas `paid` gera crédito válido;
9. recalcular quórum;
10. enfileirar notificação transacional;
11. testar replay de webhook, refund e falhas;
12. somente após todos os gates avaliar produção.

## Policy gate

Antes da primeira cobrança real:

1. inserir textos reais como `draft`;
2. revisar juridicamente/comercialmente;
3. ativar versões aprovadas;
4. exibir o bundle vigente no checkout;
5. registrar aceite;
6. backend revalidar o fingerprint/aceite antes de criar cobrança.

# Progresso macro

- Incremento 0 — Fundação: **concluído**;
- Incremento 1 — Núcleo econômico: **concluído**;
- Incremento 2 — Reativação/aquisição técnico: **concluído**;
- Incremento 3 — Club/pagamento: **fundação pré-pagamento concluída; integração real bloqueada por decisões externas**;
- Incremento 4 — Confirmação/venda pública/ticketing: **ainda não iniciado como slice completo**;
- Incremento 5 — Produção/financeiro: **não iniciado**;
- Incremento 6 — Event Day: **não iniciado**;
- Incremento 7 — Bar/fechamento: **não iniciado**;
- Incremento 8 — Retenção: **não iniciado**.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
