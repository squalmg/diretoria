import { createSupabaseContext } from 'npm:@supabase/server@^1';
import pg from 'pg';
const { Pool } = pg;

const ORIGIN='https://diretoria-hml.vercel.app';
const LOCAL=new Set(['http://localhost:3100','http://127.0.0.1:3100']);
const ASAAS_BASE='https://api-sandbox.asaas.com';
const ASAAS_WEBHOOK_URL='https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook';
const ASAAS_WEBHOOK_NAME='Diretoria HML';
const PUBLIC_HML_CLUB_URL='https://diretoria-public-hml.vercel.app/club.html';
const EDGE_HEALTH_URLS=Object.freeze({
  member:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-member-api/health',
  checkout:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-checkout-api/health',
  webhook:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-asaas-webhook',
  policy:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-checkout-policy-api/health',
  policyAdmin:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-policy-admin/health',
  status:'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-checkout-status/health',
});
const EDGE_BUILD='asaas-hml-v3-20260823';
const PUBLIC_BUILD_MARKER='asaas-hml-v3-20260823';
const REQUIRED_CHECKOUT_POLICIES=Object.freeze(['club_terms','non_achievement_policy','privacy_policy']);
const OFFER_PHASES=new Set(['FORMACAO','QUORUM_EM_ANDAMENTO','VIAVEL']);
const DESIRED_WEBHOOK_EVENTS=Object.freeze([
  'CHECKOUT_CREATED','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','CHECKOUT_PAID',
  'PAYMENT_CREATED','PAYMENT_AWAITING_RISK_ANALYSIS','PAYMENT_APPROVED_BY_RISK_ANALYSIS','PAYMENT_AUTHORIZED','PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REPROVED_BY_RISK_ANALYSIS','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_REFUND_DENIED',
  'PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
]);
const DEFAULT_TIMEOUT_MS=8000;
let pool:any=null;

type Queryable={query(text:string,values?:unknown[]):Promise<{rows:any[];rowCount?:number|null}>};
function allowed(origin:string|null){return !origin||origin===ORIGIN||LOCAL.has(origin);}
function cors(req:Request):HeadersInit{const origin=req.headers.get('origin');return{'Access-Control-Allow-Origin':origin&&allowed(origin)?origin:ORIGIN,'Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store',Vary:'Origin'};}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function route(req:Request){const pathname=new URL(req.url).pathname,marker='/diretoria-asaas-hml-lab',i=pathname.indexOf(marker);return i<0?pathname:(pathname.slice(i+marker.length)||'/');}
function databaseUrl(){const value=String(Deno.env.get('SUPABASE_DB_URL')??'').trim();if(!value)throw new Error('SUPABASE_DB_URL_REQUIRED');return value;}
function db(){return pool??=new Pool({connectionString:databaseUrl(),max:3,idleTimeoutMillis:5000,connectionTimeoutMillis:5000});}
function accessToken(){const value=String(Deno.env.get('ASAAS_ACCESS_TOKEN')??'').trim();if(!value)throw new Error('PAYMENT_PROVIDER_UNCONFIGURED');return value;}
function webhookToken(){const value=String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')??'').trim();if(!value)throw new Error('PAYMENT_PROVIDER_UNCONFIGURED');if(value.length<32||value.length>255||/\s/.test(value))throw new Error('ASAAS_WEBHOOK_TOKEN_INVALID');return value;}
function bearer(req:Request){const match=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'');return match?.[1]?.trim()||null;}
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
async function adminContext(req:Request){const token=bearer(req);if(!token?.startsWith('hml_'))return{response:json(req,{ok:false,code:'HML_SESSION_REQUIRED'},401)} as const;const{data:ctx,error}=await createSupabaseContext(req,{auth:'none'});if(error||!ctx)return{response:json(req,{ok:false,code:'CONTEXT_ERROR'},503)} as const;const{data:session,error:sessionError}=await ctx.supabaseAdmin.from('hml_admin_sessions').select('id').eq('token_hash',await sha256(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();if(sessionError)return{response:json(req,{ok:false,code:'HML_SESSION_QUERY_FAILED'},500)} as const;if(!session)return{response:json(req,{ok:false,code:'HML_SESSION_INVALID'},401)} as const;const{data:profile}=await ctx.supabaseAdmin.from('profiles').select('id').eq('display_code','HML-OPERATOR').maybeSingle();if(!profile)return{response:json(req,{ok:false,code:'HML_OPERATOR_NOT_READY'},503)} as const;const{data:user}=await ctx.supabaseAdmin.from('users').select('id').eq('profile_id',profile.id).eq('provider_subject','hml-test-operator').eq('status','active').maybeSingle();if(!user)return{response:json(req,{ok:false,code:'HML_OPERATOR_NOT_READY'},503)} as const;return{ctx,actorUserId:user.id as string} as const;}
function safeCode(error:unknown){const raw=error instanceof Error?error.message:'UNKNOWN_ERROR';return raw.split(':')[0].replace(/[^A-Z0-9_]/gi,'_').toUpperCase()||'UNKNOWN_ERROR';}
function statusFor(code:string){if(code.includes('SESSION')||code.includes('AUTH'))return 401;if(code.includes('NOT_FOUND'))return 404;if(code.includes('NOT_REFUNDABLE')||code.includes('NOT_ALLOWED')||code.includes('AMBIGUOUS')||code.includes('RECONCILIATION'))return 409;if(code.includes('INVALID')||code.includes('REQUIRED')||code.includes('UNSUPPORTED'))return 400;if(code.includes('UNCONFIGURED'))return 503;return 500;}
function safeError(req:Request,error:unknown){const code=safeCode(error);return json(req,{ok:false,code},statusFor(code));}
function requiredText(value:unknown,code:string,min=1,max=500){const text=String(value??'').trim();if(text.length<min||text.length>max)throw new Error(code);return text;}
function toMinor(value:unknown){const text=String(value??'').trim(),match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(text);if(!match)throw new Error('MONEY_VALUE_INVALID');return BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0'));}
function methodType(value:unknown){const method=String(value??'').toLowerCase();if(method==='pix')return'PIX';if(method==='card')return'CREDIT_CARD';throw new Error('PAYMENT_METHOD_UNSUPPORTED');}
function asMajor(value:unknown){return Number(toMinor(value))/100;}
async function asaas(path:string,init:RequestInit={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),DEFAULT_TIMEOUT_MS);try{const response=await fetch(`${ASAAS_BASE}${path}`,{...init,headers:{Accept:'application/json','User-Agent':'Diretoria-HML-Lab/0.1',access_token:accessToken(),...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers??{})},signal:controller.signal});const text=await response.text();let body:any=null;if(text){try{body=JSON.parse(text);}catch{throw new Error('ASAAS_INVALID_JSON_RESPONSE');}}if(!response.ok)throw new Error(`ASAAS_HTTP_ERROR:${response.status}`);return body;}catch(error){if(error instanceof Error&&error.name==='AbortError')throw new Error('ASAAS_REQUEST_TIMEOUT');if(error instanceof Error&&error.message.startsWith('ASAAS_'))throw error;throw new Error('ASAAS_NETWORK_ERROR');}finally{clearTimeout(timer);}}
async function transaction<T>(fn:(client:Queryable)=>Promise<T>){const client=await db().connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function stateBySlug(slug:string){const event=await db().query(`select id,event_code,name,slug,status from events where slug=$1 limit 1`,[slug]);if(!event.rows[0])throw new Error('EVENT_NOT_FOUND');const id=event.rows[0].id;const [config,quorum,intents,payments,credits,refunds,receipts]=await Promise.all([
 db().query(`select id,version,founder_ticket_gross,variable_cost_per_member,fee_pass_through from event_financial_configs where event_id=$1 and effective_to is null order by version desc limit 1`,[id]),
 db().query(`select * from quorum_snapshots where event_id=$1 order by calculated_at desc limit 1`,[id]),
 db().query(`select id,status,payment_method,base_amount,processing_fee_amount,amount_gross,provider_session_id,reconciliation_status,provider_error_code,created_at,updated_at from checkout_intents where event_id=$1 order by created_at desc limit 20`,[id]),
 db().query(`select id,status,payment_method,amount_gross,base_amount,processing_fee_passed,provider_fee_actual,amount_net,gateway_payment_id,checkout_intent_id,paid_at,refunded_at,created_at from payments where event_id=$1 and gateway='asaas' order by created_at desc limit 20`,[id]),
 db().query(`select id,status,gross_value,protected_value,payment_id,created_at,cancelled_at from credits where event_id=$1 order by created_at desc limit 20`,[id]),
 db().query(`select id,payment_id,amount,reason,status,gateway_refund_id,requested_at,processed_at from refunds where event_id=$1 order by requested_at desc limit 20`,[id]),
 db().query(`select id,gateway_event_id,event_type,processing_status,checkout_intent_id,received_at,processed_at from payment_webhook_receipts where checkout_intent_id in(select id from checkout_intents where event_id=$1) order by received_at desc limit 40`,[id]),
 ]);return{event:event.rows[0],financialConfig:config.rows[0]??null,quorum:quorum.rows[0]??null,intents:intents.rows,payments:payments.rows,credits:credits.rows,refunds:refunds.rows,webhooks:receipts.rows};}

function normalizeEvents(value:unknown):string[]{return [...new Set((Array.isArray(value)?value:[]).map(item=>String(item??'').trim()).filter(Boolean))].sort();}
function sanitizedWebhook(row:any){
  const events=normalizeEvents(row?.events),desired=[...DESIRED_WEBHOOK_EVENTS].sort();
  const actual=new Set(events),expected=new Set(desired);
  const missing=desired.filter(event=>!actual.has(event));
  const unexpected=events.filter(event=>!expected.has(event));
  const compliant=String(row?.url??'')===ASAAS_WEBHOOK_URL&&String(row?.sendType??'').toUpperCase()==='SEQUENTIALLY'&&row?.enabled===true&&row?.interrupted===false&&missing.length===0&&unexpected.length===0;
  return{id:String(row?.id??''),name:String(row?.name??''),url:String(row?.url??''),sendType:String(row?.sendType??''),enabled:row?.enabled===true,interrupted:row?.interrupted===true,events,missingEvents:missing,unexpectedEvents:unexpected,desiredEvents:desired,compliant};
}
async function exactDiretoriaWebhook(){
  const body=await asaas('/v3/webhooks?offset=0&limit=100',{method:'GET'});
  const rows=Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[];
  const matches=rows.filter((row:any)=>String(row?.url??'').trim()===ASAAS_WEBHOOK_URL);
  if(matches.length!==1)throw new Error(matches.length?'ASAAS_DIRETORIA_WEBHOOK_AMBIGUOUS':'ASAAS_DIRETORIA_WEBHOOK_NOT_FOUND');
  return matches[0];
}
async function auditDiretoriaWebhook(){return sanitizedWebhook(await exactDiretoriaWebhook());}
async function syncDiretoriaWebhook(){
  const current=await exactDiretoriaWebhook();
  const id=requiredText(current?.id,'ASAAS_WEBHOOK_ID_REQUIRED',2,255);
  await asaas(`/v3/webhooks/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({name:ASAAS_WEBHOOK_NAME,url:ASAAS_WEBHOOK_URL,sendType:'SEQUENTIALLY',enabled:true,interrupted:false,authToken:webhookToken(),events:[...DESIRED_WEBHOOK_EVENTS]})});
  return auditDiretoriaWebhook();
}

async function fetchEdgeHealth(url:string){
  try{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Diretoria-HML-Preflight/0.1'},cache:'no-store'});const body=await response.json().catch(()=>null);return{ok:response.ok&&Boolean(body?.ok),status:response.status,body};}catch{return{ok:false,status:0,body:null};}
}
async function edgeHealthAudit(){
  const [member,checkout,webhook,policy,policyAdmin,status]=await Promise.all([fetchEdgeHealth(EDGE_HEALTH_URLS.member),fetchEdgeHealth(EDGE_HEALTH_URLS.checkout),fetchEdgeHealth(EDGE_HEALTH_URLS.webhook),fetchEdgeHealth(EDGE_HEALTH_URLS.policy),fetchEdgeHealth(EDGE_HEALTH_URLS.policyAdmin),fetchEdgeHealth(EDGE_HEALTH_URLS.status)]);
  return{
    member:{ok:member.ok&&member.body?.build===EDGE_BUILD&&member.body?.features?.legacyPaymentRoutes==='disabled'&&member.body?.features?.orchestration==='dedicated_v3'&&Array.isArray(member.body?.requiredPolicyCodes)&&member.body.requiredPolicyCodes.length===3,status:member.status},
    checkout:{ok:checkout.ok&&checkout.body?.build===EDGE_BUILD&&checkout.body?.features?.startGuard==='transactional'&&checkout.body?.features?.providerSessionPersistence===true,status:checkout.status},
    webhook:{ok:webhook.ok&&webhook.body?.build===EDGE_BUILD&&webhook.body?.features?.bindingRecovery===true&&webhook.body?.features?.refundLifecycleTracking===true&&webhook.body?.pixConfirmedPolicy==='wait_for_received',status:webhook.status},
    policy:{ok:policy.ok&&policy.body?.build===EDGE_BUILD&&Array.isArray(policy.body?.requiredCodes)&&policy.body.requiredCodes.length===3&&policy.body?.features?.activeConsentIdempotency==='0025'&&policy.body?.features?.acceptanceAtomic===true,status:policy.status},
    policyAdmin:{ok:policyAdmin.ok&&policyAdmin.body?.build===EDGE_BUILD&&Array.isArray(policyAdmin.body?.requiredCodes)&&policyAdmin.body.requiredCodes.length===3&&policyAdmin.body?.features?.privacyPolicy===true,status:policyAdmin.status},
    status:{ok:status.ok&&status.body?.build===EDGE_BUILD&&status.body?.readOnly===true&&status.body?.authority==='backend_only',status:status.status},
  };
}

async function publicBuildAudit(){
  try{
    const target=new URL(PUBLIC_HML_CLUB_URL);target.searchParams.set('_preflight',String(Date.now()));
    const response=await fetch(target,{headers:{Accept:'text/html','User-Agent':'Diretoria-HML-Preflight/0.1'},cache:'no-store'});
    const text=await response.text();
    return{ok:response.ok&&text.includes(PUBLIC_BUILD_MARKER),status:response.status,marker:PUBLIC_BUILD_MARKER};
  }catch{return{ok:false,status:0,marker:PUBLIC_BUILD_MARKER};}
}
async function preflightBySlug(slug:string){
  const checks:Array<{id:string;label:string;ok:boolean;detail:string}> = [];
  const add=(id:string,label:string,ok:boolean,detail:string)=>checks.push({id,label,ok,detail});
  const secretsOk=Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN')??'').trim()&&String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')??'').trim());
  add('secrets','Secrets Asaas HML',secretsOk,secretsOk?'runtime possui access token + webhook token':'um ou mais secrets ausentes');
  const eventResult=await db().query(`select e.id,e.event_code,e.name,e.slug,e.status,c.id config_id,c.version,c.founder_ticket_gross,c.variable_cost_per_member,c.fee_pass_through from events e left join event_financial_configs c on c.event_id=e.id and c.effective_to is null where e.slug=$1 limit 1`,[slug]);
  const event=eventResult.rows[0]??null;
  add('event','Edição HML existe',Boolean(event),event?`${event.event_code} · ${event.status}`:'slug não encontrado');
  if(event){
    add('phase','Fase permite oferta Club',OFFER_PHASES.has(event.status),String(event.status));
    const base=Number(event.founder_ticket_gross),variable=Number(event.variable_cost_per_member);
    const configOk=Boolean(event.config_id)&&event.fee_pass_through===true&&Number.isFinite(base)&&base>0&&Number.isFinite(variable)&&variable>=0&&base>variable;
    add('financial_config','Configuração financeira',configOk,event.config_id?`v${event.version} · base ${event.founder_ticket_gross} · variável ${event.variable_cost_per_member} · repasse ${event.fee_pass_through}`:'sem configuração ativa');
    const consentIndex=await db().query(`select 1 from pg_indexes where schemaname='public' and indexname='consents_active_policy_version_uq'`);
    add('consent_index','Idempotência de consentimento (0025)',consentIndex.rows.length===1,consentIndex.rows.length===1?'índice ativo':'migration 0025 ausente');
    const policyResult=await db().query(`select code,version,title from policy_documents where code=any($1::text[]) and status='active' order by code`,[[...REQUIRED_CHECKOUT_POLICIES]]);
    const active=new Map(policyResult.rows.map((row:any)=>[String(row.code),row]));
    const missing=[...REQUIRED_CHECKOUT_POLICIES].filter(code=>!active.has(code));
    add('policies','Políticas obrigatórias ativas',missing.length===0,missing.length?`faltando: ${missing.join(', ')}`:[...active.values()].map((row:any)=>`${row.code}@v${row.version}`).join(' · '));
    const recon=await db().query(`select count(*)::int total from checkout_intents where event_id=$1 and reconciliation_status in('pending','required')`,[event.id]);
    const unresolved=Number(recon.rows[0]?.total??0);
    add('reconciliation','Reconciliações pendentes',unresolved===0,unresolved===0?'nenhuma':`${unresolved} intent(s) exigem revisão`);
    const refundPending=await db().query(`select count(*)::int total from refunds where event_id=$1 and status in('requested','approved','processing')`,[event.id]);
    const unsettledRefunds=Number(refundPending.rows[0]?.total??0);
    add('refunds','Estornos pendentes',unsettledRefunds===0,unsettledRefunds===0?'nenhum':`${unsettledRefunds} estorno(s) ainda não terminal(is)`);
  } else add('policies','Políticas obrigatórias ativas',false,'não verificadas sem edição válida');
  try{const hook=await auditDiretoriaWebhook();add('webhook','Webhook Asaas Sandbox',hook.compliant,hook.compliant?`${hook.events.length} eventos · fila sequencial ativa`:`faltando ${hook.missingEvents.join(', ')||'nenhum'}; extras ${hook.unexpectedEvents.join(', ')||'nenhum'}; enabled=${hook.enabled}; interrupted=${hook.interrupted}`);}catch(error){add('webhook','Webhook Asaas Sandbox',false,safeCode(error));}
  const edges=await edgeHealthAudit();
  add('edge_member','Edge member V3 sem rotas legadas',edges.member.ok,edges.member.ok?EDGE_BUILD:`health HTTP ${edges.member.status} ou orquestração legada ainda ativa`);
  add('edge_checkout','Edge checkout V3',edges.checkout.ok,edges.checkout.ok?EDGE_BUILD:`health HTTP ${edges.checkout.status} ou feature-set divergente`);
  add('edge_webhook','Edge webhook V3',edges.webhook.ok,edges.webhook.ok?EDGE_BUILD:`health HTTP ${edges.webhook.status} ou feature-set divergente`);
  add('edge_policy','Edge policy V3',edges.policy.ok,edges.policy.ok?EDGE_BUILD:`health HTTP ${edges.policy.status} ou feature-set divergente`);
  add('edge_policy_admin','Edge policy admin V3',edges.policyAdmin.ok,edges.policyAdmin.ok?EDGE_BUILD:`health HTTP ${edges.policyAdmin.status} ou feature-set divergente`);
  add('edge_status','Edge status V3',edges.status.ok,edges.status.ok?EDGE_BUILD:`health HTTP ${edges.status.status} ou feature-set divergente`);
  const publicBuild=await publicBuildAudit();add('public_hml','Public HML V3 publicado',publicBuild.ok,publicBuild.ok?PUBLIC_BUILD_MARKER:`marker ausente ou HTTP ${publicBuild.status}`);
  return{go:checks.every(check=>check.ok),slug,checks,checkedAt:new Date().toISOString()};
}

async function exactProviderPayment(intentId:string){const result=await db().query(`select ci.id,ci.provider_session_id,ci.payment_method,ci.amount_gross,ci.status,p.status internal_payment_status from checkout_intents ci left join payments p on p.checkout_intent_id=ci.id where ci.id=$1 and ci.provider='asaas' limit 2`,[intentId]);if(result.rows.length!==1)throw new Error(result.rows.length?'CHECKOUT_INTENT_AMBIGUOUS':'CHECKOUT_INTENT_NOT_FOUND');const intent=result.rows[0];if(!intent.provider_session_id)throw new Error('CHECKOUT_PROVIDER_SESSION_NOT_FOUND');if(['paid','refunded','chargeback'].includes(String(intent.internal_payment_status??'').toLowerCase()))throw new Error(`SANDBOX_CONFIRM_NOT_ALLOWED:${intent.internal_payment_status}`);const url=new URL('/v3/payments',ASAAS_BASE);url.searchParams.set('checkoutSession',intent.provider_session_id);url.searchParams.set('limit','20');const body=await asaas(`${url.pathname}${url.search}`,{method:'GET'});const expectedMethod=methodType(intent.payment_method),expectedMinor=toMinor(intent.amount_gross);const candidates=(Array.isArray(body?.data)?body.data:[]).filter((row:any)=>{try{return String(row?.billingType??'').toUpperCase()===expectedMethod&&toMinor(row?.value)===expectedMinor;}catch{return false;}});if(candidates.length!==1)throw new Error(candidates.length?'ASAAS_CHECKOUT_PAYMENT_AMBIGUOUS':'ASAAS_CHECKOUT_PAYMENT_NOT_FOUND');return{intent,payment:candidates[0]};}

Deno.serve(async(req:Request)=>{const origin=req.headers.get('origin');if(origin&&!allowed(origin))return json(req,{ok:false,code:'ORIGIN_NOT_ALLOWED'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});const path=route(req);if(req.method==='GET'&&(path==='/'||path==='/health'))return json(req,{ok:true,service:'diretoria-asaas-hml-lab',environment:'hml',sandboxOnly:true,configured:Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN')??'').trim()&&String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')??'').trim()),desiredWebhookEventCount:DESIRED_WEBHOOK_EVENTS.length,build:EDGE_BUILD,features:{webhookSync:true,preflight:true,fullRefundOnly:true,refundLifecycleTracking:true}});const auth=await adminContext(req);if('response'in auth)return auth.response;try{
  if(req.method==='GET'&&path==='/state'){const slug=requiredText(new URL(req.url).searchParams.get('slug'),'EVENT_SLUG_REQUIRED',2,180);return json(req,{ok:true,state:await stateBySlug(slug)});}
  if(req.method==='GET'&&path==='/preflight'){const slug=requiredText(new URL(req.url).searchParams.get('slug'),'EVENT_SLUG_REQUIRED',2,180);return json(req,{ok:true,preflight:await preflightBySlug(slug)});}
  if(req.method==='GET'&&path==='/webhook-audit'){return json(req,{ok:true,webhook:await auditDiretoriaWebhook()});}
  if(req.method==='POST'&&path==='/webhook-sync'){const webhook=await syncDiretoriaWebhook();return json(req,{ok:true,webhook,updated:true});}
  const confirm=/^\/checkout-intents\/([0-9a-f-]{36})\/sandbox-confirm$/i.exec(path);if(req.method==='POST'&&confirm){const found=await exactProviderPayment(confirm[1]);const providerPaymentId=requiredText(found.payment?.id,'ASAAS_PAYMENT_ID_REQUIRED',2,255);const body=await asaas(`/v3/sandbox/payment/${encodeURIComponent(providerPaymentId)}/confirm`,{method:'POST'});return json(req,{ok:true,providerPaymentId,providerStatus:String(body?.status??'UNKNOWN'),authority:'asaas_webhook_still_required'});}
  const refund=/^\/payments\/([0-9a-f-]{36})\/refund$/i.exec(path);if(req.method==='POST'&&refund){const input=await req.json().catch(()=>({})) as Record<string,unknown>;const reason=requiredText(input.reason,'REFUND_REASON_REQUIRED',3,500);const prepared=await transaction(async client=>{const result=await client.query(`select * from payments where id=$1 and gateway='asaas' for update`,[refund[1]]);const payment=result.rows[0];if(!payment)throw new Error('PAYMENT_NOT_FOUND');if(payment.status!=='paid')throw new Error(`PAYMENT_NOT_REFUNDABLE:${payment.status}`);if(!payment.gateway_payment_id)throw new Error('PAYMENT_PROVIDER_ID_REQUIRED');const active=await client.query(`select * from refunds where payment_id=$1 and status in('requested','approved','processing') order by requested_at desc limit 1`,[payment.id]);if(active.rows[0])return{created:false,payment,refund:active.rows[0]};const inserted=await client.query(`insert into refunds(payment_id,profile_id,event_id,amount,reason,status,requested_by) values($1,$2,$3,$4,$5,'processing',$6) returning *`,[payment.id,payment.profile_id,payment.event_id,payment.amount_gross,reason,auth.actorUserId]);return{created:true,payment,refund:inserted.rows[0]};});if(!prepared.created)return json(req,{ok:true,replayed:true,refund:{id:prepared.refund.id,status:prepared.refund.status,gatewayRefundId:prepared.refund.gateway_refund_id}});try{const provider=await asaas(`/v3/payments/${encodeURIComponent(prepared.payment.gateway_payment_id)}/refund`,{method:'POST',body:JSON.stringify({description:reason})});const refunds=Array.isArray(provider?.refunds)?provider.refunds:[],latest=refunds[refunds.length-1]??null,gatewayRefundId=String(latest?.id??latest?.endToEndIdentifier??'').trim()||null;await db().query(`update refunds set gateway_refund_id=coalesce($2,gateway_refund_id) where id=$1`,[prepared.refund.id,gatewayRefundId]);return json(req,{ok:true,replayed:false,refund:{id:prepared.refund.id,status:'processing',gatewayRefundId},providerStatus:String(provider?.status??latest?.status??'UNKNOWN'),authority:'asaas_webhook_still_required'},202);}catch(error){const code=safeCode(error);if(code==='ASAAS_REQUEST_TIMEOUT'||code==='ASAAS_NETWORK_ERROR'||code==='ASAAS_INVALID_JSON_RESPONSE'){if(prepared.payment.checkout_intent_id)await db().query(`update checkout_intents set reconciliation_status='required',provider_error_code=$2,updated_at=now() where id=$1`,[prepared.payment.checkout_intent_id,`REFUND_RECONCILIATION_REQUIRED_${code}`]);throw new Error(`REFUND_RECONCILIATION_REQUIRED:${code}`);}await db().query(`update refunds set status='failed',processed_at=now() where id=$1`,[prepared.refund.id]);throw error;}}
  const reconcile=/^\/payments\/([0-9a-f-]{36})\/refund-provider-state$/i.exec(path);if(req.method==='GET'&&reconcile){const result=await db().query(`select gateway_payment_id,status from payments where id=$1 and gateway='asaas' limit 1`,[reconcile[1]]);const payment=result.rows[0];if(!payment)throw new Error('PAYMENT_NOT_FOUND');if(!payment.gateway_payment_id)throw new Error('PAYMENT_PROVIDER_ID_REQUIRED');const provider=await asaas(`/v3/payments/${encodeURIComponent(payment.gateway_payment_id)}`,{method:'GET'});return json(req,{ok:true,internalStatus:payment.status,providerStatus:String(provider?.status??'UNKNOWN'),refunds:Array.isArray(provider?.refunds)?provider.refunds:[],authority:'read_only_reconciliation'});}
  return json(req,{ok:false,code:'NOT_FOUND'},404);
}catch(error){return safeError(req,error);}});
