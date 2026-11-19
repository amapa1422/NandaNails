'use strict';
// Deliberately no fetch handler, offline cache, JWT storage or customer data.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data?.json();}catch{return;}
 if(data?.version!==1||!['booking','test'].includes(data.kind)||!/^[a-f0-9-]{36}$/i.test(data.id||''))return;
 const test=data.kind==='test';
 event.waitUntil(self.registration.showNotification(test?'Teste de notificações':'Novo agendamento! 💅',{
  body:test?'Seu dispositivo pode receber avisos da NandaNails.':'Você recebeu uma nova reserva. Toque para visualizar na agenda.',
  icon:new URL('assets/icons/n-v1/icon-192.png',self.registration.scope).href,
  badge:new URL('assets/icons/n-v1/favicon-32x32.png',self.registration.scope).href,
  tag:'nn-push-'+data.id,renotify:false,
  data:{url:new URL('admin.html#agenda',self.registration.scope).href}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 // Never follow an arbitrary URL supplied by a push or a notification payload.
 const target=new URL('admin.html#agenda',self.registration.scope);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   const url=new URL(client.url);
   if(url.origin===target.origin&&url.pathname===target.pathname){
    await client.focus();client.postMessage({type:'NN_OPEN_AGENDA'});return;
   }
  }
  await self.clients.openWindow(target.href);
 })());
});
