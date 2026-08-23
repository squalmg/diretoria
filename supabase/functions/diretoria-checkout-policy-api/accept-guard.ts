import pg from 'pg';
const { Pool }=pg;
type Queryable={query(text:string,values?:unknown[]):Promise<{rows:any[];rowCount?:number|null}>};
export interface CheckoutPolicyDocument{ id:string; code:string; version:number; contentHash:string; status?:string; }
export interface CheckoutPolicyAcceptanceInput{ profileId:string; documents:CheckoutPolicyDocument[]; context:string; source:string; bundleFingerprint:string; userAgent?:string|null; }
function required(value:string,code:string){const text=String(value??'').trim();if(!text)throw new Error(code);return text;}
function uuid(value:string,code:string){const text=required(value,code);if(!/^[0-9a-f-]{36}$/i.test(text))throw new Error(code);return text;}
function policyVersion(document:CheckoutPolicyDocument){return `policy_document:${document.id}:v${document.version}:${document.contentHash}`;}
export class PostgresCheckoutPolicyAcceptanceGuard{
  private readonly pool:any;
  constructor(connectionString:string){if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');this.pool=new Pool({connectionString,max:3,idleTimeoutMillis:5000,connectionTimeoutMillis:5000});}
  async close(){await this.pool.end();}
  private async transaction<T>(fn:(client:Queryable)=>Promise<T>):Promise<T>{const client=await this.pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async accept(input:CheckoutPolicyAcceptanceInput){
    const profileId=uuid(input.profileId,'POLICY_PROFILE_ID_INVALID'),context=required(input.context,'POLICY_ACCEPTANCE_CONTEXT_REQUIRED'),source=required(input.source,'POLICY_ACCEPTANCE_SOURCE_REQUIRED'),fingerprint=required(input.bundleFingerprint,'POLICY_BUNDLE_FINGERPRINT_REQUIRED');
    const documents=[...input.documents];if(documents.length!==3)throw new Error('POLICY_CHECKOUT_BUNDLE_INCOMPLETE');
    const ids=documents.map(document=>uuid(document.id,'POLICY_DOCUMENT_ID_INVALID'));
    const codes=documents.map(document=>required(document.code,'POLICY_CODE_REQUIRED'));
    if(new Set(ids).size!==ids.length||new Set(codes).size!==codes.length)throw new Error('POLICY_CHECKOUT_BUNDLE_DUPLICATE');
    return this.transaction(async client=>{
      const migration=await client.query(`select 1 from pg_indexes where schemaname='public' and indexname='consents_active_policy_version_uq'`);if(!migration.rows[0])throw new Error('CHECKOUT_CONSENT_IDEMPOTENCY_MIGRATION_REQUIRED');
      const profile=await client.query(`select status from profiles where id=$1 for update`,[profileId]);if(!profile.rows[0])throw new Error('POLICY_PROFILE_NOT_FOUND');if(['blocked','archived'].includes(String(profile.rows[0].status)))throw new Error('POLICY_PROFILE_NOT_ACTIVE');
      const locked=await client.query(`select id,code,version,content_hash,status from policy_documents where id=any($1::uuid[]) for share`,[ids]);if(locked.rows.length!==documents.length)throw new Error('POLICY_DOCUMENT_NOT_FOUND');
      const byId=new Map(locked.rows.map((row:any)=>[String(row.id),row]));
      for(const document of documents){const row=byId.get(document.id);if(!row||row.status!=='active')throw new Error('POLICY_DOCUMENT_NOT_ACTIVE');if(String(row.code)!==document.code||Number(row.version)!==Number(document.version)||String(row.content_hash)!==document.contentHash)throw new Error('POLICY_BUNDLE_STALE');}
      const acceptedIds:string[]=[],replayedIds:string[]=[],consents:Array<{type:'terms'|'privacy';policyVersion:string;id:string;replayed:boolean}>=[];
      const evidence=JSON.stringify({bundleFingerprint:fingerprint,userAgent:String(input.userAgent??'').slice(0,300)});
      for(const document of documents){
        const inserted=await client.query(`insert into policy_acceptances(profile_id,policy_document_id,context,source,evidence) values($1,$2,$3,$4,$5::jsonb) on conflict(profile_id,policy_document_id,context) do nothing returning id`,[profileId,document.id,context,source,evidence]);
        if(inserted.rows[0])acceptedIds.push(inserted.rows[0].id);else{const existing=await client.query(`select id from policy_acceptances where profile_id=$1 and policy_document_id=$2 and context=$3`,[profileId,document.id,context]);if(!existing.rows[0])throw new Error('POLICY_ACCEPTANCE_IDEMPOTENCY_RECHECK_FAILED');replayedIds.push(existing.rows[0].id);}
        const consentType=document.code==='club_terms'?'terms':document.code==='privacy_policy'?'privacy':null;if(!consentType)continue;
        const version=policyVersion(document);
        const consent=await client.query(`insert into consents(profile_id,consent_type,policy_version,granted,source,user_agent) values($1,$2,$3,true,$4,$5) on conflict do nothing returning id`,[profileId,consentType,version,source,String(input.userAgent??'').slice(0,300)||null]);
        if(consent.rows[0])consents.push({type:consentType,policyVersion:version,id:consent.rows[0].id,replayed:false});else{const existing=await client.query(`select id from consents where profile_id=$1 and consent_type=$2 and policy_version=$3 and granted=true and revoked_at is null`,[profileId,consentType,version]);if(!existing.rows[0])throw new Error('CONSENT_IDEMPOTENCY_RECHECK_FAILED');consents.push({type:consentType,policyVersion:version,id:existing.rows[0].id,replayed:true});}
      }
      return{acceptedIds,replayedIds,consents};
    });
  }
}
