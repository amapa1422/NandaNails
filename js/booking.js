
(()=>{'use strict';
const L=window.Lumiere,by=id=>document.getElementById(id),cfg=()=>L.getConfig();
let serviceId='',date='',time='',month=L.dayFromKey((L.serverToday||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())).slice(0,7)+'-01'),stage=1;
const allPhotos=["assets/479393e9cb86bde5.jpg", "assets/6c4c9fbb901a262f.jpg", "assets/f729aae6daed3b2f.jpg", "assets/6302e80d435a8012.jpg", "assets/2f6e8e69b1a5c70f.jpg", "assets/55cf3867307e8da8.jpg", "assets/848a38ffed5390f8.jpg", "assets/3d5fd52cda10621c.jpg", "assets/8db060d1d75da3c0.jpg", "assets/3dd50a15712d7441.jpg"];
function renderServices(){const services=cfg().services.filter(s=>s.active),cards=document.createDocumentFragment(),choices=document.createDocumentFragment();services.forEach((s,i)=>{
 const card=document.createElement('article');card.className='service-card';card.innerHTML=`<span class="service-num">0${i+1} / <svg class="nn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7c-2-6-7-4-5 1-5-2-7 3-1 5-5 2-2 7 3 5 2 5 7 2 5-3 6 1 7-5 1-6 2-5-3-7-5-2Z"/><circle cx="12" cy="12" r="2"/></svg></span><h3>${L.escape(s.name)}</h3><p>${L.escape(s.description)}</p><div class="service-bottom"><span>${L.formatPrice(s.price)}</span><span><svg class="nn-icon nn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></span></div>`;
 card.addEventListener('click',()=>selectService(s.id));card.style.cursor='pointer';cards.append(card);
 const button=document.createElement('button');button.type='button';button.className='choice';button.innerHTML=`<span class="choice-icon"><svg class="nn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="18" rx="4"/><path d="M8 10h8"/></svg></span><span class="choice-main"><strong>${L.escape(s.name)}</strong><small>${L.escape(s.minutes)} min · ${L.formatPrice(s.price)}</small></span><span class="choice-arrow"><svg class="nn-icon nn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>`;
 button.dataset.id=s.id;button.addEventListener('click',()=>selectService(s.id));choices.append(button);
 });
 by('servicesGrid').replaceChildren(cards);by('bookingServices').replaceChildren(choices);
 if(!services.length){by('bookingServices').textContent='A profissional ainda não cadastrou serviços.';by('servicesGrid').textContent='Serviços em atualização.';}
}
function selectService(id){if(!L.configured||!L.serverToday){window.nnNotice('Agenda online indisponível no momento.');return;}serviceId=id;date='';time='';month=L.dayFromKey((L.serverToday||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())).slice(0,7)+'-01');showStage(2);by('agendar').scrollIntoView({behavior:'smooth',block:'start'});}
function showStage(n){stage=n;document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===(n===5?'panelSuccess':`panel${n}`)));document.querySelectorAll('.step').forEach(s=>{const v=Number(s.dataset.step);s.classList.toggle('active',v===n);s.classList.toggle('done',v<n)});if(n===2)renderCalendar();if(n===3)renderTimes();if(n===4)renderSummary();window.nnStage&&window.nnStage(n,{serviceId,date,time});}
let availabilityVersion=0;
async function renderCalendar(){
 const version=++availabilityVersion, selectedService=serviceId;
 by('monthLabel').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(month);
 const today=L.serverToday;
 by('prevMonth').disabled=!today||L.dayKey(month).slice(0,7)<=today.slice(0,7);
 const max=L.dayFromKey(today||L.dayKey(month));max.setDate(max.getDate()+90);
 by('nextMonth').disabled=L.dayKey(month).slice(0,7)>=L.dayKey(max).slice(0,7);
 const host=by('calendarDays');host.textContent='Consultando agenda…';host.setAttribute('aria-busy','true');
 try {
  const from=L.dayKey(month),end=new Date(month.getFullYear(),month.getMonth()+1,0,12);
  const data=await L.availability(selectedService,from,L.dayKey(end));
  if(version!==availabilityVersion||stage!==2)return;
  const days=document.createDocumentFragment(),openDates=new Set(data.slots.map(s=>s.date));
  for(let i=0;i<month.getDay();i++){const blank=document.createElement('span');blank.className='cal-day blank';days.append(blank);}
  for(let d=1;d<=end.getDate();d++){
   const key=L.dayKey(new Date(month.getFullYear(),month.getMonth(),d,12)),open=openDates.has(key),b=document.createElement('button');
   b.type='button';b.className='cal-day'+(open?' open dot':'')+(key===date?' selected':'')+(key===today?' today':'');b.textContent=d;b.disabled=!open;
   b.title=(open?'Ver horários de ':'Indisponível: ')+L.displayDate(key);b.setAttribute('aria-label',b.title);
   b.onclick=()=>{date=key;time='';showStage(3);};days.append(b);
  }
  host.replaceChildren(days);
 }catch(e){if(version===availabilityVersion){host.textContent='Não foi possível consultar a agenda.';window.nnNotice(e.message);}}
 finally{if(version===availabilityVersion)host.setAttribute('aria-busy','false');}
}
async function renderTimes(){
 const version=++availabilityVersion,requestedDate=date;
 by('timeHeading').textContent=L.displayDate(date,{weekday:'long',day:'numeric',month:'long'});
 const host=by('timeGrid');host.textContent='Atualizando horários…';host.setAttribute('aria-busy','true');
 try{
  const data=await L.availability(serviceId,requestedDate);
  if(version!==availabilityVersion||stage!==3)return;
  host.replaceChildren();
  if(!data.slots.length){host.textContent='Este dia ficou sem horários. Volte e escolha outra data.';return;}
  const times=document.createDocumentFragment();
  for(const slot of data.slots){const b=document.createElement('button');b.className='time';b.type='button';b.textContent=slot.time;b.onclick=()=>{time=slot.time;showStage(4);};times.append(b);}
  host.replaceChildren(times);
 }catch(e){if(version===availabilityVersion)host.textContent='Não foi possível atualizar os horários. Volte e tente novamente.';}
 finally{if(version===availabilityVersion)host.setAttribute('aria-busy','false');}
}
function summarize(id,booking){const s=cfg().services.find(x=>x.id===booking.serviceId);by(id).innerHTML=`<div><span>Procedimento</span><span>${L.escape(s?.name||'')}</span></div><div><span>Data</span><span>${L.escape(L.displayDate(booking.date))}</span></div><div><span>Horário</span><span>${L.escape(booking.time)}</span></div><div><span>Duração</span><span>${L.escape(s?.minutes||60)} minutos</span></div><div><span>Valor</span><span>${L.formatPrice(s?.price)}</span></div>`;}
function renderSummary(){summarize('bookingSummary',{serviceId,date,time})}
let submitting=false,requestId='',requestPayload='';
by('bookingForm').addEventListener('submit',async e=>{
 e.preventDefault();if(submitting)return;
 const name=by('clientName').value.trim(),phone=by('clientPhone').value.replace(/\D/g,'');
 if(!/^[^\d\s]+(?:\s+[^\d\s]+)+$/u.test(name)||name.length>80||!/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(phone)){window.nnNotice('Confira seu nome completo e WhatsApp com DDD.');return;}
 const service=cfg().services.find(s=>s.id===serviceId&&s.active);if(!service){window.nnNotice('Escolha novamente um serviço disponível.');return;}
 const payload=JSON.stringify({serviceId,date,time,name,phone,expectedPriceCents:Math.round(service.price*100),expectedDuration:service.minutes});
 if(payload!==requestPayload){requestId=crypto.randomUUID();requestPayload=payload;}
 submitting=true;const button=by('bookingForm').querySelector('[type=submit]');button.disabled=true;button.textContent='Registrando…';
 try{
  const result=await L.book({...JSON.parse(payload),requestId});
  if(!result?.booking?.id)throw new Error('O banco não confirmou a reserva. Tente novamente.');
  if(result.booking.status==='cancelled')throw new Error('Esta reserva foi cancelada. Escolha outro horário.');
  const booking=result.booking;
  summarize('successSummary',{serviceId,date,time});
  const summary=by('successSummary');summary.replaceChildren();
  for(const [label,value] of [['Procedimento',booking.service_name],['Data',L.displayDate(booking.date)],['Horário',booking.time],['Duração',booking.duration_minutes+' minutos'],['Valor',L.formatPrice(booking.price_cents/100)],['Reserva',booking.id]]){const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('span');a.textContent=label;b.textContent=value;row.append(a,b);summary.append(row);}
  showStage(5);by('bookingForm').reset();requestId='';requestPayload='';
 }catch(error){window.nnNotice(error.message);if(error.status===409){requestId='';requestPayload='';try{await L.loadCatalog();renderServices();}catch{}showStage(3);}}
 finally{submitting=false;button.disabled=false;button.textContent='Confirmar horário';}
});
by('anotherBooking').addEventListener('click',()=>{serviceId='';date='';time='';showStage(1)});document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showStage(Number(b.dataset.back)));by('prevMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderCalendar()};by('nextMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderCalendar()};
const gallery=by('galleryGrid');function renderGallery(showAll=false){const start=gallery.children.length,photos=document.createDocumentFragment();allPhotos.slice(start,showAll?allPhotos.length:8).forEach((src,index)=>{const i=start+index;const b=document.createElement('button');b.className='gallery-item';b.type='button';b.setAttribute('aria-label','Ampliar foto '+(i+1));const img=document.createElement('img');img.src=src;img.alt='Inspiração de unhas '+(i+1);img.loading='lazy';img.decoding='async';b.append(img);b.onclick=()=>{by('lightboxImage').src=src;by('lightbox').hidden=false;document.body.style.overflow='hidden'};photos.append(b)});gallery.append(photos);by('galleryMore').hidden=showAll;}
function closeLightbox(){by('lightbox').hidden=true;document.body.style.overflow=''}by('galleryMore').onclick=()=>renderGallery(true);by('closeLightbox').onclick=closeLightbox;by('lightbox').addEventListener('click',e=>{if(e.target===by('lightbox'))closeLightbox()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()});
renderServices();renderGallery();
const status=by('connectionStatus');
if(!L.configured){status.textContent='Agendamento online em configuração.';document.querySelectorAll('#bookingServices button,.service-card').forEach(b=>{b.setAttribute('aria-disabled','true');if(b.tagName==='BUTTON')b.disabled=true;});}
else{status.textContent='Conectando à agenda…';L.loadCatalog().then(()=>{status.textContent='';renderServices();}).catch(()=>{status.textContent='Agenda indisponível. Tente novamente em instantes.';document.querySelectorAll('#bookingServices button').forEach(b=>b.disabled=true);});}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&L.configured){if(stage===2)renderCalendar();if(stage===3)renderTimes();}});
})();

