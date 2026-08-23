import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresMemberAccounts } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/member-accounts.ts';
import { PostgresClubCheckout } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/club-checkout.ts';

const PUBLIC_HML_ORIGIN='https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS=new Set(['http://localhost:3200','http://127.0.0.1:3200']);
const BUILD='asaas-hml-v3-20260823';
const REQUIRED_CHECKOUT_POLICIES=Object.freeze(['club_terms','non_achievement_policy','privacy_policy']);
const PINNED_CORE_SHA='c0fefccf0cf71b664ed6860b595dbe1bb037b827';
let memberInstance:PostgresMemberAccounts|null=null;
let checkoutInstance:PostgresClubCheckout|null=null;

function originAllowed(origin:string|null){return !origin||origin===PUBLIC_HML_ORIGIN||LOCAL_ORIGINS.has(origin);}
function cors(req:Request):HeadersInit{const origin=req.headers.get('origin');return{'Access-Control-Allow-Origin':origin&&originAllowed(origin)?origin:PUBLIC_HML_ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'86400','Cache-Control':'no-store',Vary:'Origin'};}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function route(req:Request){const pathname=new URL(req.url).pathname,marker='/diretoria-member-api',index=pathname.indexOf(marker);return index<0?pathname:(pathname.slice(index+marker.length)||'/');}
function databaseUrl(){const value=String(Deno.env.get('SUPABASE_DB_URL')??'').trim();if(!value)throw new Error('SUPABASE_DB_URL_REQUIRED');return value;}
function memberCore(){return memberInstance??=new PostgresMemberAccounts(databaseUrl());}
function checkoutCore(){return checkoutInstance??=new PostgresClubCheckout(databaseUrl());}
function asaasConfigured(){return Boolean(String(Deno.env.get('ASAAS_ACCESS_TOKEN')??'').trim()&&String(Deno.env.get('ASAAS_WEBHOOK_AUTH_TOKEN')??'').trim());}
async function authenticated(req:Request){const{data:ctx,error}=await createSupabaseContext(req,{auth:'user'});if(error||!ctx)return{response:json(req,{ok:false,code:error?.code??'AUTH_REQUIRED'},error?.status??401)} as const;const subject=String(ctx.userClaims?.sub??'').trim();if(!subject)return{response:json(req,{ok:false,code:'AUTH_SUBJECT_REQUIRED'},401)} as const;const result=await ctx.supabaseAdmin.auth.admin.getUserById(subject),user=result.data?.user;if(result.error||!user)return{response:json(req,{ok:false,code:'AUTH_USER_NOT_FOUND'},401)} as const;const metadata=(user.user_metadata??{}) as Record<string,unknown>;return{subject,email:user.email??null,phone:user.phone??null,emailVerified:Boolean(user.email_confirmed_at),phoneVerified:Boolean(user.phone_confirmed_at),fullName:String(metadata.full_name??metadata.name??'').trim()||null} as const;}
function safeError(req:Request,error:unknown){const raw=error instanceof Error?error.message:'UNKNOWN_ERROR',code=raw.split(':')[0].replace(/[^A-Z0-9_]/gi,'_').toUpperCase()||'UNKNOWN_ERROR';if(code.includes('NOT_FOUND'))return json(req,{ok:false,code},404);if(code.includes('AUTH'))return json(req,{ok:false,code},401);if(code.includes('PHASE_BLOCKED')||code.includes('IDEMPOTENCY_CONFLICT')||code.includes('NOT_ACTIVE'))return json(req,{ok:false,code},409);if(code.includes('INVALID')||code.includes('REQUIRED')||code.includes('TOO_LONG'))return json(req,{ok:false,code},400);return json(req,{ok:false,code:'MEMBER_API_ERROR'},500);}
function legacyOrchestrationRoute(path:string){return path==='/checkout-policies'||path==='/checkout-policies/accept'||/^\/checkout-intents\/[0-9a-f-]{36}\/(quote|start)$/i.test(path);}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(origin&&!originAllowed(origin))return json(req,{ok:false,code:'ORIGIN_NOT_ALLOWED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  const path=route(req),url=new URL(req.url);
  if(req.method==='GET'&&(path==='/'||path==='/health')){
    try{await Promise.all([memberCore().health(),checkoutCore().health()]);const configured=asaasConfigured();return json(req,{ok:true,service:'diretoria-member-api',environment:'hml',database:'connected',checkoutProvider:configured?'asaas-sandbox':'asaas-sandbox-unconfigured',payments:configured?'sandbox-ready':'disabled',requiredPolicyCodes:REQUIRED_CHECKOUT_POLICIES,coreRevision:PINNED_CORE_SHA,build:BUILD,features:{legacyPaymentRoutes:'disabled',orchestration:'dedicated_v3',intentCreation:true,readOnlyIntent:true}});}catch{return json(req,{ok:false,service:'diretoria-member-api',database:'unavailable',build:BUILD},503);}
  }
  if(req.method==='GET'&&path==='/offer'){
    try{const configured=asaasConfigured(),offer=await checkoutCore().offerBySlug(url.searchParams.get('slug')??'');return json(req,{ok:true,offer:{...offer,checkoutProvider:configured?'asaas-sandbox':'asaas-sandbox-unconfigured',paymentEnabled:configured}});}catch(error){return safeError(req,error);}
  }
  if(legacyOrchestrationRoute(path))return json(req,{ok:false,code:'CHECKOUT_ORCHESTRATION_MOVED_TO_V3',use:{policy:'diretoria-checkout-policy-api',checkout:'diretoria-asaas-checkout-api'}},410);
  const auth=await authenticated(req);if('response'in auth)return auth.response;
  try{
    if(req.method==='POST'&&path==='/account/bootstrap'){const account=await memberCore().ensureAccount({providerSubject:auth.subject,email:auth.email,phone:auth.phone,emailVerified:auth.emailVerified,phoneVerified:auth.phoneVerified,fullName:auth.fullName});return json(req,{ok:true,account});}
    if(req.method==='GET'&&path==='/me')return json(req,{ok:true,account:await memberCore().getAccount(auth.subject)});
    if(req.method==='GET'&&path==='/wallet')return json(req,{ok:true,wallet:await memberCore().wallet(auth.subject)});
    if(req.method==='POST'&&path==='/checkout-intents'){const body=await req.json().catch(()=>({})) as Record<string,unknown>,intent=await checkoutCore().createIntent({providerSubject:auth.subject,eventId:String(body.eventId??''),idempotencyKey:String(body.idempotencyKey??''),policyVersion:null});return json(req,{ok:true,intent,paymentEnabled:asaasConfigured(),checkoutProvider:'asaas',nextAction:'quote_fee_v3'},201);}
    const intentMatch=/^\/checkout-intents\/([0-9a-f-]{36})$/i.exec(path);if(req.method==='GET'&&intentMatch)return json(req,{ok:true,intent:await checkoutCore().getIntent(auth.subject,intentMatch[1]),paymentEnabled:asaasConfigured(),checkoutProvider:'asaas',authority:'read_only_legacy_compat'});
    return json(req,{ok:false,code:'NOT_FOUND',method:req.method,path},404);
  }catch(error){return safeError(req,error);}
});
