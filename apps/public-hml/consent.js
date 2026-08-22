(() => {
  const STORAGE_KEY='diretoria_tracking_consent_hml_v1';
  const PROVIDERS=Object.freeze({ga4MeasurementId:null,metaPixelId:null});
  const DEFAULT=Object.freeze({necessary:true,analytics:false,marketing:false,version:'hml-v1'});

  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!value||value.version!==DEFAULT.version)return {...DEFAULT};
      return {necessary:true,analytics:value.analytics===true,marketing:value.marketing===true,version:DEFAULT.version};
    }catch{return {...DEFAULT};}
  }
  function save(next){
    const value={necessary:true,analytics:next.analytics===true,marketing:next.marketing===true,version:DEFAULT.version,updatedAt:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('diretoria:consent-changed',{detail:value}));
    renderState(value);
    loadConfiguredProviders(value);
    return value;
  }
  function providerConfigured(){return Boolean(PROVIDERS.ga4MeasurementId||PROVIDERS.metaPixelId);}
  function loadConfiguredProviders(consent){
    // HML intentionally has no provider IDs. This function is the future gate:
    // third-party loaders may only be added here and must check the matching consent first.
    if(!providerConfigured())return;
    if(consent.analytics&&PROVIDERS.ga4MeasurementId){/* GA loader intentionally absent until real configuration is approved. */}
    if(consent.marketing&&PROVIDERS.metaPixelId){/* Meta loader intentionally absent until real configuration is approved. */}
  }
  function renderState(value){
    const el=document.getElementById('trackingConsentState');
    if(el)el.textContent=`Analytics: ${value.analytics?'permitido':'negado'} · Marketing: ${value.marketing?'permitido':'negado'} · pixels: ${providerConfigured()?'configurados':'não configurados'}`;
  }
  function mount(){
    if(document.getElementById('trackingConsentHml'))return;
    const wrap=document.createElement('aside');
    wrap.id='trackingConsentHml';
    wrap.setAttribute('aria-label','Preferências de medição HML');
    wrap.innerHTML=`<div class="consent-hml"><div><strong>Preferências de medição — HML</strong><p>Terceiros estão desligados neste ambiente. Estas opções testam apenas o estado de consentimento antes da configuração real de analytics/ads.</p><div id="trackingConsentState" class="consent-state"></div></div><div class="consent-actions"><button type="button" data-consent="necessary">Somente necessário</button><button type="button" data-consent="analytics">Permitir métricas HML</button><button type="button" data-consent="all">Permitir métricas + marketing HML</button></div></div>`;
    const style=document.createElement('style');
    style.textContent=`#trackingConsentHml{position:fixed;left:12px;right:12px;bottom:12px;z-index:99}.consent-hml{max-width:980px;margin:auto;border:1px solid #3b3936;background:#111114f2;backdrop-filter:blur(14px);border-radius:16px;padding:13px 14px;box-shadow:0 18px 55px #0008;display:flex;gap:16px;justify-content:space-between;align-items:center}.consent-hml strong{font-size:13px}.consent-hml p{margin:4px 0;color:#a7a4a0;font-size:11px;line-height:1.4;max-width:620px}.consent-state{color:#777;font-size:10px}.consent-actions{display:flex;gap:7px;flex-wrap:wrap}.consent-actions button{border:1px solid #44413d;background:#222;color:#eee;border-radius:9px;padding:8px 9px;font:inherit;font-size:11px;cursor:pointer}.consent-actions button:hover{background:#333}@media(max-width:760px){.consent-hml{align-items:stretch;flex-direction:column}.consent-actions{display:grid}.consent-actions button{width:100%}}`;
    document.head.appendChild(style);
    document.body.appendChild(wrap);
    const current=read();renderState(current);
    wrap.addEventListener('click',event=>{
      const button=event.target.closest('button[data-consent]');if(!button)return;
      const mode=button.dataset.consent;
      if(mode==='necessary')save({analytics:false,marketing:false});
      else if(mode==='analytics')save({analytics:true,marketing:false});
      else if(mode==='all')save({analytics:true,marketing:true});
    });
    loadConfiguredProviders(current);
  }

  window.DiretoriaConsent=Object.freeze({get:read,set:save,providers:PROVIDERS});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
