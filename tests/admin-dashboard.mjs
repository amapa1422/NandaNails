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
 await call('Emulation.setEmulatedMedia',{features:[]});
 await viewport(1440);await navigate('admin.html');assert.equal(adminLists,0);
 authorized=false;await login();await wait('document.getElementById("adminStatus").textContent.includes("sem autorização")');assert.equal(adminLists,0);
 authorized=true;await login();await settled();await wait('document.getElementById("dashTotal").textContent==="0"');
 assert.equal(await evaluate('document.querySelectorAll(".donut-arc").length'),0);
 assert.ok(!(await evaluate('document.getElementById("dashboardLegend").textContent')).includes('NaN'));
 console.log('PASS authorization gate, empty dashboard and zero segments');
 // Keep the completed fixture in the past even when QA runs before 16:00.
 records=[record('one'),record('two','completed',today,'00:00'),record('three','cancelled',today,'17:00','invalid'),record('four','confirmed',today,'18:00')];
 await refresh();await wait('document.getElementById("dashTotal").textContent==="4"');
 assert.equal(await evaluate('document.getElementById("dashCompleted").textContent'),'1');
 await wait('document.getElementById("dashRevenue").textContent.includes("70,00")');
 assert.equal(await evaluate('document.querySelectorAll(".donut-arc").length'),3);
 // Real SVG hit testing at multiple points on every independent arc.
 assert.equal(await evaluate(`(()=>{for(const p of document.querySelectorAll('.donut-arc')){for(const f of [.1,.5,.9]){const q=p.getPointAtLength(p.getTotalLength()*f),m=p.getScreenCTM(),point=new DOMPoint(q.x,q.y).matrixTransform(m);if(document.elementFromPoint(point.x,point.y)!==p)return false;}}return true;})()`),true);
 const hover=async selector=>{const r=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await call('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await new Promise(r=>setTimeout(r,250));};
 for(const status of ['confirmed','completed','cancelled']){
  const point=await evaluate(`(()=>{const p=document.querySelector('.donut-arc[data-segment=${status}]'),q=p.getPointAtLength(p.getTotalLength()*.5),r=new DOMPoint(q.x,q.y).matrixTransform(p.getScreenCTM());return {x:r.x,y:r.y};})()`);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await new Promise(r=>setTimeout(r,250));
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.donut-arc[data-segment=${status}]')).strokeWidth`),'22px');
  assert.equal(await evaluate(`[...document.querySelectorAll('.donut-arc:not([data-segment=${status}])')].every(p=>Number(getComputedStyle(p).opacity)<.3)`),true);
  await hover(`#dashboardLegend [data-segment=${status}]`);
  assert.equal(await evaluate(`document.querySelector('.donut-arc[data-segment=${status}]').classList.contains('highlight')`),true);
  assert.equal(await evaluate('document.querySelectorAll(".donut-arc.dim").length'),2);
 }
 // Keyboard focus applies the same legend highlight.
 await evaluate('document.querySelector("#dashboardLegend [data-segment=completed]").focus()');
 assert.equal(await evaluate('document.querySelector(".donut-arc[data-segment=completed]").classList.contains("highlight")'),true);
 await evaluate('document.activeElement.blur()');
 await hover('#dashboardBars .chart-col');
 assert.equal(await evaluate('Number(getComputedStyle(document.querySelectorAll(".chart-col")[1]).opacity)<.5'),true);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 console.log('PASS real counts, estimated revenue excludes cancelled, bar hover, independent SVG hit areas and legend focus/hover');
 // Open drawer from the dashboard and inspect safe, editable WhatsApp link.
 await click('#dashboardRecent [data-appointment=one]');
 assert.equal(await evaluate('document.getElementById("detailDialog").open'),true);
 assert.match(await evaluate('document.getElementById("detailRows").textContent'),/\(44\) 99999-0000/);
 assert.equal(await evaluate('document.activeElement.closest("#detailDialog")!==null'),true);
 await evaluate('document.getElementById("whatsappMessage").value="Mensagem editada";document.getElementById("whatsappMessage").dispatchEvent(new Event("input"))');
 const link=new URL(await evaluate('document.getElementById("whatsappLink").href'));assert.equal(link.pathname,'/5544999990000');assert.equal(link.searchParams.get('text'),'Mensagem editada');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert.equal(await evaluate('document.getElementById("detailDialog").open'),false);
 await click('#dashboardRecent [data-appointment=three]');assert.equal(await evaluate('document.getElementById("whatsappLink").hasAttribute("href")'),false);assert.equal(await evaluate('document.querySelectorAll("#detailActions button").length'),0);await click('#backDetail');
 await click('[data-page=agenda]');await settled();
 assert.equal(await evaluate('document.querySelectorAll(".column").length'),7);
 await click('[data-view=day]');await settled();assert.equal(await evaluate('document.querySelectorAll(".appointment").length'),4);
 await evaluate('document.getElementById("search").value="two";document.getElementById("search").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.querySelectorAll(".appointment").length'),1);
 await evaluate('document.getElementById("search").value="";document.getElementById("search").dispatchEvent(new Event("input"));document.getElementById("status").value="cancelled";document.getElementById("status").dispatchEvent(new Event("change"))');assert.equal(await evaluate('document.querySelectorAll(".appointment.cancelled").length'),1);
 await evaluate('document.getElementById("status").value="all";document.getElementById("status").dispatchEvent(new Event("change"))');
 await click('[data-view=month]');await settled();assert.ok(await evaluate('document.querySelectorAll(".cell").length>=28'));assert.ok(await evaluate('document.querySelector(".more")!==null'));
 await click('.more');await settled();assert.equal(await evaluate('document.getElementById("agendaView").value'),'day');
 const dateBefore=await evaluate('document.getElementById("agendaDate").value');await click('#next');await settled();assert.notEqual(await evaluate('document.getElementById("agendaDate").value'),dateBefore);await click('#todayBtn');await settled();assert.equal(await evaluate('document.getElementById("agendaDate").value'),today);
 // Out-of-order date reads may not replace the latest visible month.
 const future=new Date(today+'T12:00:00');future.setDate(1);future.setMonth(future.getMonth()+2);const futureDay=future.getFullYear()+'-'+String(future.getMonth()+1).padStart(2,'0')+'-01';records.push(record('race', 'confirmed',futureDay));
 await click('[data-view=month]');await settled();listDelay=220;await click('#next');listDelay=10;await click('#next');await settled();await new Promise(r=>setTimeout(r,300));assert.ok(await evaluate('document.querySelector("#calendar [data-appointment=race]")!==null'));listDelay=0;records.pop();await click('#todayBtn');await settled();await click('[data-view=day]');await settled();
 console.log('PASS drawer, Escape/focus, editable WhatsApp, invalid phone, day/week/month, search/status, overflow summary and date navigation');
 // Status and rescheduling still use the existing RPC contract.
 await click('[data-appointment=one]');await click('#detailActions button:last-child');assert.equal(await evaluate('document.getElementById("rescheduleDialog").open'),true);
 await evaluate(`document.querySelector('#rescheduleForm [name=date]').value=${JSON.stringify(today)};document.querySelector('#rescheduleForm [name=time]').value='16:00';document.getElementById('rescheduleForm').requestSubmit()`);await wait('!document.getElementById("rescheduleDialog").open');assert.equal(mutations.at(-1).p_action,'reschedule');
 await evaluate(`document.querySelector('#detailActions button').click()`);await wait('document.getElementById("detailBadge").textContent==="Cancelado"');assert.equal(mutations.at(-1).p_data.status,'cancelled');await click('#backDetail');
 await click('[data-appointment=two]');await click('#detailActions button:first-child');await wait('document.getElementById("detailBadge").textContent==="Confirmado"');
 await click('#detailActions button:nth-child(2)');await wait('document.getElementById("detailBadge").textContent==="Concluído"');await click('#backDetail');
 for(const tab of ['services','hours','blocks']){await click(`[data-tab=${tab}]`);assert.equal(await evaluate(`getComputedStyle(document.getElementById('${tab}')).display`),'block');}
 await evaluate('document.querySelector("#serviceForms form").requestSubmit()');await wait('document.getElementById("adminStatus").textContent==="Alterações salvas."');assert.equal(mutations.at(-1).p_action,'service');
 await evaluate('document.getElementById("hoursForm").requestSubmit()');await wait('document.getElementById("adminStatus").textContent==="Alterações salvas."');assert.equal(mutations.at(-1).p_action,'hours');
 await evaluate(`(()=>{const f=document.getElementById('blockForm');f.elements.fromDate.value=${JSON.stringify(today)};f.elements.toDate.value=${JSON.stringify(today)};f.requestSubmit()})()`);await wait('document.getElementById("adminStatus").textContent==="Alterações salvas."');assert.equal(mutations.at(-1).p_action,'block');
 console.log('PASS reschedule, cancel/confirm/complete and preserved service/hours/block RPC payloads (mocks)');
 await click('[data-page=dashboard]');await settled();
 await click('[data-dash-period=month]');await settled();await click('[data-dash-period=all]');await settled();await wait('document.getElementById("dashTotal").textContent==="4"');
 for(const width of [320,375,390,430,768,1440]){
  await viewport(width);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Dashboard overflow ${width}`);
  await click('[data-page=agenda]');await settled();await click('[data-tab=agenda]');
  for(const view of ['day','week','month']){await click(`[data-view=${view}]`);await settled();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Agenda overflow ${width} ${view}`);}
  await click('[data-page=dashboard]');await settled();
  if(width===390||width===1440){await new Promise(r=>setTimeout(r,250));visualActual[width]=await specimen();}
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/dashboard/dashboard-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await viewport(1440);await click('#sidebarToggle');assert.equal(await evaluate('document.getElementById("workspace").classList.contains("collapsed")'),true);await click('#sidebarToggle');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 records=[record('single')];await refresh();assert.equal(await evaluate('document.getElementById("dashTotal").textContent'),'1');assert.equal(await evaluate('document.querySelectorAll(".donut-arc").length'),1);assert.ok(!(await evaluate('document.querySelector(".donut-arc").getAttribute("d")')).includes('NaN'));
 // Timezone boundary: UTC next day belongs to the prior Sao Paulo date.
 records=[{...record('boundary'),starts_at:today+'T01:30:00Z'}];await refresh();await click('[data-page=agenda]');await settled();await click('[data-view=month]');await settled();
 assert.equal(await evaluate('document.querySelector("#calendar [data-appointment=boundary]").closest(".cell").querySelector(".number").title'),'Ver '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(today+'T01:30:00Z')));
 await click('[data-page=dashboard]');await settled();
 // Month lengths and Sao Paulo midnight boundary, with a browser-only frozen clock.
 await call('Emulation.setEmulatedMedia',{features:[]});
 await click('[data-dash-period=month]');await settled();
 for(const [month,dayCount] of [['2025-02',28],['2024-02',29],['2026-04',30],['2026-07',31]]){
  await evaluate(`window.QAOriginalDate??=Date;window.Date=class extends QAOriginalDate{constructor(...args){super(...(args.length?args:['${month}-15T12:00:00-03:00']));}static now(){return new QAOriginalDate('${month}-15T12:00:00-03:00').getTime();}};`);
  const appointments=[record('first','confirmed',month+'-01'),record('cancelled','cancelled',month+'-01'),{...record('utc','completed',month+'-02'),starts_at:month+'-02T01:30:00Z'},record('last','confirmed',month+'-'+dayCount)];
  await evaluate(`NNAdminUI.render({appointments:${JSON.stringify(appointments)}})`);
  await wait(`document.querySelectorAll('#dashboardBars .chart-col').length===${dayCount}`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.date-text')].map(x=>Number(x.textContent))`),Array.from({length:dayCount},(_,i)=>i+1));
  assert.equal(await evaluate(`document.querySelector('#dashboardBars .value').textContent`),'3');
  assert.equal(await evaluate(`document.querySelectorAll('#dashboardBars .value')[1].textContent`),'0');
  for(const width of [320,375,390,430,768,1024,1440]){
   await viewport(width);await wait('!document.getElementById("nnChartScrollHelp").hidden');
   assert.equal(await evaluate(`(()=>{const h=document.getElementById('nnChartWindow'),cols=[...document.querySelectorAll('#dashboardBars .chart-col')];return h.scrollWidth>h.clientWidth&&document.documentElement.scrollWidth<=innerWidth&&cols.every((c,i)=>c.offsetWidth>=49&&(!i||c.getBoundingClientRect().left>=cols[i-1].getBoundingClientRect().right));})()`),true,month+' '+width);
   assert.equal(await evaluate(`document.querySelectorAll('.weekday-text').length`),dayCount);
  }
  await viewport(390);await evaluate(`document.getElementById('nnChartWindow').focus()`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await wait(`document.getElementById('nnChartWindow').scrollLeft>0`);
  await evaluate(`document.querySelector('#dashboardBars .chart-col:last-child').focus()`);await wait(`document.getElementById('nnChartWindow').scrollLeft>500`);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`),(await evaluate(`document.activeElement.title`)));
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/dashboard/month-${month}-390.png`,Buffer.from(shot.data,'base64'));
 }
 // No hint when the full month fits; restores correctly as space becomes narrow.
 await viewport(2400);await evaluate(`document.getElementById('nnChartWindow').style.cssText='width:2200px;max-width:none'`);await wait('document.getElementById("nnChartScrollHelp").hidden');await evaluate(`document.getElementById('nnChartWindow').style.cssText=''`);
 await viewport(1440);await evaluate(`document.getElementById('nnChartWindow').scrollLeft=0;document.getElementById('nnChartWindow').scrollIntoView({block:'center'})`);
 await hover('#dashboardBars .chart-col:first-child');
 assert.equal(await evaluate(`Number(getComputedStyle(document.querySelectorAll('#dashboardBars .chart-col')[1]).opacity)<.4`),true);
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
 await evaluate('window.Date=QAOriginalDate;delete window.QAOriginalDate;window.scrollTo(0,0)');
 for(const period of ['week','month','all','month','week']){await click(`[data-dash-period=${period}]`);await settled();assert.equal(await evaluate(`document.getElementById('dashboardBars').classList.contains('monthly-bars')`),period==='month');if(period!=='month'){assert.equal(await evaluate(`document.getElementById('nnChartWindow').scrollLeft`),0);assert.equal(await evaluate(`document.getElementById('nnChartScrollHelp').hidden`),true);}}
 records=[];await refresh();assert.equal(await evaluate(`[...document.querySelectorAll('#dashboardBars .value')].every(x=>x.textContent==='0')`),true);
 await click('[data-dash-period=all]');await settled();
 console.log('PASS monthly 28/29/30/31 days, zero/multiple/cancelled/UTC counts, seven widths, keyboard, overflow hint, hover and period resets');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 records=Array.from({length:10000},(_,i)=>record('load-'+i,i%3===0?'completed':'confirmed'));const start=Date.now();await refresh();assert.equal(await evaluate('document.getElementById("dashTotal").textContent'),'10000');console.log('PASS 10,000 synthetic records rendered in',Date.now()-start,'ms');
 await click('[data-page=agenda]');await settled();await click('[data-view=month]');await settled();assert.ok(await evaluate('document.querySelectorAll(".item").length<=126'));
 await click('.more');await settled();assert.ok(await evaluate('document.querySelectorAll(".appointment").length<=100'));
 failList=true;await click('#refresh');await wait('document.getElementById("adminStatus").textContent.includes("Não foi possível")');failList=false;
 // Logging out while a read is pending must discard the late response and private DOM.
 listDelay=250;await click('#refresh');await click('#logout');await new Promise(r=>setTimeout(r,400));assert.equal(await evaluate('document.getElementById("workspace").hidden'),true);assert.equal(await evaluate('document.getElementById("calendar").textContent'),'');assert.equal(await evaluate('document.getElementById("dashboardRecent").textContent'),'');
 assert.deepEqual(errors,[]);console.log('PASS periods, six responsive widths, collapsed menu, reduced motion, full-circle donut, timezone boundary, bounded calendar, errors and logout race');
 const visualReference={};
 await navigate('REFERENCIAS/NandaNails_DASHBOARD_COMPLETO_grafico_mensal_ajustado%20(1).html');
 for(const width of [390,1440]){await viewport(width);await new Promise(r=>setTimeout(r,250));visualReference[width]=await specimen();const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/dashboard/reference-${width}.png`,Buffer.from(shot.data,'base64'));}
 writeFileSync('.local/dashboard/visual-comparison.json',JSON.stringify({actual:visualActual,reference:visualReference},null,2));
 assert.deepEqual(visualActual,visualReference);console.log('PASS reference comparison: 8 selectors × 7 style properties at 390/1440 px');
 console.log('Dashboard QA passed with synthetic data and blocked external network. No production access.');
}finally{await call('Page.navigate',{url:'about:blank'});await call('Fetch.disable');ws.close();}


