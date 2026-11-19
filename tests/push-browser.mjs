// Local CDP + actual service worker. Push permission/provider/Auth are simulated.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
const base=resolve('.');
const server=createServer((req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/NandaNails\//,'/');
 const file=resolve(base,'.'+path);
 if(!file.startsWith(base+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'})[extname(file)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));
});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));
const targets=await(await fetch('http://127.0.0.1:9223/json')).json();
const target=targets.find(x=>x.type==='page');const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let sequence=0,permissionRequests=0,authorized=false;const pending=new Map(),errors=[],actions=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
ws.onmessage=async event=>{
 const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
 if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params;let body,type='application/json';
 if(!request.url.startsWith('http://127.0.0.1:4174/')){await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
 if(request.url.endsWith('/js/config.js')){body='window.NN_CONFIG={supabaseUrl:"http://127.0.0.1:4174",publishableKey:"mock"};';type='application/javascript';}
 else if(request.url.includes('/auth/v1/token'))body={access_token:'admin-jwt',refresh_token:'mock-refresh',expires_in:3600};
 else if(request.url.endsWith('/auth/v1/logout'))body={};
 else if(request.url.endsWith('/rest/v1/rpc/is_admin'))body=authorized;
 else if(request.url.endsWith('/rest/v1/rpc/admin_action'))body={appointments:[],services:[],availability:[],blocks:[]};
 else if(request.url.endsWith('/functions/v1/push-admin')){
  const data=JSON.parse(request.postData);actions.push(data.action);
  if(data.action==='subscribe')permissionRequests++;
  if(data.action==='status')body={enabled:globalThis.enabled||false,publicKey:'B'.repeat(87)};
  if(data.action==='subscribe'){globalThis.enabled=true;body={enabled:true};}
  if(data.action==='unsubscribe'){globalThis.enabled=false;body={enabled:false};}
  if(data.action==='test')body={state:'accepted',message:'Serviço Push aceitou o envio. Confira o dispositivo; isso não comprova a entrega.'};
 }
 if(body!==undefined)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')});
 else await call('Fetch.continueRequest',{requestId});
};
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function wait(expression){const until=Date.now()+10000;while(Date.now()<until){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout '+expression+' '+await evaluate('document.getElementById("pushStatus")?.textContent'));}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const login=()=>evaluate('document.getElementById("email").value="test@example.invalid";document.getElementById("password").value="mock-password";document.getElementById("loginForm").requestSubmit()');
const navigate=async()=>{const url='http://127.0.0.1:4174/NandaNails/admin.html?qa='+Date.now();await call('Page.navigate',{url});await wait('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__permission='default';window.__permissionCalls=0;window.__sub=null;
  Object.defineProperty(Notification,'permission',{configurable:true,get:()=>window.__permission});
  Notification.requestPermission=async()=>{window.__permissionCalls++;window.__permission='granted';return 'granted';};
  PushManager.prototype.getSubscription=async()=>window.__sub;
  PushManager.prototype.subscribe=async options=>{window.__sub={endpoint:'https://web.push.apple.com/browser-test',options,
   toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'B'.repeat(87),auth:'a'.repeat(22)}};},
   async unsubscribe(){window.__sub=null;return true;}};return window.__sub;};
 `});
 await navigate();assert.equal(actions.length,0);assert.equal(await evaluate('window.__permissionCalls'),0);
 await login();await wait('document.getElementById("adminStatus").textContent.includes("sem autorização")');assert.equal(actions.length,0);
 authorized=true;await login();await wait('!document.getElementById("pushEnable").hidden');
 assert.equal(await evaluate('window.__permissionCalls'),0);
 assert.equal(await evaluate('navigator.serviceWorker.getRegistration().then(r=>new URL(r.scope).pathname)'),'/NandaNails/');
 assert.equal(await evaluate('navigator.serviceWorker.getRegistration().then(r=>new URL(r.active.scriptURL).pathname)'),'/NandaNails/admin-sw.js');
 await click('#pushEnable');await wait('document.getElementById("pushStatus").textContent==="Notificações ativadas."');
 assert.equal(await evaluate('window.__permissionCalls'),1);assert.equal(permissionRequests,1);
 await click('#pushTest');await wait('document.getElementById("pushStatus").textContent.includes("não comprova")');
 await click('#pushDisable');await wait('!document.getElementById("pushEnable").hidden');assert.equal(globalThis.enabled,false);assert.equal(await evaluate('window.__sub'),null);
 await evaluate('window.__permission="denied"');await click('#pushRefresh');await wait('document.getElementById("pushStatus").textContent.includes("Permissão negada")');assert.equal(await evaluate('document.getElementById("pushEnable").hidden'),true);
 await evaluate('window.__permission="default";Object.defineProperty(navigator,"userAgent",{configurable:true,get:()=>"iPhone"});');await click('#pushRefresh');await wait('!document.getElementById("pushInstall").hidden');assert.equal(await evaluate('document.getElementById("pushEnable").hidden'),true);
 await evaluate('Object.defineProperty(navigator,"userAgent",{configurable:true,get:()=>"Desktop"});delete window.PushManager;');await click('#pushRefresh');await wait('document.getElementById("pushStatus").textContent.includes("incompatível")');
 for(const width of [320,375,390,430,768,1440]){await call('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:width<800});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Push overflow ${width}`);}
 await evaluate('navigator.serviceWorker.dispatchEvent(new MessageEvent("message",{data:{type:"NN_OPEN_AGENDA"}}))');await wait('!document.getElementById("agendaScreen").hidden');
 await click('#logout');const count=actions.length;await click('#pushRefresh');assert.equal(actions.length,count);
 await navigate();await evaluate('location.hash="agenda"');await login();await wait('!document.getElementById("agendaScreen").hidden');
 assert.deepEqual(errors,[]);
 console.log('PASS actual PWA worker/scope under /NandaNails/, mock activation/test/cancellation, click-only permission, denied/iPhone install/incompatible states, six widths, authorized deep link and logout');
 console.log('Push delivery, iPhone installation and OS background behavior remain untested on physical hardware.');
}finally{await call('Fetch.disable');ws.close();await new Promise(r=>server.close(r));}
