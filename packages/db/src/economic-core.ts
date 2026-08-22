import pg from 'pg';
import { calculateQuorum, type QuorumResult } from '../../domain/src/quorum.ts';
import { evaluateGoNoGo } from '../../domain/src/go-no-go.ts';
import { assertEventTransition, type EventStatus } from '../../domain/src/event-state.ts';
import { assertNonNegativeMoney, type MoneyCents } from '../../domain/src/money.ts';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

export type ContingencyInput =
  | { type: 'fixed'; amount: MoneyCents }
  | { type: 'percentage'; basisPoints: number };

export interface CreateEventInput {
  eventCode: string;
  name: string;
  slug: string;
  capacity?: number;
  createdBy: string;
}

export interface FinancialConfigInput {
  eventId: string;
  founderTicketGross: MoneyCents;
  estimatedFeePerMember: MoneyCents;
  variableCostPerMember: MoneyCents;
  contingency: ContingencyInput;
  approvedExposureLimit: MoneyCents;
  createdBy: string;
}

export interface CostInput {
  eventId: string;
  category: string;
  description: string;
  costType: 'fixed' | 'variable' | 'provision' | 'tax' | 'other';
  amount: MoneyCents;
  createdBy: string;
}

export interface RevenueInput {
  eventId: string;
  revenueType: 'sponsorship' | 'guaranteed_partner' | 'other_guaranteed';
  counterparty?: string;
  grossAmount: MoneyCents;
  eligibleAmount: MoneyCents;
  status: 'promised' | 'contracted' | 'partially_received' | 'received';
}

export interface PendingPaymentInput {
  profileId: string;
  eventId: string;
  amountGross: MoneyCents;
  idempotencyKey: string;
}

export interface ConfirmPaymentInput {
  paymentId: string;
  gatewayEventId: string;
  payloadHash: string;
  actorUserId?: string;
}

export interface RefundPaymentInput {
  paymentId: string;
  actorUserId: string;
  reason: string;
}

export interface QuorumSnapshotResult extends QuorumResult {
  snapshotId: string;
  financialConfigId: string;
  validCreditCount: number;
  protectedCosts: MoneyCents;
  contingency: MoneyCents;
  guaranteedRevenue: MoneyCents;
  eventStatus: EventStatus;
}

function moneyToDb(cents: MoneyCents): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function decimalToScaled(value: string | number | bigint, scale: number): bigint {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`INVALID_DECIMAL:${text}`);
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fractionRaw = (match[3] ?? '').padEnd(scale, '0').slice(0, scale);
  const factor = 10n ** BigInt(scale);
  const fraction = fractionRaw ? BigInt(fractionRaw) : 0n;
  return sign * (whole * factor + fraction);
}

function dbMoneyToCents(value: string | number | bigint): MoneyCents {
  return decimalToScaled(value, 2);
}

function scaledToDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const whole = abs / factor;
  const fraction = (abs % factor).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function ceilPositiveDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('INVALID_DIVISOR');
  if (numerator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

function percentage4(part: MoneyCents, total: MoneyCents): string {
  if (total <= 0n) return part > 0n ? '100.0000' : '0.0000';
  const scaled = (part * 1_000_000n) / total;
  return scaledToDecimal(scaled, 4);
}

function assertUuidLike(value: string, code: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(code);
}

export class PostgresEconomicCore {
  private readonly pool: any;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
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

  private async audit(
    client: Queryable,
    input: {
      actorUserId?: string;
      actorType?: 'user' | 'system';
      action: string;
      entityType: string;
      entityId: string;
      eventId?: string;
      before?: unknown;
      after?: unknown;
      reason?: string;
    },
  ): Promise<void> {
    await client.query(
      `insert into audit_logs(
        actor_user_id, actor_type, action, entity_type, entity_id, event_id,
        before_data, after_data, reason
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
      [
        input.actorUserId ?? null,
        input.actorType ?? (input.actorUserId ? 'user' : 'system'),
        input.action,
        input.entityType,
        input.entityId,
        input.eventId ?? null,
        input.before === undefined ? null : JSON.stringify(input.before),
        input.after === undefined ? null : JSON.stringify(input.after),
        input.reason ?? null,
      ],
    );
  }

  async createEvent(input: CreateEventInput): Promise<{ id: string; status: EventStatus }> {
    assertUuidLike(input.createdBy, 'CREATED_BY_INVALID');
    if (!input.eventCode.trim() || !input.name.trim() || !input.slug.trim()) throw new Error('EVENT_REQUIRED_FIELDS');
    if (input.capacity !== undefined && input.capacity <= 0) throw new Error('EVENT_CAPACITY_INVALID');

    return this.transaction(async (client) => {
      const result = await client.query(
        `insert into events(event_code,name,slug,capacity,created_by)
         values ($1,$2,$3,$4,$5)
         returning id,status`,
        [input.eventCode, input.name, input.slug, input.capacity ?? null, input.createdBy],
      );
      const event = result.rows[0];
      await client.query(
        `insert into event_status_history(event_id,from_status,to_status,reason,actor_user_id,automated)
         values ($1,null,'PLANEJAMENTO','EVENT_CREATED',$2,false)`,
        [event.id, input.createdBy],
      );
      await this.audit(client, {
        actorUserId: input.createdBy,
        action: 'event.created',
        entityType: 'event',
        entityId: event.id,
        eventId: event.id,
        after: { status: event.status, eventCode: input.eventCode },
      });
      return { id: event.id, status: event.status as EventStatus };
    });
  }

  async transitionEvent(eventId: string, to: EventStatus, actorUserId: string, reason: string): Promise<EventStatus> {
    return this.transaction(async (client) => {
      const currentResult = await client.query('select status from events where id=$1 for update', [eventId]);
      if (!currentResult.rows[0]) throw new Error('EVENT_NOT_FOUND');
      const from = currentResult.rows[0].status as EventStatus;
      assertEventTransition(from, to);
      await client.query('update events set status=$2, updated_at=now() where id=$1', [eventId, to]);
      await client.query(
        `insert into event_status_history(event_id,from_status,to_status,reason,actor_user_id,automated)
         values ($1,$2,$3,$4,$5,false)`,
        [eventId, from, to, reason, actorUserId],
      );
      await this.audit(client, {
        actorUserId,
        action: 'event.status_changed',
        entityType: 'event',
        entityId: eventId,
        eventId,
        before: { status: from },
        after: { status: to },
        reason,
      });
      return to;
    });
  }

  async createFinancialConfig(input: FinancialConfigInput): Promise<{ id: string; version: number }> {
    assertNonNegativeMoney(input.founderTicketGross, 'TICKET_GROSS_NEGATIVE');
    assertNonNegativeMoney(input.estimatedFeePerMember, 'FEE_NEGATIVE');
    assertNonNegativeMoney(input.variableCostPerMember, 'VARIABLE_COST_NEGATIVE');
    assertNonNegativeMoney(input.approvedExposureLimit, 'EXPOSURE_NEGATIVE');
    if (input.contingency.type === 'fixed') assertNonNegativeMoney(input.contingency.amount, 'CONTINGENCY_NEGATIVE');
    if (input.contingency.type === 'percentage' && (!Number.isInteger(input.contingency.basisPoints) || input.contingency.basisPoints < 0 || input.contingency.basisPoints > 10_000)) {
      throw new Error('CONTINGENCY_BPS_INVALID');
    }

    return this.transaction(async (client) => {
      const eventResult = await client.query('select status from events where id=$1 for update', [input.eventId]);
      if (!eventResult.rows[0]) throw new Error('EVENT_NOT_FOUND');
      const versionResult = await client.query(
        'select coalesce(max(version),0)::int + 1 as version from event_financial_configs where event_id=$1',
        [input.eventId],
      );
      const version = Number(versionResult.rows[0].version);
      await client.query('update event_financial_configs set effective_to=now() where event_id=$1 and effective_to is null', [input.eventId]);
      const contingencyValue = input.contingency.type === 'fixed'
        ? moneyToDb(input.contingency.amount)
        : (input.contingency.basisPoints / 100).toFixed(2);
      const result = await client.query(
        `insert into event_financial_configs(
          event_id,version,founder_ticket_gross,estimated_fee_per_member,variable_cost_per_member,
          contingency_type,contingency_value,approved_exposure_limit,created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        returning id`,
        [
          input.eventId,
          version,
          moneyToDb(input.founderTicketGross),
          moneyToDb(input.estimatedFeePerMember),
          moneyToDb(input.variableCostPerMember),
          input.contingency.type,
          contingencyValue,
          moneyToDb(input.approvedExposureLimit),
          input.createdBy,
        ],
      );
      const id = result.rows[0].id as string;
      await this.audit(client, {
        actorUserId: input.createdBy,
        action: 'event.financial_config_created',
        entityType: 'event_financial_config',
        entityId: id,
        eventId: input.eventId,
        after: { version, contingencyType: input.contingency.type },
      });
      if (['QUORUM_EM_ANDAMENTO', 'VIAVEL'].includes(eventResult.rows[0].status)) {
        await this.recalculateQuorumWithClient(client, input.eventId, 'financial_config_changed', id);
      }
      return { id, version };
    });
  }

  async addProtectedCost(input: CostInput): Promise<string> {
    assertNonNegativeMoney(input.amount, 'COST_NEGATIVE');
    return this.transaction(async (client) => {
      const result = await client.query(
        `insert into event_cost_items(
          event_id,category,description,cost_type,estimated_amount,approved_amount,protected,status,created_by,approved_by
        ) values ($1,$2,$3,$4,$5,$5,true,'approved',$6,$6)
        returning id`,
        [input.eventId, input.category, input.description, input.costType, moneyToDb(input.amount), input.createdBy],
      );
      const id = result.rows[0].id as string;
      await this.audit(client, {
        actorUserId: input.createdBy,
        action: 'event.cost_approved',
        entityType: 'event_cost_item',
        entityId: id,
        eventId: input.eventId,
        after: { amount: moneyToDb(input.amount), protected: true },
      });
      const eventResult = await client.query('select status from events where id=$1', [input.eventId]);
      if (eventResult.rows[0] && ['QUORUM_EM_ANDAMENTO', 'VIAVEL'].includes(eventResult.rows[0].status)) {
        await this.recalculateQuorumWithClient(client, input.eventId, 'cost_changed', id);
      }
      return id;
    });
  }

  async addGuaranteedRevenue(input: RevenueInput): Promise<string> {
    assertNonNegativeMoney(input.grossAmount, 'REVENUE_NEGATIVE');
    assertNonNegativeMoney(input.eligibleAmount, 'ELIGIBLE_REVENUE_NEGATIVE');
    if (input.eligibleAmount > input.grossAmount) throw new Error('ELIGIBLE_REVENUE_EXCEEDS_GROSS');
    if (input.status === 'promised' && input.eligibleAmount !== 0n) throw new Error('PROMISED_REVENUE_NOT_ELIGIBLE');

    return this.transaction(async (client) => {
      const eligiblePercentage = input.grossAmount === 0n
        ? '0.00'
        : scaledToDecimal((input.eligibleAmount * 10_000n) / input.grossAmount, 2);
      const result = await client.query(
        `insert into event_revenue_commitments(
          event_id,revenue_type,counterparty,gross_amount,eligible_percentage,eligible_amount,status,received_at
        ) values ($1,$2,$3,$4,$5,$6,$7,case when $7='received' then now() else null end)
        returning id`,
        [
          input.eventId,
          input.revenueType,
          input.counterparty ?? null,
          moneyToDb(input.grossAmount),
          eligiblePercentage,
          moneyToDb(input.eligibleAmount),
          input.status,
        ],
      );
      const id = result.rows[0].id as string;
      await this.audit(client, {
        action: 'event.guaranteed_revenue_recorded',
        entityType: 'event_revenue_commitment',
        entityId: id,
        eventId: input.eventId,
        after: { status: input.status, eligibleAmount: moneyToDb(input.eligibleAmount) },
      });
      const eventResult = await client.query('select status from events where id=$1', [input.eventId]);
      if (eventResult.rows[0] && ['QUORUM_EM_ANDAMENTO', 'VIAVEL'].includes(eventResult.rows[0].status)) {
        await this.recalculateQuorumWithClient(client, input.eventId, 'guaranteed_revenue_changed', id);
      }
      return id;
    });
  }

  async createPendingMockPayment(input: PendingPaymentInput): Promise<{ id: string; status: string }> {
    assertNonNegativeMoney(input.amountGross, 'PAYMENT_AMOUNT_NEGATIVE');
    if (input.amountGross <= 0n) throw new Error('PAYMENT_AMOUNT_MUST_BE_POSITIVE');
    const result = await this.pool.query(
      `insert into payments(
        profile_id,event_id,purpose,gateway,idempotency_key,amount_gross,currency_code,payment_method,status
      ) values ($1,$2,'club_credit','mock',$3,$4,'BRL','mock','pending')
      on conflict (idempotency_key) do update set idempotency_key=excluded.idempotency_key
      returning id,status`,
      [input.profileId, input.eventId, input.idempotencyKey, moneyToDb(input.amountGross)],
    );
    return { id: result.rows[0].id, status: result.rows[0].status };
  }

  async confirmMockPayment(input: ConfirmPaymentInput): Promise<{ paymentId: string; creditId: string; alreadyProcessed: boolean; snapshot: QuorumSnapshotResult }> {
    return this.transaction(async (client) => {
      const paymentResult = await client.query('select * from payments where id=$1 for update', [input.paymentId]);
      const payment = paymentResult.rows[0];
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (payment.purpose !== 'club_credit') throw new Error('PAYMENT_PURPOSE_NOT_CLUB_CREDIT');

      const receipt = await client.query(
        `insert into payment_webhook_receipts(
          gateway,gateway_event_id,event_type,signature_valid,payload_hash,processed_at,processing_status
        ) values ('mock',$1,'payment.paid',true,$2,now(),'processed')
        on conflict (gateway,gateway_event_id) do nothing
        returning id`,
        [input.gatewayEventId, input.payloadHash],
      );

      if ((receipt.rowCount ?? 0) === 0 || payment.status === 'paid') {
        const existingCredit = await client.query('select id from credits where payment_id=$1', [input.paymentId]);
        if (!existingCredit.rows[0]) throw new Error('PAID_PAYMENT_WITHOUT_CREDIT');
        const snapshot = await this.recalculateQuorumWithClient(client, payment.event_id, 'payment_idempotent_replay', input.paymentId);
        return { paymentId: input.paymentId, creditId: existingCredit.rows[0].id, alreadyProcessed: true, snapshot };
      }

      if (!['created', 'pending'].includes(payment.status)) throw new Error(`PAYMENT_STATUS_NOT_CONFIRMABLE:${payment.status}`);
      const configResult = await client.query(
        `select * from event_financial_configs
         where event_id=$1 and effective_to is null
         order by version desc limit 1`,
        [payment.event_id],
      );
      const config = configResult.rows[0];
      if (!config) throw new Error('FINANCIAL_CONFIG_NOT_FOUND');

      const amountGross = dbMoneyToCents(payment.amount_gross);
      const ticketGross = dbMoneyToCents(config.founder_ticket_gross);
      const fee = dbMoneyToCents(config.estimated_fee_per_member);
      const variableCost = dbMoneyToCents(config.variable_cost_per_member);
      if (amountGross !== ticketGross) throw new Error('PAYMENT_AMOUNT_MISMATCH');
      const amountNet = amountGross - fee;
      const protectedValue = amountNet - variableCost;
      if (amountNet <= 0n || protectedValue <= 0n) throw new Error('PAYMENT_NET_CONTRIBUTION_INVALID');

      await client.query(
        `update payments
         set status='paid', amount_fee=$2, amount_net=$3, paid_at=now(), updated_at=now()
         where id=$1`,
        [input.paymentId, moneyToDb(fee), moneyToDb(amountNet)],
      );
      await client.query(
        `insert into payment_events(payment_id,event_type,old_status,new_status,gateway_event_id,metadata)
         values ($1,'payment.paid',$2,'paid',$3,$4::jsonb)`,
        [input.paymentId, payment.status, input.gatewayEventId, JSON.stringify({ gateway: 'mock' })],
      );
      const creditResult = await client.query(
        `insert into credits(
          profile_id,event_id,payment_id,origin_type,origin_id,gross_value,protected_value,status,valid_from
        ) values ($1,$2,$3,'payment',$3,$4,$5,'valid',now())
        returning id`,
        [payment.profile_id, payment.event_id, input.paymentId, moneyToDb(amountGross), moneyToDb(protectedValue)],
      );
      const creditId = creditResult.rows[0].id as string;
      await client.query(
        `insert into credit_movements(credit_id,movement_type,amount,to_event_id,reference_type,reference_id)
         values ($1,'validated',$2,$3,'payment',$4)`,
        [creditId, moneyToDb(protectedValue), payment.event_id, input.paymentId],
      );
      await this.audit(client, {
        actorUserId: input.actorUserId,
        actorType: input.actorUserId ? 'user' : 'system',
        action: 'payment.confirmed',
        entityType: 'payment',
        entityId: input.paymentId,
        eventId: payment.event_id,
        before: { status: payment.status },
        after: { status: 'paid', creditId, protectedValue: moneyToDb(protectedValue) },
      });
      const snapshot = await this.recalculateQuorumWithClient(client, payment.event_id, 'payment_confirmed', input.paymentId);
      return { paymentId: input.paymentId, creditId, alreadyProcessed: false, snapshot };
    });
  }

  async refundMockPayment(input: RefundPaymentInput): Promise<{ refundId: string; snapshot: QuorumSnapshotResult }> {
    return this.transaction(async (client) => {
      const paymentResult = await client.query('select * from payments where id=$1 for update', [input.paymentId]);
      const payment = paymentResult.rows[0];
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (payment.status !== 'paid') throw new Error(`PAYMENT_NOT_REFUNDABLE:${payment.status}`);
      const creditResult = await client.query('select * from credits where payment_id=$1 for update', [input.paymentId]);
      const credit = creditResult.rows[0];
      if (!credit || credit.status !== 'valid') throw new Error('VALID_CREDIT_NOT_FOUND');

      const refundResult = await client.query(
        `insert into refunds(payment_id,profile_id,event_id,amount,reason,status,processed_at,requested_by)
         values ($1,$2,$3,$4,$5,'paid',now(),$6)
         returning id`,
        [input.paymentId, payment.profile_id, payment.event_id, payment.amount_gross, input.reason, input.actorUserId],
      );
      await client.query(
        `update payments set status='refunded', refunded_at=now(), updated_at=now() where id=$1`,
        [input.paymentId],
      );
      await client.query(
        `insert into payment_events(payment_id,event_type,old_status,new_status,metadata)
         values ($1,'payment.refunded','paid','refunded',$2::jsonb)`,
        [input.paymentId, JSON.stringify({ reason: input.reason })],
      );
      await client.query(`update credits set status='refunded', cancelled_at=now() where id=$1`, [credit.id]);
      await client.query(
        `insert into credit_movements(credit_id,movement_type,amount,from_event_id,reference_type,reference_id)
         values ($1,'refund',$2,$3,'refund',$4)`,
        [credit.id, credit.protected_value, payment.event_id, refundResult.rows[0].id],
      );
      await this.audit(client, {
        actorUserId: input.actorUserId,
        action: 'payment.refunded',
        entityType: 'payment',
        entityId: input.paymentId,
        eventId: payment.event_id,
        before: { status: 'paid', creditStatus: 'valid' },
        after: { status: 'refunded', creditStatus: 'refunded' },
        reason: input.reason,
      });
      const snapshot = await this.recalculateQuorumWithClient(client, payment.event_id, 'payment_refunded', refundResult.rows[0].id);
      return { refundId: refundResult.rows[0].id, snapshot };
    });
  }

  async recalculateQuorum(eventId: string, triggerType = 'manual_recalculate', triggerId?: string): Promise<QuorumSnapshotResult> {
    return this.transaction((client) => this.recalculateQuorumWithClient(client, eventId, triggerType, triggerId));
  }

  private async recalculateQuorumWithClient(client: Queryable, eventId: string, triggerType: string, triggerId?: string): Promise<QuorumSnapshotResult> {
    const eventResult = await client.query('select status from events where id=$1 for update', [eventId]);
    if (!eventResult.rows[0]) throw new Error('EVENT_NOT_FOUND');
    const currentStatus = eventResult.rows[0].status as EventStatus;

    const configResult = await client.query(
      `select * from event_financial_configs
       where event_id=$1 and effective_to is null
       order by version desc limit 1`,
      [eventId],
    );
    const config = configResult.rows[0];
    if (!config) throw new Error('FINANCIAL_CONFIG_NOT_FOUND');

    const costsResult = await client.query(
      `select coalesce(sum(coalesce(approved_amount,estimated_amount)),0)::text as total
       from event_cost_items
       where event_id=$1 and protected=true and status='approved'`,
      [eventId],
    );
    const revenueResult = await client.query(
      `select coalesce(sum(eligible_amount),0)::text as total
       from event_revenue_commitments
       where event_id=$1 and status in ('contracted','partially_received','received')`,
      [eventId],
    );
    const creditsResult = await client.query(
      `select coalesce(sum(protected_value),0)::text as total, count(*)::int as count
       from credits where event_id=$1 and status='valid'`,
      [eventId],
    );

    const protectedCosts = dbMoneyToCents(costsResult.rows[0].total);
    const guaranteedRevenue = dbMoneyToCents(revenueResult.rows[0].total);
    const protectedCapital = dbMoneyToCents(creditsResult.rows[0].total);
    const validCreditCount = Number(creditsResult.rows[0].count);
    let contingency: MoneyCents;
    if (config.contingency_type === 'fixed') {
      contingency = dbMoneyToCents(config.contingency_value);
    } else if (config.contingency_type === 'percentage') {
      const basisPoints = decimalToScaled(config.contingency_value, 2);
      contingency = ceilPositiveDiv(protectedCosts * basisPoints, 10_000n);
    } else {
      throw new Error('CONTINGENCY_TYPE_INVALID');
    }

    const result = calculateQuorum({
      protectedCosts,
      contingency,
      guaranteedRevenue,
      ticketGross: dbMoneyToCents(config.founder_ticket_gross),
      feePerMember: dbMoneyToCents(config.estimated_fee_per_member),
      variableCostPerMember: dbMoneyToCents(config.variable_cost_per_member),
      protectedCapital,
    });
    if (result.quorumMinimum > 2_147_483_647n) throw new Error('QUORUM_EXCEEDS_INTEGER');

    const snapshotResult = await client.query(
      `insert into quorum_snapshots(
        event_id,financial_config_id,protected_costs,contingency_amount,guaranteed_revenue,financial_need,
        valid_credit_count,protected_capital,quorum_minimum,protected_percentage,deficit,surplus,
        financial_status,trigger_type,trigger_id
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      returning id`,
      [
        eventId,
        config.id,
        moneyToDb(protectedCosts),
        moneyToDb(contingency),
        moneyToDb(guaranteedRevenue),
        moneyToDb(result.financialNeed),
        validCreditCount,
        moneyToDb(protectedCapital),
        Number(result.quorumMinimum),
        percentage4(protectedCapital, result.financialNeed),
        moneyToDb(result.deficit),
        moneyToDb(result.surplus),
        result.status,
        triggerType,
        triggerId ?? null,
      ],
    );

    let eventStatus = currentStatus;
    let target: EventStatus | null = null;
    if (currentStatus === 'QUORUM_EM_ANDAMENTO' && result.status === 'VIAVEL') target = 'VIAVEL';
    if (currentStatus === 'VIAVEL' && result.status === 'NAO_VIAVEL') target = 'QUORUM_EM_ANDAMENTO';
    if (target) {
      assertEventTransition(currentStatus, target);
      await client.query('update events set status=$2, updated_at=now() where id=$1', [eventId, target]);
      await client.query(
        `insert into event_status_history(event_id,from_status,to_status,reason,automated)
         values ($1,$2,$3,$4,true)`,
        [eventId, currentStatus, target, `QUORUM_RECALCULATED:${triggerType}`],
      );
      await this.audit(client, {
        actorType: 'system',
        action: 'event.status_changed_by_quorum',
        entityType: 'event',
        entityId: eventId,
        eventId,
        before: { status: currentStatus },
        after: { status: target },
        reason: triggerType,
      });
      eventStatus = target;
    }

    return {
      ...result,
      snapshotId: snapshotResult.rows[0].id,
      financialConfigId: config.id,
      validCreditCount,
      protectedCosts,
      contingency,
      guaranteedRevenue,
      eventStatus,
    };
  }

  async setConfirmationCheck(input: {
    eventId: string;
    code: string;
    label: string;
    status: 'pending' | 'approved' | 'rejected' | 'not_applicable';
    actorUserId: string;
    required?: boolean;
  }): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        `insert into event_confirmation_checks(event_id,check_code,label,required,status,validated_by,validated_at)
         values ($1,$2,$3,$4,$5,case when $5 in ('approved','not_applicable') then $6::uuid else null end,
         case when $5 in ('approved','not_applicable') then now() else null end)
         on conflict (event_id,check_code) do update set
           label=excluded.label,
           required=excluded.required,
           status=excluded.status,
           validated_by=excluded.validated_by,
           validated_at=excluded.validated_at`,
        [input.eventId, input.code, input.label, input.required ?? true, input.status, input.actorUserId],
      );
      await this.audit(client, {
        actorUserId: input.actorUserId,
        action: 'event.confirmation_check_set',
        entityType: 'event_confirmation_check',
        entityId: input.eventId,
        eventId: input.eventId,
        after: { code: input.code, status: input.status },
      });
    });
  }

  async reviewGoNoGo(input: { eventId: string; actorUserId: string; projectedRequiredExposure: MoneyCents }): Promise<{ id: string; result: 'GO' | 'NO_GO'; reasons: string[] }> {
    assertNonNegativeMoney(input.projectedRequiredExposure, 'PROJECTED_EXPOSURE_NEGATIVE');
    return this.transaction(async (client) => {
      const eventResult = await client.query('select status from events where id=$1 for update', [input.eventId]);
      if (!eventResult.rows[0]) throw new Error('EVENT_NOT_FOUND');
      const snapshotResult = await client.query(
        'select * from quorum_snapshots where event_id=$1 order by calculated_at desc,id desc limit 1',
        [input.eventId],
      );
      const snapshot = snapshotResult.rows[0];
      if (!snapshot) throw new Error('QUORUM_SNAPSHOT_NOT_FOUND');
      const configResult = await client.query(
        `select * from event_financial_configs where event_id=$1 and effective_to is null order by version desc limit 1`,
        [input.eventId],
      );
      const config = configResult.rows[0];
      if (!config || config.approved_exposure_limit === null) throw new Error('APPROVED_EXPOSURE_LIMIT_REQUIRED');
      if (snapshot.financial_config_id !== config.id) throw new Error('QUORUM_SNAPSHOT_STALE');

      const checksResult = await client.query(
        `select count(*) filter (where required=true)::int as required_count,
                count(*) filter (where required=true and status in ('approved','not_applicable'))::int as approved_count
         from event_confirmation_checks where event_id=$1`,
        [input.eventId],
      );
      const requiredCount = Number(checksResult.rows[0].required_count);
      const approvedCount = Number(checksResult.rows[0].approved_count);
      const allRequiredChecksApproved = requiredCount > 0 && requiredCount === approvedCount;
      const minimumStatus = ['VIAVEL','PROTEGIDO','SUPERAVIT'].includes(snapshot.financial_status) ? 'VIAVEL' : 'NAO_VIAVEL';
      const review = evaluateGoNoGo({
        financialStatus: minimumStatus,
        allRequiredChecksApproved,
        approvedExposureLimit: dbMoneyToCents(config.approved_exposure_limit),
        projectedRequiredExposure: input.projectedRequiredExposure,
        noFutureSalesAssumed: true,
        barRevenueAssumed: 0n,
      });
      const insert = await client.query(
        `insert into event_go_no_go_reviews(
          event_id,quorum_snapshot_id,approved_exposure_limit,projected_required_exposure,
          no_future_sales_assumed,bar_revenue_assumed,result,reason,reviewed_by
        ) values ($1,$2,$3,$4,true,0,$5,$6,$7)
        returning id`,
        [
          input.eventId,
          snapshot.id,
          config.approved_exposure_limit,
          moneyToDb(input.projectedRequiredExposure),
          review.result,
          review.reasons.join(','),
          input.actorUserId,
        ],
      );
      await this.audit(client, {
        actorUserId: input.actorUserId,
        action: 'event.go_no_go_reviewed',
        entityType: 'event_go_no_go_review',
        entityId: insert.rows[0].id,
        eventId: input.eventId,
        after: { result: review.result, reasons: review.reasons, snapshotId: snapshot.id },
      });
      return { id: insert.rows[0].id, result: review.result, reasons: review.reasons };
    });
  }

  async confirmEvent(input: { eventId: string; actorUserId: string; reason: string }): Promise<{ status: 'CONFIRMADO' }> {
    return this.transaction(async (client) => {
      const eventResult = await client.query('select * from events where id=$1 for update', [input.eventId]);
      const event = eventResult.rows[0];
      if (!event) throw new Error('EVENT_NOT_FOUND');
      if (event.status !== 'VIAVEL') throw new Error('EVENT_NOT_VIABLE');

      const snapshotResult = await client.query(
        'select * from quorum_snapshots where event_id=$1 order by calculated_at desc,id desc limit 1',
        [input.eventId],
      );
      const snapshot = snapshotResult.rows[0];
      if (!snapshot || !['VIAVEL','PROTEGIDO','SUPERAVIT'].includes(snapshot.financial_status)) throw new Error('LATEST_QUORUM_NOT_VIABLE');
      const configResult = await client.query(
        `select * from event_financial_configs where event_id=$1 and effective_to is null order by version desc limit 1`,
        [input.eventId],
      );
      const config = configResult.rows[0];
      if (!config || snapshot.financial_config_id !== config.id) throw new Error('QUORUM_SNAPSHOT_STALE');

      const reviewResult = await client.query(
        `select * from event_go_no_go_reviews where event_id=$1 order by reviewed_at desc,id desc limit 1`,
        [input.eventId],
      );
      const review = reviewResult.rows[0];
      if (!review || review.quorum_snapshot_id !== snapshot.id) throw new Error('GO_NO_GO_REVIEW_STALE');

      const checksResult = await client.query(
        `select count(*) filter (where required=true)::int as required_count,
                count(*) filter (where required=true and status in ('approved','not_applicable'))::int as approved_count
         from event_confirmation_checks where event_id=$1`,
        [input.eventId],
      );
      const requiredCount = Number(checksResult.rows[0].required_count);
      const approvedCount = Number(checksResult.rows[0].approved_count);
      const gate = evaluateGoNoGo({
        financialStatus: 'VIAVEL',
        allRequiredChecksApproved: requiredCount > 0 && requiredCount === approvedCount,
        approvedExposureLimit: dbMoneyToCents(config.approved_exposure_limit),
        projectedRequiredExposure: dbMoneyToCents(review.projected_required_exposure),
        noFutureSalesAssumed: review.no_future_sales_assumed === true,
        barRevenueAssumed: dbMoneyToCents(review.bar_revenue_assumed),
      });
      if (review.result !== 'GO' || gate.result !== 'GO') throw new Error(`EVENT_CONFIRMATION_BLOCKED:${gate.reasons.join('|')}`);

      assertEventTransition('VIAVEL', 'CONFIRMADO');
      await client.query(`update events set status='CONFIRMADO',confirmed_at=now(),updated_at=now() where id=$1`, [input.eventId]);
      await client.query(
        `insert into event_status_history(event_id,from_status,to_status,reason,actor_user_id,automated)
         values ($1,'VIAVEL','CONFIRMADO',$2,$3,false)`,
        [input.eventId, input.reason, input.actorUserId],
      );
      await this.audit(client, {
        actorUserId: input.actorUserId,
        action: 'event.confirmed',
        entityType: 'event',
        entityId: input.eventId,
        eventId: input.eventId,
        before: { status: 'VIAVEL' },
        after: { status: 'CONFIRMADO', snapshotId: snapshot.id, reviewId: review.id },
        reason: input.reason,
      });
      return { status: 'CONFIRMADO' };
    });
  }
}
