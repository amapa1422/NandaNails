export async function sendNotification(job, config, fetcher=fetch) {
  const b=job.booking;
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(b.starts_at));
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(b.starts_at));
  const values=[b.client_name,b.service_name,date,time,String(b.duration_minutes),new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(b.price_cents/100)];
  try {
    const response=await fetcher(`https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,{
      method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to:config.recipient,type:'template',template:{name:config.template,language:{code:'pt_BR'},components:[{type:'body',parameters:values.map(text=>({type:'text',text}))}]}}),
      signal:AbortSignal.timeout(15000)
    });
    const data=await response.json();
    if(response.ok&&data.messages?.[0]?.id)return {state:'accepted',providerId:data.messages[0].id};
    // Retentar somente rejeições explícitas por limite; timeouts/5xx podem já ter sido aceitos.
    return {state:response.status===429?'failed':'unknown',error:`HTTP ${response.status}; code ${data.error?.code||'unknown'}`};
  }catch{return {state:'unknown',error:'Resultado do provedor desconhecido; verificar antes de reenviar.'};}
}
