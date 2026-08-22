import pg from 'pg';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

export interface EnsureMemberAccountInput {
  providerSubject: string;
  email?: string | null;
  phone?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName?: string | null;
}

export interface MemberAccountResult {
  userId: string;
  profileId: string;
  displayCode: string;
  created: boolean;
  linkedExistingProfile: boolean;
}

function normalizeEmail(value?: string | null): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) return null;
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('MEMBER_EMAIL_INVALID');
  return email;
}

function normalizePhone(value?: string | null): string | null {
  const phone = String(value ?? '').trim();
  if (!phone) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('MEMBER_PHONE_INVALID');
  return phone;
}

function assertSubject(value: string): string {
  const subject = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject)) {
    throw new Error('MEMBER_AUTH_SUBJECT_INVALID');
  }
  return subject.toLowerCase();
}

function displayCodeForSubject(subject: string): string {
  return `CUS-${subject.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
}

function safeName(fullName: string | null | undefined, email: string | null): string {
  const name = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  if (name.length >= 2 && name.length <= 180) return name;
  if (email) return email.split('@')[0].slice(0, 180) || 'Membro Diretoria';
  return 'Membro Diretoria';
}

export class PostgresMemberAccounts {
  private readonly pool: any;

  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
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

  async health(): Promise<{ ok: true; database: string }> {
    const result = await this.pool.query('select current_database() as database');
    return { ok: true, database: result.rows[0].database };
  }

  async ensureAccount(input: EnsureMemberAccountInput): Promise<MemberAccountResult> {
    const subject = assertSubject(input.providerSubject);
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const name = safeName(input.fullName, email);

    return this.transaction(async (client) => {
      const existingUser = await client.query(
        `select u.id as user_id,u.profile_id,p.display_code,p.status
         from users u join profiles p on p.id=u.profile_id
         where u.auth_provider='supabase' and u.provider_subject=$1
         for update of u,p`,
        [subject],
      );
      if (existingUser.rows[0]) {
        if (existingUser.rows[0].status === 'blocked' || existingUser.rows[0].status === 'archived') {
          throw new Error('MEMBER_PROFILE_NOT_ACTIVE');
        }
        return {
          userId: existingUser.rows[0].user_id,
          profileId: existingUser.rows[0].profile_id,
          displayCode: existingUser.rows[0].display_code,
          created: false,
          linkedExistingProfile: false,
        };
      }

      let emailProfile: any = null;
      let phoneProfile: any = null;

      if (email) {
        const result = await client.query('select id,status from profiles where email_normalized=$1 for update', [email]);
        emailProfile = result.rows[0] ?? null;
        if (emailProfile && !input.emailVerified) throw new Error('MEMBER_EMAIL_VERIFICATION_REQUIRED_FOR_LINK');
      }
      if (phone) {
        const result = await client.query('select id,status from profiles where phone_e164=$1 for update', [phone]);
        phoneProfile = result.rows[0] ?? null;
        if (phoneProfile && !input.phoneVerified) throw new Error('MEMBER_PHONE_VERIFICATION_REQUIRED_FOR_LINK');
      }
      if (emailProfile && phoneProfile && emailProfile.id !== phoneProfile.id) {
        throw new Error('MEMBER_IDENTITY_CONFLICT');
      }

      let profileId = emailProfile?.id ?? phoneProfile?.id ?? null;
      const linkedExistingProfile = Boolean(profileId);

      if (profileId) {
        const candidate = emailProfile ?? phoneProfile;
        if (candidate.status === 'blocked' || candidate.status === 'archived') throw new Error('MEMBER_PROFILE_NOT_ACTIVE');
        const profileUser = await client.query('select id,auth_provider,provider_subject from users where profile_id=$1 for update', [profileId]);
        if (profileUser.rows[0]) throw new Error('MEMBER_PROFILE_ALREADY_HAS_ACCOUNT');

        await client.query(
          `update profiles set
             full_name=case when full_name is null or btrim(full_name)='' then $2 else full_name end,
             email=case when $3::boolean and email is null then $4 else email end,
             email_normalized=case when $3::boolean and email_normalized is null then $4 else email_normalized end,
             phone_e164=case when $5::boolean and phone_e164 is null then $6 else phone_e164 end,
             status=case when status='lead' then 'active' else status end,
             updated_at=now()
           where id=$1`,
          [profileId, name, input.emailVerified, email, input.phoneVerified, phone],
        );
      } else {
        const displayCode = displayCodeForSubject(subject);
        const createdProfile = await client.query(
          `insert into profiles(display_code,full_name,email,email_normalized,phone_e164,status,first_source)
           values($1,$2,$3,$3,$4,'active','member_account') returning id`,
          [displayCode, name, input.emailVerified ? email : null, input.phoneVerified ? phone : null],
        );
        profileId = createdProfile.rows[0].id;
        await client.query(
          `insert into crm_stage_history(profile_id,from_stage,to_stage,reason,source_type,source_id,changed_at)
           values($1,null,'lead','ACCOUNT_CREATED_WITHOUT_PRIOR_LEAD','system',$1,now())`,
          [profileId],
        );
      }

      const createdUser = await client.query(
        `insert into users(
           profile_id,auth_provider,provider_subject,email_verified_at,phone_verified_at,status
         ) values($1,'supabase',$2,$3,$4,'active') returning id`,
        [
          profileId,
          subject,
          input.emailVerified ? new Date().toISOString() : null,
          input.phoneVerified ? new Date().toISOString() : null,
        ],
      );
      const userId = createdUser.rows[0].id as string;

      await client.query(
        `insert into crm_interactions(profile_id,channel,direction,interaction_type,summary,occurred_at,created_by)
         values($1,'site','inbound','account_created',$2,now(),$3)`,
        [profileId, linkedExistingProfile ? 'Conta autenticada vinculada ao profile existente' : 'Conta autenticada criada', userId],
      );
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,before_data,after_data,reason)
         values($1,'user',$2,'profile',$3,null,$4::jsonb,$5)`,
        [
          userId,
          linkedExistingProfile ? 'member.account_linked' : 'member.account_created',
          profileId,
          JSON.stringify({ authProvider: 'supabase', providerSubject: subject, emailVerified: input.emailVerified, phoneVerified: input.phoneVerified }),
          linkedExistingProfile ? 'VERIFIED_IDENTITY_MATCH' : 'NEW_AUTHENTICATED_PROFILE',
        ],
      );

      const profile = await client.query('select display_code from profiles where id=$1', [profileId]);
      return {
        userId,
        profileId,
        displayCode: profile.rows[0].display_code,
        created: true,
        linkedExistingProfile,
      };
    });
  }

  async getAccount(providerSubject: string): Promise<any> {
    const subject = assertSubject(providerSubject);
    const result = await this.pool.query(
      `select u.id as user_id,u.status as user_status,u.email_verified_at,u.phone_verified_at,
              p.id as profile_id,p.display_code,p.full_name,p.email_normalized,p.phone_e164,p.status as profile_status,
              coalesce((select to_stage from crm_stage_history s where s.profile_id=p.id order by changed_at desc,id desc limit 1),'lead') as crm_stage
       from users u join profiles p on p.id=u.profile_id
       where u.auth_provider='supabase' and u.provider_subject=$1`,
      [subject],
    );
    if (!result.rows[0]) throw new Error('MEMBER_ACCOUNT_NOT_FOUND');
    return result.rows[0];
  }

  async wallet(providerSubject: string): Promise<any> {
    const account = await this.getAccount(providerSubject);
    const [credits, payments] = await Promise.all([
      this.pool.query(
        `select c.id,c.event_id,c.gross_value,c.protected_value,c.status,c.valid_from,c.converted_at,c.created_at,
                e.event_code,e.name as event_name,e.status as event_status
         from credits c join events e on e.id=c.event_id
         where c.profile_id=$1 order by c.created_at desc,id desc limit 100`,
        [account.profile_id],
      ),
      this.pool.query(
        `select id,event_id,purpose,amount_gross,amount_fee,amount_net,payment_method,status,created_at,paid_at,refunded_at
         from payments where profile_id=$1 order by created_at desc,id desc limit 100`,
        [account.profile_id],
      ),
    ]);
    return {
      account,
      credits: credits.rows,
      payments: payments.rows,
      tickets: [],
      ticketsImplemented: false,
    };
  }
}
