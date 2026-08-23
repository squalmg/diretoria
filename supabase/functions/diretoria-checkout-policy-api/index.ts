import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { PostgresMemberAccounts } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/member-accounts.ts';
import { PostgresPolicyGate } from 'https://raw.githubusercontent.com/squalmg/diretoria/c0fefccf0cf71b664ed6860b595dbe1bb037b827/packages/db/src/policy-gate.ts';
import { PostgresCheckoutPolicyAcceptanceGuard } from './accept-guard.ts';

const PUBLIC_HML_ORIGIN='https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS=new Set(['http://localhost:3200','http://127.0.0.1:3200']);
const REQUIRED_POLICIES=Object.freeze(['club_terms','non_achievement_policy','privacy_policy']);
const POLICY_CONTEXT='club_checkout';
let memberInstance:PostgresMemberAccounts|null=null;
let policyInstance:PostgresPolicyGate|null=null;
let acceptanceInstance:PostgresCheckoutPolicyAcceptanceGuard|null=null;

function originAllowed(origin:string|null){return !origin||origin===PUBLIC_HML_ORIGIN||LOCAL_ORIGINS.has(origin);}
function cors(req:Request):HeadersInit{const origin=req.headers.get('origin');return{'Access-Control-Allow-Origin':origin&&originAllowed(origin)?origin:PUBLIC_HML_ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'86400',Vary:'Origin','Cache-Control':'no-store'};}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function route(req:Request){const pathname=new URL(req.url).pathname,marker='/diretoria-checkout-policy-api',index=pathname.indexOf(marker);return index<0?pathname:(pathname.slice(index+marker.length)||'/');}
function databaseUrl(){const value=String(Deno.env.get('SUPABASE_DB_URL')??'').trim();if(!value)throw new Error('SUPABASE_DB_URL_REQUIRED');return value;}
function memberCore(){return memberInstance??=new PostgresMemberAccounts(databaseUrl());}
function policyCore(){return policyInstance??=new PostgresPolicyGate(databaseUrl());}
function acceptanceGuard(){return acceptanceInstance??=new PostgresCheckoutPolicyAcceptanceGuard(databaseUrl());}
async function authenticated(req:Request){const {data:ctx,error}=await createSupabaseContext(req,{auth:'user'});if(error||!ctx)return{response:json(req,{ok:false,code:error?.code??'AUTH_REQUIRED'},error?.status??401)} as const;const subject=String(ctx.userClaims?.sub??'').trim();if(!subject)return{response:json(req,{ok:false,code:'AUTH_REQUIRED'},401)} as const;return{ctx,subject} as const;}
function safeError(req:Request,error:unknown){const raw=error instanceof Error?error.message:'UNKNOWN_ERROR',code=raw.split(':')[0].replace(/[^A-Z0-9_]/gi,'_').toUpperCase();if(code.includes('AUTH'))return json(req,{ok:false,code},401);if(code.includes('NOT_FOUND'))return json(req,{ok:false,code},404);if(code.includes('MIGRATION_REQUIRED'))return json(req,{ok:false,code},503);if(code.includes('ACTIVE_DOCUMENT_REQUIRED')||code.includes('ACCEPTANCE_REQUIRED')||code.includes('STALE'))return json(req,{ok:false,code},409);if(code.includes('INVALID')||code.includes('REQUIRED'))return json(req,{ok:false,code},400);return json(req,{ok:false,code:'CHECKOUT_POLICY_API_ERROR'},500);}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(origin&&!originAllowed(origin))return json(req,{ok:false,code:'ORIGIN_NOT_ALLOWED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  const path=route(req);
  if(req.method==='GET'&&(path==='/'||path==='/health'))return json(req,{ok:true,service:'diretoria-checkout-policy-api',environment:'hml',requiredCodes:REQUIRED_POLICIES,context:POLICY_CONTEXT,build:'asaas-hml-v3-20260823',features:{consentMirrors:['terms','privacy'],activeConsentIdempotency:'0025',acceptanceAtomic:true}});
  const auth=await authenticated(req);if('response'in auth)return auth.response;
  try{
    if(req.method==='GET'&&path==='/bundle'){
      const bundle=await policyCore().activeBundle([...REQUIRED_POLICIES]);
      const ids=bundle.documents.map(document=>document.id);
      const {data:rows,error}=await auth.ctx.supabaseAdmin.from('policy_documents').select('id,content').in('id',ids);
      if(error)throw new Error('POLICY_CONTENT_QUERY_FAILED');
      const byId=new Map((rows??[]).map((row:{id:string;content:string})=>[row.id,row.content]));
      if(ids.some(id=>!byId.has(id)))throw new Error('POLICY_CONTENT_NOT_FOUND');
      return json(req,{ok:true,context:POLICY_CONTEXT,bundle:{fingerprint:bundle.fingerprint,documents:bundle.documents.map(document=>({...document,content:byId.get(document.id)}))}});
    }

    if(req.method==='POST'&&path==='/accept'){
      const input=await req.json().catch(()=>({})) as Record<string,unknown>;
      const fingerprint=String(input.fingerprint??'').trim().toLowerCase();
      if(!/^[0-9a-f]{64}$/.test(fingerprint))throw new Error('POLICY_FINGERPRINT_INVALID');
      const bundle=await policyCore().activeBundle([...REQUIRED_POLICIES]);
      if(bundle.fingerprint!==fingerprint)throw new Error('POLICY_BUNDLE_STALE');
      const account=await memberCore().getAccount(auth.subject);
      const userAgent=String(req.headers.get('user-agent')??'').slice(0,300);
      const accepted=await acceptanceGuard().accept({profileId:account.profile_id,documents:bundle.documents.map(document=>({id:document.id,code:document.code,version:document.version,contentHash:document.contentHash,status:document.status})),context:POLICY_CONTEXT,source:'public_hml_checkout',bundleFingerprint:bundle.fingerprint,userAgent});
      const verified=await policyCore().assertAccepted({profileId:account.profile_id,context:POLICY_CONTEXT,requiredCodes:[...REQUIRED_POLICIES]});
      return json(req,{ok:true,acceptance:{fingerprint:verified.fingerprint,documentIds:verified.documentIds,acceptedIds:accepted.acceptedIds,replayedIds:accepted.replayedIds,consents:accepted.consents}});
    }
    return json(req,{ok:false,code:'NOT_FOUND'},404);
  }catch(error){return safeError(req,error);}
});
