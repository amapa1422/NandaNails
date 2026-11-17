(() => {
  'use strict';
  const c = window.NN_CONFIG;
  const configured = Boolean(c.supabaseUrl && c.publishableKey && c.turnstileSiteKey);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dayFromKey = k => new Date(k+'T12:00:00');
  const displayDate = (k, opts={}) => new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',...opts}).format(dayFromKey(k));
  const formatPrice = p => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p);
  let config = structuredClone(window.LUMIERE_DEFAULTS);
  async function request(path, body, token) {
    const response = await fetch(c.supabaseUrl+path, {
      method:'POST', headers:{apikey:c.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(body), signal:AbortSignal.timeout(20000)
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível completar a operação. Tente novamente.'), {status:response.status});
    return data;
  }
  let captchaToken = '', widget;
  function mountCaptcha() {
    if (!configured) return;
    window.nnCaptchaReady = () => {
      widget = window.turnstile.render('#captcha',{sitekey:c.turnstileSiteKey,theme:'dark',size:'flexible',callback:t=>{captchaToken=t;},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';}});
    };
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=nnCaptchaReady&render=explicit';script.async=true;document.head.append(script);
  }
  window.NN = {
    configured, request, escape, dayKey, dayFromKey, displayDate, formatPrice,
    getConfig:()=>config,
    async loadCatalog() {
      const data=await request('/functions/v1/booking',{action:'catalog'});
      config.services=data.services.map(s=>({...s,minutes:s.duration_minutes,price:s.price_cents/100}));
      this.serverToday=data.today; return data;
    },
    async availability(serviceId, from, to=from) {
      return request('/functions/v1/booking',{action:'availability',serviceId,from,to});
    },
    async book(body) {
      if (!captchaToken) throw new Error('Conclua a verificação de segurança.');
      try { return await request('/functions/v1/booking',{action:'book',...body,captchaToken}); }
      finally { captchaToken=''; if(window.turnstile && widget!==undefined) window.turnstile.reset(widget); }
    }, mountCaptcha
  };
  // Compatibilidade com os componentes visuais originais, sem reservas locais.
  window.Lumiere=window.NN;
})();
