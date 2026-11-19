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
let notifications=[],notificationCalls=0,notificationFailure=false,notificationDelay=0;
let day='2026-11-20',records=[],authorized=true,failList=false,listDelay=0;const mutations=[];
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function record(id,status='confirmed',date=today,time='15:00',phone='(44) 99999-0000'){return {id,client_name:'Cliente teste '+id,phone,service_name:'Procedimento teste',duration_minutes:60,price_cents:7000,status,starts_at:date+'T'+time+':00-03:00',ends_at:date+'T'+time+':00-03:00'};}

ws.onmessage=async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;let body,contentType='application/json';
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
  else if(request.url.endsWith('/rest/v1/rpc/admin_notifications')){
   notificationCalls++;const {p_action:action,p_data:p}=JSON.parse(request.postData);
   if(notificationDelay)await new Promise(r=>setTimeout(r,notificationDelay));
   if(notificationFailure){await call('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')});return;}
   const select=()=>notifications.filter(n=>(p.filter==='all'||!p.filter||(p.filter==='read'&&n.read_at)||(p.filter==='unread'&&!n.read_at)||(p.filter==='issues'&&n.has_issues))&&(p.period!=='today'||n.created_at.slice(0,10)===today));
   if(action==='read'){const n=notifications.find(n=>n.id===p.id);n.read_at=p.read===false?null:new Date().toISOString();body='{"ok":true}';}
   if(action==='read_filter'){const list=select().filter(n=>!n.read_at&&n.created_at<=p.until);list.forEach(n=>n.read_at=new Date().toISOString());body=JSON.stringify({changed:list.length});}
   if(action==='detail')body=JSON.stringify(records.find(n=>n.id===p.id));
   if(action==='list'){
    const sorted=[...select()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
    const list=sorted.filter(n=>!p.before_time||n.created_at<p.before_time||(n.created_at===p.before_time&&n.id<p.before_id));
    const states={};for(const n of sorted)for(const [k,v]of Object.entries(n.push))states[k]=(states[k]||0)+v;
    body=JSON.stringify({until:new Date().toISOString(),unread:notifications.filter(n=>!n.read_at).length,total:sorted.length,has_more:list.length>20,items:list.slice(0,20),recent:[...notifications].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(0,4),states,metrics:{total:sorted.length,unread:sorted.filter(n=>!n.read_at).length,read:sorted.filter(n=>n.read_at).length,accepted:sorted.filter(n=>n.push.accepted).length,issues:sorted.filter(n=>n.has_issues).length}});
   }
  } else if(request.url.endsWith('/rest/v1/rpc/admin_action')){
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
const center=()=>wait('document.getElementById("notificationsScreen").getAttribute("aria-busy")==="false"&&!document.getElementById("nnMarkAll").disabled');
function fixture(i,state='accepted'){
 const id=String(i).padStart(6,'0'),a=record(id);records.push(a);
 return {id,client_name:i===1?'<img src=x onerror=alert(1)>':a.client_name,service_name:a.service_name,starts_at:a.starts_at,created_at:today+'T09:00:00-03:00',read_at:null,push:state?{[state]:1}:{},has_issues:['failed','unknown','expired'].includes(state)};
}
const visual={};
const styles=()=>evaluate(`Object.fromEntries(['.nn-bell','.nn-hero h1','.nn-metric','.nn-main-card','.nn-cardhead','.nn-filterbar','.nn-item','.nn-symbol','.nn-pill','.nn-side-card'].map(s=>{const c=getComputedStyle(document.querySelector(s));return [s,Object.fromEntries(['backgroundColor','color','borderRadius','padding','fontFamily','fontSize','gap'].map(k=>[k,c[k]]))]}))`);
async function secondDeviceRead(id){
 const {targetId}=await call('Target.createTarget',{url:'about:blank'});
 const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.id===targetId);
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);
 let sequence=0;const requests=new Map();
 const invoke=(method,params={})=>new Promise((resolve,reject)=>{const key=++sequence;requests.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 socket.onmessage=async event=>{
  const m=JSON.parse(event.data);if(m.id){const p=requests.get(m.id);requests.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
  if(m.method!=='Fetch.requestPaused')return;
  const {request,requestId}=m.params;let body,type='application/json';
  if(!request.url.startsWith('http://127.0.0.1:4173/')){await invoke('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
  if(request.url.endsWith('/js/config.js')){type='application/javascript';body='window.NN_CONFIG={supabaseUrl:"http://127.0.0.1:4173",publishableKey:"mock"}';}
  else if(request.url.includes('/auth/v1/token'))body=JSON.stringify({access_token:'second-device',refresh_token:'mock',expires_in:3600});
  else if(request.url.endsWith('/rpc/is_admin'))body='true';
  else if(request.url.endsWith('/rpc/admin_action'))body=JSON.stringify({appointments:records,services:catalog,availability:[],blocks:[]});
  else if(request.url.endsWith('/rpc/admin_notifications')){
   const {p_action:action,p_data:p}=JSON.parse(request.postData);
   if(action==='read'){notifications.find(n=>n.id===p.id).read_at=new Date().toISOString();body='{"ok":true}';}
   else {const unread=notifications.filter(n=>!n.read_at).length;body=JSON.stringify({until:new Date().toISOString(),unread,total:notifications.length,has_more:false,items:[...notifications].reverse().slice(0,20),recent:[],states:{},metrics:{unread,total:notifications.length,read:notifications.length-unread,accepted:0,issues:0}});}
  }
  if(body===undefined)await invoke('Fetch.continueRequest',{requestId});else await invoke('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')});
 };
 const run=async expression=>{const r=await invoke('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Second device timeout: '+expression);};
 try{
  await invoke('Page.enable');await invoke('Fetch.enable',{patterns:[{urlPattern:'*'}]});await invoke('Page.navigate',{url:'http://127.0.0.1:4173/admin.html?device=2'});await until('document.readyState==="complete"&&!!window.NNNotifications');
  await run('document.getElementById("email").value="test@example.invalid";document.getElementById("password").value="mock";document.getElementById("loginForm").requestSubmit()');
  await until('!document.getElementById("workspace").hidden&&!document.getElementById("nnMarkAll").disabled');
  await run('document.querySelector("[data-page=notifications]").click()');await until('!document.getElementById("nnMarkAll").disabled');
  await run(`document.querySelector('[data-notification="${id}"] .nn-item-actions button:last-child').click()`);
  await until('document.getElementById("nnBellCount").hidden');
 }finally{await invoke('Fetch.disable');socket.close();await call('Target.closeTarget',{targetId});}
}
try{
 mkdirSync('.local/notifications',{recursive:true});
 await viewport(1440);await navigate('admin.html');assert.equal(notificationCalls,0);assert.equal(await evaluate('document.getElementById("nnBell").hidden'),true);
 authorized=false;await login();await wait('document.getElementById("adminStatus").textContent.includes("sem autorização")');assert.equal(notificationCalls,0);
 authorized=true;await login();await settled();await center();
 await click('[data-page=notifications]');await center();assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),0);assert.equal(await evaluate('document.getElementById("nnBellCount").hidden'),true);
 console.log('PASS auth gate, denied user, empty center and zero badge');
 notifications=Array.from({length:45},(_,i)=>fixture(i+1,['accepted','failed','unknown','expired','sending','pending',null][i%7]));
 await click('#nnRefresh');await center();await wait('document.getElementById("nnTotalMetric").textContent==="45"');
 assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),20);
 assert.equal(await evaluate('document.getElementById("nnBellCount").textContent'),'45');
 await click('#nnListFooter button');await center();assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),20);
 await click('#nnListFooter button');await center();
 await click('#nnList .nn-item-actions button:last-child');await center();await wait('document.getElementById("nnBellCount").textContent==="44"');
 await click('[data-nn-filter=read]');await center();assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),1);
 await click('[data-nn-filter=issues]');await center();assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),20);
 await click('[data-nn-filter=all]');await center();await click('#nnMarkAll');await wait('document.getElementById("nnFeedback").textContent.includes("44 avisos")');
 assert.equal(notifications.filter(n=>!n.read_at).length,0);assert.equal(await evaluate('document.getElementById("nnBellCount").hidden'),true);
 // Simulate a second device marking the shared persistent record unread; focus syncs.
 notifications[44].read_at=null;await evaluate('window.dispatchEvent(new Event("focus"))');await center();assert.equal(await evaluate('document.getElementById("nnBellCount").textContent'),'1');
 await secondDeviceRead('000045');await evaluate('window.dispatchEvent(new Event("focus"))');await center();assert.equal(await evaluate('document.getElementById("nnBellCount").hidden'),true);
 await click('#nnList .nn-item-actions button');await wait('document.getElementById("detailDialog").open');
 assert.equal(await evaluate('document.getElementById("detailTitle").textContent'),'Cliente teste 000045');
 assert.ok((await evaluate('document.getElementById("whatsappLink").href')).startsWith('https://wa.me/'));
 await click('#closeDetail');await center();
 console.log('PASS bounded pages, read/unread, filter-wide marking beyond page, external-device read sync, filters and correct existing drawer/WhatsApp');
 // Compact popup, keyboard Escape/focus and outside close.
 await click('#nnBell');await center();assert.equal(await evaluate('document.getElementById("nnPopover").hidden'),false);
 assert.equal(await evaluate('document.querySelectorAll(".nn-pop-item").length'),4);
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await evaluate('document.getElementById("nnPopover").hidden'),true);assert.equal(await evaluate('document.activeElement.id'),'nnBell');
 await click('#nnBell');await click('#nnSeeAll');assert.equal(await evaluate('document.getElementById("notificationsScreen").hidden'),false);
 await center();await click('#nnBell');await click('.nn-hero h1');assert.equal(await evaluate('document.getElementById("nnPopover").hidden'),true);
 // All state labels and safe client text, never interpreted as HTML.
 await click('#nnListFooter button');await center();await click('#nnListFooter button:last-child');await center();
 assert.equal(await evaluate('document.querySelectorAll("#nnList img").length'),0);
 assert.ok((await evaluate('document.getElementById("nnStatusSummary").textContent')).includes('Em processamento'));
 assert.ok(!(await evaluate('document.getElementById("nnList").textContent')).includes('Entregue ao iPhone'));
 // Match read/Push states when comparing the first card to the reference.
 notifications[44].read_at=null;notifications[44].push={accepted:1};notifications[44].has_issues=false;
 // Compare the first page against the reference on mobile/desktop.
 await click('#nnRefresh');await center();
 for(const width of [320,375,390,430,768,1440]){
  await viewport(width);await new Promise(r=>setTimeout(r,220));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'overflow '+width);
  if([390,1440].includes(width))visual[width]=await styles();
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/notifications/actual-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await viewport(1440);await evaluate('document.querySelector(".nn-item").scrollIntoView({block:"center"})');
 const rect=await evaluate('(()=>{const r=document.querySelector(".nn-item").getBoundingClientRect();return {x:r.x+30,y:r.y+30}})()');await call('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});await new Promise(r=>setTimeout(r,250));
 assert.ok(Number(await evaluate('getComputedStyle(document.querySelectorAll(".nn-item")[1]).opacity'))<1);
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".nn-item")).transform'),'none');
 await call('Emulation.setEmulatedMedia',{features:[]});
 notifications=Array.from({length:10000},(_,i)=>fixture(i+100));await click('#nnRefresh');await center();assert.equal(await evaluate('document.querySelectorAll(".nn-item").length'),20);
 notificationFailure=true;await click('#nnRefresh');await wait('document.getElementById("nnFeedback").textContent.includes("indisponível")');notificationFailure=false;
 notificationDelay=250;await click('#nnRefresh');await click('#logout');await new Promise(r=>setTimeout(r,500));assert.equal(await evaluate('document.getElementById("nnList").textContent'),'');assert.equal(await evaluate('document.getElementById("nnBell").hidden'),true);
 console.log('PASS popup/keyboard, six widths, reduced motion, hover, 10,000 mocked records, server errors and logout race');
 await navigate('REFERENCIAS/NandaNails_DASHBOARD_COMPLETO_grafico_mensal_ajustado%20(1).html');await click('[data-page=notifications]');
 const reference={};for(const width of [390,1440]){await viewport(width);await new Promise(r=>setTimeout(r,220));reference[width]=await styles();const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/notifications/reference-${width}.png`,Buffer.from(shot.data,'base64'));}
 writeFileSync('.local/notifications/visual-comparison.json',JSON.stringify({actual:visual,reference},null,2));
 assert.deepEqual(visual,reference);assert.deepEqual(errors,[]);
 console.log('PASS reference comparison: 10 selectors x 7 properties at 390/1440; blocked external network, no production access');
}finally{await call('Page.navigate',{url:'about:blank'});await call('Fetch.disable');ws.close();}
