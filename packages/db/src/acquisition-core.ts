import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

export interface CaptureLeadInput {
  fullName: string;
  email?: string;
  phoneE164?: string;
  policyVersion: string;
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referralCode?: string;
  landingPage?: string;
  sessionKey?: string;
  ipAddress?: string;
  userAgent?: string;
  consents: {
    privacy: boolean;
    marketing?: boolean;
    whatsapp?: boolean;
    email?: boolean;
  };
}

export interface CaptureLeadResult {
  profileId: string;
  created: boolean;
  stageChanged: boolean;
  attributionId: string;
}

const stageRank: Readonly<Record<string, number>> = {
  visitor: 0,
  lead: 1,
  member: 2,
  member_confirmed: 3,
  ticket_issued: 4,
  participant: 5,
  repeat_participant: 6,
  ambassador: 7,
  inactive: -1,
};

function optionalText(value: string | undefined, max: number, code: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new Error(code);
  return normalized;
}

export function normalizeLeadEmail(value?: string): string | undefined {
  const email = optionalText(value, 320, 'EMAIL_TOO_LONG')?.toLowerCase();
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('EMAIL_INVALID');
  return email;
}

export function normalizeLeadPhone(value?: string): string | undefined {
  const phone = optionalText(value, 20, 'PHONE_TOO_LONG');
  if (!phone) return undefined;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('PHONE_E164_INVALID');
  return phone;
}

function normalizeRequired(value: string, max: number, code: string): string {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(code);
  return text;
}

export class PostgresAcquisitionCore {
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

  private async lockIdentities(client: Queryable, email?: string, phone?: string): Promise<void> {
    const keys = [email ? `email:${email}` : null, phone ? `phone:${phone}` : null]
      .filter((value): value is string => Boolean(value))
      .sort();
    for (const key of keys) {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
  }

  async captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
    const fullName = normalizeRequired(input.fullName, 180, 'FULL_NAME_REQUIRED');
    const email = normalizeLeadEmail(input.email);
    const phone = normalizeLeadPhone(input.phoneE164);
    if (!email && !phone) throw new Error('CONTACT_REQUIRED');
    if (input.consents.privacy !== true) throw new Error('PRIVACY_CONSENT_REQUIRED');

    const policyVersion = normalizeRequired(input.policyVersion, 80, 'POLICY_VERSION_REQUIRED');
    const source = normalizeRequired(input.source, 120, 'SOURCE_REQUIRED');
    const medium = optionalText(input.medium, 120, 'MEDIUM_TOO_LONG');
    const campaign = optionalText(input.campaign, 180, 'CAMPAIGN_TOO_LONG');
    const content = optionalText(input.content, 180, 'CONTENT_TOO_LONG');
    const term = optionalText(input.term, 180, 'TERM_TOO_LONG');
    const referralCode = optionalText(input.referralCode, 120, 'REFERRAL_TOO_LONG');
    const landingPage = optionalText(input.landingPage, 1000, 'LANDING_PAGE_TOO_LONG');
    const sessionKey = optionalText(input.sessionKey, 200, 'SESSION_KEY_TOO_LONG');
    const userAgent = optionalText(input.userAgent, 1000, 'USER_AGENT_TOO_LONG');
    const ipAddress = optionalText(input.ipAddress, 64, 'IP_TOO_LONG');

    return this.transaction(async (client) => {
      await this.lockIdentities(client, email, phone);

      const emailResult = email
        ? await client.query('select * from profiles where email_normalized=$1 for update', [email])
        : { rows: [] };
      const phoneResult = phone
        ? await client.query('select * from profiles where phone_e164=$1 for update', [phone])
        : { rows: [] };

      const emailProfile = emailResult.rows[0];
      const phoneProfile = phoneResult.rows[0];
      if (emailProfile && phoneProfile && emailProfile.id !== phoneProfile.id) {
        throw new Error('IDENTITY_COLLISION');
      }

      let profile = emailProfile ?? phoneProfile;
      let created = false;
      if (!profile) {
        const id = randomUUID();
        const displayCode = `LEAD-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        const result = await client.query(
          `insert into profiles(
            id,display_code,full_name,email,email_normalized,phone_e164,status,first_source,first_campaign
          ) values ($1,$2,$3,$4,$5,$6,'lead',$7,$8)
          returning *`,
          [id, displayCode, fullName, email ?? null, email ?? null, phone ?? null, source, campaign ?? null],
        );
        profile = result.rows[0];
        created = true;
      } else {
        if (profile.status === 'blocked') throw new Error('PROFILE_BLOCKED');
        const emailConflict = email && profile.email_normalized && profile.email_normalized !== email;
        const phoneConflict = phone && profile.phone_e164 && profile.phone_e164 !== phone;
        if (emailConflict || phoneConflict) throw new Error('IDENTITY_CONTACT_CONFLICT');

        const result = await client.query(
          `update profiles
           set full_name=$2,
               email=coalesce(email,$3),
               email_normalized=coalesce(email_normalized,$3),
               phone_e164=coalesce(phone_e164,$4),
               updated_at=now()
           where id=$1
           returning *`,
          [profile.id, fullName, email ?? null, phone ?? null],
        );
        profile = result.rows[0];
      }

      const attribution = await client.query(
        `insert into acquisition_attributions(
          profile_id,session_key,source,medium,campaign,content,term,referral_code,landing_page
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        returning id`,
        [profile.id, sessionKey ?? null, source, medium ?? null, campaign ?? null, content ?? null, term ?? null, referralCode ?? null, landingPage ?? null],
      );

      const consentRows: Array<[string, boolean]> = [
        ['privacy', true],
        ['marketing', input.consents.marketing === true],
        ['whatsapp', input.consents.whatsapp === true],
        ['email', input.consents.email === true],
      ];
      for (const [type, granted] of consentRows) {
        await client.query(
          `insert into consents(profile_id,consent_type,policy_version,granted,source,ip_address,user_agent)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [profile.id, type, policyVersion, granted, source, ipAddress ?? null, userAgent ?? null],
        );
      }

      const stageResult = await client.query(
        `select to_stage from crm_stage_history
         where profile_id=$1
         order by changed_at desc,id desc
         limit 1`,
        [profile.id],
      );
      const currentStage = stageResult.rows[0]?.to_stage as string | undefined;
      const shouldSetLead = !currentStage || currentStage === 'visitor' || currentStage === 'inactive' || (stageRank[currentStage] ?? -1) < stageRank.lead;
      let stageChanged = false;
      if (shouldSetLead && currentStage !== 'lead') {
        await client.query(
          `insert into crm_stage_history(profile_id,from_stage,to_stage,reason,source_type,source_id)
           values ($1,$2,'lead',$3,'lead_capture',$4)`,
          [profile.id, currentStage ?? null, currentStage === 'inactive' ? 'LEAD_REACTIVATED' : 'LEAD_CAPTURED', attribution.rows[0].id],
        );
        stageChanged = true;
      }

      await client.query(
        `insert into crm_interactions(profile_id,channel,direction,interaction_type,summary)
         values ($1,'site','inbound','lead_capture','Lead capturado pelo formulário público')`,
        [profile.id],
      );

      await client.query(
        `insert into analytics_events(profile_id,session_id,event_name,properties)
         values ($1,$2,'lead_created',$3::jsonb)`,
        [
          profile.id,
          sessionKey ?? null,
          JSON.stringify({ source, medium: medium ?? null, campaign: campaign ?? null, content: content ?? null, referralCode: referralCode ?? null }),
        ],
      );

      await client.query(
        `insert into audit_logs(actor_type,action,entity_type,entity_id,before_data,after_data,reason)
         values ('system','lead.captured','profile',$1,$2::jsonb,$3::jsonb,$4)`,
        [
          profile.id,
          JSON.stringify(created ? null : { status: profile.status }),
          JSON.stringify({ created, source, campaign: campaign ?? null, stageChanged }),
          created ? 'NEW_PROFILE' : 'PROFILE_CONSOLIDATED',
        ],
      );

      return {
        profileId: profile.id as string,
        created,
        stageChanged,
        attributionId: attribution.rows[0].id as string,
      };
    });
  }
}
