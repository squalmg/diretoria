import pg from 'pg';

const { Pool } = pg;

const OFFER_PHASES = new Set(['FORMACAO', 'QUORUM_EM_ANDAMENTO', 'VIAVEL']);

type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }> };

export interface ClubOffer {
  available: boolean;
  reason: string | null;
  event: { id: string; name: string; slug: string; status: string; currencyCode: string } | null;
  financialConfig: { id: string; version: number; founderTicketGross: string; feePassThrough: boolean } | null;
  checkoutProvider: 'unconfigured';
  paymentEnabled: false;
}

export interface CheckoutIntentInput {
  providerSubject: string;
  eventId: string;
  idempotencyKey: string;
  policyVersion?: string | null;
}

function assertNonEmpty(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export class PostgresClubCheckout {
  private readonly pool: any;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
  }

  async close(): Promise<void> { await this.pool.end(); }

  private async transaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<{ database: 'connected' }> {
    await this.pool.query('select 1');
    return { database: 'connected' };
  }

  async offerBySlug(slug: string): Promise<ClubOffer> {
    const normalized = assertNonEmpty(slug, 'EVENT_SLUG_REQUIRED');
    const result = await this.pool.query(
      `select e.id,e.name,e.slug,e.status,e.default_currency,
              c.id financial_config_id,c.version,c.founder_ticket_gross,c.fee_pass_through
       from events e
       left join event_financial_configs c on c.event_id=e.id and c.effective_to is null
       where e.slug=$1
       limit 1`,
      [normalized],
    );
    const row = result.rows[0];
    if (!row) return { available: false, reason: 'EVENT_NOT_FOUND', event: null, financialConfig: null, checkoutProvider: 'unconfigured', paymentEnabled: false };
    const event = { id: row.id, name: row.name, slug: row.slug, status: row.status, currencyCode: row.default_currency };
    if (!OFFER_PHASES.has(row.status)) return { available: false, reason: 'CLUB_OFFER_PHASE_BLOCKED', event, financialConfig: null, checkoutProvider: 'unconfigured', paymentEnabled: false };
    if (!row.financial_config_id) return { available: false, reason: 'FINANCIAL_CONFIG_REQUIRED', event, financialConfig: null, checkoutProvider: 'unconfigured', paymentEnabled: false };
    if (Number(row.founder_ticket_gross) <= 0) return { available: false, reason: 'FOUNDER_PRICE_REQUIRED', event, financialConfig: null, checkoutProvider: 'unconfigured', paymentEnabled: false };
    return {
      available: true,
      reason: null,
      event,
      financialConfig: {
        id: row.financial_config_id,
        version: Number(row.version),
        founderTicketGross: String(row.founder_ticket_gross),
        feePassThrough: row.fee_pass_through === true,
      },
      checkoutProvider: 'unconfigured',
      paymentEnabled: false,
    };
  }

  async createIntent(input: CheckoutIntentInput): Promise<{ id: string; status: string; provider: string; amountGross: string; baseAmount: string; processingFeeAmount: string; financialConfigId: string; replayed: boolean }> {
    const providerSubject = assertNonEmpty(input.providerSubject, 'PROVIDER_SUBJECT_REQUIRED');
    const eventId = assertNonEmpty(input.eventId, 'EVENT_ID_REQUIRED');
    const idempotencyKey = assertNonEmpty(input.idempotencyKey, 'IDEMPOTENCY_KEY_REQUIRED');
    if (idempotencyKey.length > 255) throw new Error('IDEMPOTENCY_KEY_TOO_LONG');

    return this.transaction(async (client) => {
      const existing = await client.query(
        `select id,profile_id,event_id,financial_config_id,status,provider,amount_gross,base_amount,processing_fee_amount
         from checkout_intents where idempotency_key=$1 for update`,
        [idempotencyKey],
      );
      if (existing.rows[0]) {
        const account = await client.query(`select profile_id from users where auth_provider='supabase' and provider_subject=$1 and status='active'`, [providerSubject]);
        if (!account.rows[0] || account.rows[0].profile_id !== existing.rows[0].profile_id || existing.rows[0].event_id !== eventId) throw new Error('CHECKOUT_IDEMPOTENCY_CONFLICT');
        return {
          id: existing.rows[0].id,
          status: existing.rows[0].status,
          provider: existing.rows[0].provider,
          amountGross: String(existing.rows[0].amount_gross),
          baseAmount: String(existing.rows[0].base_amount),
          processingFeeAmount: String(existing.rows[0].processing_fee_amount),
          financialConfigId: existing.rows[0].financial_config_id,
          replayed: true,
        };
      }

      const account = await client.query(
        `select u.id user_id,u.profile_id,p.status profile_status
         from users u join profiles p on p.id=u.profile_id
         where u.auth_provider='supabase' and u.provider_subject=$1 and u.status='active'
         for update of u,p`,
        [providerSubject],
      );
      if (!account.rows[0]) throw new Error('MEMBER_ACCOUNT_NOT_FOUND');
      if (account.rows[0].profile_status === 'blocked' || account.rows[0].profile_status === 'archived') throw new Error('MEMBER_PROFILE_NOT_ACTIVE');

      const event = await client.query(
        `select e.id,e.status,e.default_currency,c.id financial_config_id,c.founder_ticket_gross
         from events e
         left join event_financial_configs c on c.event_id=e.id and c.effective_to is null
         where e.id=$1 for update of e`,
        [eventId],
      );
      const row = event.rows[0];
      if (!row) throw new Error('EVENT_NOT_FOUND');
      if (!OFFER_PHASES.has(row.status)) throw new Error('CLUB_OFFER_PHASE_BLOCKED');
      if (!row.financial_config_id) throw new Error('FINANCIAL_CONFIG_REQUIRED');
      if (Number(row.founder_ticket_gross) <= 0) throw new Error('FOUNDER_PRICE_REQUIRED');

      const inserted = await client.query(
        `insert into checkout_intents(
          profile_id,event_id,financial_config_id,purpose,provider,idempotency_key,
          amount_gross,base_amount,processing_fee_amount,currency_code,status,policy_version
        ) values ($1,$2,$3,'club_credit','unconfigured',$4,$5,$5,0,$6,'draft',$7)
        returning id,status,provider,amount_gross,base_amount,processing_fee_amount,financial_config_id`,
        [account.rows[0].profile_id, eventId, row.financial_config_id, idempotencyKey, row.founder_ticket_gross, row.default_currency, input.policyVersion ?? null],
      );
      const intent = inserted.rows[0];
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
         values ($1,'user','checkout.intent_created','checkout_intent',$2,$3,$4::jsonb,'GATEWAY_NOT_CONFIGURED')`,
        [account.rows[0].user_id, intent.id, eventId, JSON.stringify({
          provider: 'unconfigured',
          status: 'draft',
          financialConfigId: intent.financial_config_id,
          amountGross: String(intent.amount_gross),
          baseAmount: String(intent.base_amount),
          processingFeeAmount: String(intent.processing_fee_amount),
        })],
      );
      return {
        id: intent.id,
        status: intent.status,
        provider: intent.provider,
        amountGross: String(intent.amount_gross),
        baseAmount: String(intent.base_amount),
        processingFeeAmount: String(intent.processing_fee_amount),
        financialConfigId: intent.financial_config_id,
        replayed: false,
      };
    });
  }

  async getIntent(providerSubject: string, intentId: string) {
    const result = await this.pool.query(
      `select ci.id,ci.event_id,ci.financial_config_id,ci.provider,ci.provider_session_id,
              ci.amount_gross,ci.base_amount,ci.processing_fee_amount,ci.payment_method,ci.installment_count,
              ci.currency_code,ci.status,ci.policy_version,ci.fee_snapshot,ci.fee_source_hash,ci.fee_quoted_at,
              ci.created_at,ci.expires_at
       from checkout_intents ci
       join users u on u.profile_id=ci.profile_id
       where u.auth_provider='supabase' and u.provider_subject=$1 and u.status='active' and ci.id=$2`,
      [assertNonEmpty(providerSubject, 'PROVIDER_SUBJECT_REQUIRED'), assertNonEmpty(intentId, 'CHECKOUT_INTENT_ID_REQUIRED')],
    );
    if (!result.rows[0]) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
    return result.rows[0];
  }
}
