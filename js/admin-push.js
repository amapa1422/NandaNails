(() => {
 'use strict';
 const $=id=>document.getElementById(id),c=window.NN_CONFIG;
 const workerURL=new URL('../admin-sw.js',document.currentScript.src);
 let token='',generation=0,registration=null,publicKey='',busy=false;
 const buttons=()=>[$('pushEnable'),$('pushDisable'),$('pushTest'),$('pushRefresh')];
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function say(text){$('pushStatus').textContent=text;}
 function locked(value){busy=value;buttons().forEach(b=>b.disabled=value||!token);}
 function supported(){
  if(ios()&&!standalone()){
   $('pushInstall').hidden=false;say('No iPhone, adicione o painel à Tela de Início antes de ativar.');return false;
  }
  $('pushInstall').hidden=true;
  if(!isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
   say('Dispositivo incompatível com notificações Web Push. No iPhone, use iOS 16.4 ou posterior.');return false;
  }
  return true;
 }
 async function api(body,version=generation){
  if(!token||version!==generation)throw Error('Entre novamente no painel.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const r=await fetch(c.supabaseUrl+'/functions/v1/push-admin',{method:'POST',headers:{apikey:c.publishableKey,
    Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   const data=await r.json();
   if(version!==generation)throw Error('Sessão alterada.');
   if(!r.ok)throw Error(data.error||'Não foi possível atualizar as notificações.');
   return data;
  }finally{clearTimeout(timeout);}
 }
 function keyBytes(value){const b=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,x=>x.charCodeAt(0));}
 async function inspect(){
  const version=generation;locked(true);$('pushEnable').hidden=true;$('pushDisable').hidden=true;$('pushTest').hidden=true;
  try{
   if(!supported())return;
   if(Notification.permission==='denied'){
    say('Permissão negada. Libere as notificações nos Ajustes do iPhone ou nas configurações do navegador.');
    // Permit removal of the server registration even after OS permission revocation.
   }
   const reg=await navigator.serviceWorker.register(workerURL,{scope:new URL('./',location.href).pathname,updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   if(version!==generation)return;
   registration=reg;
   const sub=await reg.pushManager.getSubscription();
   const data=await api({action:'status',endpoint:sub?.endpoint||''},version);
   if(version!==generation)return;
   publicKey=data.publicKey||'';
   const enabled=Boolean(sub&&data.enabled&&Notification.permission==='granted');
   $('pushEnable').hidden=Notification.permission==='denied'||enabled||!publicKey;
   $('pushDisable').hidden=!sub;
   $('pushTest').hidden=!enabled||!publicKey;
   if(Notification.permission!=='denied')say(!publicKey?'Envio ainda não configurado no servidor. Você pode desativar uma inscrição existente.':enabled?'Notificações ativadas.':'Ativar notificações neste dispositivo.');
  }catch(e){if(version===generation)say(e.message);}
  finally{if(version===generation)locked(false);}
 }
 $('pushEnable').onclick=async()=>{
  if(busy||!token||!registration||!publicKey)return;
  const version=generation;locked(true);
  try{
   // Called directly in the click handler, before any network await (iOS gesture).
   const permission=await Notification.requestPermission();
   if(version!==generation)return;
   if(permission!=='granted'){say(permission==='denied'?'Permissão negada. Libere nos Ajustes para tentar novamente.':'Permissão não concedida. Toque em Ativar para tentar novamente.');return;}
   let sub=await registration.pushManager.getSubscription();
   if(sub?.options.applicationServerKey&&Array.from(new Uint8Array(sub.options.applicationServerKey)).join()!==Array.from(keyBytes(publicKey)).join()){
    await api({action:'unsubscribe',endpoint:sub.endpoint},version);await sub.unsubscribe();sub=null;
   }
   if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
   if(version!==generation)return;
   await api({action:'subscribe',subscription:sub.toJSON()},version);
   await inspect();
  }catch(e){if(version===generation)say(e.message||'Não foi possível ativar. Tente novamente.');}
  finally{if(version===generation)locked(false);}
 };
 $('pushDisable').onclick=async()=>{
  if(busy||!token||!registration)return;
  const version=generation;locked(true);
  try{
   const sub=await registration.pushManager.getSubscription();
   if(sub){await api({action:'unsubscribe',endpoint:sub.endpoint},version);await sub.unsubscribe();}
   await inspect();
  }catch(e){if(version===generation)say(e.message);}
  finally{if(version===generation)locked(false);}
 };
 $('pushTest').onclick=async()=>{
  if(busy||!token||!registration)return;
  const version=generation;locked(true);
  try{
   const sub=await registration.pushManager.getSubscription();if(!sub)throw Error('Ative as notificações primeiro.');
   say('Enviando notificação de teste…');
   const data=await api({action:'test',endpoint:sub.endpoint},version);say(data.message);
  }catch(e){if(version===generation)say(e.message);}
  finally{if(version===generation)locked(false);}
 };
 $('pushRefresh').onclick=()=>{if(!busy&&token)inspect();};
 const openAgenda=()=>{
  if(!token){location.hash='agenda';return;}
  document.querySelector('[data-page="agenda"]').click();
  document.querySelector('[data-tab="agenda"]').click();
  if(location.hash==='#agenda')history.replaceState(null,'',location.pathname+location.search);
 };
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='NN_OPEN_AGENDA')openAgenda();});
 window.NNPush={
  start(value){token=value;generation++;inspect();},
  session(value){token=value;},
  clear(){token='';generation++;publicKey='';locked(true);say('Entre no painel para gerenciar notificações.');},
  openAgenda(){if(location.hash==='#agenda')openAgenda();}
 };
 locked(true);
})();
