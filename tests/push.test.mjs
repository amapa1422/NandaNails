import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validSubscription,pushPayload,dispatchPush,createPushAdminHandler,createPushWorkerHandler} from '../supabase/functions/_shared/push-handler.mjs';
import {generatePushSecrets} from '../scripts/generate-push-secrets.mjs';
import {createECDH} from 'node:crypto';
const subscription={endpoint:'https://web.push.apple.com/device-token',keys:{p256dh:'B'.repeat(87),auth:'a'.repeat(22)}};
const job={id:'11111111-1111-4111-8111-111111111111',kind:'booking',appointmentId:'private-id',subscription};

test('offline key generator creates a matching P-256 VAPID pair and independent worker secret',()=>{
 const secrets=generatePushSecrets(),pair=createECDH('prime256v1');
 pair.setPrivateKey(Buffer.from(secrets.VAPID_PRIVATE_KEY,'base64url'));
 assert.equal(pair.getPublicKey().toString('base64url'),secrets.VAPID_PUBLIC_KEY);
 assert.equal(secrets.VAPID_PUBLIC_KEY.length,87);assert.equal(secrets.VAPID_PRIVATE_KEY.length,43);
 assert.equal(secrets.PUSH_WORKER_SECRET.length,64);
 assert.notEqual(generatePushSecrets().VAPID_PUBLIC_KEY,secrets.VAPID_PUBLIC_KEY);
});

test('push validates endpoints, ports, keys and blocks SSRF destinations',()=>{
 for(const host of ['web.push.apple.com','a1.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'])assert.ok(validSubscription({...subscription,endpoint:'https://'+host+'/token'}));
 for(const endpoint of ['http://web.push.apple.com/token','https://127.0.0.1/token','https://web.push.apple.com.evil.test/token','https://web.push.apple.com:444/token','https://me@web.push.apple.com/token','https://web.push.apple.com/token?secret=x','https://evil.test/token'])assert.equal(validSubscription({...subscription,endpoint}),false,endpoint);
 assert.equal(validSubscription({...subscription,keys:{p256dh:'bad',auth:'bad'}}),false);
});
test('payload only contains generic lock-screen text and a delivery id',()=>{
 const body=JSON.parse(pushPayload({...job,client_name:'Cliente Sigilosa',phone:'5511999999999'}));
 assert.deepEqual(Object.keys(body).sort(),['version','id','kind','title','body'].sort());
 assert.ok(!JSON.stringify(body).includes('private-id'));assert.ok(!JSON.stringify(body).includes('Cliente Sigilosa'));
 assert.match(body.title,/Novo agendamento/);
});
for(const [code,expected] of [[0,'unknown'],[500,'unknown'],[429,'retry'],[404,'expired'],[410,'expired'],[403,'failed'],[201,'accepted']]){
 test(`dispatch classifies provider ${code}, persists ${expected}, and never treats accepted as delivered`,async()=>{
  let claimed=false,sends=0;const calls=[];
  const rpc=async(name,args)=>{calls.push([name,args]);if(name==='claim_push'){if(claimed)return {data:null};claimed=true;return {data:job};}return {};};
  const states=await dispatchPush({rpc,send:async()=>{sends++;if(code!==201)throw {statusCode:code||undefined};}});
  assert.deepEqual(states,[expected]);assert.equal(sends,1);assert.equal(calls[1][1].p_result,expected);
 });
}
test('queue failure prevents sending; finalization failure stays uncertain',async()=>{
 let sent=0;
 await assert.rejects(dispatchPush({rpc:async()=>({error:true}),send:async()=>sent++}),/QUEUE_UNAVAILABLE/);assert.equal(sent,0);
 await assert.rejects(dispatchPush({rpc:async name=>name==='claim_push'?{data:job}:{error:true},send:async()=>sent++}),/RESULT_UNKNOWN/);
 assert.equal(sent,1);
});
test('worker requires its dedicated secret and POST; no anon/user JWT grants dispatch access',async()=>{
 let sends=0;const secret='s'.repeat(64);
 const h=createPushWorkerHandler({env:()=>secret,dispatch:async()=>{sends++;return ['accepted'];}});
 for(const value of ['', 'anon-key','user-jwt','s'.repeat(63)]){
  const r=await h(new Request('https://mock.invalid',{method:'POST',headers:{'x-push-worker-secret':value}}));assert.equal(r.status,401);
 }
 assert.equal(sends,0);
 assert.equal((await h(new Request('https://mock.invalid',{headers:{'x-push-worker-secret':secret}}))).status,405);
 assert.equal((await h(new Request('https://mock.invalid',{method:'POST',headers:{'x-push-worker-secret':secret}}))).status,200);
 assert.equal(sends,1);
});
function handler(authorized=true){
 const calls=[];let dispatched=0;
 const h=createPushAdminHandler({env:name=>({ALLOWED_ORIGINS:'https://amapa1422.github.io',VAPID_PUBLIC_KEY:'B'.repeat(87),VAPID_PRIVATE_KEY:'backend-only',VAPID_SUBJECT:'mailto:test@example.invalid'})[name],
  authenticate:async token=>authorized&&token==='admin-jwt',rpc:async(token,name,args)=>{calls.push({token,name,args});return {data:args.p_action==='test'?{deliveryId:job.id}:{enabled:args.p_action==='subscribe'}};},
  dispatch:async id=>{assert.equal(id,job.id);dispatched++;return ['accepted'];}});
 const request=(body,token='admin-jwt',origin='https://amapa1422.github.io')=>h(new Request('https://mock.invalid/push-admin',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
 return {calls,request,get dispatched(){return dispatched;}};
}
test('push API rejects anonymous/common users before any subscription or dispatch',async()=>{
 for(const auth of [false,true]){const h=handler(auth);const r=await h.request({action:'test',endpoint:subscription.endpoint},auth?'':'common-jwt');assert.ok([401,403].includes(r.status));assert.equal(h.calls.length,0);assert.equal(h.dispatched,0);}
});
test('push API honors CORS, strict actions, body limits and subscription validation',async()=>{
 const h=handler();
 assert.equal((await h.request({action:'status',endpoint:''},'admin-jwt','https://evil.test')).status,403);
 assert.equal((await h.request({action:'drain',endpoint:''})).status,400);
 assert.equal((await h.request({action:'subscribe',subscription:{endpoint:'http://127.0.0.1'}})).status,400);
 assert.equal((await h.request({action:'status',endpoint:'x'.repeat(5000)})).status,413);
 assert.equal(h.calls.length,0);
});
test('authorized API manages own device, returns only public VAPID key and sends test without booking',async()=>{
 const h=handler();
 for(const action of ['status','subscribe','unsubscribe','test']){
  const r=await h.request(action==='subscribe'?{action,subscription}:{action,endpoint:subscription.endpoint});assert.equal(r.status,200);
  const data=await r.json();assert.ok(!JSON.stringify(data).includes('backend-only'));
  if(action==='test'){assert.equal(data.state,'accepted');assert.match(data.message,/não comprova/);}
 }
 assert.equal(h.dispatched,1);assert.ok(h.calls.every(c=>c.name==='admin_push'&&c.token==='admin-jwt'));
});
test('missing VAPID setup blocks sends but still permits status and cancellation',async()=>{
 const h=createPushAdminHandler({env:()=>'',authenticate:async()=>true,rpc:async()=>({data:{enabled:false}}),dispatch:async()=>{throw Error('must not send');}});
 for(const action of ['status','unsubscribe','test','subscribe']){
  const req=new Request('https://mock.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer admin'},body:JSON.stringify({action,endpoint:subscription.endpoint,subscription})});
  assert.equal((await h(req)).status,['status','unsubscribe'].includes(action)?200:503);
 }
});
test('PWA URLs resolve under GitHub Pages and public index stays independent',()=>{
 const m=JSON.parse(readFileSync('admin.webmanifest'));const root=new URL('https://amapa1422.github.io/NandaNails/admin.webmanifest');
 assert.equal(new URL(m.start_url,root).href,'https://amapa1422.github.io/NandaNails/admin.html');
 assert.equal(new URL(m.scope,root).pathname,'/NandaNails/');assert.equal(m.display,'standalone');
 for(const icon of m.icons)assert.ok(readFileSync(new URL('../'+icon.src,import.meta.url)).length);
 assert.ok(!/admin-push|admin-sw|admin.webmanifest/.test(readFileSync('index.html','utf8')));
});
test('service worker displays generic push while no window exists; ignores injected URLs and uses safe click target',async()=>{
 const handlers={},shown=[],opened=[];let promise;
 const self={addEventListener:(name,fn)=>handlers[name]=fn,registration:{scope:'https://amapa1422.github.io/NandaNails/',showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 runInNewContext(readFileSync('admin-sw.js','utf8'),{self,URL});
 assert.equal(handlers.fetch,undefined);
 handlers.push({data:{json:()=>({...job,version:1,title:'private',body:'customer data',url:'https://evil.test'})},waitUntil:p=>promise=p});await promise;
 assert.equal(shown.length,1);assert.ok(!JSON.stringify(shown).includes('customer data'));assert.equal(shown[0][1].renotify,false);
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>promise=p});await promise;
 assert.deepEqual(opened,['https://amapa1422.github.io/NandaNails/admin.html#agenda']);
 handlers.push({data:{json:()=>({version:1,kind:'booking',id:'bad'})},waitUntil(){throw Error('invalid accepted');}});
});
