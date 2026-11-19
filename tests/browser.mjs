// Local Chromium/Edge QA. Run a static server on 4173 and a disposable headless
// browser with --remote-debugging-port=9223. Provider requests are mocked.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const targets=await(await fetch('http://127.0.0.1:9223/json')).json();
const target=targets.find(x=>x.type==='page');
if(!target)throw Error('No disposable browser target');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];let mock=false,bookings=0,bookingResult='valid',availabilityFails=false,adminLists=0,slotRace=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
const catalog=[['molde-f1','Alongamento Molde F1',120,9000],['esmaltacao-gel','Esmaltação em Gel',60,7000],['esmaltacao-gel-pe','Esmaltação em Gel no Pé',60,6000],['manutencao-alongamento','Manutenção de Alongamento',90,6500],['remocao','Remoção',30,1500]].map(([id,name,duration_minutes,price_cents])=>({id,name,duration_minutes,price_cents,description:'Procedimento original',active:true}));
let day='2026-11-20';
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
  else if(request.url.endsWith('/rest/v1/rpc/is_admin'))body='true';
  else if(request.url.endsWith('/rest/v1/rpc/admin_action')){
   const data=JSON.parse(request.postData);if(data.p_action==='list')adminLists++;
   let slotTime='14:00';if(data.p_action==='slots'&&slotRace){const order=slotRace++;slotTime=order===1?'15:00':'16:00';await new Promise(r=>setTimeout(r,order===1?150:10));}
   body=JSON.stringify(data.p_action==='slots'?{slots:[{date:day,time:slotTime}]}:{appointments:[],services:catalog,availability:[{weekday:1,opens:'09:00:00',closes:'18:00:00',active:true}],blocks:[]});
  }
  try{if(body!==undefined)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')});else await call('Fetch.continueRequest',{requestId});}catch(e){errors.push(e.message);}
 }
};
await call('Runtime.discardConsoleEntries');await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function wait(expression){const end=Date.now()+10000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timeout: '+expression+' '+JSON.stringify(await evaluate('({config:window.NN_CONFIG,status:document.getElementById("connectionStatus")?.textContent})'))+' '+errors.join('\n'));}
async function navigate(page){const url='http://127.0.0.1:4173/'+page+'?qa='+Date.now();await call('Page.navigate',{url});await wait('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');}
async function viewport(width,height=852){await call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:width<800});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
try{
 await viewport(375);await navigate('index.html');await wait('document.querySelectorAll("#bookingServices button").length===5');
 assert.match(await evaluate('document.getElementById("connectionStatus").textContent'),/configuração/);
 assert.equal(await evaluate('[...document.querySelectorAll("#bookingServices button")].every(b=>b.disabled)'),true);
 console.log('PASS disconnected state never offers a fake reservation');

 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero img')).animationName`),'nn-intro-photo');
 await wait(`document.querySelector('.hero img').getAnimations().every(a=>a.playState==='finished')`);
 await evaluate('window.heroAnimation=document.querySelector(".hero img").getAnimations()[0];window.scrollTo(0,1200);window.scrollTo(0,0)');
 assert.equal(await evaluate('window.heroAnimation===document.querySelector(".hero img").getAnimations()[0]&&window.heroAnimation.playState==="finished"'),true);
 assert.equal(await evaluate('document.querySelectorAll("#bookingCourses button").length'),2);
 await evaluate('window.coursePopups=[];window.open=(...args)=>window.coursePopups.push(args)');
 for(const [key,title,price,days] of [['completo','Curso completo','R$ 300,00','3 DIAS'],['tradicional','Curso tradicional','R$ 200,00','2 DIAS']]){
  await evaluate(`document.querySelector('#bookingCourses button:nth-child(${key==='completo'?1:2})').focus();document.activeElement.click()`);
  assert.equal(await evaluate('document.getElementById("courseModal").hidden'),false);
  assert.equal(await evaluate('document.getElementById("modalTitle").textContent'),title);
  assert.equal(await evaluate('document.getElementById("modalPrice").textContent'),price);
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#modalList li")].map(li=>li.textContent)'),key==='completo'?['Molde F1','Esmaltação em gel','Soft Gel','Orientação presencial na loja indicada para os materiais necessários']:['Primeiro dia: teoria e café','Segundo dia: prática em modelo e café','Esmaltação tradicional sem alongamento','Diferenças entre esmaltação em gel, blindagem e banho de gel']);
  assert.equal(await evaluate('document.getElementById("modalPayment").textContent'),key==='completo'?'Até 2× de R$ 150,00 sem juros':'À vista ou em até 2 parcelas com juros (taxa e total a confirmar)');
  assert.ok((await evaluate('document.getElementById("bookingCourses").textContent')).includes(days));
  assert.equal(await evaluate('document.getElementById("panel1").classList.contains("active")'),true);
  assert.equal(bookings,0);
  await evaluate('document.getElementById("interestButton").click()');
  const args=await evaluate('window.coursePopups.at(-1)');
  const link=new URL(args[0]);assert.equal(link.origin+link.pathname,'https://wa.me/554491712430');
  assert.equal(link.searchParams.get('text'),`Olá! Tenho interesse no ${title} da NandaNails (${price}). Gostaria de receber mais informações sobre as próximas turmas, datas, horários, conteúdo do curso e formas de pagamento.`);
  assert.deepEqual(args.slice(1),['_blank','noopener,noreferrer']);
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('document.activeElement.id'),'backModal');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('document.activeElement.id'),'closeModal');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  await wait('document.getElementById("courseModal").hidden');
  assert.equal(await evaluate('document.activeElement.closest("#bookingCourses")!==null'),true);
 }
 mkdirSync('.local/courses',{recursive:true});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const width of [320,375,390,430,768,1024,1440]){
  await viewport(width);await navigate('index.html');await wait('document.querySelectorAll("#bookingCourses button").length===2');
  assert.equal(await evaluate('innerWidth'),width);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.desktop-nav a')].map(a=>a.getAttribute('href'))`),['#sobre','#cursos','#servicos','#galeria']);
  assert.equal(await evaluate(`(()=>{const props=['backgroundImage','borderRadius','fontSize','fontWeight','minHeight','padding','gap','transition'];const [a,b]=[...document.querySelectorAll('#cursos [data-course]')].map(x=>getComputedStyle(x));return props.every(p=>a[p]===b[p])&&a.backgroundImage.includes('linear-gradient')})()`),true,`Matching pink buttons ${width}`);
  assert.equal(await evaluate(`document.querySelector('.hero img').getAnimations().length===0`),true,'Reduced motion disables entrance');
  assert.deepEqual(await evaluate(`[...document.querySelector('main').children].map(s=>s.id||s.className)`),['hero','sobre','agendar','cursos','servicos','galeria','section closing']);
  assert.equal(await evaluate('document.querySelectorAll(".hero").length===1&&document.querySelectorAll("#agendar").length===1'),true);
  assert.equal(await evaluate(`(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),strip=document.querySelector('.intro-strip').getBoundingClientRect(),booking=document.querySelector('#agendar').getBoundingClientRect();return hero.top>=document.querySelector('header').getBoundingClientRect().bottom&&strip.top>=hero.bottom&&booking.top>=strip.bottom})()`),true,`Section positions ${width}`);
  assert.equal(await evaluate(`(()=>{const text=document.querySelector('.hero-text').getBoundingClientRect(),photo=document.querySelector('.hero-visual').getBoundingClientRect(),title=document.querySelector('.hero h1'),label=document.querySelector('.hero-image-label').getBoundingClientRect(),img=document.querySelector('.hero-visual img');return (innerWidth<=650?photo.top>=text.bottom:photo.left>=text.right)&&label.top>=photo.top&&label.bottom<=photo.bottom&&title.scrollWidth<=title.clientWidth&&img.getAttribute('src')==='assets/8db060d1d75da3c0.jpg'&&img.fetchPriority==='high'&&img.loading!=='lazy'&&getComputedStyle(img).objectFit==='cover'})()`),true,`Hero layout and original priority photo ${width}`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.hero a,.top-cta')].map(a=>a.getAttribute('href'))`),['#agendar','#agendar','#cursos','#galeria']);
  for(const selector of ['.hero a[href="#agendar"]','.hero a[href="#cursos"]','.hero a[href="#galeria"]','.top-cta','.desktop-nav a[href="#cursos"]','.desktop-nav a[href="#galeria"]','.desktop-nav a[href="#servicos"]','.desktop-nav a[href="#sobre"]']){
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
   await wait(`location.hash===document.querySelector(${JSON.stringify(selector)}).getAttribute('href')`);
   assert.ok(await evaluate(`(()=>{const r=document.querySelector(location.hash).getBoundingClientRect(),h=document.querySelector('header'),fixed=['fixed','sticky'].includes(getComputedStyle(h).position);return r.top>=(fixed?h.getBoundingClientRect().bottom:0)&&r.top<innerHeight})()`),`Anchor destination visible ${selector} ${width}`);
  }
  await evaluate('document.querySelector(".brand").click()');
  await wait('scrollY===0');
  mkdirSync('.local/home-order',{recursive:true});
  const heroShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/home-order/hero-${width}.png`,Buffer.from(heroShot.data,'base64'));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Course page overflow ${width}`);
  assert.equal(await evaluate(`(()=>{const [a,b]=[...document.querySelectorAll('.course-hero-actions a')].map(x=>x.getBoundingClientRect());const c=document.querySelector('.hero-courses').getBoundingClientRect();return Math.abs(a.top-b.top)<1&&c.top>=a.bottom&&[...document.querySelectorAll('.course-hero-actions a')].every(x=>x.scrollWidth<=x.clientWidth)})()`),true,`Hero actions ${width}`);
  for(const key of ['completo','tradicional']){
   await evaluate(`document.querySelector('[data-course="${key}"]').click()`);
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Modal overflow ${width}`);
   assert.ok(await evaluate('document.querySelector(".modal-card").scrollWidth<=document.querySelector(".modal-card").clientWidth'),`Modal text overflow ${width}`);
   assert.ok(await evaluate('document.querySelector(".modal-card").getBoundingClientRect().bottom<=innerHeight'),`Modal fits ${width}`);
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.local/courses/${key}-${width}.png`,Buffer.from(shot.data,'base64'));
   await evaluate('document.getElementById("backModal").click()');
   await wait('document.getElementById("courseModal").hidden');
  }
 }
 await call('Emulation.setEmulatedMedia',{features:[]});
 for(const id of ['closeModal','backModal','courseModal','Escape']){
  await evaluate('document.querySelector("[data-course=completo]").click()');
  await evaluate('new Promise(r=>setTimeout(r,380))');
  if(id==='Escape')await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  else await evaluate(`document.getElementById('${id}').click()`);
  assert.equal(await evaluate('!document.getElementById("courseModal").hidden&&document.querySelector("main").inert&&document.body.style.overflow==="hidden"'),true);
  assert.equal(await evaluate('document.querySelector("#courseModal .modal-card").getAnimations().some(a=>a.animationName==="nnModalClose")'),true);
  await evaluate('document.getElementById("backModal").click();document.querySelector("[data-course=tradicional]").click()');
  assert.equal(await evaluate('document.getElementById("modalTitle").textContent'), 'Curso completo');
  await wait('document.getElementById("courseModal").hidden');
 }
 assert.equal(await evaluate('document.body.style.overflow'), '');
 assert.equal(await evaluate('document.querySelector("main").inert'),false);
 console.log('PASS independent offline courses, prices, durations, WhatsApp messages, Escape/back/close/backdrop, focus trap/return, seven widths and hero button rows');

 mock=true;await navigate('index.html');await wait('window.NN?.serverToday');
 for(const width of [320,375,390,430,768,1024,1440]){
  await viewport(width);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Horizontal overflow at ${width}`);
  assert.equal(await evaluate(`document.querySelectorAll('a[href*="admin"],.admin-link,script[src*="admin"]').length`),0);
  assert.equal(await evaluate('document.body.textContent.includes("\u00c1rea da Nanda")'),false);
  assert.equal(await evaluate('document.querySelector("footer").children.length'),2);
  assert.ok(await evaluate('(()=>{const [brand,copy]=[...document.querySelector("footer").children].map(x=>x.getBoundingClientRect());return brand.left>=0&&copy.right<=innerWidth&&(innerWidth<=650?copy.top>=brand.bottom:Math.abs((brand.top+brand.bottom-copy.top-copy.bottom)/2)<1)})()'),`Footer alignment ${width}`);
 }
 console.log('PASS public page without administrative links, footer alignment and seven responsive widths');
 for(const [i,service] of catalog.entries()){
  await evaluate(`document.querySelectorAll('#bookingServices button')[${i}].click()`);await wait('document.querySelector(".cal-day.open")');
  await evaluate('document.querySelector(".cal-day.open").click()');await wait('document.querySelector("#timeGrid button")');
  await evaluate('document.querySelector("#timeGrid button").click()');
  assert.match(await evaluate('document.getElementById("bookingSummary").textContent'),new RegExp(service.duration_minutes+' minutos'));
  assert.ok((await evaluate('document.getElementById("bookingSummary").textContent')).includes(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(service.price_cents/100)));
  await evaluate('document.querySelector("#panel4 [data-back]").click()');await wait('document.querySelector("#timeGrid button")');
  await evaluate('document.querySelector("#panel3 [data-back]").click()');await wait('document.querySelector(".cal-day.open")');
  await evaluate('document.querySelector("#panel2 [data-back]").click()');
 }
 availabilityFails=true;await evaluate('document.querySelector("#bookingServices button").click()');
 await wait('document.getElementById("calendarDays").getAttribute("aria-busy")==="false"');
 assert.match(await evaluate('document.getElementById("calendarDays").textContent'),/Não foi possível/);
 availabilityFails=false;await evaluate('document.querySelector("#panel2 [data-back]").click()');
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
 await evaluate('window.firstGalleryImage=document.querySelector(".gallery-item img");document.getElementById("galleryMore").click()');assert.equal(await evaluate('document.querySelectorAll(".gallery-item").length'),10);
 assert.equal(await evaluate('window.firstGalleryImage===document.querySelector(".gallery-item img")'),true);
 await evaluate('document.querySelector(".gallery-item").click()');assert.equal(await evaluate('document.getElementById("lightbox").hidden'),false);
 const firstSrc=await evaluate('document.getElementById("lightboxImage").src');
 await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');assert.notEqual(await evaluate('document.getElementById("lightboxImage").src'),firstSrc);
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await evaluate('document.querySelector(".nn-lb-nav.next").click()');assert.equal(await evaluate('document.getElementById("lightboxImage").getAnimations().some(a=>a.playState==="running")'),false);
 await call('Emulation.setEmulatedMedia',{features:[]});
 await evaluate('document.getElementById("closeLightbox").click()');
 await evaluate('Promise.all([...document.querySelectorAll(".gallery-item img")].map(img=>{img.loading="eager";return img.decode()}))');
 assert.equal(await evaluate('[...document.querySelectorAll(".gallery-item img")].every(img=>img.complete&&img.naturalWidth>0)'),true);
 mkdirSync('.local/screenshots',{recursive:true});await viewport(393);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('.local/screenshots/mobile.png',Buffer.from(shot.data,'base64'));
 await navigate('admin.html');await evaluate('document.getElementById("email").value="test@example.invalid";document.getElementById("password").value="mock-password";document.getElementById("loginForm").requestSubmit()');await wait('!document.getElementById("workspace").hidden');await wait('document.querySelectorAll("#stats .admin-stat").length===6');
 await wait('document.getElementById("adminStatus").textContent==="Agenda atualizada."');
 const listsBefore=adminLists;
 await evaluate('document.getElementById("agendaView").value="week";document.getElementById("agendaView").dispatchEvent(new Event("change"))');
 await wait('document.getElementById("adminStatus").textContent==="Agenda atualizada."');assert.equal(adminLists-listsBefore,0);
 slotRace=1;await evaluate('document.getElementById("slotService").dispatchEvent(new Event("change"));document.getElementById("slotService").dispatchEvent(new Event("change"))');
 await wait('document.getElementById("slots").textContent.includes("16:00")');await evaluate('new Promise(r=>setTimeout(r,220))');
 assert.ok(!(await evaluate('document.getElementById("slots").textContent')).includes('15:00'));slotRace=0;
 await evaluate('document.querySelector("[data-page=agenda]").click()');
 for(const width of [320,375,390,430,768,1024,1440]){await viewport(width);for(const tab of ['agenda','services','hours','blocks']){await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Admin overflow ${width} ${tab}`);}}
 await evaluate('document.getElementById("logout").click()');assert.equal(await evaluate('document.getElementById("workspace").hidden'),true);
 assert.deepEqual(errors,[]);console.log('PASS gallery, admin login/logout (mock), six indicators, seven widths on all tabs, zero JS exceptions');
 console.log('Browser QA passed. Chromium emulation does not validate real iOS Safari.');
}finally{await call('Page.navigate',{url:'about:blank'});await call('Fetch.disable');ws.close();}
