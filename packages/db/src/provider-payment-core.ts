import pg from 'pg';
import { PostgresEconomicCore } from './economic-core.ts';
import type { VerifiedWebhook } from '../../payments/provider-contract.ts';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

function assertUuid(value: string, code: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(String(value ?? ''))) throw new Error(code);
}

function toMoney(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

function toMinor(value: string | number | bigint, code: string): bigint {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(code);
  const sign = match[1] === '-' ? -1n : 1n;
  return sign * (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0')));
}

export interface FreezeProviderQuoteInput {
  providerSubject: string;
  intentId: string;
  paymentMethod: 'pix' | 'card';
  installmentCount: number | null;
  baseAmountMinor: bigint;
  processingFeeMinor: bigint;
  totalMinor: bigint;
  feeSnapshot: Record<string, unknown>;
  feeSourceHash: string;
}

export interface BindProviderCheckoutInput {
  providerSubject: string;
  intentId: string;
  providerSessionId: string;
  expiresAt?: string | null;
}

export class PostgresProviderPaymentCore {
  private readonly pool: any;
  private readonly economic: PostgresEconomicCore;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
    this.economic = new PostgresEconomicCore(connectionString);
  }

  async close(): Promise<void> {
    await Promise.all([this.pool.end(), this.economic.close()]);
  }

  private async transaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async freezeQuote(input: FreezeProviderQuoteInput) {
    assertUuid(input.intentId, 'CHECKOUT_INTENT_ID_INVALID');
    if (!input.providerSubject.trim()) throw new Error('PROVIDER_SUBJECT_REQUIRED');
    if (input.baseAmountMinor <= 0n || input.processingFeeMinor < 0n || input.totalMinor <= 0n) throw new Error('CHECKOUT_QUOTE_AMOUNT_INVALID');
    if (input.totalMinor !== input.baseAmountMinor + input.processingFeeMinor) throw new Error('CHECKOUT_QUOTE_COMPOSITION_INVALID');
    if (!input.feeSourceHash.trim()) throw new Error('CHECKOUT_FEE_SOURCE_HASH_REQUIRED');
    if (input.paymentMethod === 'pix' && input.installmentCount !== null) throw new Error('CHECKOUT_PIX_INSTALLMENTS_INVALID');
    if (input.paymentMethod === 'card' && (!Number.isInteger(input.installmentCount) || (input.installmentCount ?? 0) < 1 || (input.installmentCount ?? 0) > 21)) {
      throw new Error('CHECKOUT_CARD_INSTALLMENTS_INVALID');
    }

    return this.transaction(async (client) => {
      const result = await client.query(
        `select ci.*,u.id user_id,c.founder_ticket_gross,c.fee_pass_through
         from checkout_intents ci
         join users u on u.profile_id=ci.profile_id and u.auth_provider='supabase' and u.provider_subject=$2 and u.status='active'
         join event_financial_configs c on c.id=ci.financial_config_id
         where ci.id=$1 for update of ci`,
        [input.intentId, input.providerSubject],
      );
      const intent = result.rows[0];
      if (!intent) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
      if (!['draft','ready'].includes(intent.status)) throw new Error(`CHECKOUT_INTENT_NOT_QUOTABLE:${intent.status}`);
      if (intent.fee_pass_through !== true) throw new Error('CHECKOUT_FEE_PASS_THROUGH_REQUIRED');
      const configuredBase = toMinor(intent.founder_ticket_gross, 'CHECKOUT_CONFIG_PRICE_INVALID');
      if (configuredBase !== input.baseAmountMinor) throw new Error('CHECKOUT_BASE_AMOUNT_MISMATCH');

      if (intent.status === 'ready') {
        const same = String(intent.provider) === 'asaas'
          && toMinor(intent.base_amount, 'CHECKOUT_BASE_AMOUNT_INVALID') === input.baseAmountMinor
          && toMinor(intent.processing_fee_amount, 'CHECKOUT_FEE_AMOUNT_INVALID') === input.processingFeeMinor
          && toMinor(intent.amount_gross, 'CHECKOUT_TOTAL_INVALID') === input.totalMinor
          && intent.payment_method === input.paymentMethod
          && Number(intent.installment_count ?? 0) === Number(input.installmentCount ?? 0)
          && String(intent.fee_source_hash ?? '') === input.feeSourceHash;
        if (!same) throw new Error('CHECKOUT_QUOTE_ALREADY_FROZEN');
        return { id: intent.id, status: intent.status, replayed: true };
      }

      await client.query(
        `update checkout_intents
         set provider='asaas',status='ready',base_amount=$2,processing_fee_amount=$3,amount_gross=$4,
             payment_method=$5,installment_count=$6,fee_snapshot=$7::jsonb,fee_source_hash=$8,fee_quoted_at=now(),updated_at=now()
         where id=$1`,
        [input.intentId,toMoney(input.baseAmountMinor),toMoney(input.processingFeeMinor),toMoney(input.totalMinor),input.paymentMethod,input.installmentCount,JSON.stringify(input.feeSnapshot),input.feeSourceHash],
      );
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
         values ($1,'user','checkout.fee_quote_frozen','checkout_intent',$2,$3,$4::jsonb,'ASAAS_FEE_PASS_THROUGH')`,
        [intent.user_id,intent.id,intent.event_id,JSON.stringify({provider:'asaas',baseAmount:toMoney(input.baseAmountMinor),processingFee:toMoney(input.processingFeeMinor),total:toMoney(input.totalMinor),paymentMethod:input.paymentMethod,installmentCount:input.installmentCount,feeSourceHash:input.feeSourceHash})],
      );
      return { id: intent.id, status: 'ready', replayed: false };
    });
  }

  async bindCheckout(input: BindProviderCheckoutInput) {
    assertUuid(input.intentId, 'CHECKOUT_INTENT_ID_INVALID');
    if (!input.providerSubject.trim()) throw new Error('PROVIDER_SUBJECT_REQUIRED');
    if (!input.providerSessionId.trim()) throw new Error('PROVIDER_SESSION_ID_REQUIRED');

    return this.transaction(async (client) => {
      const result = await client.query(
        `select ci.*,u.id user_id
         from checkout_intents ci
         join users u on u.profile_id=ci.profile_id and u.auth_provider='supabase' and u.provider_subject=$2 and u.status='active'
         where ci.id=$1 for update of ci`,
        [input.intentId,input.providerSubject],
      );
      const intent = result.rows[0];
      if (!intent) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
      if (intent.provider !== 'asaas') throw new Error('CHECKOUT_PROVIDER_NOT_ASAAS');
      if (!['ready','pending'].includes(intent.status)) throw new Error(`CHECKOUT_INTENT_NOT_STARTABLE:${intent.status}`);
      if (intent.status === 'pending') {
        if (intent.provider_session_id !== input.providerSessionId) throw new Error('CHECKOUT_PROVIDER_SESSION_CONFLICT');
        const existing = await client.query(`select id,status from payments where checkout_intent_id=$1`, [intent.id]);
        if (!existing.rows[0]) throw new Error('CHECKOUT_PENDING_WITHOUT_PAYMENT');
        return { paymentId: existing.rows[0].id, status: existing.rows[0].status, replayed: true };
      }

      await client.query(
        `update checkout_intents set provider_session_id=$2,status='pending',provider_started_at=now(),expires_at=$3,
         reconciliation_status='not_required',provider_error_code=null,updated_at=now() where id=$1`,
        [intent.id,input.providerSessionId,input.expiresAt ?? null],
      );
      const payment = await client.query(
        `insert into payments(profile_id,event_id,checkout_intent_id,purpose,gateway,idempotency_key,amount_gross,base_amount,
          processing_fee_passed,currency_code,payment_method,status)
         values ($1,$2,$3,'club_credit','asaas',$4,$5,$6,$7,$8,$9,'pending')
         on conflict (checkout_intent_id) where checkout_intent_id is not null
         do update set checkout_intent_id=excluded.checkout_intent_id
         returning id,status`,
        [intent.profile_id,intent.event_id,intent.id,`asaas-checkout:${intent.id}`,intent.amount_gross,intent.base_amount,intent.processing_fee_amount,intent.currency_code,intent.payment_method],
      );
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
         values ($1,'user','checkout.provider_started','checkout_intent',$2,$3,$4::jsonb,'ASAAS_CHECKOUT_CREATED')`,
        [intent.user_id,intent.id,intent.event_id,JSON.stringify({providerSessionId:input.providerSessionId,paymentId:payment.rows[0].id})],
      );
      return { paymentId: payment.rows[0].id, status: payment.rows[0].status, replayed: false };
    });
  }

  async markCheckoutReconciliationRequired(intentId: string, code: string): Promise<void> {
    assertUuid(intentId, 'CHECKOUT_INTENT_ID_INVALID');
    await this.pool.query(
      `update checkout_intents set reconciliation_status='required',provider_error_code=$2,updated_at=now()
       where id=$1 and status in ('ready','pending')`,
      [intentId,String(code || 'ASAAS_UNKNOWN_ERROR').slice(0,120)],
    );
  }

  async processVerifiedWebhook(webhook: VerifiedWebhook) {
    if (webhook.provider !== 'asaas' || webhook.signatureVerified !== true) throw new Error('ASAAS_WEBHOOK_NOT_VERIFIED');
    assertUuid(webhook.checkoutIntentId, 'CHECKOUT_INTENT_ID_INVALID');

    const result = await this.transaction(async (client) => {
      const intentResult = await client.query(`select * from checkout_intents where id=$1 for update`, [webhook.checkoutIntentId]);
      const intent = intentResult.rows[0];
      if (!intent) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
      if (intent.provider !== 'asaas') throw new Error('CHECKOUT_PROVIDER_MISMATCH');
      if (String(intent.currency_code).toUpperCase() !== webhook.currencyCode.toUpperCase()) throw new Error('PAYMENT_WEBHOOK_CURRENCY_MISMATCH');
      if (toMinor(intent.amount_gross,'CHECKOUT_TOTAL_INVALID') !== webhook.amountMinor) throw new Error('PAYMENT_WEBHOOK_AMOUNT_MISMATCH');
      if (intent.payment_method && webhook.paymentMethod && intent.payment_method !== webhook.paymentMethod) throw new Error('PAYMENT_WEBHOOK_METHOD_MISMATCH');

      const receipt = await client.query(
        `insert into payment_webhook_receipts(gateway,gateway_event_id,event_type,signature_valid,payload_hash,checkout_intent_id,processed_at,processing_status)
         values ('asaas',$1,$2,true,$3,$4,now(),'processed')
         on conflict (gateway,gateway_event_id) do nothing returning id`,
        [webhook.providerEventId,`payment.${webhook.eventType}`,webhook.rawPayloadHash,intent.id],
      );
      const paymentResult = await client.query(`select * from payments where checkout_intent_id=$1 for update`, [intent.id]);
      const payment = paymentResult.rows[0];
      if (!payment) throw new Error('CHECKOUT_PAYMENT_NOT_FOUND');
      if (payment.gateway_payment_id && payment.gateway_payment_id !== webhook.providerPaymentId) throw new Error('PAYMENT_PROVIDER_ID_CONFLICT');
      if (!payment.gateway_payment_id) await client.query(`update payments set gateway_payment_id=$2,updated_at=now() where id=$1`, [payment.id,webhook.providerPaymentId]);

      if ((receipt.rowCount ?? 0) === 0) return { paymentId: payment.id, eventType: webhook.eventType, replayed: true, eventId: intent.event_id, changedEconomicState: ['paid','refunded','chargeback'].includes(webhook.eventType) };

      const oldStatus = payment.status;
      if (webhook.eventType === 'pending') {
        await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values ($1,'payment.pending',$2,$2,$3,$4::jsonb)`, [payment.id,oldStatus,webhook.providerEventId,JSON.stringify({gateway:'asaas'})]);
        return { paymentId: payment.id, eventType: webhook.eventType, replayed: false, eventId: intent.event_id, changedEconomicState: false };
      }

      if (webhook.eventType === 'failed') {
        if (['paid','refunded','chargeback'].includes(oldStatus)) throw new Error(`PAYMENT_FAILURE_AFTER_FINAL_STATE:${oldStatus}`);
        await client.query(`update payments set status='failed',updated_at=now() where id=$1`, [payment.id]);
        await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values ($1,'payment.failed',$2,'failed',$3,$4::jsonb)`, [payment.id,oldStatus,webhook.providerEventId,JSON.stringify({gateway:'asaas'})]);
        return { paymentId: payment.id, eventType: webhook.eventType, replayed: false, eventId: intent.event_id, changedEconomicState: false };
      }

      if (webhook.eventType === 'paid') {
        const existingCredit = await client.query(`select id,status from credits where payment_id=$1`, [payment.id]);
        if (oldStatus === 'paid') {
          if (!existingCredit.rows[0]) throw new Error('PAID_PAYMENT_WITHOUT_CREDIT');
          return { paymentId: payment.id, creditId: existingCredit.rows[0].id, eventType: webhook.eventType, replayed: true, eventId: intent.event_id, changedEconomicState: true };
        }
        if (!['created','pending','failed'].includes(oldStatus)) throw new Error(`PAYMENT_STATUS_NOT_CONFIRMABLE:${oldStatus}`);
        const configResult = await client.query(`select * from event_financial_configs where id=$1`, [intent.financial_config_id]);
        const config = configResult.rows[0];
        if (!config) throw new Error('FINANCIAL_CONFIG_NOT_FOUND');
        if (config.fee_pass_through !== true) throw new Error('PAYMENT_FEE_PASS_THROUGH_REQUIRED');
        const baseMinor = toMinor(payment.base_amount,'PAYMENT_BASE_AMOUNT_INVALID');
        const variableCostMinor = toMinor(config.variable_cost_per_member,'VARIABLE_COST_INVALID');
        const protectedMinor = baseMinor - variableCostMinor;
        if (protectedMinor <= 0n) throw new Error('PAYMENT_PROTECTED_CONTRIBUTION_INVALID');
        const providerFeeMinor = webhook.feeMinor ?? toMinor(payment.processing_fee_passed,'PAYMENT_PROCESSING_FEE_INVALID');
        const netMinor = webhook.amountMinor - providerFeeMinor;
        if (netMinor < baseMinor) throw new Error('ASAAS_ACTUAL_FEE_EXCEEDS_PASSTHROUGH');

        await client.query(`update payments set status='paid',amount_fee=$2,provider_fee_actual=$2,amount_net=$3,paid_at=now(),updated_at=now() where id=$1`, [payment.id,toMoney(providerFeeMinor),toMoney(netMinor)]);
        await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values ($1,'payment.paid',$2,'paid',$3,$4::jsonb)`, [payment.id,oldStatus,webhook.providerEventId,JSON.stringify({gateway:'asaas',providerFeeActual:toMoney(providerFeeMinor)})]);
        const credit = await client.query(
          `insert into credits(profile_id,event_id,payment_id,origin_type,origin_id,gross_value,protected_value,status,valid_from)
           values ($1,$2,$3,'payment',$3,$4,$5,'valid',now()) on conflict (payment_id) do update set payment_id=excluded.payment_id returning id`,
          [payment.profile_id,payment.event_id,payment.id,toMoney(baseMinor),toMoney(protectedMinor)],
        );
        await client.query(`insert into credit_movements(credit_id,movement_type,amount,to_event_id,reference_type,reference_id) values ($1,'validated',$2,$3,'payment',$4)`, [credit.rows[0].id,toMoney(protectedMinor),payment.event_id,payment.id]);
        await client.query(`update checkout_intents set status='pending',reconciliation_status='not_required',provider_error_code=null,updated_at=now() where id=$1`, [intent.id]);
        return { paymentId: payment.id, creditId: credit.rows[0].id, eventType: webhook.eventType, replayed: false, eventId: intent.event_id, changedEconomicState: true };
      }

      if (webhook.eventType === 'refunded' || webhook.eventType === 'chargeback') {
        if (oldStatus === webhook.eventType) return { paymentId: payment.id, eventType: webhook.eventType, replayed: true, eventId: intent.event_id, changedEconomicState: true };
        if (oldStatus !== 'paid') throw new Error(`PAYMENT_REVERSAL_WITHOUT_PAID:${oldStatus}`);
        const credit = await client.query(`select * from credits where payment_id=$1 for update`, [payment.id]);
        if (!credit.rows[0] || credit.rows[0].status !== 'valid') throw new Error('VALID_CREDIT_NOT_FOUND');
        const targetCreditStatus = webhook.eventType === 'refunded' ? 'refunded' : 'cancelled';
        await client.query(`update payments set status=$2,refunded_at=case when $2='refunded' then now() else refunded_at end,updated_at=now() where id=$1`, [payment.id,webhook.eventType]);
        await client.query(`update credits set status=$2,cancelled_at=now() where id=$1`, [credit.rows[0].id,targetCreditStatus]);
        await client.query(`insert into credit_movements(credit_id,movement_type,amount,from_event_id,reference_type,reference_id) values ($1,'refund',$2,$3,$4,$5)`, [credit.rows[0].id,credit.rows[0].protected_value,payment.event_id,webhook.eventType,payment.id]);
        await client.query(`insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata) values ($1,$2,'paid',$3,$4,$5::jsonb)`, [payment.id,`payment.${webhook.eventType}`,webhook.eventType,webhook.providerEventId,JSON.stringify({gateway:'asaas'})]);
        return { paymentId: payment.id, creditId: credit.rows[0].id, eventType: webhook.eventType, replayed: false, eventId: intent.event_id, changedEconomicState: true };
      }

      throw new Error('PAYMENT_WEBHOOK_EVENT_UNHANDLED');
    });

    let snapshot = null;
    if (result.changedEconomicState) snapshot = await this.economic.recalculateQuorum(result.eventId, `asaas_${result.eventType}`, result.paymentId);
    return { ...result, snapshot };
  }
}
