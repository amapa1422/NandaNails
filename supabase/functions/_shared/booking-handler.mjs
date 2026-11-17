import {cors,json} from './http.ts';

// Dependencies are injected for local tests. Neither IP headers nor request IDs
// identify a quota bucket. Only the backend derives the phone HMAC.
export async function phoneSubject(phone,salt) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('booking-phone:55'+phone));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function limitedBody(req) {
  const reader=req.body?.getReader();if(!reader)throw Error('INVALID_BODY');
  const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,raw='';
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('BODY_TOO_LARGE');}raw+=decoder.decode(value,{stream:true});}
  return JSON.parse(raw+decoder.decode());
}
function validDate(value) {return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
const keys={catalog:['action'],availability:['action','serviceId','from','to'],book:['action','serviceId','date','time','name','phone','requestId','expectedPriceCents','expectedDuration']};

export function createBookingHandler({env,rpc}) {
 return async req=>{
  const origins=env('ALLOWED_ORIGINS')||'',headers=cors(req,origins),origin=req.headers.get('origin');
  if(origin&&!origins.split(',').map(s=>s.trim()).includes(origin))return json({error:'Origem não permitida.'},403,headers);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return json({error:'Método inválido.'},405,headers);
  if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'Envie os dados em JSON.'},415,headers);
  try {
   let body;
   try{body=await limitedBody(req);}catch(e){return json({error:'Dados inválidos.'},e.message==='BODY_TOO_LARGE'?413:400,headers);}
   if(!body||Array.isArray(body)||!Object.hasOwn(keys,body.action)||Object.keys(body).some(k=>!keys[body.action].includes(k)))return json({error:'Operação ou campos inválidos.'},400,headers);
   if(body.action!=='catalog'&&(typeof body.serviceId!=='string'||body.serviceId.length>100))return json({error:'Serviço inválido.'},400,headers);
   if(body.action==='availability'&&(!validDate(body.from)||!validDate(body.to)||Date.parse(body.to)<Date.parse(body.from)||Date.parse(body.to)-Date.parse(body.from)>31*86400000))return json({error:'Período inválido.'},400,headers);
   if(body.action==='book'&&(!validDate(body.date)||typeof body.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)||typeof body.name!=='string'||body.name.trim().length<3||body.name.length>80||!/^[^\d\s]+(?:\s+[^\d\s]+)+$/u.test(body.name.trim())||typeof body.phone!=='string'||!/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(body.phone)||typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)||!Number.isInteger(body.expectedPriceCents)||body.expectedPriceCents<0||body.expectedPriceCents>10000000||!Number.isInteger(body.expectedDuration)||body.expectedDuration<15||body.expectedDuration>480||body.expectedDuration%15!==0))return json({error:'Confira os dados da reserva.'},400,headers);
   // Each RPC commits independently. A rejected booking must not
   // undo the attempt count. Global quotas cannot be rotated by client data.
   const quota=await rpc('agenda_rate_limit',{p_action:body.action});
   if(quota.error)return json({error:'Proteção da agenda indisponível.'},503,headers);
   if(quota.data!==true)return json({error:'Muitas tentativas. Tente mais tarde.'},429,headers);
   let result;
   if(body.action==='catalog')result=await rpc('agenda_catalog');
   else if(body.action==='availability')result=await rpc('agenda_availability',{p_service:body.serviceId,p_from:body.from,p_to:body.to});
   else {
    const salt=env('RATE_LIMIT_SALT');
    if(!salt||salt.length<32)return json({error:'Agenda online em configuração.'},503,headers);
    const phoneQuota=await rpc('agenda_rate_limit',{p_action:'book_phone',p_subject:await phoneSubject(body.phone,salt)});
    if(phoneQuota.error)return json({error:'Proteção da agenda indisponível.'},503,headers);
    if(phoneQuota.data!==true)return json({error:'Muitas tentativas. Tente mais tarde.'},429,headers);
    result=await rpc('agenda_book',{p_service:body.serviceId,p_date:body.date,p_time:body.time,p_name:body.name.trim(),p_phone:'55'+body.phone,p_request:body.requestId,p_expected_price:body.expectedPriceCents,p_expected_duration:body.expectedDuration});
   }
   if(result.error){const message=result.error.message||'';
    if(message.includes('SLOT_CONFLICT')||result.error.code==='23P01')return json({error:'Esse horário acabou de ser ocupado. Escolha outro horário.'},409,headers);
    if(message.includes('SERVICE_CHANGED')||message.includes('SERVICE_UNAVAILABLE'))return json({error:'O serviço foi atualizado. Confira o novo valor e a duração antes de confirmar novamente.'},409,headers);
    if(message.includes('RATE_LIMIT'))return json({error:'Muitas tentativas. Tente mais tarde.'},429,headers);
    if(['22007','22008','22P02','23514'].includes(result.error.code)||message.includes('INVALID_'))return json({error:'Confira os dados da reserva.'},400,headers);
    return json({error:'A agenda está indisponível. Tente novamente em instantes.'},503,headers);
   }
   if(body.action==='book'&&(typeof result.data?.booking?.id!=='string'||!result.data.booking.id.trim()))return json({error:'O banco não confirmou a reserva. Tente novamente.'},503,headers);
   return json(result.data,200,headers);
  }catch{return json({error:'A agenda está indisponível. Tente novamente em instantes.'},503,headers);}
 };
}
