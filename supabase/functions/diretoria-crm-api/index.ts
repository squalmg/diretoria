import { createSupabaseContext } from 'npm:@supabase/server@^1';
import pg from 'pg';

const { Pool } = pg;
const CANONICAL_ORIGIN = 'https://diretoria-hml.vercel.app';
const LOCAL_ORIGINS = new Set(['http://localhost:3100','http://127.0.0.1:3100']);
let pool: any = null;

function cors(req: Request): HeadersInit {
  const origin=req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && (origin===CANONICAL_ORIGIN||LOCAL_ORIGINS.has(origin)) ? origin : CANONICAL_ORIGIN,
    'Access-Control-Allow-Headers':'authorization,content-type',
    'Access-Control-Allow-Methods':'GET,OPTIONS',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin',
    'Cache-Control':'no-store',
  };
}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function originAllowed(origin:string|null){return !origin||origin===CANONICAL_ORIGIN||LOCAL_ORIGINS.has(origin);}
function bearer(req:Request){const m=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'');return m?.[1]?.trim()||null;}
async function sha256(value:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');}
function routePath(req:Request){const p=new URL(req.url).pathname;const marker='/diretoria-crm-api';const i=p.indexOf(marker);if(i<0)return p;return p.slice(i+marker.length)||'/';}
function db(){if(pool)return pool;const connection=Deno.env.get('SUPABASE_DB_URL');if(!connection)throw new Error('DATABASE_URL_REQUIRED');pool=new Pool({connectionString:connection,max:3,idleTimeoutMillis:5000,connectionTimeoutMillis:5000});return pool;}

async function session(req:Request){
  const token=bearer(req);
  if(!token?.startsWith('hml_'))return {response:json(req,{ok:false,code:'HML_SESSION_REQUIRED'},401)} as const;
  const {data:ctx,error}=await createSupabaseContext(req,{auth:'none'});
  if(error||!ctx)return {response:json(req,{ok:false,code:'SERVICE_UNAVAILABLE'},503)} as const;
  const tokenHash=await sha256(token);const now=new Date().toISOString();
  const {data,error:queryError}=await ctx.supabaseAdmin.from('hml_admin_sessions').select('id,expires_at').eq('token_hash',tokenHash).is('revoked_at',null).gt('expires_at',now).maybeSingle();
  if(queryError)return {response:json(req,{ok:false,code:'HML_SESSION_QUERY_FAILED'},500)} as const;
  if(!data)return {response:json(req,{ok:false,code:'HML_SESSION_INVALID'},401)} as const;
  return {sessionId:data.id as string,expiresAt:data.expires_at as string} as const;
}

function clampInt(raw:string|null,def:number,min:number,max:number){const n=raw===null?def:Number(raw);return Number.isInteger(n)&&n>=min&&n<=max?n:def;}
function optional(raw:string|null,max:number){if(raw===null)return null;const t=raw.trim();return t? t.slice(0,max):null;}

async function health(req:Request){
  const auth=await session(req);if('response'in auth)return auth.response;
  const r=await db().query('select 1 as ok');return json(req,{ok:r.rows[0]?.ok===1,service:'diretoria-crm-api',environment:'hml',mode:'read-only',expiresAt:auth.expiresAt});
}

async function overview(req:Request){
  const auth=await session(req);if('response'in auth)return auth.response;
  const client=db();
  const [totals,stages,sources,campaigns,consents]=await Promise.all([
    client.query(`select count(*)::int as total,
      count(*) filter(where created_at>=now()-interval '24 hours')::int as last_24h,
      count(*) filter(where created_at>=now()-interval '7 days')::int as last_7d
      from profiles where display_code not like 'HML-%'`),
    client.query(`with latest as (select distinct on(profile_id) profile_id,to_stage from crm_stage_history order by profile_id,changed_at desc,id desc)
      select coalesce(to_stage,'sem_estagio') stage,count(*)::int count from profiles p left join latest l on l.profile_id=p.id where p.display_code not like 'HML-%' group by coalesce(to_stage,'sem_estagio') order by count desc`),
    client.query(`select source,count(*)::int count from acquisition_attributions group by source order by count desc,source limit 10`),
    client.query(`select coalesce(campaign,'(sem campanha)') campaign,count(*)::int count from acquisition_attributions group by coalesce(campaign,'(sem campanha)') order by count desc,campaign limit 10`),
    client.query(`with latest as (select distinct on(profile_id,consent_type) profile_id,consent_type,granted from consents order by profile_id,consent_type,granted_at desc,id desc)
      select consent_type,count(*) filter(where granted)::int granted,count(*) filter(where not granted)::int denied from latest group by consent_type order by consent_type`),
  ]);
  return json(req,{ok:true,total:totals.rows[0],stages:stages.rows,sources:sources.rows,campaigns:campaigns.rows,consents:consents.rows});
}

async function listProfiles(req:Request){
  const auth=await session(req);if('response'in auth)return auth.response;
  const url=new URL(req.url);const search=optional(url.searchParams.get('search'),120);const stage=optional(url.searchParams.get('stage'),40);const source=optional(url.searchParams.get('source'),120);const campaign=optional(url.searchParams.get('campaign'),180);const limit=clampInt(url.searchParams.get('limit'),50,1,100);const offset=clampInt(url.searchParams.get('offset'),0,0,100000);
  const values:any[]=[];const where=[`p.display_code not like 'HML-%'`];
  if(search){values.push(`%${search}%`);where.push(`(p.full_name ilike $${values.length} or coalesce(p.email_normalized,'') ilike $${values.length} or coalesce(p.phone_e164,'') ilike $${values.length})`);}
  if(stage){values.push(stage);where.push(`coalesce(st.to_stage,'sem_estagio')=$${values.length}`);}
  if(source){values.push(source);where.push(`coalesce(attr.source,'')=$${values.length}`);}
  if(campaign){values.push(campaign);where.push(`coalesce(attr.campaign,'')=$${values.length}`);}
  values.push(limit,offset);const limitParam=values.length-1,offsetParam=values.length;
  const sql=`select p.id,p.display_code,p.full_name,p.email_normalized,p.phone_e164,p.status,p.created_at,p.updated_at,
    coalesce(st.to_stage,'sem_estagio') stage,st.changed_at stage_at,
    attr.source,attr.medium,attr.campaign,attr.content,attr.referral_code,attr.occurred_at attribution_at,
    cprivacy.granted privacy,cmarketing.granted marketing,cwhatsapp.granted whatsapp,cemail.granted email_consent
    from profiles p
    left join lateral(select to_stage,changed_at from crm_stage_history where profile_id=p.id order by changed_at desc,id desc limit 1) st on true
    left join lateral(select source,medium,campaign,content,referral_code,occurred_at from acquisition_attributions where profile_id=p.id order by occurred_at desc,id desc limit 1) attr on true
    left join lateral(select granted from consents where profile_id=p.id and consent_type='privacy' order by granted_at desc,id desc limit 1) cprivacy on true
    left join lateral(select granted from consents where profile_id=p.id and consent_type='marketing' order by granted_at desc,id desc limit 1) cmarketing on true
    left join lateral(select granted from consents where profile_id=p.id and consent_type='whatsapp' order by granted_at desc,id desc limit 1) cwhatsapp on true
    left join lateral(select granted from consents where profile_id=p.id and consent_type='email' order by granted_at desc,id desc limit 1) cemail on true
    where ${where.join(' and ')} order by p.created_at desc,p.id desc limit $${limitParam} offset $${offsetParam}`;
  const result=await db().query(sql,values);
  return json(req,{ok:true,items:result.rows,limit,offset});
}

async function profile360(req:Request,profileId:string){
  const auth=await session(req);if('response'in auth)return auth.response;
  if(!/^[0-9a-f-]{36}$/i.test(profileId))return json(req,{ok:false,code:'PROFILE_ID_INVALID'},400);
  const client=db();
  const profile=await client.query('select id,display_code,full_name,email_normalized,phone_e164,status,first_source,first_campaign,created_at,updated_at from profiles where id=$1',[profileId]);
  if(!profile.rows[0])return json(req,{ok:false,code:'PROFILE_NOT_FOUND'},404);
  const [stages,attributions,consents,interactions,analytics,payments,credits,audit]=await Promise.all([
    client.query('select from_stage,to_stage,reason,source_type,changed_at from crm_stage_history where profile_id=$1 order by changed_at desc,id desc limit 50',[profileId]),
    client.query('select source,medium,campaign,content,term,referral_code,landing_page,session_key,occurred_at from acquisition_attributions where profile_id=$1 order by occurred_at desc,id desc limit 50',[profileId]),
    client.query('select consent_type,policy_version,granted,source,granted_at,revoked_at from consents where profile_id=$1 order by granted_at desc,id desc limit 100',[profileId]),
    client.query('select channel,direction,interaction_type,summary,occurred_at from crm_interactions where profile_id=$1 order by occurred_at desc,id desc limit 50',[profileId]),
    client.query('select event_name,properties,occurred_at from analytics_events where profile_id=$1 order by occurred_at desc,id desc limit 50',[profileId]),
    client.query('select id,event_id,purpose,gateway,amount_gross,amount_net,payment_method,status,created_at,paid_at,refunded_at from payments where profile_id=$1 order by created_at desc limit 30',[profileId]),
    client.query('select id,event_id,gross_value,protected_value,status,created_at from credits where profile_id=$1 order by created_at desc limit 30',[profileId]),
    client.query(`select action,entity_type,entity_id,reason,occurred_at from audit_logs where entity_id=$1 or actor_user_id in(select id from users where profile_id=$1) order by occurred_at desc limit 50`,[profileId]),
  ]);
  return json(req,{ok:true,profile:profile.rows[0],stages:stages.rows,attributions:attributions.rows,consents:consents.rows,interactions:interactions.rows,analytics:analytics.rows,payments:payments.rows,credits:credits.rows,audit:audit.rows});
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(!originAllowed(origin))return json(req,{ok:false,code:'ORIGIN_NOT_ALLOWED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=='GET')return json(req,{ok:false,code:'METHOD_NOT_ALLOWED'},405);
  const path=routePath(req);
  try{
    if(path==='/'||path==='/health')return await health(req);
    if(path==='/overview')return await overview(req);
    if(path==='/profiles')return await listProfiles(req);
    const match=/^\/profiles\/([0-9a-f-]{36})$/i.exec(path);if(match)return await profile360(req,match[1]);
    return json(req,{ok:false,code:'NOT_FOUND'},404);
  }catch(error){const code=error instanceof Error?error.message.split(':')[0]:'CRM_QUERY_FAILED';console.error(JSON.stringify({level:'error',msg:'crm_api_failed',code}));return json(req,{ok:false,code:'CRM_QUERY_FAILED'},500);}
});
