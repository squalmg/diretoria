import pg from 'pg';
import { createHash } from 'node:crypto';

const { Pool } = pg;

type QueryResultLike = { rows: any[]; rowCount?: number | null };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResultLike> };

export interface CreatePolicyDraftInput {
  code: string;
  documentType: 'terms' | 'rules' | 'policy' | 'notice';
  title: string;
  content: string;
  createdBy?: string | null;
}

export interface PolicyDocumentView {
  id: string;
  code: string;
  documentType: string;
  version: number;
  title: string;
  contentHash: string;
  status: string;
  activatedAt: string | null;
}

export interface ActivePolicyBundle {
  documents: PolicyDocumentView[];
  fingerprint: string;
}

function required(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertUuid(value: string, code: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(code);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export class PostgresPolicyGate {
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

  async createDraft(input: CreatePolicyDraftInput): Promise<{ id: string; code: string; version: number; contentHash: string; status: 'draft' }> {
    const code = required(input.code, 'POLICY_CODE_REQUIRED').toLowerCase();
    const title = required(input.title, 'POLICY_TITLE_REQUIRED');
    const content = required(input.content, 'POLICY_CONTENT_REQUIRED');
    if (!['terms', 'rules', 'policy', 'notice'].includes(input.documentType)) throw new Error('POLICY_DOCUMENT_TYPE_INVALID');
    if (input.createdBy) assertUuid(input.createdBy, 'POLICY_CREATED_BY_INVALID');
    const contentHash = sha256(content);

    return this.transaction(async (client) => {
      const versionResult = await client.query(
        `select coalesce(max(version),0)::int + 1 version from policy_documents where code=$1`,
        [code],
      );
      const version = Number(versionResult.rows[0].version);
      const inserted = await client.query(
        `insert into policy_documents(code,document_type,version,title,content,content_hash,status,created_by)
         values ($1,$2,$3,$4,$5,$6,'draft',$7)
         returning id`,
        [code, input.documentType, version, title, content, contentHash, input.createdBy ?? null],
      );
      return { id: inserted.rows[0].id, code, version, contentHash, status: 'draft' };
    });
  }

  async activate(documentId: string, actorUserId?: string | null): Promise<PolicyDocumentView> {
    assertUuid(documentId, 'POLICY_DOCUMENT_ID_INVALID');
    if (actorUserId) assertUuid(actorUserId, 'POLICY_ACTOR_INVALID');

    return this.transaction(async (client) => {
      const targetResult = await client.query(
        `select id,code,document_type,version,title,content_hash,status,activated_at
         from policy_documents where id=$1 for update`,
        [documentId],
      );
      const target = targetResult.rows[0];
      if (!target) throw new Error('POLICY_DOCUMENT_NOT_FOUND');
      if (target.status === 'retired') throw new Error('POLICY_DOCUMENT_RETIRED');

      await client.query(
        `update policy_documents set status='retired',retired_at=now()
         where code=$1 and status='active' and id<>$2`,
        [target.code, target.id],
      );
      const activeResult = await client.query(
        `update policy_documents set status='active',activated_at=coalesce(activated_at,now()),retired_at=null
         where id=$1
         returning id,code,document_type,version,title,content_hash,status,activated_at`,
        [target.id],
      );
      const active = activeResult.rows[0];
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,after_data,reason)
         values ($1,$2,'policy.document_activated','policy_document',$3,$4::jsonb,'POLICY_VERSION_ACTIVATED')`,
        [actorUserId ?? null, actorUserId ? 'user' : 'system', active.id, JSON.stringify({ code: active.code, version: active.version, contentHash: active.content_hash })],
      );
      return {
        id: active.id,
        code: active.code,
        documentType: active.document_type,
        version: Number(active.version),
        title: active.title,
        contentHash: active.content_hash,
        status: active.status,
        activatedAt: active.activated_at,
      };
    });
  }

  async activeBundle(codes: string[]): Promise<ActivePolicyBundle> {
    const normalized = [...new Set(codes.map((code) => required(code, 'POLICY_CODE_REQUIRED').toLowerCase()))].sort();
    if (!normalized.length) throw new Error('POLICY_CODES_REQUIRED');
    const result = await this.pool.query(
      `select id,code,document_type,version,title,content_hash,status,activated_at
       from policy_documents
       where code=any($1::text[]) and status='active'
       order by code`,
      [normalized],
    );
    const byCode = new Map(result.rows.map((row: any) => [row.code, row]));
    const missing = normalized.filter((code) => !byCode.has(code));
    if (missing.length) throw new Error(`POLICY_ACTIVE_DOCUMENT_REQUIRED:${missing.join(',')}`);
    const documents: PolicyDocumentView[] = normalized.map((code) => {
      const row = byCode.get(code)!;
      return { id: row.id, code: row.code, documentType: row.document_type, version: Number(row.version), title: row.title, contentHash: row.content_hash, status: row.status, activatedAt: row.activated_at };
    });
    const fingerprint = sha256(documents.map((document) => `${document.code}:${document.version}:${document.contentHash}`).join('|'));
    return { documents, fingerprint };
  }

  async accept(input: {
    profileId: string;
    policyDocumentIds: string[];
    context: string;
    source: string;
    evidence?: Record<string, unknown>;
  }): Promise<{ acceptedIds: string[]; replayedIds: string[] }> {
    assertUuid(input.profileId, 'POLICY_PROFILE_ID_INVALID');
    const context = required(input.context, 'POLICY_ACCEPTANCE_CONTEXT_REQUIRED');
    const source = required(input.source, 'POLICY_ACCEPTANCE_SOURCE_REQUIRED');
    const documentIds = [...new Set(input.policyDocumentIds)];
    if (!documentIds.length) throw new Error('POLICY_DOCUMENT_IDS_REQUIRED');
    for (const id of documentIds) assertUuid(id, 'POLICY_DOCUMENT_ID_INVALID');

    return this.transaction(async (client) => {
      const profile = await client.query(`select status from profiles where id=$1`, [input.profileId]);
      if (!profile.rows[0]) throw new Error('POLICY_PROFILE_NOT_FOUND');
      if (['blocked', 'archived'].includes(profile.rows[0].status)) throw new Error('POLICY_PROFILE_NOT_ACTIVE');

      const docs = await client.query(
        `select id,status from policy_documents where id=any($1::uuid[]) for update`,
        [documentIds],
      );
      if (docs.rows.length !== documentIds.length) throw new Error('POLICY_DOCUMENT_NOT_FOUND');
      if (docs.rows.some((row: any) => row.status !== 'active')) throw new Error('POLICY_DOCUMENT_NOT_ACTIVE');

      const acceptedIds: string[] = [];
      const replayedIds: string[] = [];
      for (const documentId of documentIds) {
        const existing = await client.query(
          `select id from policy_acceptances where profile_id=$1 and policy_document_id=$2 and context=$3`,
          [input.profileId, documentId, context],
        );
        if (existing.rows[0]) {
          replayedIds.push(existing.rows[0].id);
          continue;
        }
        const inserted = await client.query(
          `insert into policy_acceptances(profile_id,policy_document_id,context,source,evidence)
           values ($1,$2,$3,$4,$5::jsonb) returning id`,
          [input.profileId, documentId, context, source, JSON.stringify(input.evidence ?? {})],
        );
        acceptedIds.push(inserted.rows[0].id);
      }
      return { acceptedIds, replayedIds };
    });
  }

  async assertAccepted(input: { profileId: string; context: string; requiredCodes: string[] }): Promise<{ ok: true; fingerprint: string; documentIds: string[] }> {
    assertUuid(input.profileId, 'POLICY_PROFILE_ID_INVALID');
    const context = required(input.context, 'POLICY_ACCEPTANCE_CONTEXT_REQUIRED');
    const bundle = await this.activeBundle(input.requiredCodes);
    const documentIds = bundle.documents.map((document) => document.id);
    const accepted = await this.pool.query(
      `select policy_document_id from policy_acceptances
       where profile_id=$1 and context=$2 and policy_document_id=any($3::uuid[])`,
      [input.profileId, context, documentIds],
    );
    const acceptedSet = new Set(accepted.rows.map((row: any) => row.policy_document_id));
    const missing = bundle.documents.filter((document) => !acceptedSet.has(document.id)).map((document) => document.code);
    if (missing.length) throw new Error(`POLICY_ACCEPTANCE_REQUIRED:${missing.join(',')}`);
    return { ok: true, fingerprint: bundle.fingerprint, documentIds };
  }
}
