import pg from 'pg';

const { Pool } = pg;

export interface CrmProfileFilters {
  search?: string;
  stage?: string;
  source?: string;
  campaign?: string;
  limit?: number;
  offset?: number;
}

function optional(value: string | undefined, max: number, code: string): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(code);
  return text;
}

function bounded(value: number | undefined, fallback: number, min: number, max: number, code: string): number {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(code);
  return n;
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('PROFILE_ID_INVALID');
}

export class PostgresCrmRead {
  private readonly pool: any;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query('select 1 as ok');
    return result.rows[0]?.ok === 1;
  }

  async overview() {
    const [totals, stages, sources, campaigns, consents] = await Promise.all([
      this.pool.query(`select count(*)::int as total,
        count(*) filter(where created_at>=now()-interval '24 hours')::int as last_24h,
        count(*) filter(where created_at>=now()-interval '7 days')::int as last_7d
        from profiles where display_code not like 'HML-%'`),
      this.pool.query(`with latest as (
        select distinct on(profile_id) profile_id,to_stage
        from crm_stage_history
        order by profile_id,changed_at desc,id desc
      )
      select coalesce(to_stage,'sem_estagio') stage,count(*)::int count
      from profiles p
      left join latest l on l.profile_id=p.id
      where p.display_code not like 'HML-%'
      group by coalesce(to_stage,'sem_estagio')
      order by count desc,stage`),
      this.pool.query(`select source,count(*)::int count
        from acquisition_attributions group by source order by count desc,source limit 10`),
      this.pool.query(`select coalesce(campaign,'(sem campanha)') campaign,count(*)::int count
        from acquisition_attributions
        group by coalesce(campaign,'(sem campanha)')
        order by count desc,campaign limit 10`),
      this.pool.query(`with latest as (
        select distinct on(profile_id,consent_type) profile_id,consent_type,granted
        from consents
        order by profile_id,consent_type,granted_at desc,id desc
      )
      select consent_type,
        count(*) filter(where granted)::int granted,
        count(*) filter(where not granted)::int denied
      from latest group by consent_type order by consent_type`),
    ]);

    return {
      total: totals.rows[0],
      stages: stages.rows,
      sources: sources.rows,
      campaigns: campaigns.rows,
      consents: consents.rows,
    };
  }

  async listProfiles(filters: CrmProfileFilters = {}) {
    const search = optional(filters.search, 120, 'CRM_SEARCH_TOO_LONG');
    const stage = optional(filters.stage, 40, 'CRM_STAGE_TOO_LONG');
    const source = optional(filters.source, 120, 'CRM_SOURCE_TOO_LONG');
    const campaign = optional(filters.campaign, 180, 'CRM_CAMPAIGN_TOO_LONG');
    const limit = bounded(filters.limit, 50, 1, 100, 'CRM_LIMIT_INVALID');
    const offset = bounded(filters.offset, 0, 0, 100_000, 'CRM_OFFSET_INVALID');

    const values: unknown[] = [];
    const where = [`p.display_code not like 'HML-%'`];
    if (search) {
      values.push(`%${search}%`);
      where.push(`(p.full_name ilike $${values.length} or coalesce(p.email_normalized,'') ilike $${values.length} or coalesce(p.phone_e164,'') ilike $${values.length})`);
    }
    if (stage) {
      values.push(stage);
      where.push(`coalesce(st.to_stage,'sem_estagio')=$${values.length}`);
    }
    if (source) {
      values.push(source);
      where.push(`coalesce(attr.source,'')=$${values.length}`);
    }
    if (campaign) {
      values.push(campaign);
      where.push(`coalesce(attr.campaign,'')=$${values.length}`);
    }
    values.push(limit, offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;

    const result = await this.pool.query(
      `select p.id,p.display_code,p.full_name,p.email_normalized,p.phone_e164,p.status,p.created_at,p.updated_at,
        coalesce(st.to_stage,'sem_estagio') stage,st.changed_at stage_at,
        attr.source,attr.medium,attr.campaign,attr.content,attr.referral_code,attr.occurred_at attribution_at,
        cprivacy.granted privacy,cmarketing.granted marketing,cwhatsapp.granted whatsapp,cemail.granted email_consent
      from profiles p
      left join lateral(
        select to_stage,changed_at from crm_stage_history
        where profile_id=p.id order by changed_at desc,id desc limit 1
      ) st on true
      left join lateral(
        select source,medium,campaign,content,referral_code,occurred_at from acquisition_attributions
        where profile_id=p.id order by occurred_at desc,id desc limit 1
      ) attr on true
      left join lateral(select granted from consents where profile_id=p.id and consent_type='privacy' order by granted_at desc,id desc limit 1) cprivacy on true
      left join lateral(select granted from consents where profile_id=p.id and consent_type='marketing' order by granted_at desc,id desc limit 1) cmarketing on true
      left join lateral(select granted from consents where profile_id=p.id and consent_type='whatsapp' order by granted_at desc,id desc limit 1) cwhatsapp on true
      left join lateral(select granted from consents where profile_id=p.id and consent_type='email' order by granted_at desc,id desc limit 1) cemail on true
      where ${where.join(' and ')}
      order by p.created_at desc,p.id desc
      limit $${limitParam} offset $${offsetParam}`,
      values,
    );
    return { items: result.rows, limit, offset };
  }

  async profile360(profileId: string) {
    assertUuid(profileId);
    const profile = await this.pool.query(
      `select id,display_code,full_name,email_normalized,phone_e164,status,first_source,first_campaign,created_at,updated_at
       from profiles where id=$1`,
      [profileId],
    );
    if (!profile.rows[0]) throw new Error('PROFILE_NOT_FOUND');

    const [stages, attributions, consents, interactions, analytics, payments, credits, audit] = await Promise.all([
      this.pool.query('select from_stage,to_stage,reason,source_type,changed_at from crm_stage_history where profile_id=$1 order by changed_at desc,id desc limit 50', [profileId]),
      this.pool.query('select source,medium,campaign,content,term,referral_code,landing_page,session_key,occurred_at from acquisition_attributions where profile_id=$1 order by occurred_at desc,id desc limit 50', [profileId]),
      this.pool.query('select consent_type,policy_version,granted,source,granted_at,revoked_at from consents where profile_id=$1 order by granted_at desc,id desc limit 100', [profileId]),
      this.pool.query('select channel,direction,interaction_type,summary,occurred_at from crm_interactions where profile_id=$1 order by occurred_at desc,id desc limit 50', [profileId]),
      this.pool.query('select event_name,properties,occurred_at from analytics_events where profile_id=$1 order by occurred_at desc,id desc limit 50', [profileId]),
      this.pool.query('select id,event_id,purpose,gateway,amount_gross,amount_net,payment_method,status,created_at,paid_at,refunded_at from payments where profile_id=$1 order by created_at desc limit 30', [profileId]),
      this.pool.query('select id,event_id,gross_value,protected_value,status,created_at from credits where profile_id=$1 order by created_at desc limit 30', [profileId]),
      this.pool.query(`select action,entity_type,entity_id,reason,occurred_at
        from audit_logs
        where entity_id=$1 or actor_user_id in(select id from users where profile_id=$1)
        order by occurred_at desc limit 50`, [profileId]),
    ]);

    return {
      profile: profile.rows[0],
      stages: stages.rows,
      attributions: attributions.rows,
      consents: consents.rows,
      interactions: interactions.rows,
      analytics: analytics.rows,
      payments: payments.rows,
      credits: credits.rows,
      audit: audit.rows,
    };
  }
}
