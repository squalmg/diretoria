import { createSupabaseContext } from 'npm:@supabase/server@^1';
import pg from 'pg';
const { Pool } = pg;
const PUBLIC_HML_ORIGIN='https://diretoria-public-hml.vercel.app';
const LOCAL_ORIGINS=new Set(['http://localhost:3200','http://127.0.0.1:3200']);
let pool: any = null;
function originAllowed(origin:string|null){return !origin||origin===PUBLIC_HML_ORIGIN||LOCAL_ORIGINS.has(origin);}
function cors(req:Request):HeadersInit{const origin=req.headers.get('origin');return {'Access-Control-Allow-Origin':origin&&originAllowed(origin)?origin:PUBLIC_HML_ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'86400',Vary:'Origin','Cache-Control':'no-store'};}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function db(){if(pool)return pool;const connection=String(Deno.env.get('SUPABASE_DB_URL')??'').trim();if(!connection)throw new Error('SUPABASE_DB_URL_REQUIRED');pool=new Pool({connectionString:connection,max:3,idleTimeoutMillis:5000,connectionTimeoutMillis:5000});return pool;}
function path(req:Request){const pathname=new URL(req.url).pathname;const marker='/diretoria-checkout-status';const index=pathname.indexOf(marker);return index<0?pathname:(pathname.slice(index+marker.length)||'/');}
async function authSubject(req:Request):Promise<string>{const {data:ctx,error}=await createSupabaseContext(req,{auth:'user'});if(error||!ctx)throw new Error('AUTH_REQUIRED');const subject=String(ctx.userClaims?.sub??'').trim();if(!subject)throw new Error('AUTH_REQUIRED');return subject;}
function safeError(req:Request,error:unknown){const raw=error instanceof Error?error.message:'UNKNOWN_ERROR';const code=raw.split(':')[0].replace(/[^A-Z0-9_]/gi,'_').toUpperCase();if(code.includes('AUTH'))return json(req,{ok:false,code},401);if(code.includes('NOT_FOUND'))return json(req,{ok:false,code},404);if(code.includes('INVALID')||code.includes('REQUIRED'))return json(req,{ok:false,code},400);return json(req,{ok:false,code:'CHECKOUT_STATUS_ERROR'},500);}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(origin&&!originAllowed(origin))return json(req,{ok:false,code:'ORIGIN_NOT_ALLOWED'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});if(req.method==='GET'&&(path(req)==='/'||path(req)==='/health'))return json(req,{ok:true,service:'diretoria-checkout-status',environment:'hml',authority:'backend_only',build:'asaas-hml-v3-20260823',readOnly:true});if(req.method!=='GET')return json(req,{ok:false,code:'METHOD_NOT_ALLOWED'},405);
  try{
    const match=/^\/checkout-intents\/([0-9a-f-]{36})$/i.exec(path(req));if(!match)throw new Error('CHECKOUT_INTENT_ID_INVALID');
    const subject=await authSubject(req);
    const result=await db().query(
      `select ci.*,e.slug event_slug,e.name event_name,e.status event_status,e.default_currency event_currency,
              pay.id payment_id,pay.status payment_status,pay.gateway_payment_id,pay.amount_gross payment_amount_gross,
              pay.base_amount payment_base_amount,pay.processing_fee_passed,pay.provider_fee_actual,pay.amount_net,pay.paid_at,pay.refunded_at,
              cr.id credit_id,cr.status credit_status,cr.gross_value credit_gross_value,cr.protected_value credit_protected_value
       from users u
       join profiles pr on pr.id=u.profile_id
       join checkout_intents ci on ci.profile_id=pr.id
       join events e on e.id=ci.event_id
       left join payments pay on pay.checkout_intent_id=ci.id
       left join credits cr on cr.payment_id=pay.id
       where u.auth_provider='supabase' and u.provider_subject=$1 and u.status='active' and ci.id=$2
       limit 2`,[subject,match[1]]);
    if(result.rows.length!==1)throw new Error(result.rows.length?'CHECKOUT_INTENT_AMBIGUOUS':'CHECKOUT_INTENT_NOT_FOUND');
    const row=result.rows[0];
    const intent={
      id:row.id,profile_id:row.profile_id,event_id:row.event_id,financial_config_id:row.financial_config_id,purpose:row.purpose,provider:row.provider,provider_session_id:row.provider_session_id,idempotency_key:row.idempotency_key,
      amount_gross:String(row.amount_gross),base_amount:String(row.base_amount),processing_fee_amount:String(row.processing_fee_amount),currency_code:row.currency_code,payment_method:row.payment_method,installment_count:row.installment_count,status:row.status,
      reconciliation_status:row.reconciliation_status,provider_error_code:row.provider_error_code,created_at:row.created_at,updated_at:row.updated_at,expires_at:row.expires_at,
      event:{id:row.event_id,slug:row.event_slug,name:row.event_name,status:row.event_status,currencyCode:row.event_currency},
      payment:row.payment_id?{id:row.payment_id,status:row.payment_status,gateway_payment_id:row.gateway_payment_id,amount_gross:String(row.payment_amount_gross),base_amount:String(row.payment_base_amount),processing_fee_passed:String(row.processing_fee_passed),provider_fee_actual:row.provider_fee_actual==null?null:String(row.provider_fee_actual),amount_net:row.amount_net==null?null:String(row.amount_net),paid_at:row.paid_at,refunded_at:row.refunded_at}:null,
      credit:row.credit_id?{id:row.credit_id,status:row.credit_status,gross_value:String(row.credit_gross_value),protected_value:String(row.credit_protected_value)}:null,
    };
    return json(req,{ok:true,intent});
  }catch(error){return safeError(req,error);}
});
