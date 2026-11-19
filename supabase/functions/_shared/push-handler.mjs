// Shared, dependency-injected code exercised by Node tests. No secrets in logs.
export function validSubscription(s) {
 try {
  const u=new URL(s?.endpoint);
  const host=u.hostname;
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.length>1&&s.endpoint.length<=2048&&
   (/^(?:web|[a-z0-9-]+)\.push\.apple\.com$/.test(host)||['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(host))&&
   /^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth);
 } catch {return false;}
}
export function pushPayload(job) {
 return JSON.stringify({version:1,id:job.id,kind:job.kind,
  // No customer data, subscription, JWT or booking identifier on the lock screen.
  title:job.kind==='test'?'Teste de notificações':'Novo agendamento! 💅',
  body:job.kind==='test'?'Seu dispositivo pode receber avisos da NandaNails.':'Você recebeu uma nova reserva. Toque para visualizar na agenda.'});
}
/** @param {{rpc: Function, send: Function}} dependencies
 * @param {string|null} id
 * @param {number} limit */
export async function dispatchPush({rpc,send},id=null,limit=10) {
 const states=[];
 for(let i=0;i<limit;i++) {
  const {data:job,error}=await rpc('claim_push',{p_id:id});
  if(error)throw Error('QUEUE_UNAVAILABLE');
  if(!job)break;
  let state='failed';
  if(validSubscription(job.subscription)) {
   try {await send(job.subscription,pushPayload(job));state='accepted';}
   catch(e) {
    // Only explicit 429 is automatically retried. Timeouts/5xx may be ambiguous.
    state=[404,410].includes(e.statusCode)?'expired':e.statusCode===429?'retry':
     (!e.statusCode||e.statusCode>=500)?'unknown':'failed';
   }
  }
  const finished=await rpc('finish_push',{p_id:job.id,p_result:state});
  if(finished.error)throw Error('RESULT_UNKNOWN');
  states.push(state);
  if(id)break;
 }
 return states;
}

export function createPushAdminHandler({env,authenticate,rpc,dispatch}) {
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const allowed=(env('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null',
   'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowed.includes(origin))return reply({error:'Origem não permitida.'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'Método inválido.'},405);
  if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return reply({error:'Envie JSON.'},415);
  const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token)return reply({error:'Entre novamente no painel.'},401);
  try {
   if(!await authenticate(token))return reply({error:'Sem autorização administrativa.'},403);
   // Bounded streaming read, independent of a forged/missing Content-Length.
   const reader=req.body?.getReader();let bytes=0,raw='';const decoder=new TextDecoder();
   if(!reader)return reply({error:'Dados inválidos.'},400);
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
    if(bytes>4096){await reader.cancel();return reply({error:'Dados inválidos.'},413);}raw+=decoder.decode(value,{stream:true});}
   let body;try{body=JSON.parse(raw+decoder.decode());}catch{return reply({error:'Dados inválidos.'},400);}
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','subscription','endpoint'].includes(k))||
    !['status','subscribe','unsubscribe','test'].includes(body.action))return reply({error:'Operação inválida.'},400);
   const publicKey=env('VAPID_PUBLIC_KEY');
   const configured=/^[A-Za-z0-9_-]{87}$/.test(publicKey||'')&&Boolean(env('VAPID_PRIVATE_KEY')&&env('VAPID_SUBJECT'));
   // Removal must remain possible even if an operator removed/rotated VAPID secrets.
   if(!configured&&['subscribe','test'].includes(body.action))return reply({error:'Notificações ainda não configuradas no servidor.'},503);
   const sub=body.subscription;
   if(body.action==='subscribe'&&!validSubscription(sub))return reply({error:'Inscrição incompatível ou inválida.'},400);
   const endpoint=body.action==='subscribe'?sub.endpoint:body.endpoint;
   if(typeof endpoint!=='string'||endpoint.length>2048)return reply({error:'Dispositivo inválido.'},400);
   const {data,error}=await rpc(token,'admin_push',{p_action:body.action,p_data:{endpoint,
    ...(body.action==='subscribe'?{p256dh:sub.keys.p256dh,auth:sub.keys.auth}:{})}});
   if(error)return reply({error:'Não foi possível atualizar a inscrição. Confira a configuração ou aguarde um minuto para repetir o teste.'},400);
   if(body.action==='test'){
    const states=await dispatch(data.deliveryId);
    return reply({state:states[0]||'pending',message:states[0]==='accepted'?
     'Serviço Push aceitou o envio. Confira o dispositivo; isso não comprova a entrega.':'Envio não confirmado. Confira o status e tente mais tarde.'});
   }
   return reply({...data,publicKey:configured?publicKey:null});
  }catch{return reply({error:'Serviço de notificações indisponível. Tente novamente.'},503);}
 };
}

export function createPushWorkerHandler({env,dispatch}) {
 return async req=>{
  const secret=env('PUSH_WORKER_SECRET'),supplied=req.headers.get('x-push-worker-secret')||'';
  const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([hash(secret||''),hash(supplied)]);let difference=0;
  for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(!secret||secret.length<32||difference)return reply({error:'Unauthorized'},401);
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{return reply({states:await dispatch()});}catch{return reply({error:'Push worker unavailable'},503);}
 };
}
