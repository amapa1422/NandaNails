// Local diagnostics only: CDP Chromium, synthetic catalog/slots, no external network.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,statSync,readdirSync,readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const fixture={};runInNewContext(readFileSync('js/catalog.js','utf8'),{window:fixture});
const services=fixture.LUMIERE_DEFAULTS.services.map(s=>({...s,duration_minutes:s.minutes,price_cents:Math.round(s.price*100)}));
const label=process.argv[2]||'current';
if(!/^[a-z-]+$/.test(label))throw Error('Use a simple diagnostic label');
const target=await(await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let seq=0,slotsRequests=0;const pending=new Map(),errors=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
const wait=async expression=>{const end=Date.now()+10000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timeout: '+expression+' '+errors.join('; '));};
ws.onmessage=async event=>{
 const m=JSON.parse(event.data);
 if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params;
 try{
  if(!request.url.startsWith('http://127.0.0.1:4173/')){await call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
  let body,contentType='application/json';
  if(/\/js\/(api|booking|animations|experience|admin)\.js$/.test(request.url)){
   contentType='application/javascript';body=readFileSync((label.startsWith('before')?'.local/performance/baseline/':'js/')+new URL(request.url).pathname.split('/').pop(),'utf8');
  }
  if(request.url.endsWith('/js/config.js')){contentType='application/javascript';body="window.NN_CONFIG={supabaseUrl:'http://127.0.0.1:4173',publishableKey:'mock'};";}
  if(request.url.endsWith('/functions/v1/booking')){
   const data=JSON.parse(request.postData);
   if(data.action==='catalog')body=JSON.stringify({today:'2026-11-18',services});
   else if(data.action==='availability'){
    slotsRequests++;const slots=[];
    for(let d=new Date(data.from+'T12:00:00');d<=new Date(data.to+'T12:00:00');d.setDate(d.getDate()+1)){
     if(d.getDay()===0)continue;
     for(const time of ['15:00','16:00'])slots.push({date:d.toISOString().slice(0,10),time});
    }
    // Deliberately return December late to exercise stale responses.
    await new Promise(r=>setTimeout(r,data.from==='2026-12-01'?150:15));
    body=JSON.stringify({slots});
   }else throw Error('Unexpected mutation in diagnostic');
  }
  await call(body===undefined?'Fetch.continueRequest':'Fetch.fulfillRequest',body===undefined?{requestId}:{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')});
 }catch(e){errors.push(e.message);}
};
try{
 await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});await call('Performance.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await call('Emulation.setCPUThrottlingRate',{rate:4});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.diag={lcp:0,cls:0,longTasks:[]};
 for(const [type,fn] of [['largest-contentful-paint',e=>diag.lcp=e.startTime],['layout-shift',e=>{if(!e.hadRecentInput)diag.cls+=e.value}],['longtask',e=>diag.longTasks.push(e.duration)]]){try{new PerformanceObserver(l=>l.getEntries().forEach(fn)).observe({type,buffered:true})}catch{}}`});
 await call('Page.navigate',{url:'http://127.0.0.1:4173/index.html?performance='+Date.now()});
 await wait('document.readyState==="complete"&&window.NN?.serverToday');
 await evaluate('new Promise(r=>setTimeout(r,900))');
 const initial=await evaluate('({...diag,navigation:performance.getEntriesByType("navigation")[0].toJSON(),resources:performance.getEntriesByType("resource").map(r=>({name:r.name.split("/").pop(),bytes:r.encodedBodySize}))})');
 const metrics=async()=>Object.fromEntries((await call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const initialMetrics=await metrics();
 mkdirSync('.local/performance',{recursive:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync('.local/performance/'+label+'.png',Buffer.from(shot.data,'base64'));
 const before=await metrics();
 await evaluate('document.querySelector("#bookingServices button").click()');await wait('document.querySelector(".cal-day.open")');
 // Four repeated reads in flight should share a request; no settled availability cache.
 const countBefore=slotsRequests;
 await evaluate('Promise.all(Array.from({length:4},()=>NN.availability("molde-f1","2026-11-20")))');
 const duplicateReads=slotsRequests-countBefore;
 await evaluate('document.getElementById("nextMonth").click();document.getElementById("nextMonth").click()');
 await wait('document.getElementById("monthLabel").textContent.includes("janeiro")&&document.querySelector(".cal-day.open")');
 await evaluate('new Promise(r=>setTimeout(r,250))');
 assert.match(await evaluate('document.querySelector(".cal-day.open").title'),/janeiro/);
 await evaluate('document.querySelector(".cal-day.open").click()');await wait('document.querySelector("#timeGrid .time")');
 const after=await metrics();
 const delta=Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(k=>[k,after[k]-before[k]]));
 const report={label,environment:'Edge headless, 393x852, CPU 4x, localhost, cold cache, external fonts blocked, synthetic backend; NOT field Web Vitals or iOS',initial,initialMetrics,interaction:delta,duplicateReads,assetsBytes:readdirSync('assets').reduce((n,f)=>n+statSync('assets/'+f).size,0),errors};
 writeFileSync('.local/performance/'+label+'.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({label,lcp:initial.lcp,cls:initial.cls,longTasks:initial.longTasks,duplicateReads,interaction:delta},null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});await call('Fetch.disable');ws.close();await fetch('http://127.0.0.1:9223/json/close/'+target.id);}
