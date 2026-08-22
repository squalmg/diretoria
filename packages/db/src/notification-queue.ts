import pg from 'pg';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

export type NotificationChannel = 'whatsapp' | 'email' | 'push';
export type NotificationPurpose = 'transactional' | 'marketing';
export type NotificationStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface TemplateInput {
  code: string;
  channel: NotificationChannel;
  purpose: NotificationPurpose;
  content: string;
  createdBy?: string;
}

export interface QueueTransactionalInput {
  profileId: string;
  eventId?: string | null;
  templateCode: string;
  channel: NotificationChannel;
  variables?: Record<string, unknown>;
  dedupeKey?: string | null;
  scheduledAt?: string | null;
}

function required(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertUuidLike(value: string, code: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(code);
}

export class PostgresNotificationQueue {
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

  async health(): Promise<{ database: 'connected'; provider: 'unconfigured' }> {
    await this.pool.query('select 1');
    return { database: 'connected', provider: 'unconfigured' };
  }

  async createTemplateVersion(input: TemplateInput): Promise<{ id: string; version: number; status: 'draft' }> {
    const code = required(input.code, 'NOTIFICATION_TEMPLATE_CODE_REQUIRED');
    const content = required(input.content, 'NOTIFICATION_TEMPLATE_CONTENT_REQUIRED');
    if (!['whatsapp', 'email', 'push'].includes(input.channel)) throw new Error('NOTIFICATION_CHANNEL_INVALID');
    if (!['transactional', 'marketing'].includes(input.purpose)) throw new Error('NOTIFICATION_PURPOSE_INVALID');
    if (input.createdBy) assertUuidLike(input.createdBy, 'NOTIFICATION_CREATED_BY_INVALID');

    return this.transaction(async (client) => {
      const versionResult = await client.query(
        `select coalesce(max(version),0)::int + 1 version
         from notification_templates where code=$1 and channel=$2`,
        [code, input.channel],
      );
      const version = Number(versionResult.rows[0].version);
      const inserted = await client.query(
        `insert into notification_templates(code,channel,purpose,version,content,status,created_by)
         values ($1,$2,$3,$4,$5,'draft',$6)
         returning id`,
        [code, input.channel, input.purpose, version, content, input.createdBy ?? null],
      );
      return { id: inserted.rows[0].id, version, status: 'draft' };
    });
  }

  async activateTemplate(templateId: string, actorUserId?: string): Promise<{ id: string; code: string; channel: NotificationChannel; version: number }> {
    assertUuidLike(templateId, 'NOTIFICATION_TEMPLATE_ID_INVALID');
    if (actorUserId) assertUuidLike(actorUserId, 'NOTIFICATION_ACTOR_INVALID');

    return this.transaction(async (client) => {
      const targetResult = await client.query(
        `select id,code,channel,purpose,version,status from notification_templates where id=$1 for update`,
        [templateId],
      );
      const target = targetResult.rows[0];
      if (!target) throw new Error('NOTIFICATION_TEMPLATE_NOT_FOUND');
      if (target.status === 'retired') throw new Error('NOTIFICATION_TEMPLATE_RETIRED');

      await client.query(
        `update notification_templates
         set status='retired',retired_at=now()
         where code=$1 and channel=$2 and status='active' and id<>$3`,
        [target.code, target.channel, target.id],
      );
      await client.query(
        `update notification_templates
         set status='active',activated_at=coalesce(activated_at,now()),retired_at=null
         where id=$1`,
        [target.id],
      );
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,after_data,reason)
         values ($1,$2,'notification.template_activated','notification_template',$3,$4::jsonb,'VERSION_ACTIVATED')`,
        [actorUserId ?? null, actorUserId ? 'user' : 'system', target.id, JSON.stringify({ code: target.code, channel: target.channel, version: target.version })],
      );
      return { id: target.id, code: target.code, channel: target.channel as NotificationChannel, version: Number(target.version) };
    });
  }

  async queueTransactional(input: QueueTransactionalInput): Promise<{ id: string; status: NotificationStatus; replayed: boolean; templateId: string; templateVersion: number }> {
    assertUuidLike(input.profileId, 'NOTIFICATION_PROFILE_ID_INVALID');
    if (input.eventId) assertUuidLike(input.eventId, 'NOTIFICATION_EVENT_ID_INVALID');
    const code = required(input.templateCode, 'NOTIFICATION_TEMPLATE_CODE_REQUIRED');
    const dedupeKey = input.dedupeKey == null ? null : required(input.dedupeKey, 'NOTIFICATION_DEDUPE_KEY_INVALID');
    if (dedupeKey && dedupeKey.length > 255) throw new Error('NOTIFICATION_DEDUPE_KEY_TOO_LONG');

    return this.transaction(async (client) => {
      if (dedupeKey) {
        const existing = await client.query(
          `select n.id,n.status,n.profile_id,n.event_id,n.template_id,t.version,t.code,t.channel
           from notifications n join notification_templates t on t.id=n.template_id
           where n.dedupe_key=$1 for update of n`,
          [dedupeKey],
        );
        if (existing.rows[0]) {
          const row = existing.rows[0];
          if (row.profile_id !== input.profileId || (row.event_id ?? null) !== (input.eventId ?? null) || row.code !== code || row.channel !== input.channel) {
            throw new Error('NOTIFICATION_DEDUPE_CONFLICT');
          }
          return { id: row.id, status: row.status as NotificationStatus, replayed: true, templateId: row.template_id, templateVersion: Number(row.version) };
        }
      }

      const profile = await client.query(`select status from profiles where id=$1`, [input.profileId]);
      if (!profile.rows[0]) throw new Error('NOTIFICATION_PROFILE_NOT_FOUND');
      if (['blocked', 'archived'].includes(profile.rows[0].status)) throw new Error('NOTIFICATION_PROFILE_NOT_ACTIVE');
      if (input.eventId) {
        const event = await client.query(`select id from events where id=$1`, [input.eventId]);
        if (!event.rows[0]) throw new Error('NOTIFICATION_EVENT_NOT_FOUND');
      }

      const templateResult = await client.query(
        `select id,version,purpose from notification_templates
         where code=$1 and channel=$2 and status='active'
         limit 1`,
        [code, input.channel],
      );
      const template = templateResult.rows[0];
      if (!template) throw new Error('NOTIFICATION_ACTIVE_TEMPLATE_NOT_FOUND');
      if (template.purpose !== 'transactional') throw new Error('NOTIFICATION_TEMPLATE_NOT_TRANSACTIONAL');

      const inserted = await client.query(
        `insert into notifications(
          profile_id,event_id,template_id,channel,purpose,status,variables,dedupe_key,scheduled_at
         ) values ($1,$2,$3,$4,'transactional','queued',$5::jsonb,$6,$7)
         returning id,status`,
        [input.profileId, input.eventId ?? null, template.id, input.channel, JSON.stringify(input.variables ?? {}), dedupeKey, input.scheduledAt ?? null],
      );
      return { id: inserted.rows[0].id, status: inserted.rows[0].status as NotificationStatus, replayed: false, templateId: template.id, templateVersion: Number(template.version) };
    });
  }

  async claimBatch(limit = 20): Promise<any[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('NOTIFICATION_CLAIM_LIMIT_INVALID');
    return this.transaction(async (client) => {
      const result = await client.query(
        `with picked as (
          select id from notifications
          where status='queued' and (scheduled_at is null or scheduled_at<=now())
          order by coalesce(scheduled_at,created_at),created_at
          for update skip locked
          limit $1
        )
        update notifications n set status='sending'
        from picked where n.id=picked.id
        returning n.*`,
        [limit],
      );
      return result.rows;
    });
  }

  async recordAttempt(input: {
    notificationId: string;
    provider?: string;
    status: 'sending' | 'sent' | 'delivered' | 'failed';
    externalId?: string | null;
    errorCode?: string | null;
    responseMeta?: Record<string, unknown>;
  }): Promise<{ attemptId: string; notificationStatus: NotificationStatus }> {
    assertUuidLike(input.notificationId, 'NOTIFICATION_ID_INVALID');
    const provider = input.provider?.trim() || 'unconfigured';
    if (!['sending', 'sent', 'delivered', 'failed'].includes(input.status)) throw new Error('NOTIFICATION_ATTEMPT_STATUS_INVALID');

    return this.transaction(async (client) => {
      const notificationResult = await client.query(`select id,status from notifications where id=$1 for update`, [input.notificationId]);
      if (!notificationResult.rows[0]) throw new Error('NOTIFICATION_NOT_FOUND');
      if (notificationResult.rows[0].status === 'cancelled') throw new Error('NOTIFICATION_CANCELLED');
      const numberResult = await client.query(`select coalesce(max(attempt_number),0)::int + 1 n from notification_attempts where notification_id=$1`, [input.notificationId]);
      const attemptNumber = Number(numberResult.rows[0].n);
      const attemptResult = await client.query(
        `insert into notification_attempts(notification_id,provider,external_id,attempt_number,status,error_code,response_meta)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning id`,
        [input.notificationId, provider, input.externalId ?? null, attemptNumber, input.status, input.errorCode ?? null, JSON.stringify(input.responseMeta ?? {})],
      );
      const notificationStatus: NotificationStatus = input.status === 'delivered' ? 'delivered' : input.status === 'sent' ? 'sent' : input.status === 'failed' ? 'failed' : 'sending';
      await client.query(
        `update notifications set status=$2::varchar,
          sent_at=case when $2::varchar in ('sent','delivered') then coalesce(sent_at,now()) else sent_at end,
          delivered_at=case when $2::varchar='delivered' then coalesce(delivered_at,now()) else delivered_at end
         where id=$1`,
        [input.notificationId, notificationStatus],
      );
      return { attemptId: attemptResult.rows[0].id, notificationStatus };
    });
  }
}
