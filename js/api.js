(() => {
  'use strict';
  const c = window.NN_CONFIG;
  const configured = Boolean(c.supabaseUrl && c.publishableKey);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dayFromKey = k => new Date(k+'T12:00:00');
  const dateFormats = new Map();
  const displayDate = (k, opts={}) => {
    const key=JSON.stringify(opts);
    if(!dateFormats.has(key))dateFormats.set(key,new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',...opts}));
    return dateFormats.get(key).format(dayFromKey(k));
  };
  const priceFormat = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const formatPrice = p => priceFormat.format(p);
  const availabilityRequests = new Map();
  let config = structuredClone(window.LUMIERE_DEFAULTS);
  async function request(path, body, token) {
    // AbortController also supports Safari versions without AbortSignal.timeout.
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
    const response = await fetch(c.supabaseUrl+path, {
      method:'POST', headers:{apikey:c.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(body), signal:controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível completar a operação. Tente novamente.'), {status:response.status});
    return data;
    } finally { clearTimeout(timeout); }
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
      // Share only pending public reads. Every settled read is discarded.
      const key=JSON.stringify([serviceId,from,to]);
      if(!availabilityRequests.has(key)){
        const pending=request('/functions/v1/booking',{action:'availability',serviceId,from,to});
        availabilityRequests.set(key,pending);
        pending.finally(()=>{if(availabilityRequests.get(key)===pending)availabilityRequests.delete(key);}).catch(()=>{});
      }
      return availabilityRequests.get(key);
    },
    async book(body) {
      availabilityRequests.clear();
      try{return await request('/functions/v1/booking',{action:'book',...body});}
      finally{availabilityRequests.clear();}
    }
  };
  // Compatibilidade com os componentes visuais originais, sem reservas locais.
  window.Lumiere=window.NN;
})();
