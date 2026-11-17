// Local Chromium/Edge QA. Run a static server on 4173 and a disposable headless
// browser with --remote-debugging-port=9223. Provider requests are mocked.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const targets=await(await fetch('http://127.0.0.1:9223/json')).json();
const target=targets.find(x=>x.type==='page');
if(!target)throw Error('No disposable browser target');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];let mock=false,bookings=0,bookingResult='valid';
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
const catalog=[['molde-f1','Alongamento Molde F1',120,9000],['esmaltacao-gel','Esmaltação em Gel',60,7000],['esmaltacao-gel-pe','Esmaltação em Gel no Pé',60,6000],['manutencao-alongamento','Manutenção de Alongamento',90,6500],['remocao','Remoção',30,1500]].map(([id,name,duration_minutes,price_cents])=>({id,name,duration_minutes,price_cents,description:'Procedimento original',active:true}));
let day='2026-11-20';
ws.onmessage=async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;let body,contentType='application/json';
  if(mock&&request.url.endsWith('/js/config.js')){contentType='application/javascript';body=`window.NN_CONFIG={supabaseUrl:'http://127.0.0.1:4173',publishableKey:'mock'};`;}
  else if(request.url.includes('challenges.cloudflare.com')){errors.push('Unexpected CAPTCHA dependency');await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
  else if(request.url.endsWith('/functions/v1/booking')){const data=JSON.parse(request.postData);
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
  else if(request.url.endsWith('/rest/v1/rpc/is_admin'))body='true';
  else if(request.url.endsWith('/rest/v1/rpc/admin_action')){
   const data=JSON.parse(request.postData);body=JSON.stringify(data.p_action==='slots'?{slots:[{date:day,time:'14:00'}]}:{appointments:[],services:catalog,availability:[{weekday:1,opens:'09:00:00',closes:'18:00:00',active:true}],blocks:[]});
  }
  try{if(body!==undefined)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')});else await call('Fetch.continueRequest',{requestId});}catch(e){errors.push(e.message);}
 }
};
await call('Runtime.discardConsoleEntries');await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function wait(expression){const end=Date.now()+10000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timeout: '+expression+' '+JSON.stringify(await evaluate('({config:window.NN_CONFIG,status:document.getElementById("connectionStatus")?.textContent})'))+' '+errors.join('\n'));}
async function navigate(page){const url='http://127.0.0.1:4173/'+page+'?qa='+Date.now();await call('Page.navigate',{url});await wait('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');}
async function viewport(width,height=852){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<800});}
try{
 await viewport(375);await navigate('index.html');await wait('document.querySelectorAll("#bookingServices button").length===5');
 assert.match(await evaluate('document.getElementById("connectionStatus").textContent'),/configuração/);
 assert.equal(await evaluate('[...document.querySelectorAll("#bookingServices button")].every(b=>b.disabled)'),true);
 console.log('PASS disconnected state never offers a fake reservation');
 mock=true;await navigate('index.html');await wait('window.NN?.serverToday');
 for(const width of [320,375,393,430,768,1440]){await viewport(width);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Horizontal overflow at ${width}`);}
 await viewport(375);await evaluate('document.querySelector("#bookingServices button").click()');await wait('document.querySelector(".cal-day.open")');
 assert.equal(await evaluate('[...document.querySelectorAll(".cal-day")].find(b=>b.textContent==="22").disabled'),true);
 await evaluate('document.querySelector(".cal-day.open").click()');await wait('document.querySelector("#timeGrid button")');
 assert.deepEqual(await evaluate('[...document.querySelectorAll("#timeGrid button")].map(b=>b.textContent)'),['15:00','16:00']);
 await evaluate('document.querySelector("#timeGrid button").click()');
 assert.match(await evaluate('document.getElementById("bookingSummary").textContent'),/120 minutos/);
 await evaluate('document.getElementById("clientName").value="Cliente Teste";document.getElementById("clientPhone").value="11912345678";document.getElementById("clientPhone").dispatchEvent(new Event("input",{bubbles:true}))');
 assert.equal(await evaluate('document.getElementById("clientPhone").value'),'(11)91234-5678');
 for(const badResult of [null,{booking:{}},{booking:{id:''}}]){bookingResult=badResult;await evaluate('document.getElementById("bookingForm").requestSubmit()');await wait('!document.querySelector("#bookingForm [type=submit]").disabled');assert.equal(await evaluate('document.getElementById("panelSuccess").classList.contains("active")'),false);}
 bookingResult='valid';
 await evaluate('document.getElementById("bookingForm").requestSubmit();document.getElementById("bookingForm").requestSubmit()');
 await wait('document.getElementById("panelSuccess").classList.contains("active")');assert.equal(bookings,4);
 assert.match(await evaluate('document.getElementById("successSummary").textContent'),/mock-reserva/);
 console.log('PASS service, date, time, phone mask, summary, duplicate submit, database response confirmation, unconfirmed results never succeed, no CAPTCHA (mock)');
 await evaluate('document.getElementById("galleryMore").click()');assert.equal(await evaluate('document.querySelectorAll(".gallery-item").length'),10);
 await evaluate('document.querySelector(".gallery-item").click()');assert.equal(await evaluate('document.getElementById("lightbox").hidden'),false);
 await evaluate('document.getElementById("closeLightbox").click()');
 mkdirSync('.local/screenshots',{recursive:true});await viewport(393);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('.local/screenshots/mobile.png',Buffer.from(shot.data,'base64'));
 await navigate('admin.html');await evaluate('document.getElementById("email").value="test@example.invalid";document.getElementById("password").value="mock-password";document.getElementById("loginForm").requestSubmit()');await wait('!document.getElementById("workspace").hidden');await wait('document.querySelectorAll(".admin-stat").length===6');
 for(const width of [320,375,393,430,768,1440]){await viewport(width);for(const tab of ['agenda','services','hours','blocks']){await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Admin overflow ${width} ${tab}`);}}
 await evaluate('document.getElementById("logout").click()');assert.equal(await evaluate('document.getElementById("workspace").hidden'),true);
 assert.deepEqual(errors,[]);console.log('PASS gallery, admin login/logout (mock), six indicators, six widths on all tabs, zero JS exceptions');
 console.log('Browser QA passed. Chromium emulation does not validate real iOS Safari.');
}finally{await call('Fetch.disable');ws.close();}
