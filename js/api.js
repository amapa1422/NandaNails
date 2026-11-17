(() => {
  'use strict';
  const c = window.NN_CONFIG;
  const configured = Boolean(c.supabaseUrl && c.publishableKey);
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
      return request('/functions/v1/booking',{action:'book',...body});
    }
  };
  // Compatibilidade com os componentes visuais originais, sem reservas locais.
  window.Lumiere=window.NN;
})();
