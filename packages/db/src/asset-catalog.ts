import pg from 'pg';

const { Pool } = pg;

type UsagePermission = 'unknown' | 'internal' | 'organic' | 'paid' | 'unrestricted' | 'restricted';
type RightsStatus = 'review_required' | 'cleared' | 'restricted' | 'expired';

export interface AssetCatalogInput {
  eventId?: string;
  historicalEventLabel?: string;
  assetType: string;
  storageKey: string;
  title?: string;
  description?: string;
  format?: string;
  quality?: string;
  usagePermission: UsagePermission;
  rightsStatus: RightsStatus;
  rightsNotes?: string;
  sourceCredit?: string;
  externalSourceUrl?: string;
  capturedAt?: string;
  tags?: string[];
}

function optional(value: string | undefined, max: number, code: string): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(code);
  return text;
}
function required(value: string, max: number, code: string): string {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(code);
  return text;
}
function assertUuid(value: string | undefined, code: string): void {
  if (value && !/^[0-9a-f-]{36}$/i.test(value)) throw new Error(code);
}
function normalizeTags(tags?: string[]): string[] {
  const normalized = [...new Set((tags ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (normalized.length > 30) throw new Error('ASSET_TAG_LIMIT');
  for (const tag of normalized) if (tag.length > 80) throw new Error('ASSET_TAG_TOO_LONG');
  return normalized;
}
function validateUrl(value?: string): string | undefined {
  const text = optional(value, 2_000, 'ASSET_SOURCE_URL_TOO_LONG');
  if (!text) return undefined;
  let url: URL;
  try { url = new URL(text); } catch { throw new Error('ASSET_SOURCE_URL_INVALID'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('ASSET_SOURCE_URL_INVALID');
  return url.toString();
}

export class PostgresAssetCatalog {
  private readonly pool: any;
  constructor(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
  }
  async close(): Promise<void> { await this.pool.end(); }

  private normalize(input: AssetCatalogInput) {
    assertUuid(input.eventId, 'EVENT_ID_INVALID');
    const usage = input.usagePermission;
    const rights = input.rightsStatus;
    if (!['unknown','internal','organic','paid','unrestricted','restricted'].includes(usage)) throw new Error('USAGE_PERMISSION_INVALID');
    if (!['review_required','cleared','restricted','expired'].includes(rights)) throw new Error('RIGHTS_STATUS_INVALID');
    const capturedAt = optional(input.capturedAt, 64, 'CAPTURED_AT_TOO_LONG');
    if (capturedAt && Number.isNaN(Date.parse(capturedAt))) throw new Error('CAPTURED_AT_INVALID');
    return {
      eventId: input.eventId,
      historicalEventLabel: optional(input.historicalEventLabel, 180, 'HISTORICAL_EVENT_TOO_LONG'),
      assetType: required(input.assetType, 80, 'ASSET_TYPE_REQUIRED'),
      storageKey: required(input.storageKey, 500, 'STORAGE_KEY_REQUIRED'),
      title: optional(input.title, 240, 'ASSET_TITLE_TOO_LONG'),
      description: optional(input.description, 2_000, 'ASSET_DESCRIPTION_TOO_LONG'),
      format: optional(input.format, 80, 'ASSET_FORMAT_TOO_LONG'),
      quality: optional(input.quality, 80, 'ASSET_QUALITY_TOO_LONG'),
      usagePermission: usage,
      rightsStatus: rights,
      rightsNotes: optional(input.rightsNotes, 2_000, 'RIGHTS_NOTES_TOO_LONG'),
      sourceCredit: optional(input.sourceCredit, 240, 'SOURCE_CREDIT_TOO_LONG'),
      externalSourceUrl: validateUrl(input.externalSourceUrl),
      capturedAt,
      tags: normalizeTags(input.tags),
    };
  }

  async create(input: AssetCatalogInput, actorUserId: string): Promise<string> {
    assertUuid(actorUserId, 'ACTOR_USER_ID_INVALID');
    const value = this.normalize(input);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `insert into assets(event_id,historical_event_label,asset_type,storage_key,title,description,format,quality,usage_permission,rights_status,rights_notes,source_credit,external_source_url,captured_at,created_by,updated_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         returning id`,
        [value.eventId ?? null,value.historicalEventLabel ?? null,value.assetType,value.storageKey,value.title ?? null,value.description ?? null,value.format ?? null,value.quality ?? null,value.usagePermission,value.rightsStatus,value.rightsNotes ?? null,value.sourceCredit ?? null,value.externalSourceUrl ?? null,value.capturedAt ?? null,actorUserId],
      );
      const id = result.rows[0].id as string;
      for (const tag of value.tags) await client.query('insert into asset_tags(asset_id,tag) values($1,$2)', [id, tag]);
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,after_data,reason)
         values($1,'user','asset.catalog_created','asset',$2,$3,$4::jsonb,'ASSET_CATALOG_CREATED')`,
        [actorUserId,id,value.eventId ?? null,JSON.stringify({rightsStatus:value.rightsStatus,usagePermission:value.usagePermission,tags:value.tags})],
      );
      await client.query('COMMIT');
      return id;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async update(id: string, input: AssetCatalogInput, actorUserId: string): Promise<void> {
    assertUuid(id, 'ASSET_ID_INVALID');
    assertUuid(actorUserId, 'ACTOR_USER_ID_INVALID');
    const value = this.normalize(input);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const beforeResult = await client.query('select rights_status,usage_permission,event_id from assets where id=$1 for update', [id]);
      if (!beforeResult.rows[0]) throw new Error('ASSET_NOT_FOUND');
      const before = beforeResult.rows[0];
      await client.query(
        `update assets set event_id=$2,historical_event_label=$3,asset_type=$4,storage_key=$5,title=$6,description=$7,format=$8,quality=$9,usage_permission=$10,rights_status=$11,rights_notes=$12,source_credit=$13,external_source_url=$14,captured_at=$15,updated_by=$16,updated_at=now() where id=$1`,
        [id,value.eventId ?? null,value.historicalEventLabel ?? null,value.assetType,value.storageKey,value.title ?? null,value.description ?? null,value.format ?? null,value.quality ?? null,value.usagePermission,value.rightsStatus,value.rightsNotes ?? null,value.sourceCredit ?? null,value.externalSourceUrl ?? null,value.capturedAt ?? null,actorUserId],
      );
      await client.query('delete from asset_tags where asset_id=$1', [id]);
      for (const tag of value.tags) await client.query('insert into asset_tags(asset_id,tag) values($1,$2)', [id, tag]);
      await client.query(
        `insert into audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,event_id,before_data,after_data,reason)
         values($1,'user','asset.catalog_updated','asset',$2,$3,$4::jsonb,$5::jsonb,'ASSET_CATALOG_UPDATED')`,
        [actorUserId,id,value.eventId ?? before.event_id ?? null,JSON.stringify({rightsStatus:before.rights_status,usagePermission:before.usage_permission}),JSON.stringify({rightsStatus:value.rightsStatus,usagePermission:value.usagePermission,tags:value.tags})],
      );
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async list(filters: { rightsStatus?: RightsStatus; usagePermission?: UsagePermission; assetType?: string; tag?: string; search?: string; limit?: number } = {}) {
    const values: unknown[] = [];
    const where = ['true'];
    if (filters.rightsStatus) { values.push(filters.rightsStatus); where.push(`a.rights_status=$${values.length}`); }
    if (filters.usagePermission) { values.push(filters.usagePermission); where.push(`a.usage_permission=$${values.length}`); }
    if (filters.assetType) { values.push(required(filters.assetType,80,'ASSET_TYPE_INVALID')); where.push(`a.asset_type=$${values.length}`); }
    if (filters.tag) { values.push(required(filters.tag,80,'ASSET_TAG_INVALID').toLowerCase()); where.push(`exists(select 1 from asset_tags at2 where at2.asset_id=a.id and at2.tag=$${values.length})`); }
    if (filters.search) { values.push(`%${required(filters.search,180,'ASSET_SEARCH_INVALID')}%`); where.push(`(coalesce(a.title,'') ilike $${values.length} or coalesce(a.description,'') ilike $${values.length} or coalesce(a.historical_event_label,'') ilike $${values.length})`); }
    const limit = filters.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('ASSET_LIMIT_INVALID');
    values.push(limit);
    const result = await this.pool.query(
      `select a.*,coalesce(array_agg(at.tag order by at.tag) filter(where at.tag is not null),'{}') tags
       from assets a left join asset_tags at on at.asset_id=a.id
       where ${where.join(' and ')} group by a.id order by a.created_at desc limit $${values.length}`,
      values,
    );
    return result.rows;
  }

  async rightsSummary() {
    const result = await this.pool.query(`select rights_status,usage_permission,count(*)::int count from assets group by rights_status,usage_permission order by rights_status,usage_permission`);
    return result.rows;
  }
}
