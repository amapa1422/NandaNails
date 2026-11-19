// Local Chromium/Edge QA. Run a static server on 4173 and a disposable headless
// browser with --remote-debugging-port=9223. Provider requests are mocked.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const targets=await(await fetch('http://127.0.0.1:9223/json')).json();
const target=targets.find(x=>x.type==='page');
if(!target)throw Error('No disposable browser target');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];let mock=true,bookings=0,bookingResult='valid',availabilityFails=false,adminLists=0,slotRace=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
const catalog=[['molde-f1','Alongamento Molde F1',120,9000],['esmaltacao-gel','Esmaltação em Gel',60,7000],['esmaltacao-gel-pe','Esmaltação em Gel no Pé',60,6000],['manutencao-alongamento','Manutenção de Alongamento',90,6500],['remocao','Remoção',30,1500]].map(([id,name,duration_minutes,price_cents])=>({id,name,duration_minutes,price_cents,description:'Procedimento original',active:true}));
let day='2026-11-20',records=[],authorized=true,failList=false,listDelay=0;const mutations=[];
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function record(id,status='confirmed',date=today,time='15:00',phone='(44) 99999-0000'){return {id,client_name:'Cliente teste '+id,phone,service_name:'Procedimento teste',duration_minutes:60,price_cents:7000,status,starts_at:date+'T'+time+':00-03:00',ends_at:date+'T'+time+':00-03:00'};}

ws.onmessage=async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;let body,contentType='application/json';if(request.url.includes('/rest/v1/')||request.url.includes('/functions/v1/')||request.url.includes('/auth/v1/'))await new Promise(r=>setTimeout(r,200));
  if(request.url.endsWith('/js/config.js')){contentType='application/javascript';body=`window.NN_CONFIG=${JSON.stringify(mock?{supabaseUrl:'http://127.0.0.1:4173',publishableKey:'mock'}:{supabaseUrl:'',publishableKey:''})};`;}
  else if(!request.url.startsWith('http://127.0.0.1:4173/')){await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
  else if(request.url.includes('challenges.cloudflare.com')){errors.push('Unexpected CAPTCHA dependency');await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
  else if(request.url.endsWith('/functions/v1/booking')){const data=JSON.parse(request.postData);
   if(data.action==='availability'&&availabilityFails){await call('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Falha de rede simulada'})).toString('base64')});return;}
   if(data.action==='catalog')body=JSON.stringify({today:'2026-11-17',services:catalog});
   if(data.action==='availability'){
    const slots=[],duration=catalog.find(s=>s.id===data.serviceId).duration_minutes;
    for(let d=new Date(data.from+'T12:00:00Z');d<=new Date(data.to+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){
     const date=d.toISOString().slice(0,10),weekday=d.getUTCDay();if(date<'2026-11-17'||weekday===0)continue;
     const starts=weekday===6?Array.from({length:17},(_,i)=>480+i*30).filter(m=>m+duration<=960):[900,960];
     for(const m of starts)slots.push({date,time:`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`});
    }
    day=data.from;body=JSON.stringify({slots});
   }
   if(data.action==='book'){bookings++;if('captchaToken' in data)errors.push('Unexpected CAPTCHA token');body=JSON.stringify(bookingResult!=='valid'?bookingResult:{booking:{id:'mock-reserva',service_name:catalog[0].name,date:data.date,time:data.time,duration_minutes:120,price_cents:9000}});}
  } else if(request.url.includes('/auth/v1/token'))body=JSON.stringify({access_token:'mock-jwt',refresh_token:'mock-refresh',expires_in:3600});
  else if(request.url.endsWith('/auth/v1/logout'))body='{}';
  else if(request.url.endsWith('/rest/v1/rpc/is_admin'))body=JSON.stringify(authorized);
  else if(request.url.endsWith('/rest/v1/rpc/admin_action')){
   const data=JSON.parse(request.postData);
   if(data.p_action==='list'){
    adminLists++;const response={appointments:records.filter(a=>(data.p_data.from==='-infinity'||a.starts_at>=data.p_data.from)&&(data.p_data.to==='infinity'||a.starts_at<data.p_data.to)),services:catalog,availability:[{weekday:new Date(today+'T12:00:00').getDay(),opens:'15:00:00',closes:'18:00:00',active:true}],blocks:[]};
    if(listDelay)await new Promise(r=>setTimeout(r,listDelay));
    if(failList){await call('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({message:'simulated failure'})).toString('base64')});return;}
    body=JSON.stringify(response);
   }else if(data.p_action==='slots')body=JSON.stringify({slots:[{time:'16:00'}]});
   else{mutations.push(data);const a=records.find(a=>a.id===data.p_data.id);if(data.p_action==='status'&&a)a.status=data.p_data.status;if(data.p_action==='reschedule'&&a)a.starts_at=data.p_data.date+'T'+data.p_data.time+':00-03:00';body=JSON.stringify({ok:true});}

  }
  try{if(body!==undefined)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')});else await call('Fetch.continueRequest',{requestId});}catch(e){errors.push(e.message);}
 }
};
await call('Runtime.discardConsoleEntries');await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function wait(expression){const end=Date.now()+10000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timeout: '+expression+' '+JSON.stringify(await evaluate('({config:window.NN_CONFIG,status:document.getElementById("connectionStatus")?.textContent})'))+' '+errors.join('\n'));}
async function navigate(page){const url='http://127.0.0.1:4173/'+page+'?qa='+Date.now();await call('Page.navigate',{url});await wait('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');}
async function viewport(width,height=852){await call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:width<800});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
const visualActual={};
const specimen=()=>evaluate(`Object.fromEntries(['.dash-kpis','.kpi','.dash-card','.dash-card h2','.side-link','.dash-period','.donut','.chart-bar'].map(selector=>{const c=getComputedStyle(document.querySelector(selector));return [selector,Object.fromEntries(['backgroundColor','color','borderRadius','padding','fontFamily','fontSize','gap'].map(k=>[k,c[k]]))]}))`);
const click=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const login=async()=>{await evaluate('document.getElementById("email").value="test@example.invalid";document.getElementById("password").value="mock-password";document.getElementById("loginForm").requestSubmit()');};
const settled=()=>wait('document.getElementById("adminStatus").textContent==="Agenda atualizada."');
const refresh=async()=>{await click('#dashboardReload');await settled();};
try{
 await call('Emulation.setCPUThrottlingRate',{rate:4});
 await call('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:128*1024,uploadThroughput:64*1024});
 await viewport(375);await navigate('admin.html');assert.equal(adminLists,0);
 records=[{...record('a'),client_name:'Cliente Acentuada',service_name:'Esmaltação'},{...record('b','completed'),client_name:'Outra cliente'},{...record('c','cancelled'),client_name:'Cancelada'}];
 await login();await settled();
 await click('[data-page=agenda]');await settled();await click('[data-view=day]');await settled();
 for(const [query,count] of [['ACENTUADA',1],['ESMALTAÇÃO',1],['ausente',0],['ACENTUADA',1]]){
  await evaluate(`document.getElementById('search').value=${JSON.stringify(query)};document.getElementById('search').dispatchEvent(new Event('input'))`);
  assert.equal(await evaluate('document.querySelectorAll("#calendar .appointment").length'),count);
 }
 records[0].client_name='Nome atualizado';records[0].service_name='Procedimento atualizado';
 await click('#refresh');await settled();assert.equal(await evaluate('document.querySelectorAll("#calendar .appointment").length'),0);
 await evaluate(`document.getElementById('search').value='ATUALIZADO';document.getElementById('search').dispatchEvent(new Event('input'))`);
 assert.equal(await evaluate('document.querySelectorAll("#calendar .appointment").length'),1);
 await click('[data-view=week]');await click('[data-view=month]');await click('[data-view=day]');await settled();
 assert.equal(await evaluate('document.getElementById("agendaView").value'),'day');
 assert.equal(await evaluate('document.querySelectorAll("#calendar .appointment").length'),1);
 await click('#logout');assert.equal(await evaluate('document.getElementById("calendar").textContent'),'');
 assert.deepEqual(errors,[]);console.log('PASS CPU 4x, 128 KiB/s + 150ms network and 200ms provider delay, accent/case search, refreshed names/services invalidate search strings, rapid views, logout');
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await call('Page.navigate',{url:'about:blank'});await call('Fetch.disable');ws.close();}
