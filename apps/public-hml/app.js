const API='https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-public-api';
const SESSION_KEY='diretoria_public_hml_session';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let sessionKey=localStorage.getItem(SESSION_KEY);
if(!sessionKey){sessionKey=crypto.randomUUID();localStorage.setItem(SESSION_KEY,sessionKey);}

const copy={
  REATIVACAO:['Reativação','A Diretoria está voltando.','Entre na lista para acompanhar a próxima edição desde o começo.'],
  LISTA_DE_ESPERA:['Lista de espera','A próxima Diretoria está sendo formada.','Entre na lista e acompanhe os próximos passos.'],
  FORMACAO:['Formação','A comunidade começou a formar a próxima edição.','Cadastre-se para acompanhar a evolução antes da abertura pública.'],
  QUORUM_EM_ANDAMENTO:['Quórum','A próxima Diretoria está em formação.','Acompanhe o avanço do compromisso financeiro da comunidade.'],
  VIAVEL:['Viável','O quórum financeiro foi atingido.','A edição está viável e passa agora pelas validações administrativas.'],
  CONFIRMADO:['Confirmado','A próxima Diretoria está confirmada.','Cadastre-se para receber as próximas atualizações deste ambiente HML.'],
  VENDA_PUBLICA:['Venda pública','A Diretoria está confirmada.','A venda pública ainda não é habilitada neste HML. Cadastre-se para acompanhar.'],
  PRE_EVENTO:['Pré-evento','A Diretoria está chegando.','Este HML ainda não habilita venda ou ingresso real.'],
  AO_VIVO:['Ao vivo','A Diretoria está acontecendo.','Este ambiente continua somente para homologação.'],
  FECHAMENTO:['Fechamento','Esta edição está sendo fechada.','Entre na lista para acompanhar o próximo ciclo.'],
  ENCERRADO:['Encerrado','Esta edição foi encerrada.','Entre na lista para saber quando o próximo ciclo começar.'],
  RETENCAO:['Próximo ciclo','A próxima Diretoria começa agora.','Cadastre-se para acompanhar a próxima formação.'],
  PLANEJAMENTO:['Planejamento','A próxima Diretoria está sendo planejada.','Entre na lista para receber a abertura do próximo ciclo.']
};

function showMessage(text,type=''){const el=$('message');el.textContent=text;el.className=`message show${type?' '+type:''}`;if(window.gsap)gsap.fromTo(el,{opacity:.25,y:4},{opacity:1,y:0,duration:.25});}
function setState(body){const phase=body.phase||'REATIVACAO';const selected=copy[phase]||copy.REATIVACAO;$('eyebrow').textContent=selected[0];$('headline').textContent=selected[1];$('subline').textContent=selected[2];$('healthDot').classList.add('ok');$('stateText').textContent=body.event?`${body.event.name} · ${phase.replaceAll('_',' ')}`:'API e banco online · aguardando edição ativa';const q=body.quorum;if(q&&Number(q.quorum_minimum)>0){$('progress').classList.add('show');const current=Number(q.valid_credit_count||0),target=Number(q.quorum_minimum||0),pct=Math.max(0,Math.min(100,Number(q.protected_percentage||0)));$('progressTitle').textContent=`${current.toLocaleString('pt-BR')} / ${target.toLocaleString('pt-BR')} membros válidos`;$('progressBar').style.width=`${pct}%`;$('progressText').textContent=`${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da proteção financeira necessária`;}else $('progress').classList.remove('show');}

async function loadState(){try{const res=await fetch(`${API}/state`,{headers:{Accept:'application/json'},cache:'no-store'});const body=await res.json();if(!res.ok||!body.ok)throw new Error();setState(body);if(window.gsap)gsap.fromTo('.hero-copy',{opacity:0,y:12},{opacity:1,y:0,duration:.55,ease:'power2.out'});}catch{$('healthDot').classList.remove('ok');$('stateText').textContent='Não foi possível consultar o estado do HML.';}}

function payloadFrom(form){const data=new FormData(form);const whatsapp=data.get('whatsapp')==='on',emailConsent=data.get('emailConsent')==='on';return {fullName:String(data.get('fullName')||''),phone:String(data.get('phone')||''),email:String(data.get('email')||''),website:String(data.get('website')||''),privacyConsent:data.get('privacy')==='on',whatsappConsent:whatsapp,emailConsent,marketingConsent:whatsapp||emailConsent,utmSource:params.get('utm_source')||undefined,utmMedium:params.get('utm_medium')||undefined,utmCampaign:params.get('utm_campaign')||undefined,utmContent:params.get('utm_content')||undefined,utmTerm:params.get('utm_term')||undefined,referralCode:params.get('ref')||params.get('referral')||undefined,landingPage:`${location.pathname}${location.search}`,sessionKey};}

$('leadForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('submitBtn');button.disabled=true;button.textContent='Enviando…';try{const res=await fetch(`${API}/leads`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadFrom(event.currentTarget))});const body=await res.json().catch(()=>({}));if(res.ok&&body.accepted){showMessage('Cadastro HML recebido. A captura, consentimentos e origem foram processados.','ok');event.currentTarget.reset();}else if(res.status===429)showMessage('Muitas tentativas deste acesso. Aguarde alguns minutos e tente novamente.','error');else if(body.code==='CONTACTS_CONFLICT')showMessage('Não conseguimos validar a combinação de e-mail e telefone. Confira os dados e tente novamente.','error');else if(body.code==='PRIVACY_CONSENT_REQUIRED')showMessage('O consentimento de privacidade é necessário para entrar na lista.','error');else if(body.code==='PHONE_INVALID'||body.code==='EMAIL_INVALID'||body.code==='FULL_NAME_INVALID')showMessage('Confira nome, WhatsApp e e-mail.','error');else showMessage('Não foi possível concluir o cadastro HML agora. Tente novamente.','error');}catch{showMessage('Falha de conexão com a API HML.','error');}finally{button.disabled=false;button.textContent='Entrar na lista HML';}});

loadState();
