const SUPABASE_URL='https://heckakjcpwomoucobtau.supabase.co';
const SUPABASE_PUBLISHABLE='sb_publishable_tqabW8ADQJRin-kDMmXGTw_MtCv-VUK';
const MEMBER_API='https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-member-api';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const slug=(params.get('event')||params.get('slug')||'').trim();
const returnIntent=(params.get('intent')||'').trim();
const providerResult=(params.get('result')||'').trim();
let currentOffer=null;
let currentIntent=null;
let currentPolicyBundle=null;
let quoteReady=false;
let policiesLoaded=false;
let policiesAccepted=false;

function money(value,currency='BRL'){const n=Number(value);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency}):String(value??'—');}
function state(id,text,type=''){const el=$(id);el.textContent=text;el.className='status'+(type?' '+type:'');el.classList.remove('hidden');}
function friendly(code){
  if(String(code).includes('PAYMENT_PROVIDER_UNCONFIGURED'))return 'Asaas Sandbox indisponível para cotação. Verifique os secrets HML sem expor seus valores.';
  if(String(code).includes('POLICY_ACTIVE_DOCUMENT_REQUIRED'))return 'Ainda faltam políticas ativas para o checkout. Nenhuma política será inventada pelo sistema.';
  if(String(code).includes('POLICY_BUNDLE_STALE'))return 'As políticas mudaram. Recarregue os documentos vigentes antes de aceitar.';
  if(String(code).includes('CHECKOUT_RECONCILIATION_REQUIRED'))return 'A criação do checkout ficou incerta e foi enviada para reconciliação. Não tente criar outra cobrança às cegas.';
  return String(code||'Erro desconhecido');
}
async function publicApi(path){const response=await fetch(MEMBER_API+path,{headers:{Accept:'application/json'},cache:'no-store'});const body=await response.json().catch(()=>({ok:false,code:'INVALID_RESPONSE'}));if(!response.ok){const error=new Error(body.code||`HTTP_${response.status}`);error.status=response.status;throw error;}return body;}
async function memberApi(path,options={}){const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});const response=await fetch(MEMBER_API+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...(options.headers||{})}});const body=await response.json().catch(()=>({ok:false,code:'INVALID_RESPONSE'}));if(!response.ok){const error=new Error(body.code||`HTTP_${response.status}`);error.status=response.status;throw error;}return body;}

function selectedMethod(){return document.querySelector('input[name="paymentMethod"]:checked')?.value||'pix';}
function lockMethods(locked){$('methodPix').disabled=locked;$('methodCard').disabled=locked;}
function updatePolicyControls(){
  $('policyAck').disabled=!(quoteReady&&policiesLoaded);
  $('acceptPolicyBtn').disabled=!(quoteReady&&policiesLoaded&&$('policyAck').checked&&!policiesAccepted);
  $('startBtn').disabled=!policiesAccepted;
}
function showQuote(base,fee,total,method){
  const currency=currentOffer?.event?.currencyCode||'BRL';
  $('baseAmount').textContent=money(base,currency);
  $('processingFee').textContent=money(fee,currency);
  $('customerTotal').textContent=money(total,currency);
  $('quoteBreakdown').classList.remove('hidden');
  quoteReady=true;
  lockMethods(true);
  $('quoteBtn').disabled=true;
  $('policiesSection').classList.remove('hidden');
  $('startSection').classList.remove('hidden');
  state('quoteState',`Cotação congelada para ${method==='card'?'cartão 1x':'Pix'}. O total é preço-base + taxa repassada.`,'ok');
  updatePolicyControls();
}

function renderPolicies(bundle){
  const list=$('policiesList');
  list.textContent='';
  for(const documentView of bundle.documents){
    const details=document.createElement('details');details.className='policy';
    const summary=document.createElement('summary');summary.textContent=`${documentView.title} · v${documentView.version}`;
    const meta=document.createElement('div');meta.className='meta-text';meta.textContent=`${documentView.code} · hash ${String(documentView.contentHash||'').slice(0,12)}…`;
    const body=document.createElement('div');body.className='body';body.textContent=String(documentView.content||'');
    details.append(summary,meta,body);list.append(details);
  }
}

async function loadPolicies(){
  $('policiesSection').classList.remove('hidden');
  policiesLoaded=false;currentPolicyBundle=null;policiesAccepted=false;$('policyAck').checked=false;updatePolicyControls();
  state('policiesState','Consultando as versões ativas exigidas pelo backend…');
  try{
    const data=await memberApi('/checkout-policies');
    currentPolicyBundle=data.bundle;
    renderPolicies(data.bundle);
    policiesLoaded=true;
    state('policiesState',`${data.bundle.documents.length} documentos ativos carregados. Fingerprint ${data.bundle.fingerprint.slice(0,12)}…`,'ok');
  }catch(error){
    state('policiesState',friendly(error.message),'error');
  }
  updatePolicyControls();
}

async function loadOffer(){
  if(!slug){
    if(returnIntent){$('eventName').textContent='Retorno do Asaas Sandbox';state('offerState','O retorno do provedor não confirma pagamento. Aguardando leitura autenticada do checkout.');return;}
    $('eventName').textContent='Informe a edição';state('offerState','Abra esta página com ?event=slug-da-edicao.','error');$('authState').textContent='Aguardando uma edição válida.';return;
  }
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
    $('paymentState').textContent=currentOffer.paymentEnabled?'pronto para teste':'bloqueado';
    state('offerState',currentOffer.paymentEnabled?'Oferta disponível e Asaas Sandbox sinalizado como configurado pela Edge.':'Oferta disponível, mas o Asaas Sandbox ainda está fail-closed.','ok');
  }catch(error){$('eventName').textContent='Oferta indisponível';state('offerState',`Falha ao consultar oferta: ${friendly(error.message)}.`,'error');}
}

async function restoreIntent(intentId){
  const data=await memberApi(`/checkout-intents/${encodeURIComponent(intentId)}`);
  currentIntent=data.intent;
  if(currentIntent.status==='ready'){
    const method=currentIntent.payment_method||'pix';
    if(method==='card')$('methodCard').checked=true;else $('methodPix').checked=true;
    showQuote(currentIntent.base_amount,currentIntent.processing_fee_amount,currentIntent.amount_gross,method);
  }else if(currentIntent.status==='pending'){
    $('paymentControls').classList.remove('hidden');
    $('quoteBtn').disabled=true;lockMethods(true);
    $('startSection').classList.remove('hidden');
    state('quoteState','Este checkout já foi iniciado no Asaas. O estado financeiro continua dependente do webhook.','ok');
  }
  return data;
}

async function loadReturnState(){
  if(!returnIntent)return;
  $('prepareSection').classList.add('hidden');
  try{
    const data=await restoreIntent(returnIntent);
    const intent=data.intent;
    state('returnState',`Retorno do Asaas (${providerResult||'return'}). Intent ${intent.id} está em ${intent.status}. Isso não significa “paid”; a confirmação vem exclusivamente do webhook.`,'ok');
  }catch(error){state('returnState',`Não foi possível ler a intenção retornada: ${friendly(error.message)}.`,'error');}
}

async function loadAuth(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){state('authState','Entre na sua conta para operar o checkout de homologação.');$('loginBtn').classList.remove('hidden');$('prepareBtn').disabled=true;return;}
  try{
    await memberApi('/account/bootstrap',{method:'POST',body:'{}'});
    state('authState',`Conta autenticada: ${session.user.email||session.user.id}.`,'ok');
    $('loginBtn').classList.add('hidden');
    $('prepareBtn').disabled=!currentOffer?.available;
    await loadPolicies();
    await loadReturnState();
  }catch(error){state('authState',`Conta não pôde ser vinculada: ${friendly(error.message)}.`,'error');$('prepareBtn').disabled=true;}
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
    currentIntent=result.intent;
    state('intentState',`Intent ${currentIntent.id} · preço-base ${money(currentIntent.baseAmount,currentOffer.event.currencyCode||'BRL')} · status ${currentIntent.status}.`,'ok');
    $('paymentControls').classList.remove('hidden');
    if(!result.paymentEnabled){$('quoteBtn').disabled=true;state('quoteState','Asaas Sandbox está fail-closed; a intenção existe, mas nenhuma cobrança será criada.','error');return;}
    await restoreIntent(currentIntent.id);
    if(currentIntent.status==='draft'){$('quoteBtn').disabled=false;lockMethods(false);}
  }catch(error){state('intentState',`Não foi possível preparar: ${friendly(error.message)}.`,'error');$('prepareBtn').disabled=false;}
};

$('quoteBtn').onclick=async()=>{
  if(!currentIntent?.id)return;
  const method=selectedMethod();
  $('quoteBtn').disabled=true;lockMethods(true);
  state('quoteState','Consultando as taxas efetivas da conta Asaas Sandbox…');
  try{
    const result=await memberApi(`/checkout-intents/${currentIntent.id}/quote`,{method:'POST',body:JSON.stringify({method,installments:method==='card'?1:null})});
    showQuote(result.quote.baseAmount,result.quote.processingFee,result.quote.customerTotal,result.quote.method);
  }catch(error){state('quoteState',friendly(error.message),'error');$('quoteBtn').disabled=false;lockMethods(false);}
};

$('policyAck').onchange=()=>updatePolicyControls();

$('acceptPolicyBtn').onclick=async()=>{
  if(!currentPolicyBundle||!quoteReady||!$('policyAck').checked)return;
  $('acceptPolicyBtn').disabled=true;
  state('acceptState','Registrando aceite append-only das versões exibidas…');
  try{
    const result=await memberApi('/checkout-policies/accept',{method:'POST',body:JSON.stringify({fingerprint:currentPolicyBundle.fingerprint})});
    policiesAccepted=result.acceptance.fingerprint===currentPolicyBundle.fingerprint;
    state('acceptState',policiesAccepted?'Aceite registrado e validado para o bundle vigente.':'O aceite não corresponde ao bundle atual.','ok');
  }catch(error){
    policiesAccepted=false;state('acceptState',friendly(error.message),'error');
    if(String(error.message).includes('POLICY_BUNDLE_STALE'))await loadPolicies();
  }
  updatePolicyControls();
};

$('startBtn').onclick=async()=>{
  if(!currentIntent?.id||!policiesAccepted)return;
  $('startBtn').disabled=true;
  state('checkoutState','Criando hosted checkout no Asaas Sandbox…');
  try{
    const result=await memberApi(`/checkout-intents/${currentIntent.id}/start`,{method:'POST',body:'{}'});
    if(result.checkout?.redirectUrl){
      const target=new URL(result.checkout.redirectUrl);
      if(target.protocol!=='https:')throw new Error('CHECKOUT_REDIRECT_URL_INVALID');
      state('checkoutState','Checkout criado. Redirecionando para o ambiente hospedado do Asaas…','ok');
      location.assign(target.href);
      return;
    }
    state('checkoutState','Checkout já iniciado anteriormente. Nenhuma cobrança adicional foi criada.','ok');
  }catch(error){state('checkoutState',friendly(error.message),'error');if(!String(error.message).includes('RECONCILIATION'))$('startBtn').disabled=false;}
};

client.auth.onAuthStateChange(()=>{loadAuth();});
(async()=>{await loadOffer();await loadAuth();})();
