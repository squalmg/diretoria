# MODELO DE DADOS — DIRETORIA

**Projeto:** Diretoria  
**Produto inicial:** Diretoria Club  
**Documento:** Modelo de Dados V0.1  
**Data-base:** 21/08/2026  
**Base canônica:** Blueprint Mestre + `goal.md` + Arquitetura Funcional V0.1  
**Status:** Modelo lógico para revisão antes do UX Flow e do DDL físico

---

# 1. OBJETIVO

Transformar a arquitetura funcional da Diretoria em um modelo lógico de dados capaz de sustentar:

- identidade única do cliente;
- aquisição e CRM;
- edição e máquina de estados;
- Diretoria Club;
- pagamentos;
- créditos;
- quórum financeiro;
- GO/NO-GO;
- venda pública;
- ticketing;
- transferências;
- portaria;
- produção;
- fornecedores;
- contratos;
- despesas;
- adiantamentos;
- conciliação;
- bar e estoque;
- auditoria;
- DRE;
- retenção.

Este documento ainda **não é o SQL final**.

Ele define:

- entidades;
- chaves;
- relacionamentos;
- estados;
- constraints;
- fontes de verdade;
- dados derivados;
- regras de integridade;
- histórico obrigatório.

---

# 2. PRINCÍPIOS DE MODELAGEM

## 2.1 Verdade transacional acima da interface

Nenhum valor financeiro crítico poderá ser considerado verdadeiro apenas porque foi exibido ou alterado numa tela.

A fonte de verdade deverá estar no backend e no banco.

---

## 2.2 Dinheiro nunca usa ponto flutuante

Valores monetários deverão usar tipo exato.

Proposta para PostgreSQL:

`NUMERIC(14,2)`

Nunca usar:

`FLOAT`

ou

`DOUBLE`

para valores financeiros.

Moeda inicial:

`BRL`

Preparar campo `currency_code CHAR(3)` para evitar acoplamento irreversível.

---

## 2.3 IDs

Proposta:

`UUID`

para entidades principais.

Razões:

- baixa previsibilidade;
- melhor segurança externa;
- geração distribuída;
- menor exposição de volume interno.

Poderão existir códigos humanos separados.

Exemplo:

`event_code = DIR-2026-001`

---

## 2.4 Datas

Todos os registros transacionais possuirão:

`created_at`

Quando aplicável:

`updated_at`

Eventos financeiros e de auditoria deverão possuir timestamp imutável de ocorrência.

Internamente:

UTC.

Exibição:

timezone da operação.

---

## 2.5 Exclusão

Registros financeiros, pagamentos, créditos, tickets utilizados, auditoria e conciliações **não serão apagados fisicamente**.

Quando necessário:

- cancelar;
- estornar;
- bloquear;
- arquivar;
- criar registro compensatório.

Soft delete será permitido apenas onde fizer sentido.

---

## 2.6 Dados derivados não são editáveis

Exemplos:

- capital protegido;
- percentual do quórum;
- déficit;
- superávit;
- saldo de sócio;
- CMV;
- DRE;
- número de ingressos usados.

Esses números deverão ser calculados a partir de fatos registrados.

Snapshots poderão ser armazenados para desempenho e histórico, mas não serão a fonte primária da verdade.

---

# 3. DOMÍNIOS DE DADOS

Modelo dividido em nove grupos:

1. Identidade e Segurança
2. CRM e Aquisição
3. Edições e Club
4. Comércio e Pagamentos
5. Quórum e Financeiro
6. Ticketing e Portaria
7. Produção e Fornecedores
8. Bar e Estoque
9. Comunicação, Analytics, Auditoria e Relatórios

---

# 4. MAPA MACRO DE RELAÇÕES

```text
profiles
 ├── users
 ├── memberships
 ├── credits
 ├── payments
 ├── tickets
 ├── referrals
 ├── votes
 └── crm_interactions

events
 ├── event_status_history
 ├── event_financial_configs
 ├── memberships
 ├── credits
 ├── payments
 ├── quorum_snapshots
 ├── lots
 ├── tickets
 ├── suppliers/contracts/expenses
 ├── inventory
 ├── checkins
 ├── incidents
 └── reports

payments
 ├── payment_events
 ├── refunds
 ├── credits
 └── financial_transactions

credits
 ├── quorum
 └── tickets

tickets
 ├── ticket_transfers
 └── checkins

expenses
 ├── expense_payments
 ├── advances
 └── financial_transactions

bar/inventory
 └── DRE

todos os domínios críticos
 └── audit_logs
```

---

# 5. IDENTIDADE — `profiles`

Representa a pessoa no ecossistema Diretoria.

É o `customer_id` canônico.

## Campos

- `id UUID PK`
- `display_code VARCHAR UNIQUE`
- `full_name VARCHAR`
- `email VARCHAR NULL`
- `email_normalized VARCHAR NULL`
- `phone_e164 VARCHAR NULL`
- `birth_date DATE NULL`
- `document_type VARCHAR NULL`
- `document_number_encrypted TEXT NULL`
- `status VARCHAR`
- `first_source VARCHAR NULL`
- `first_campaign VARCHAR NULL`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`
- `archived_at TIMESTAMPTZ NULL`

## Status

- `lead`
- `active`
- `blocked`
- `archived`

## Constraints

- email normalizado único quando informado;
- telefone E.164 único quando informado;
- não permitir perfil sem pelo menos um identificador operacional quando ele evoluir para conta pagante;
- dados sensíveis devem possuir política específica de proteção.

---

# 6. AUTENTICAÇÃO — `users`

Representa a conta autenticável.

Separar pessoa de credencial permite existir lead antes de existir login.

## Campos

- `id UUID PK`
- `profile_id UUID FK profiles UNIQUE`
- `auth_provider VARCHAR`
- `provider_subject VARCHAR NULL`
- `password_hash TEXT NULL`
- `email_verified_at TIMESTAMPTZ NULL`
- `phone_verified_at TIMESTAMPTZ NULL`
- `last_login_at TIMESTAMPTZ NULL`
- `status VARCHAR`
- `created_at`
- `updated_at`

## Status

- `pending`
- `active`
- `blocked`
- `disabled`

## Regra

Senha nunca é armazenada em texto puro.

---

# 7. CONSENTIMENTOS — `consents`

Registra consentimentos por finalidade e versão.

## Campos

- `id UUID PK`
- `profile_id FK`
- `consent_type`
- `policy_version`
- `granted BOOLEAN`
- `source`
- `ip_address NULL`
- `user_agent NULL`
- `granted_at`
- `revoked_at NULL`

## Tipos possíveis

- termos;
- privacidade;
- marketing;
- WhatsApp;
- e-mail;
- push.

---

# 8. RBAC — `roles`

## Campos

- `id UUID PK`
- `code VARCHAR UNIQUE`
- `name`
- `description`
- `is_system BOOLEAN`
- `created_at`

Perfis iniciais:

- `super_admin`
- `finance`
- `production`
- `marketing`
- `support`
- `gate_supervisor`
- `scanner`
- `bar`

---

# 9. RBAC — `permissions`

## Campos

- `id UUID PK`
- `code VARCHAR UNIQUE`
- `description`
- `created_at`

Exemplos:

- `events.read`
- `events.confirm`
- `payments.read`
- `payments.refund`
- `finance.read`
- `finance.write`
- `tickets.scan`
- `tickets.block`
- `inventory.write`
- `audit.read`

---

# 10. RBAC — `user_roles`

Relação N:N entre usuário administrativo e papel.

## Campos

- `user_id FK`
- `role_id FK`
- `event_id FK NULL`
- `granted_by UUID FK users`
- `granted_at`

## PK/Unique

`UNIQUE(user_id, role_id, event_id)`

Permite papel global ou limitado a uma edição.

---

# 11. RBAC — `role_permissions`

## Campos

- `role_id FK`
- `permission_id FK`

## PK

`PRIMARY KEY(role_id, permission_id)`

---

# 12. AQUISIÇÃO — `acquisition_attributions`

Preserva a origem de aquisição sem depender exclusivamente de analytics.

## Campos

- `id UUID PK`
- `profile_id FK`
- `session_key VARCHAR NULL`
- `source`
- `medium NULL`
- `campaign NULL`
- `content NULL`
- `term NULL`
- `referral_code NULL`
- `landing_page NULL`
- `occurred_at`

## Regra

Primeira atribuição e última atribuição poderão ser calculadas a partir do histórico.

---

# 13. CRM — `crm_stage_history`

Não armazenar apenas “status atual”.

Guardar histórico de mudança de funil.

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK NULL`
- `from_stage NULL`
- `to_stage`
- `reason NULL`
- `source_type`
- `source_id UUID NULL`
- `changed_at`

## Estágios

- `visitor`
- `lead`
- `member`
- `member_confirmed`
- `ticket_issued`
- `participant`
- `repeat_participant`
- `ambassador`
- `inactive`

---

# 14. CRM — `crm_interactions`

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK NULL`
- `channel`
- `direction`
- `interaction_type`
- `summary`
- `external_id NULL`
- `occurred_at`
- `created_by NULL`

Canais:

- WhatsApp;
- e-mail;
- site;
- telefone;
- presencial;
- sistema.

---

# 15. EDIÇÕES — `events`

Entidade central.

## Campos

- `id UUID PK`
- `event_code VARCHAR UNIQUE`
- `name`
- `slug VARCHAR UNIQUE`
- `description NULL`
- `status`
- `capacity INTEGER NULL`
- `formation_starts_at NULL`
- `quorum_deadline_at NULL`
- `public_sales_starts_at NULL`
- `event_starts_at NULL`
- `event_ends_at NULL`
- `confirmed_at NULL`
- `closed_at NULL`
- `timezone VARCHAR`
- `default_currency CHAR(3)`
- `created_by FK users`
- `created_at`
- `updated_at`

## Status canônicos

- `PLANEJAMENTO`
- `REATIVACAO`
- `LISTA_DE_ESPERA`
- `FORMACAO`
- `QUORUM_EM_ANDAMENTO`
- `VIAVEL`
- `CONFIRMADO`
- `VENDA_PUBLICA`
- `PRE_EVENTO`
- `AO_VIVO`
- `FECHAMENTO`
- `ENCERRADO`
- `RETENCAO`

## Constraint

Transição de status será validada pelo domínio, não por alteração livre do campo.

---

# 16. HISTÓRICO DA EDIÇÃO — `event_status_history`

## Campos

- `id UUID PK`
- `event_id FK`
- `from_status NULL`
- `to_status`
- `reason NULL`
- `actor_user_id FK NULL`
- `automated BOOLEAN`
- `occurred_at`

## Regra

Obrigatório para toda transição.

---

# 17. LOCAIS — `venues`

Cadastro reutilizável.

## Campos

- `id UUID PK`
- `name`
- `address`
- `city`
- `state`
- `capacity_reference NULL`
- `contact_name NULL`
- `contact_phone NULL`
- `notes NULL`
- `created_at`

---

# 18. OPÇÕES DE LOCAL — `event_venues`

## Campos

- `event_id FK`
- `venue_id FK`
- `status`
- `quoted_value NUMERIC(14,2) NULL`
- `capacity INTEGER NULL`
- `notes NULL`
- `selected_at NULL`

Status:

- `candidate`
- `negotiating`
- `selected`
- `rejected`

Uma edição confirmada deverá possuir no máximo um local selecionado.

---

# 19. CONFIGURAÇÃO FINANCEIRA — `event_financial_configs`

Versionar parâmetros que alteram o quórum.

## Campos

- `id UUID PK`
- `event_id FK`
- `version INTEGER`
- `founder_ticket_gross NUMERIC(14,2)`
- `estimated_fee_per_member NUMERIC(14,2)`
- `variable_cost_per_member NUMERIC(14,2)`
- `contingency_type`
- `contingency_value NUMERIC(14,2)`
- `approved_exposure_limit NUMERIC(14,2) NULL`
- `effective_from`
- `effective_to NULL`
- `created_by`
- `created_at`

## Constraint

`UNIQUE(event_id, version)`

## Regra

Configuração usada num cálculo histórico não deve ser reescrita.

Criar nova versão.

---

# 20. MEMBROS — `memberships`

Representa vínculo de membro com uma edição.

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK`
- `membership_type`
- `status`
- `source_credit_id FK credits NULL`
- `joined_at NULL`
- `cancelled_at NULL`
- `created_at`

## Tipo

- `founder`
- `club`
- `other`

## Status

- `pending`
- `active`
- `cancelled`
- `rolled_over`
- `refunded`

## Constraint

Para V1:

`UNIQUE(profile_id, event_id, membership_type)`

Quando aplicável.

---

# 21. PAGAMENTOS — `payments`

Registra cobrança/tentativa.

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK NULL`
- `purpose`
- `gateway`
- `gateway_payment_id VARCHAR NULL`
- `idempotency_key VARCHAR UNIQUE`
- `amount_gross NUMERIC(14,2)`
- `amount_fee NUMERIC(14,2) DEFAULT 0`
- `amount_net NUMERIC(14,2) NULL`
- `currency_code CHAR(3)`
- `payment_method`
- `status`
- `created_at`
- `paid_at NULL`
- `expired_at NULL`
- `refunded_at NULL`
- `updated_at`

## Purpose

- `club_credit`
- `public_ticket`
- `other`

## Status

- `created`
- `pending`
- `paid`
- `failed`
- `expired`
- `refunded`
- `chargeback`

## Constraints

- `amount_gross > 0`
- `amount_fee >= 0`
- gateway ID único por gateway quando informado;
- `paid_at` obrigatório quando status `paid`.

---

# 22. WEBHOOKS — `payment_webhook_receipts`

Protege idempotência e auditoria.

## Campos

- `id UUID PK`
- `gateway`
- `gateway_event_id`
- `event_type`
- `signature_valid BOOLEAN`
- `payload_hash`
- `received_at`
- `processed_at NULL`
- `processing_status`
- `error_message NULL`

## Constraint crítica

`UNIQUE(gateway, gateway_event_id)`

O mesmo webhook não poderá produzir efeito financeiro duas vezes.

---

# 23. EVENTOS DE PAGAMENTO — `payment_events`

Histórico interno.

## Campos

- `id UUID PK`
- `payment_id FK`
- `event_type`
- `old_status NULL`
- `new_status NULL`
- `gateway_event_id NULL`
- `metadata JSONB NULL`
- `occurred_at`

---

# 24. REEMBOLSOS — `refunds`

## Campos

- `id UUID PK`
- `payment_id FK`
- `profile_id FK`
- `event_id FK NULL`
- `amount NUMERIC(14,2)`
- `reason`
- `status`
- `gateway_refund_id NULL`
- `requested_at`
- `processed_at NULL`
- `requested_by NULL`

## Status

- `requested`
- `approved`
- `processing`
- `paid`
- `failed`
- `cancelled`

---

# 25. CRÉDITOS — `credits`

Representa compromisso financeiro do membro.

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK`
- `payment_id FK NULL`
- `origin_type`
- `origin_id UUID NULL`
- `gross_value NUMERIC(14,2)`
- `protected_value NUMERIC(14,2)`
- `status`
- `valid_from NULL`
- `converted_at NULL`
- `rolled_over_at NULL`
- `cancelled_at NULL`
- `created_at`

## Status

- `pending`
- `valid`
- `converted`
- `rolled_over`
- `refund_requested`
- `refunded`
- `cancelled`

## Constraints

- `gross_value >= 0`
- `protected_value >= 0`
- `protected_value <= gross_value` salvo regra financeira explicitamente documentada;
- um pagamento de Club não pode gerar dois créditos ativos equivalentes.

## Constraint proposta

Índice único parcial por `payment_id` para créditos cuja origem seja pagamento do Club.

---

# 26. MOVIMENTOS DE CRÉDITO — `credit_movements`

Mantém histórico sem sobrescrever fatos.

## Campos

- `id UUID PK`
- `credit_id FK`
- `movement_type`
- `amount NUMERIC(14,2)`
- `from_event_id FK NULL`
- `to_event_id FK NULL`
- `reference_type NULL`
- `reference_id UUID NULL`
- `occurred_at`

Tipos:

- `validated`
- `converted`
- `rollover_out`
- `rollover_in`
- `refund`
- `adjustment`

Ajustes exigem permissão e auditoria.

---

# 27. CUSTOS PROTEGIDOS — `event_cost_items`

Base do quórum.

## Campos

- `id UUID PK`
- `event_id FK`
- `category`
- `description`
- `cost_type`
- `estimated_amount NUMERIC(14,2)`
- `approved_amount NUMERIC(14,2) NULL`
- `protected BOOLEAN`
- `status`
- `supplier_id FK NULL`
- `contract_id FK NULL`
- `created_by`
- `approved_by NULL`
- `created_at`
- `updated_at`

## Cost type

- `fixed`
- `variable`
- `provision`
- `tax`
- `other`

## Status

- `draft`
- `planned`
- `approved`
- `cancelled`

## Regra

Somente custos em estado aceito pela política de quórum entram no cálculo.

---

# 28. RECEITAS GARANTIDAS — `event_revenue_commitments`

Receita que pode reduzir a necessidade de quórum.

## Campos

- `id UUID PK`
- `event_id FK`
- `revenue_type`
- `counterparty NULL`
- `gross_amount NUMERIC(14,2)`
- `eligible_percentage NUMERIC(5,2)`
- `eligible_amount NUMERIC(14,2)`
- `status`
- `evidence_reference NULL`
- `received_at NULL`
- `created_at`
- `updated_at`

## Revenue type

- `sponsorship`
- `guaranteed_partner`
- `other_guaranteed`

## Status

- `promised`
- `contracted`
- `partially_received`
- `received`
- `cancelled`

## Regra

Bar esperado nunca é registrado aqui como receita elegível para quórum.

`eligible_amount` deve obedecer política configurada.

---

# 29. SNAPSHOTS DE QUÓRUM — `quorum_snapshots`

Histórico derivado.

## Campos

- `id UUID PK`
- `event_id FK`
- `financial_config_id FK`
- `protected_costs NUMERIC(14,2)`
- `contingency_amount NUMERIC(14,2)`
- `guaranteed_revenue NUMERIC(14,2)`
- `financial_need NUMERIC(14,2)`
- `valid_credit_count INTEGER`
- `protected_capital NUMERIC(14,2)`
- `quorum_minimum INTEGER`
- `protected_percentage NUMERIC(7,4)`
- `deficit NUMERIC(14,2)`
- `surplus NUMERIC(14,2)`
- `financial_status`
- `trigger_type`
- `trigger_id UUID NULL`
- `calculated_at`

## Status

- `NAO_VIAVEL`
- `PROXIMO_DO_QUORUM`
- `VIAVEL`
- `PROTEGIDO`
- `SUPERAVIT`

## Regra

Snapshot é imutável.

O “estado atual” é o snapshot mais recente válido.

---

# 30. CHECKLIST DE CONFIRMAÇÃO — `event_confirmation_checks`

## Campos

- `id UUID PK`
- `event_id FK`
- `check_code`
- `label`
- `required BOOLEAN`
- `status`
- `evidence NULL`
- `validated_by NULL`
- `validated_at NULL`

## Status

- `pending`
- `approved`
- `rejected`
- `not_applicable`

Exemplos:

- data definida;
- local definido;
- capacidade validada;
- orçamento atualizado;
- fornecedor crítico validado.

---

# 31. GO/NO-GO — `event_go_no_go_reviews`

## Campos

- `id UUID PK`
- `event_id FK`
- `quorum_snapshot_id FK`
- `approved_exposure_limit NUMERIC(14,2)`
- `projected_required_exposure NUMERIC(14,2)`
- `no_future_sales_assumed BOOLEAN DEFAULT TRUE`
- `bar_revenue_assumed NUMERIC(14,2) DEFAULT 0`
- `result`
- `reason NULL`
- `reviewed_by`
- `reviewed_at`

## Result

- `GO`
- `NO_GO`

## Constraints críticas

Para aprovação canônica:

- `bar_revenue_assumed = 0`
- `no_future_sales_assumed = TRUE`
- `projected_required_exposure <= approved_exposure_limit`

---

# 32. LOTES — `lots`

## Campos

- `id UUID PK`
- `event_id FK`
- `name`
- `sequence INTEGER`
- `price NUMERIC(14,2)`
- `quantity_limit INTEGER NULL`
- `starts_at NULL`
- `ends_at NULL`
- `activation_type`
- `status`
- `created_at`

## Status

- `draft`
- `scheduled`
- `active`
- `sold_out`
- `closed`
- `cancelled`

## Constraint

`UNIQUE(event_id, sequence)`

---

# 33. INGRESSOS — `tickets`

## Campos

- `id UUID PK`
- `ticket_code VARCHAR UNIQUE`
- `event_id FK`
- `owner_profile_id FK`
- `origin_type`
- `origin_id UUID`
- `lot_id FK NULL`
- `category`
- `status`
- `token_hash`
- `issued_at`
- `used_at NULL`
- `blocked_at NULL`
- `cancelled_at NULL`

## Status

- `active`
- `transferred`
- `used`
- `cancelled`
- `refunded`
- `blocked`

## Constraints críticas

- `token_hash` único;
- `used_at` só existe se ticket foi consumido;
- ticket usado não pode voltar a `active` sem procedimento administrativo extraordinário auditado;
- um crédito convertido não pode gerar dois tickets ativos.

---

# 34. TRANSFERÊNCIAS — `ticket_transfers`

## Campos

- `id UUID PK`
- `ticket_id FK`
- `from_profile_id FK`
- `to_profile_id FK`
- `status`
- `requested_at`
- `accepted_at NULL`
- `completed_at NULL`
- `cancelled_at NULL`
- `new_ticket_id FK NULL`
- `requested_by`
- `reason NULL`

## Status

- `requested`
- `accepted`
- `completed`
- `cancelled`
- `rejected`

## Integridade

A conclusão deverá ocorrer em transação única:

1. invalidar ticket anterior;
2. criar/ativar direito do novo titular;
3. registrar transferência.

Não permitir janela em que dois ingressos estejam ativos.

---

# 35. DISPOSITIVOS DE PORTARIA — `gate_devices`

## Campos

- `id UUID PK`
- `event_id FK`
- `device_code UNIQUE`
- `name`
- `status`
- `last_seen_at NULL`
- `software_version NULL`
- `registered_at`
- `revoked_at NULL`

Status:

- `active`
- `offline`
- `revoked`

---

# 36. CHECK-INS — `checkins`

## Campos

- `id UUID PK`
- `event_id FK`
- `ticket_id FK`
- `device_id FK`
- `operator_user_id FK NULL`
- `result`
- `reason_code NULL`
- `scanned_at`
- `sync_source`
- `synced_at NULL`

## Result

- `valid`
- `invalid`
- `verification`

## Constraint crítica

Índice único parcial:

apenas um check-in `valid` para cada `ticket_id`.

---

# 37. SINCRONIZAÇÃO OFFLINE — `gate_sync_events`

## Campos

- `id UUID PK`
- `event_id FK`
- `device_id FK`
- `local_event_id VARCHAR`
- `event_type`
- `payload_hash`
- `occurred_at`
- `received_at`
- `processing_status`
- `conflict_status NULL`

## Constraint

`UNIQUE(device_id, local_event_id)`

Impede reaplicação do mesmo evento offline.

---

# 38. VOTAÇÕES — `polls`

## Campos

- `id UUID PK`
- `event_id FK`
- `title`
- `description NULL`
- `poll_type`
- `status`
- `opens_at`
- `closes_at`
- `eligible_membership_rule JSONB NULL`
- `created_by`
- `created_at`

Tipos:

- `consultative`
- `binding`

---

# 39. OPÇÕES — `poll_options`

## Campos

- `id UUID PK`
- `poll_id FK`
- `label`
- `sequence`

---

# 40. VOTOS — `votes`

## Campos

- `id UUID PK`
- `poll_id FK`
- `option_id FK`
- `profile_id FK`
- `membership_id FK NULL`
- `submitted_at`

## Constraint

Por padrão:

`UNIQUE(poll_id, profile_id)`

---

# 41. INDICAÇÕES — `referrals`

## Campos

- `id UUID PK`
- `referrer_profile_id FK`
- `event_id FK NULL`
- `referral_code VARCHAR UNIQUE`
- `status`
- `created_at`
- `expires_at NULL`

---

# 42. EVENTOS DE INDICAÇÃO — `referral_events`

## Campos

- `id UUID PK`
- `referral_id FK`
- `event_type`
- `referred_profile_id FK NULL`
- `payment_id FK NULL`
- `revenue_amount NUMERIC(14,2) NULL`
- `occurred_at`

Tipos:

- `click`
- `lead`
- `purchase`
- `qualified_purchase`
- `reward_created`

---

# 43. PARCEIROS — `partners`

## Campos

- `id UUID PK`
- `partner_type`
- `name`
- `contact_name NULL`
- `phone NULL`
- `email NULL`
- `document NULL`
- `status`
- `created_at`

Tipos:

- `athletic_association`
- `ambassador`
- `sponsor`
- `commercial_partner`
- `other`

---

# 44. CAMPANHAS DE PARCEIRO — `partner_campaigns`

## Campos

- `id UUID PK`
- `partner_id FK`
- `event_id FK`
- `code VARCHAR UNIQUE`
- `commission_type`
- `commission_value NUMERIC(14,4)`
- `starts_at`
- `ends_at NULL`
- `status`

---

# 45. VENDAS DE PARCEIRO — `partner_sales`

## Campos

- `id UUID PK`
- `partner_campaign_id FK`
- `payment_id FK`
- `profile_id FK`
- `gross_revenue NUMERIC(14,2)`
- `eligible_revenue NUMERIC(14,2)`
- `commission_amount NUMERIC(14,2)`
- `status`
- `created_at`

## Constraint

Uma venda/pagamento não pode ser comissionada duas vezes pela mesma campanha.

---

# 46. FORNECEDORES — `suppliers`

## Campos

- `id UUID PK`
- `name`
- `category`
- `document NULL`
- `contact_name NULL`
- `phone NULL`
- `email NULL`
- `payment_details_encrypted NULL`
- `rating NULL`
- `status`
- `created_at`
- `updated_at`

---

# 47. CONTRATOS — `contracts`

## Campos

- `id UUID PK`
- `event_id FK`
- `supplier_id FK`
- `title`
- `status`
- `total_amount NUMERIC(14,2)`
- `deposit_amount NUMERIC(14,2) DEFAULT 0`
- `balance_amount NUMERIC(14,2)`
- `signed_at NULL`
- `file_asset_id FK NULL`
- `responsible_user_id FK`
- `created_at`
- `updated_at`

## Status

- `draft`
- `negotiating`
- `signed`
- `completed`
- `cancelled`

---

# 48. DESPESAS — `expenses`

## Campos

- `id UUID PK`
- `event_id FK`
- `supplier_id FK NULL`
- `contract_id FK NULL`
- `cost_item_id FK NULL`
- `financial_center`
- `category`
- `description`
- `planned_amount NUMERIC(14,2) NULL`
- `approved_amount NUMERIC(14,2) NULL`
- `status`
- `due_date NULL`
- `approved_by NULL`
- `created_by`
- `created_at`
- `updated_at`

## Status

- `planned`
- `approved`
- `partial`
- `paid`
- `cancelled`
- `overdue`

---

# 49. PAGAMENTO DE DESPESA — `expense_payments`

## Campos

- `id UUID PK`
- `expense_id FK`
- `amount NUMERIC(14,2)`
- `payment_channel`
- `paid_by_type`
- `paid_by_profile_id FK NULL`
- `external_reference NULL`
- `paid_at`
- `created_by`

## Paid by type

- `company`
- `partner_person`
- `bar_cash`
- `other`

## Regra

Se `paid_by_type = partner_person`, gerar adiantamento correspondente.

---

# 50. ADIANTAMENTOS — `advances`

## Campos

- `id UUID PK`
- `event_id FK`
- `profile_id FK`
- `expense_payment_id FK NULL`
- `amount NUMERIC(14,2)`
- `type`
- `status`
- `created_at`
- `settled_at NULL`

Tipos:

- `person_paid_for_company`
- `person_received_for_company`
- `manual_adjustment`

Status:

- `open`
- `partially_settled`
- `settled`
- `cancelled`

---

# 51. MOVIMENTOS DE CONTA-CORRENTE — `person_account_movements`

## Campos

- `id UUID PK`
- `event_id FK`
- `profile_id FK`
- `movement_type`
- `amount NUMERIC(14,2)`
- `reference_type`
- `reference_id UUID`
- `occurred_at`

## Regra

Saldo é:

`SUM(créditos/devidos) - SUM(reembolsos/acertos)`

Nunca armazenar saldo como valor livremente editável.

---

# 52. SUBLEDGER FINANCEIRO — `ledger_accounts`

**Proposta técnica adicional para robustez da V1.**

O Blueprint exige rastreabilidade financeira. Para evitar caixas inconsistentes, propõe-se subledger de partidas.

## Campos

- `id UUID PK`
- `code VARCHAR UNIQUE`
- `name`
- `account_type`
- `financial_center NULL`
- `active BOOLEAN`

Tipos:

- `asset`
- `liability`
- `revenue`
- `expense`
- `equity`
- `control`

Exemplos:

- caixa_formacao;
- caixa_operacional;
- recebiveis_gateway;
- creditos_a_converter;
- reembolsos_a_pagar;
- receita_ingressos;
- receita_bar;
- despesa_producao;
- adiantamentos_socios.

---

# 53. SUBLEDGER — `financial_transactions`

Cabeçalho imutável de fato financeiro.

## Campos

- `id UUID PK`
- `event_id FK NULL`
- `transaction_type`
- `reference_type`
- `reference_id UUID`
- `description`
- `occurred_at`
- `created_at`
- `reversal_of_id FK NULL`

## Regra

Transação lançada não é editada.

Erro gera reversão e novo lançamento.

---

# 54. SUBLEDGER — `financial_postings`

## Campos

- `id UUID PK`
- `transaction_id FK`
- `ledger_account_id FK`
- `direction`
- `amount NUMERIC(14,2)`
- `currency_code CHAR(3)`

Direction:

- `debit`
- `credit`

## Integridade

A soma dos débitos de cada transação deve ser igual à soma dos créditos.

Essa validação deverá ocorrer no serviço financeiro/transação de banco.

---

# 55. CONCILIAÇÃO — `reconciliations`

## Campos

- `id UUID PK`
- `event_id FK`
- `channel`
- `period_start`
- `period_end`
- `gross_amount NUMERIC(14,2)`
- `fee_amount NUMERIC(14,2)`
- `cancellations_amount NUMERIC(14,2)`
- `expected_net NUMERIC(14,2)`
- `received_net NUMERIC(14,2)`
- `difference_amount NUMERIC(14,2)`
- `status`
- `reconciled_by NULL`
- `reconciled_at NULL`

## Status

- `open`
- `matched`
- `difference`
- `resolved`

`difference_amount` é derivado.

---

# 56. PRODUTOS DO BAR — `products`

## Campos

- `id UUID PK`
- `sku VARCHAR UNIQUE`
- `name`
- `category`
- `unit`
- `active BOOLEAN`
- `created_at`

---

# 57. LOCAIS DE ESTOQUE — `inventory_locations`

## Campos

- `id UUID PK`
- `event_id FK`
- `name`
- `type`
- `active BOOLEAN`

Exemplos:

- depósito;
- bar principal;
- bar secundário.

---

# 58. MOVIMENTOS DE ESTOQUE — `inventory_movements`

Fonte de verdade do estoque.

## Campos

- `id UUID PK`
- `event_id FK`
- `product_id FK`
- `location_id FK`
- `movement_type`
- `quantity NUMERIC(14,3)`
- `unit_cost NUMERIC(14,4) NULL`
- `supplier_id FK NULL`
- `consignment BOOLEAN DEFAULT FALSE`
- `reference_type NULL`
- `reference_id UUID NULL`
- `occurred_at`
- `created_by`

Tipos:

- `purchase`
- `consignment_in`
- `transfer_in`
- `transfer_out`
- `sale`
- `courtesy`
- `loss`
- `breakage`
- `return_supplier`
- `count_adjustment`

## Regra

Estoque atual é derivado dos movimentos.

---

# 59. CONTAGENS DE ESTOQUE — `stock_counts`

## Campos

- `id UUID PK`
- `event_id FK`
- `location_id FK`
- `count_type`
- `status`
- `counted_at`
- `counted_by`

Tipos:

- `opening`
- `intermediate`
- `closing`

---

# 60. ITENS DA CONTAGEM — `stock_count_items`

## Campos

- `stock_count_id FK`
- `product_id FK`
- `system_quantity NUMERIC(14,3)`
- `counted_quantity NUMERIC(14,3)`
- `difference_quantity NUMERIC(14,3)`

## PK

`PRIMARY KEY(stock_count_id, product_id)`

---

# 61. TRANSAÇÕES DE BAR — `bar_transactions`

Pode receber dados de PDV externo.

## Campos

- `id UUID PK`
- `event_id FK`
- `external_source`
- `external_transaction_id NULL`
- `gross_amount NUMERIC(14,2)`
- `fee_amount NUMERIC(14,2)`
- `payment_channel`
- `status`
- `occurred_at`
- `imported_at`

## Constraint

ID externo único dentro da origem quando informado.

---

# 62. ITENS DE VENDA DO BAR — `bar_transaction_items`

## Campos

- `id UUID PK`
- `bar_transaction_id FK`
- `product_id FK`
- `quantity NUMERIC(14,3)`
- `unit_price NUMERIC(14,2)`
- `gross_amount NUMERIC(14,2)`

---

# 63. PRODUÇÃO — `production_tasks`

## Campos

- `id UUID PK`
- `event_id FK`
- `category`
- `title`
- `description NULL`
- `status`
- `priority`
- `responsible_user_id FK NULL`
- `supplier_id FK NULL`
- `due_at NULL`
- `completed_at NULL`
- `created_at`

Status:

- `todo`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

---

# 64. OCORRÊNCIAS — `incidents`

## Campos

- `id UUID PK`
- `event_id FK`
- `incident_type`
- `severity`
- `status`
- `description`
- `action_taken NULL`
- `responsible_user_id NULL`
- `occurred_at`
- `closed_at NULL`

Tipos:

- segurança;
- saúde;
- estrutura;
- bar;
- portaria;
- sistema;
- fornecedor.

---

# 65. NOTIFICAÇÕES — `notification_templates`

## Campos

- `id UUID PK`
- `code VARCHAR UNIQUE`
- `channel`
- `purpose`
- `version`
- `content`
- `active BOOLEAN`
- `created_at`

Purpose:

- `transactional`
- `marketing`

---

# 66. NOTIFICAÇÕES — `notifications`

## Campos

- `id UUID PK`
- `profile_id FK`
- `event_id FK NULL`
- `template_id FK NULL`
- `channel`
- `purpose`
- `status`
- `scheduled_at NULL`
- `sent_at NULL`
- `delivered_at NULL`
- `read_at NULL`
- `created_at`

Status:

- `queued`
- `sending`
- `sent`
- `delivered`
- `failed`
- `cancelled`

---

# 67. TENTATIVAS DE ENVIO — `notification_attempts`

## Campos

- `id UUID PK`
- `notification_id FK`
- `provider`
- `external_id NULL`
- `attempt_number`
- `status`
- `error_code NULL`
- `attempted_at`

---

# 68. ACERVO — `assets`

## Campos

- `id UUID PK`
- `event_id FK NULL`
- `asset_type`
- `storage_key`
- `title NULL`
- `description NULL`
- `format NULL`
- `quality NULL`
- `usage_permission`
- `rights_status`
- `created_at`

---

# 69. TAGS DE ACERVO — `asset_tags`

## Campos

- `asset_id FK`
- `tag`

## PK

`PRIMARY KEY(asset_id, tag)`

---

# 70. ANALYTICS — `analytics_events`

Telemetria, não fonte financeira.

## Campos

- `id UUID PK`
- `profile_id FK NULL`
- `event_id FK NULL`
- `session_id NULL`
- `event_name`
- `properties JSONB`
- `occurred_at`

Eventos mínimos:

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

# 71. AUDITORIA — `audit_logs`

Registro append-only.

## Campos

- `id UUID PK`
- `actor_user_id FK NULL`
- `actor_type`
- `action`
- `entity_type`
- `entity_id UUID`
- `event_id FK NULL`
- `before_data JSONB NULL`
- `after_data JSONB NULL`
- `reason NULL`
- `ip_address NULL`
- `device_id NULL`
- `occurred_at`

## Regra

Não permitir update/delete por usuários comuns.

---

# 72. DRE — `event_financial_reports`

Relatório consolidado versionado.

## Campos

- `id UUID PK`
- `event_id FK`
- `version INTEGER`
- `status`
- `period_end`
- `total_revenue NUMERIC(14,2)`
- `total_cost NUMERIC(14,2)`
- `operating_result NUMERIC(14,2)`
- `generated_at`
- `finalized_at NULL`
- `generated_by`

Status:

- `draft`
- `provisional`
- `final`

---

# 73. LINHAS DA DRE — `event_financial_report_lines`

## Campos

- `id UUID PK`
- `report_id FK`
- `section`
- `category`
- `label`
- `amount NUMERIC(14,2)`
- `source_query_version NULL`
- `sequence`

A DRE final deve ser reproduzível a partir dos fatos financeiros.

---

# 74. RELATÓRIO DA EDIÇÃO — `event_reports`

## Campos

- `id UUID PK`
- `event_id FK`
- `report_version`
- `status`
- `metrics JSONB`
- `learnings TEXT NULL`
- `generated_at`
- `finalized_at NULL`

Métricas poderão incluir:

- público;
- receita;
- custos;
- resultado;
- bar;
- CAC;
- ROAS;
- quórum;
- no-show;
- indicação;
- recorrência.

---

# 75. REGRAS DE INTEGRIDADE CRÍTICAS

## RI-01 — Pagamento

`pending` nunca gera crédito válido.

---

## RI-02 — Webhook

Mesmo `gateway_event_id` nunca produz efeito duas vezes.

---

## RI-03 — Crédito

Crédito `valid` deve possuir origem financeira válida.

---

## RI-04 — Quórum

Somente créditos elegíveis e receitas garantidas elegíveis entram no capital protegido.

---

## RI-05 — Bar

Receita esperada de bar nunca entra em `event_revenue_commitments` como receita elegível de quórum.

---

## RI-06 — GO/NO-GO

`CONFIRMADO` exige:

- snapshot financeiro válido;
- `GO`;
- checks administrativos obrigatórios aprovados.

---

## RI-07 — Ingresso

Um crédito convertido não gera mais de um ingresso válido.

---

## RI-08 — Uso

Ticket não pode possuir dois check-ins válidos.

---

## RI-09 — Transferência

Transferência concluída não deixa ticket antigo e novo simultaneamente ativos.

---

## RI-10 — Financeiro

Transação financeira lançada não é apagada.

Correção é reversão.

---

## RI-11 — Sócios

Pagamento pessoal de despesa gera movimento de conta-corrente.

---

## RI-12 — Estoque

Estoque não é editado como “saldo”.

É derivado de movimentos e contagens.

---

## RI-13 — DRE

DRE final só pode ser criada depois da política mínima de fechamento ser satisfeita.

---

## RI-14 — Auditoria

Mudanças críticas sempre possuem registro de auditoria.

---

# 76. ÍNDICES PRIORITÁRIOS

## Identidade

- `profiles(email_normalized)` UNIQUE parcial
- `profiles(phone_e164)` UNIQUE parcial

## Pagamento

- `payments(gateway, gateway_payment_id)` UNIQUE parcial
- `payments(idempotency_key)` UNIQUE
- `payments(profile_id, event_id, status)`
- `payment_webhook_receipts(gateway, gateway_event_id)` UNIQUE

## Créditos

- `credits(event_id, status)`
- `credits(profile_id, event_id)`
- índice parcial de origem de pagamento

## Quórum

- `quorum_snapshots(event_id, calculated_at DESC)`

## Tickets

- `tickets(event_id, owner_profile_id, status)`
- `tickets(token_hash)` UNIQUE
- `checkins(ticket_id)` com unicidade parcial para resultado válido

## Financeiro

- `expenses(event_id, status)`
- `financial_transactions(event_id, occurred_at)`
- `financial_postings(transaction_id)`
- `reconciliations(event_id, channel, period_start)`

## Estoque

- `inventory_movements(event_id, product_id, location_id, occurred_at)`

## Auditoria

- `audit_logs(entity_type, entity_id, occurred_at)`
- `audit_logs(event_id, occurred_at)`

---

# 77. TRANSAÇÕES ATÔMICAS OBRIGATÓRIAS

As operações abaixo devem ocorrer dentro de transação de banco.

## T-01 — Confirmar pagamento

1. validar webhook;
2. travar pagamento;
3. verificar idempotência;
4. alterar status;
5. criar evento de pagamento;
6. criar/validar crédito quando aplicável;
7. lançar fato financeiro;
8. commit;
9. disparar recálculo assíncrono/idempotente.

---

## T-02 — Converter crédito em ingresso

1. travar crédito;
2. verificar status;
3. criar ticket;
4. marcar crédito convertido;
5. registrar auditoria;
6. commit.

---

## T-03 — Transferir ingresso

1. travar ticket;
2. verificar validade;
3. invalidar ticket anterior;
4. criar/ativar novo ticket;
5. concluir transferência;
6. auditoria;
7. commit.

---

## T-04 — Consumir ingresso

1. travar ticket;
2. verificar status `active`;
3. verificar inexistência de check-in válido;
4. marcar `used`;
5. criar check-in;
6. commit.

---

## T-05 — Pagamento pessoal de despesa

1. registrar pagamento;
2. atualizar estado da despesa;
3. criar adiantamento;
4. criar movimento de conta-corrente;
5. lançar fato financeiro;
6. auditoria;
7. commit.

---

## T-06 — Confirmar edição

1. travar edição;
2. carregar snapshot atual;
3. validar GO;
4. validar checklist;
5. validar status atual;
6. alterar para `CONFIRMADO`;
7. registrar histórico;
8. registrar auditoria;
9. commit;
10. disparar emissão de tickets/notificações.

---

# 78. DADOS QUE NÃO DEVEM SER CAMPOS LIVRES

Não permitir edição manual direta de:

- capital protegido;
- quórum atual;
- percentual protegido;
- déficit;
- superávit;
- valor líquido recebido conciliado sem evidência;
- saldo do sócio;
- estoque atual;
- CMV;
- resultado operacional;
- quantidade de ingressos utilizados.

Devem ser calculados.

---

# 79. CAMPOS QUE DEVEM SER VERSIONADOS

Criar nova versão em vez de sobrescrever quando alterar fatos que afetem decisões históricas:

- configuração financeira;
- regras de quórum;
- política comercial;
- template de comunicação;
- DRE;
- relatório final;
- política de reembolso;
- critérios de elegibilidade de receitas quando aplicável.

---

# 80. DADOS SENSÍVEIS

Aplicar proteção especial a:

- documentos pessoais;
- dados financeiros de fornecedores;
- credenciais;
- tokens;
- dados de autenticação;
- payloads de gateways;
- IP/dispositivo quando sujeito à política de privacidade.

Nunca armazenar dados completos de cartão.

Usar apenas tokens/identificadores fornecidos pelo gateway.

---

# 81. RETENÇÃO E IMUTABILIDADE

## Retenção prolongada

- pagamentos;
- reembolsos;
- créditos;
- tickets;
- check-ins;
- contratos;
- despesas;
- adiantamentos;
- conciliações;
- ledger;
- auditoria;
- relatórios.

## Pode ser arquivado

- lead inativo;
- campanha antiga;
- ativo de acervo;
- notificação;
- tarefas encerradas.

Arquivar não significa apagar histórico financeiro.

---

# 82. MODELO DO PRIMEIRO VERTICAL SLICE

Para iniciar HML não é necessário implementar todas as tabelas.

Primeiro conjunto:

1. `profiles`
2. `users`
3. `roles`
4. `permissions`
5. `user_roles`
6. `events`
7. `event_status_history`
8. `event_financial_configs`
9. `payments`
10. `payment_webhook_receipts`
11. `payment_events`
12. `credits`
13. `credit_movements`
14. `event_cost_items`
15. `event_revenue_commitments`
16. `quorum_snapshots`
17. `event_confirmation_checks`
18. `event_go_no_go_reviews`
19. `audit_logs`

Opcional já no primeiro slice, mas recomendado:

20. `ledger_accounts`
21. `financial_transactions`
22. `financial_postings`

---

# 83. CENÁRIO DE TESTE 01 — QUÓRUM

Configuração:

- custos protegidos: R$ 70.000
- contingência: R$ 10.500
- receitas garantidas: R$ 10.000
- necessidade: R$ 70.500
- contribuição líquida por membro: R$ 110

Resultado esperado:

`quorum_minimo = 641`

Com 400 créditos válidos de R$110:

`capital_protegido = R$44.000`

Status:

`NAO_VIAVEL`

Com 641:

`capital_protegido = R$70.510`

Status mínimo:

`VIAVEL`

---

# 84. CENÁRIO DE TESTE 02 — PAGAMENTO DUPLICADO

Gateway envia o mesmo webhook três vezes.

Resultado:

- 1 `payment_webhook_receipt`;
- 1 transição efetiva para `paid`;
- 1 crédito;
- 1 lançamento financeiro;
- 3 requisições podem ser observadas em infraestrutura, mas somente 1 efeito de domínio.

---

# 85. CENÁRIO DE TESTE 03 — REEMBOLSO

Edição possui 641 créditos válidos.

Um crédito é reembolsado antes da confirmação.

Resultado:

- crédito deixa de ser elegível;
- capital protegido cai;
- quórum recalcula;
- edição pode retornar a estado financeiro insuficiente segundo regra;
- snapshot registra a mudança;
- auditoria preservada.

---

# 86. CENÁRIO DE TESTE 04 — TENTATIVA DE CONFIRMAÇÃO

Edição está financeiramente abaixo da condição necessária.

Admin tenta confirmar.

Resultado:

- transição negada;
- nenhum status é alterado;
- tentativa pode ser auditada;
- motivo da negativa é retornado.

---

# 87. CENÁRIO DE TESTE 05 — TRANSFERÊNCIA

Ticket A pertence ao cliente X.

X transfere para Y.

Resultado esperado:

- ticket de X deixa de estar ativo;
- Y recebe um ticket válido;
- no máximo um acesso ativo;
- histórico preserva origem;
- QR antigo deixa de funcionar.

---

# 88. CENÁRIO DE TESTE 06 — CHECK-IN DUPLO

Mesmo QR é lido simultaneamente em dois scanners.

Resultado:

- somente uma transação consegue consumir o ticket;
- primeiro check-in válido vence;
- segundo recebe resposta de já utilizado/inválido;
- banco preserva unicidade.

---

# 89. CENÁRIO DE TESTE 07 — ADIANTAMENTO

Despesa:

R$ 600.

Pago por pessoa com recursos pessoais.

Resultado:

- despesa possui pagamento;
- adiantamento de R$600 é criado;
- conta-corrente mostra R$600 de obrigação;
- DRE reconhece despesa;
- caixa da empresa não é falsamente reduzido como se ela própria tivesse realizado o pagamento.

---

# 90. CENÁRIO DE TESTE 08 — BAR NÃO SALVA QUÓRUM

Evento:

- custos protegidos insuficientemente cobertos;
- previsão de bar: R$40.000.

Resultado:

A previsão de bar não altera capital protegido.

Status permanece:

`NAO_VIAVEL`

---

# 91. DECISÕES QUE PERMANECEM EM ABERTO

O modelo não fixa:

- gateway definitivo;
- preço fundador;
- preço público;
- política jurídica definitiva;
- meia-entrada;
- política de menores;
- regra final de rollover;
- limite final de transferência;
- modelo operacional definitivo de bar;
- stack completa.

O banco deverá suportar essas decisões sem inventá-las.

---

# 92. RECOMENDAÇÃO DE ORGANIZAÇÃO NO POSTGRESQL

Proposta para a fase física:

- `public` ou `core`: identidade e edição;
- `commerce`: pagamentos, créditos, tickets;
- `finance`: custos, ledger, conciliação;
- `operations`: produção, portaria, bar;
- `crm`: aquisição e relacionamento;
- `audit`: auditoria.

Não é obrigatório usar múltiplos schemas na V1.

A prioridade é consistência, migrações controladas e clareza.

---

# 93. MIGRAÇÕES

Toda alteração estrutural futura deverá ocorrer por migração versionada.

Nunca:

- editar tabela manualmente em produção sem migration;
- remover coluna financeira sem plano de transição;
- reutilizar enum/status com significado diferente.

Cada migration crítica deve possuir:

- descrição;
- rollback ou estratégia de reversão;
- teste em HML;
- backup/snapshot quando pertinente.

---

# 94. DEFINIÇÃO DE PRONTO DESTE MODELO

O modelo será considerado suficiente para avançar quando suportar sem contradição:

1. lead antes de conta;
2. pessoa única;
3. edição;
4. pagamento idempotente;
5. crédito vinculado à edição;
6. quórum derivado;
7. GO/NO-GO;
8. membro diferente de comprador público;
9. ingresso único;
10. transferência sem duplicação;
11. check-in atômico;
12. despesa;
13. pagamento pessoal;
14. conta-corrente;
15. receita garantida;
16. bar separado;
17. conciliação;
18. DRE;
19. auditoria;
20. encerramento.

---

# 95. PRÓXIMO PASSO CANÔNICO

Depois da validação deste Modelo de Dados:

# UX FLOW

O UX Flow deverá traduzir os estados e relações deste documento em jornadas e telas.

A ordem deverá ser:

1. jornada pública;
2. jornada de cadastro;
3. jornada do membro;
4. jornada de pagamento;
5. jornada administrativa de criação da edição;
6. jornada financeira/quórum;
7. jornada de confirmação;
8. venda pública;
9. produção;
10. portaria;
11. fechamento.

A UX não poderá criar atalhos que violem as invariantes do banco.

---

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
