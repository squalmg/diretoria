const SUPABASE_URL='https://heckakjcpwomoucobtau.supabase.co';
const SUPABASE_PUBLISHABLE='sb_publishable_tqabW8ADQJRin-kDMmXGTw_MtCv-VUK';
const MEMBER_API='https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-member-api';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const slug=(params.get('event')||params.get('slug')||'').trim();
let currentOffer=null;

function money(value,currency='BRL'){const n=Number(value);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency}):String(value??'—');}
function state(id,text,type=''){const el=$(id);el.textContent=text;el.className='status'+(type?' '+type:'');el.classList.remove('hidden');}
async function publicApi(path){const response=await fetch(MEMBER_API+path,{headers:{Accept:'application/json'},cache:'no-store'});const body=await response.json().catch(()=>({ok:false,code:'INVALID_RESPONSE'}));if(!response.ok){const error=new Error(body.code||`HTTP_${response.status}`);error.status=response.status;throw error;}return body;}
async function memberApi(path,options={}){const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});const response=await fetch(MEMBER_API+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...(options.headers||{})}});const body=await response.json().catch(()=>({ok:false,code:'INVALID_RESPONSE'}));if(!response.ok){const error=new Error(body.code||`HTTP_${response.status}`);error.status=response.status;throw error;}return body;}

async function loadOffer(){
  if(!slug){$('eventName').textContent='Informe a edição';state('offerState','Abra esta página com ?event=slug-da-edicao.','error');$('authState').textContent='Aguardando uma edição válida.';return;}
  try{
    const data=await publicApi(`/offer?slug=${encodeURIComponent(slug)}`);
    currentOffer=data.offer;
    if(!currentOffer?.event){$('eventName').textContent='Edição não encontrada';state('offerState','Não existe edição com esse slug neste HML.','error');return;}
    $('eventName').textContent=currentOffer.event.name;
    if(!currentOffer.available){state('offerState',`Oferta indisponível: ${currentOffer.reason}.`,'error');$('phase').textContent=currentOffer.event.status;return;}
    $('offerData').classList.remove('hidden');
    $('price').textContent=money(currentOffer.financialConfig.founderTicketGross,currentOffer.event.currencyCode||'BRL');
    $('phase').textContent=currentOffer.event.status;
    $('configVersion').textContent=`v${currentOffer.financialConfig.version}`;
    $('provider').textContent=currentOffer.checkoutProvider;
    $('paymentState').textContent=currentOffer.paymentEnabled?'habilitado':'desabilitado';
    state('offerState','Oferta técnica disponível. O preço foi lido da configuração financeira vigente.','ok');
  }catch(error){$('eventName').textContent='Oferta indisponível';state('offerState',`Falha ao consultar oferta: ${error.message}.`,'error');}
}

async function loadAuth(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){state('authState','Entre na sua conta para preparar a intenção de checkout.');$('loginBtn').classList.remove('hidden');$('prepareBtn').disabled=true;return;}
  try{
    await memberApi('/account/bootstrap',{method:'POST',body:'{}'});
    state('authState',`Conta autenticada: ${session.user.email||session.user.id}.`,'ok');
    $('loginBtn').classList.add('hidden');
    $('prepareBtn').disabled=!currentOffer?.available;
  }catch(error){state('authState',`Conta não pôde ser vinculada: ${error.message}.`,'error');$('prepareBtn').disabled=true;}
}

$('prepareBtn').onclick=async()=>{
  if(!currentOffer?.available)return;
  const storageKey=`diretoria_checkout_intent_key:${currentOffer.event.id}`;
  let idempotencyKey=sessionStorage.getItem(storageKey);
  if(!idempotencyKey){idempotencyKey=`web:${crypto.randomUUID()}`;sessionStorage.setItem(storageKey,idempotencyKey);}
  $('prepareBtn').disabled=true;
  state('intentState','Preparando intenção idempotente…');
  try{
    const result=await memberApi('/checkout-intents',{method:'POST',body:JSON.stringify({eventId:currentOffer.event.id,idempotencyKey})});
    const intent=result.intent;
    state('intentState',`Intent ${intent.id} · ${money(intent.amountGross,currentOffer.event.currencyCode||'BRL')} · provider ${intent.provider} · pagamento desabilitado.`,'ok');
    if(result.paymentEnabled===false)$('prepareBtn').textContent='Intent preparada — pagamento bloqueado';
  }catch(error){state('intentState',`Não foi possível preparar: ${error.message}.`,'error');$('prepareBtn').disabled=false;}
};

client.auth.onAuthStateChange(()=>loadAuth());
(async()=>{await loadOffer();await loadAuth();})();
