import pg from 'pg';
import { createHash } from 'node:crypto';
import { AsaasPaymentAdapter } from '../../payments/asaas-adapter.ts';
import { quoteAsaasPassThrough, type AsaasPassThroughQuote, type AsaasQuoteMethod } from '../../payments/asaas-fees.ts';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };
const OFFER_PHASES = new Set(['FORMACAO', 'QUORUM_EM_ANDAMENTO', 'VIAVEL']);

type SelectedMethod = 'pix' | 'card';

export interface AsaasCheckoutOrchestratorConfig {
  connectionString: string;
  adapter: AsaasPaymentAdapter;
  requiredPolicyCodes: string[];
  policyContext?: string;
  webhookUrl: string;
}

export interface AsaasQuoteView {
  provider: 'asaas';
  method: SelectedMethod;
  installments: number | null;
  baseAmount: string;
  processingFeeAmount: string;
  totalAmount: string;
  quoteFingerprint: string;
  feeModel: {
    mode: string;
    fixedMinor: string;
    percentageBasisPoints: string;
    minimumMinor: string | null;
    maximumMinor: string | null;
    promotional: boolean;
    discountExpiration: string | null;
  };
}

export interface AsaasQuoteOption {
  method: SelectedMethod;
  available: boolean;
  quote?: AsaasQuoteView;
  reason?: string;
}

export type StartCheckoutResult =
  | {
      started: false;
      reason: 'quote_changed';
      quote: AsaasQuoteView;
    }
  | {
      started: true;
      replayed: boolean;
      checkoutIntentId: string;
      paymentId: string;
      providerSessionId: string;
      redirectUrl: string;
      expiresAt: string | null;
      quote: AsaasQuoteView;
    };

function required(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertUuid(value: string, code: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(code);
}

function dbMoneyToMinor(value: string | number | bigint): bigint {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('INVALID_MONEY_DECIMAL');
  const sign = match[1] === '-' ? -1n : 1n;
  return sign * (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0')));
}

function minorToDb(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizePolicyCodes(codes: string[]): string[] {
  const normalized = [...new Set(codes.map((code) => required(code, 'ASAAS_REQUIRED_POLICY_CODE_INVALID').toLowerCase()))].sort();
  if (!normalized.length) throw new Error('ASAAS_REQUIRED_POLICY_CODES_REQUIRED');
  return normalized;
}

function quoteMethod(method: SelectedMethod): AsaasQuoteMethod {
  return method === 'pix' ? { method: 'pix' } : { method: 'card', installments: 1 };
}

function quoteSnapshot(quote: AsaasPassThroughQuote) {
  return {
    provider: quote.provider,
    method: quote.method,
    installments: quote.installments,
    baseMinor: quote.baseMinor.toString(),
    processingFeeMinor: quote.processingFeeMinor.toString(),
    totalMinor: quote.totalMinor.toString(),
    providerFeeOnTotalMinor: quote.providerFeeOnTotalMinor.toString(),
    netAfterProviderFeeMinor: quote.netAfterProviderFeeMinor.toString(),
    feeModel: {
      mode: quote.feeModel.mode,
      fixedMinor: quote.feeModel.fixedMinor.toString(),
      percentageBasisPoints: quote.feeModel.percentageBasisPoints.toString(),
      minimumMinor: quote.feeModel.minimumMinor?.toString() ?? null,
      maximumMinor: quote.feeModel.maximumMinor?.toString() ?? null,
      promotional: quote.feeModel.promotional,
      discountExpiration: quote.feeModel.discountExpiration,
    },
  };
}

function quoteView(intentId: string, financialConfigId: string, quote: AsaasPassThroughQuote): AsaasQuoteView {
  const snapshot = quoteSnapshot(quote);
  const quoteFingerprint = sha256(JSON.stringify({ intentId, financialConfigId, ...snapshot }));
  return {
    provider: 'asaas',
    method: quote.method,
    installments: quote.installments,
    baseAmount: minorToDb(quote.baseMinor),
    processingFeeAmount: minorToDb(quote.processingFeeMinor),
    totalAmount: minorToDb(quote.totalMinor),
    quoteFingerprint,
    feeModel: snapshot.feeModel,
  };
}

function safeErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  return raw.replace(/[^A-Za-z0-9_:.-]/g, '_').slice(0, 120) || 'UNKNOWN_ERROR';
}

function creationDisposition(error: unknown): 'ready' | 'uncertain' {
  const code = safeErrorCode(error);
  if (code === 'ASAAS_HTTP_ERROR:400' || code === 'ASAAS_HTTP_ERROR:401') return 'ready';
  return 'uncertain';
}

export class PostgresAsaasCheckoutOrchestrator {
  private readonly pool: any;
  private readonly adapter: AsaasPaymentAdapter;
  private readonly requiredPolicyCodes: string[];
  private readonly policyContext: string;
  private readonly webhookUrl: string;

  constructor(config: AsaasCheckoutOrchestratorConfig) {
    if (!config.connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString: config.connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
    this.adapter = config.adapter;
    this.requiredPolicyCodes = normalizePolicyCodes(config.requiredPolicyCodes);
    this.policyContext = required(config.policyContext ?? 'club_checkout', 'ASAAS_POLICY_CONTEXT_REQUIRED');
    this.webhookUrl = new URL(required(config.webhookUrl, 'ASAAS_WEBHOOK_URL_REQUIRED')).toString();
  }

  async close(): Promise<void> { await this.pool.end(); }

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

  private async ownedIntent(providerSubject: string, intentId: string, client: Queryable = this.pool, lock = false): Promise<any> {
    assertUuid(intentId, 'CHECKOUT_INTENT_ID_INVALID');
    const subject = required(providerSubject, 'PROVIDER_SUBJECT_REQUIRED');
    const result = await client.query(
      `select ci.*,u.id user_id,u.profile_id,p.status profile_status,
              e.status event_status,e.event_code,e.slug event_slug,e.default_currency,
              c.founder_ticket_gross,c.version financial_config_version
       from checkout_intents ci
       join users u on u.profile_id=ci.profile_id
       join profiles p on p.id=u.profile_id
       join events e on e.id=ci.event_id
       join event_financial_configs c on c.id=ci.financial_config_id
       where ci.id=$1 and u.auth_provider='supabase' and u.provider_subject=$2 and u.status='active'
       ${lock ? 'for update of ci' : ''}`,
      [intentId, subject],
    );
    const row = result.rows[0];
    if (!row) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
    if (['blocked', 'archived'].includes(row.profile_status)) throw new Error('MEMBER_PROFILE_NOT_ACTIVE');
    return row;
  }

  private assertIntentCanQuote(row: any): void {
    if (!OFFER_PHASES.has(row.event_status)) throw new Error('CLUB_OFFER_PHASE_BLOCKED');
    if (!['draft', 'ready'].includes(row.status)) {
      if (row.status === 'uncertain') throw new Error('CHECKOUT_PROVIDER_CREATION_UNCERTAIN');
      if (row.status === 'creating') throw new Error('CHECKOUT_PROVIDER_CREATION_IN_PROGRESS');
      throw new Error(`CHECKOUT_INTENT_NOT_QUOTABLE:${row.status}`);
    }
    if (String(row.default_currency).toUpperCase() !== 'BRL') throw new Error('ASAAS_CURRENCY_UNSUPPORTED');
  }

  private async currentQuote(row: any, method: SelectedMethod): Promise<{ quote: AsaasPassThroughQuote; view: AsaasQuoteView; feeSourceHash: string }> {
    const fees = await this.adapter.getAccountFees();
    const baseMinor = dbMoneyToMinor(row.base_amount);
    const quote = quoteAsaasPassThrough(baseMinor, quoteMethod(method), fees);
    const view = quoteView(row.id, row.financial_config_id, quote);
    const feeSourceHash = sha256(JSON.stringify({ method, feeModel: view.feeModel }));
    return { quote, view, feeSourceHash };
  }

  async quoteOptions(providerSubject: string, intentId: string): Promise<{ checkoutIntentId: string; options: AsaasQuoteOption[] }> {
    const row = await this.ownedIntent(providerSubject, intentId);
    this.assertIntentCanQuote(row);
    const fees = await this.adapter.getAccountFees();
    const baseMinor = dbMoneyToMinor(row.base_amount);
    const options: AsaasQuoteOption[] = [];
    for (const method of ['pix', 'card'] as const) {
      try {
        const quote = quoteAsaasPassThrough(baseMinor, quoteMethod(method), fees);
        options.push({ method, available: true, quote: quoteView(row.id, row.financial_config_id, quote) });
      } catch (error) {
        options.push({ method, available: false, reason: safeErrorCode(error) });
      }
    }
    return { checkoutIntentId: row.id, options };
  }

  private async assertPoliciesWithClient(client: Queryable, profileId: string): Promise<string> {
    const documents = await client.query(
      `select id,code,version,content_hash
       from policy_documents
       where code=any($1::text[]) and status='active'
       order by code`,
      [this.requiredPolicyCodes],
    );
    const byCode = new Map(documents.rows.map((row: any) => [row.code, row]));
    const missingDocs = this.requiredPolicyCodes.filter((code) => !byCode.has(code));
    if (missingDocs.length) throw new Error(`POLICY_ACTIVE_DOCUMENT_REQUIRED:${missingDocs.join(',')}`);
    const ordered = this.requiredPolicyCodes.map((code) => byCode.get(code)!);
    const ids = ordered.map((row: any) => row.id);
    const accepted = await client.query(
      `select policy_document_id from policy_acceptances
       where profile_id=$1 and context=$2 and policy_document_id=any($3::uuid[])`,
      [profileId, this.policyContext, ids],
    );
    const acceptedIds = new Set(accepted.rows.map((row: any) => row.policy_document_id));
    const missingAcceptances = ordered.filter((row: any) => !acceptedIds.has(row.id)).map((row: any) => row.code);
    if (missingAcceptances.length) throw new Error(`POLICY_ACCEPTANCE_REQUIRED:${missingAcceptances.join(',')}`);
    return sha256(ordered.map((row: any) => `${row.code}:${row.version}:${row.content_hash}`).join('|'));
  }

  async startCheckout(input: {
    providerSubject: string;
    checkoutIntentId: string;
    method: SelectedMethod;
    expectedQuoteFingerprint: string;
  }): Promise<StartCheckoutResult> {
    if (!['pix', 'card'].includes(input.method)) throw new Error('ASAAS_PAYMENT_METHOD_UNSUPPORTED');
    const expectedFingerprint = required(input.expectedQuoteFingerprint, 'ASAAS_EXPECTED_QUOTE_FINGERPRINT_REQUIRED');

    const preflight = await this.ownedIntent(input.providerSubject, input.checkoutIntentId);
    if (preflight.status === 'pending' && preflight.provider_session_id && preflight.provider_redirect_url) {
      const payment = await this.pool.query(`select id from payments where checkout_intent_id=$1`, [preflight.id]);
      if (!payment.rows[0]) throw new Error('PENDING_CHECKOUT_WITHOUT_PAYMENT');
      const storedQuote: AsaasQuoteView = {
        provider: 'asaas',
        method: preflight.payment_method,
        installments: preflight.installment_count,
        baseAmount: String(preflight.base_amount),
        processingFeeAmount: String(preflight.processing_fee_amount),
        totalAmount: String(preflight.amount_gross),
        quoteFingerprint: expectedFingerprint,
        feeModel: preflight.fee_snapshot?.feeModel ?? {},
      } as AsaasQuoteView;
      return {
        started: true,
        replayed: true,
        checkoutIntentId: preflight.id,
        paymentId: payment.rows[0].id,
        providerSessionId: preflight.provider_session_id,
        redirectUrl: preflight.provider_redirect_url,
        expiresAt: preflight.expires_at,
        quote: storedQuote,
      };
    }
    this.assertIntentCanQuote(preflight);

    // Bloqueia qualquer chamada externa se as políticas atuais não estiverem aceitas.
    await this.transaction((client) => this.assertPoliciesWithClient(client, preflight.profile_id));

    const current = await this.currentQuote(preflight, input.method);
    if (current.view.quoteFingerprint !== expectedFingerprint) {
      return { started: false, reason: 'quote_changed', quote: current.view };
    }

    const prepared = await this.transaction(async (client) => {
      const row = await this.ownedIntent(input.providerSubject, input.checkoutIntentId, client, true);
      if (row.status === 'pending' && row.provider_session_id && row.provider_redirect_url) {
        const payment = await client.query(`select id from payments where checkout_intent_id=$1`, [row.id]);
        if (!payment.rows[0]) throw new Error('PENDING_CHECKOUT_WITHOUT_PAYMENT');
        return { replay: true as const, row, paymentId: payment.rows[0].id, policyFingerprint: row.policy_fingerprint };
      }
      this.assertIntentCanQuote(row);
      if (String(row.financial_config_id) !== String(preflight.financial_config_id) || String(row.base_amount) !== String(preflight.base_amount)) {
        throw new Error('CHECKOUT_INTENT_CHANGED_DURING_QUOTE');
      }
      const policyFingerprint = await this.assertPoliciesWithClient(client, row.profile_id);
      const snapshot = quoteSnapshot(current.quote);
      const update = await client.query(
        `update checkout_intents
         set provider='asaas',status='creating',amount_gross=$2,processing_fee_amount=$3,
             payment_method=$4,installment_count=$5,fee_snapshot=$6::jsonb,fee_source_hash=$7,
             fee_quoted_at=now(),policy_fingerprint=$8,policy_version=$8,
             provider_creation_attempts=provider_creation_attempts+1,
             provider_creation_started_at=now(),provider_last_error_code=null
         where id=$1
         returning provider_creation_attempts`,
        [
          row.id,
          minorToDb(current.quote.totalMinor),
          minorToDb(current.quote.processingFeeMinor),
          input.method,
          input.method === 'card' ? 1 : null,
          JSON.stringify(snapshot),
          current.feeSourceHash,
          policyFingerprint,
        ],
      );
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
         values ($1,'user','checkout.provider_creation_started','checkout_intent',$2,$3,$4::jsonb,'ASAAS_CHECKOUT_START')`,
        [row.user_id, row.id, row.event_id, JSON.stringify({ method: input.method, quoteFingerprint: current.view.quoteFingerprint, policyFingerprint, attempt: update.rows[0].provider_creation_attempts })],
      );
      return { replay: false as const, row, attempt: Number(update.rows[0].provider_creation_attempts), policyFingerprint };
    });

    if (prepared.replay) {
      return {
        started: true,
        replayed: true,
        checkoutIntentId: prepared.row.id,
        paymentId: prepared.paymentId,
        providerSessionId: prepared.row.provider_session_id,
        redirectUrl: prepared.row.provider_redirect_url,
        expiresAt: prepared.row.expires_at,
        quote: current.view,
      };
    }

    try {
      const providerCheckout = await this.adapter.createCheckout({
        checkoutIntentId: prepared.row.id,
        idempotencyKey: `asaas-checkout:${prepared.row.id}:${prepared.attempt}`,
        amountMinor: current.quote.totalMinor,
        currencyCode: 'BRL',
        customerReference: prepared.row.profile_id,
        eventReference: prepared.row.event_slug || prepared.row.event_code,
        allowedMethods: [input.method],
        returnUrl: null,
        webhookUrl: this.webhookUrl,
      });

      return await this.transaction(async (client) => {
        const row = await this.ownedIntent(input.providerSubject, input.checkoutIntentId, client, true);
        if (row.status !== 'creating') throw new Error(`CHECKOUT_PROVIDER_STATE_CHANGED:${row.status}`);
        const payment = await client.query(
          `insert into payments(
            profile_id,event_id,checkout_intent_id,purpose,gateway,idempotency_key,
            amount_gross,base_amount,processing_fee_passed,currency_code,payment_method,status
           ) values ($1,$2,$3,'club_credit','asaas',$4,$5,$6,$7,'BRL',$8,'pending')
           on conflict (checkout_intent_id) do update set checkout_intent_id=excluded.checkout_intent_id
           returning id`,
          [
            row.profile_id,
            row.event_id,
            row.id,
            `asaas:checkout:${row.id}`,
            minorToDb(current.quote.totalMinor),
            minorToDb(current.quote.baseMinor),
            minorToDb(current.quote.processingFeeMinor),
            input.method,
          ],
        );
        await client.query(
          `update checkout_intents
           set status='pending',provider_session_id=$2,provider_redirect_url=$3,expires_at=$4,
               provider_last_error_code=null
           where id=$1`,
          [row.id, providerCheckout.providerSessionId, providerCheckout.redirectUrl, providerCheckout.expiresAt],
        );
        await client.query(
          `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
           values ($1,'user','checkout.provider_created','checkout_intent',$2,$3,$4::jsonb,'ASAAS_CHECKOUT_CREATED')`,
          [row.user_id, row.id, row.event_id, JSON.stringify({ providerSessionId: providerCheckout.providerSessionId, paymentId: payment.rows[0].id, method: input.method })],
        );
        return {
          started: true as const,
          replayed: false,
          checkoutIntentId: row.id,
          paymentId: payment.rows[0].id,
          providerSessionId: providerCheckout.providerSessionId,
          redirectUrl: providerCheckout.redirectUrl!,
          expiresAt: providerCheckout.expiresAt ?? null,
          quote: current.view,
        };
      });
    } catch (error) {
      const disposition = creationDisposition(error);
      const code = safeErrorCode(error);
      await this.transaction(async (client) => {
        const row = await this.ownedIntent(input.providerSubject, input.checkoutIntentId, client, true);
        if (row.status === 'creating') {
          await client.query(
            `update checkout_intents set status=$2,provider_last_error_code=$3 where id=$1`,
            [row.id, disposition, code],
          );
          await client.query(
            `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
             values ($1,'user','checkout.provider_creation_failed','checkout_intent',$2,$3,$4::jsonb,$5)`,
            [row.user_id, row.id, row.event_id, JSON.stringify({ disposition, attempt: row.provider_creation_attempts }), code],
          );
        }
      });
      throw error;
    }
  }
}
