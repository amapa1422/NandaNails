import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { cors, json } from '../_shared/http.ts';

Deno.serve(async req => {
  const headers=cors(req);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return json({error:'Método inválido.'},405,headers);
  try {
    const raw=await req.text();if(raw.length>4096)return json({error:'Dados inválidos.'},400,headers);
    const body=JSON.parse(raw);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    let result;
    if(body.action==='catalog')result=await db.rpc('agenda_catalog');
    else if(body.action==='availability') {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(body.from)||!/^\d{4}-\d{2}-\d{2}$/.test(body.to)||typeof body.serviceId!=='string')return json({error:'Data inválida.'},400,headers);
      const from=Date.parse(body.from+'T12:00:00Z'),to=Date.parse(body.to+'T12:00:00Z');
      if(!Number.isFinite(from)||!Number.isFinite(to)||to<from||to-from>31*86400000)return json({error:'Período inválido.'},400,headers);
      result=await db.rpc('agenda_availability',{p_service:body.serviceId,p_from:body.from,p_to:body.to});
    } else if(body.action==='book') {
      if(typeof body.name!=='string'||typeof body.phone!=='string'||typeof body.captchaToken!=='string'||body.captchaToken.length>2048||!/^\d{2}:\d{2}$/.test(body.time)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!/^\d{10,11}$/.test(body.phone)||body.name.length>80)return json({error:'Confira os dados da reserva.'},400,headers);
      const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
      const salt=Deno.env.get('RATE_LIMIT_SALT');
      if(!secret||!salt)return json({error:'Agenda online em configuração.'},503,headers);
      const challenge=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',body:new URLSearchParams({secret,response:body.captchaToken}),signal:AbortSignal.timeout(10000)
      });
      const proof=await challenge.json();
      const hosts=(Deno.env.get('TURNSTILE_HOSTNAMES')||'').split(',');
      if(!proof.success||!hosts.includes(proof.hostname))return json({error:'Refaça a verificação de segurança.'},400,headers);
      // O proxy Supabase deve sobrescrever x-forwarded-for. Nunca aceitar IP fornecido no corpo.
      const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
      const key=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      result=await db.rpc('agenda_book',{p_service:body.serviceId,p_date:body.date,p_time:body.time,p_name:body.name.trim(),p_phone:'55'+body.phone,p_request:body.requestId,p_rate_key:key,p_expected_price:body.expectedPriceCents,p_expected_duration:body.expectedDuration});
    } else return json({error:'Operação inválida.'},400,headers);
    if(result.error){
      const message=result.error.message||'';
      if(message.includes('SLOT_CONFLICT')||result.error.code==='23P01')return json({error:'Esse horário acabou de ser ocupado. Escolha outro horário.'},409,headers);
      if(message.includes('SERVICE_CHANGED')||message.includes('SERVICE_UNAVAILABLE'))return json({error:'O serviço foi atualizado. Confira o novo valor e a duração antes de confirmar novamente.'},409,headers);
      if(message.includes('RATE_LIMIT'))return json({error:'Muitas tentativas. Tente mais tarde.'},429,headers);
      return json({error:'Não foi possível registrar a solicitação. Confira os dados e tente novamente.'},400,headers);
    }
    return json(result.data,200,headers);
  }catch{return json({error:'A agenda está indisponível. Tente novamente em instantes.'},503,headers);}
});
