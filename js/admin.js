(() => {
 'use strict';
 const $=id=>document.getElementById(id),c=window.NN_CONFIG;
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const dateTime=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));
 const labels={confirmed:'Confirmado',cancelled:'Cancelado',completed:'Concluído'};
 let token='',refreshToken='',timer,cache,loading=0;
 function notice(m){$('adminStatus').textContent=m;}
 async function http(path,body,auth=token){
  const r=await fetch(c.supabaseUrl+path,{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const data=await r.json();
  if(!r.ok){if(r.status===401)logout();throw new Error(data.message?.includes('SLOT_CONFLICT')||data.code==='23P01'?'Esse horário está ocupado. Escolha outro.':data.message?.includes('FORBIDDEN')?'Usuária sem autorização administrativa.':data.message?.includes('NOT_FINISHED')?'Aguarde o término do atendimento.':data.message?.includes('CANCELLED_BOOKING')?'Agendamentos cancelados não podem ser reativados.':data.message?.includes('HOURS_WITHOUT_ALLOWED_START')?'Nos dias úteis, cada turno ativo precisa incluir um início às 15h ou 16h.':data.message?.includes('INVALID_HOURS')?'Confira os turnos antes de salvar.':data.message?.includes('OVERLAPPING_HOURS')?'Há turnos sobrepostos. Confira os horários.':'Não foi possível completar a operação. Confira os dados e tente novamente.');}
  return data;
 }
 const rpc=(action,data={})=>http('/rest/v1/rpc/admin_action',{p_action:action,p_data:data});
 function setSession(s){token=s.access_token;refreshToken=s.refresh_token;clearTimeout(timer);timer=setTimeout(async()=>{try{setSession(await http('/auth/v1/token?grant_type=refresh_token',{refresh_token:refreshToken},''));}catch{logout();notice('Sua sessão expirou. Entre novamente.');}},Math.max(10000,(s.expires_in-60)*1000));}
 function logout(){const old=token;token='';refreshToken='';clearTimeout(timer);loading++;cache=null;$('workspace').hidden=true;$('loginPanel').hidden=false;$('logout').hidden=true;$('password').value='';if(old)http('/auth/v1/logout',{},old).catch(()=>{});}
 $('logout').onclick=logout;
 $('loginForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter||$('loginForm').querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{
  if(!c.supabaseUrl||!c.publishableKey)throw new Error('Configure o projeto Supabase em js/config.js.');
  setSession(await http('/auth/v1/token?grant_type=password',{email:$('email').value.trim(),password:$('password').value},''));
  if(!await http('/rest/v1/rpc/is_admin',{})){logout();throw new Error('Usuária sem autorização administrativa.');}
  $('password').value='';$('loginPanel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;await load();
 }catch(err){notice(err.message);}finally{b.disabled=false;}};
 function range(){const d=new Date($('agendaDate').value+'T12:00:00');let start=new Date(d),end=new Date(d);if($('agendaView').value==='week'){start.setDate(d.getDate()-((d.getDay()+6)%7));end=new Date(start);end.setDate(end.getDate()+7);}else if($('agendaView').value==='month'){start.setDate(1);end=new Date(start);end.setMonth(end.getMonth()+1);}else end.setDate(end.getDate()+1);return {from:key(start)+'T00:00:00-03:00',to:key(end)+'T00:00:00-03:00'};}
 async function load(){const version=++loading;notice('Atualizando…');try{const data=await rpc('list',range());if(version!==loading||!token)return;cache=data;render();await loadSlots();notice('Agenda atualizada.');}catch(e){notice(e.message);}}
 async function mutate(action,data,button){if(button)button.disabled=true;try{await rpc(action,data);await load();notice('Alterações salvas.');return true;}catch(e){notice(e.message);return false;}finally{if(button)button.disabled=false;}}
 function render(){
  const selected=$('slotService').value;
  $('slotService').innerHTML=cache.services.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');if(selected)$('slotService').value=selected;
  $('appointments').replaceChildren();
  for(const a of cache.appointments){const card=document.createElement('article');card.className='admin-card admin-booking';card.innerHTML=`<div><strong>${esc(dateTime(a.starts_at))} · ${esc(a.client_name)}</strong><small>${esc(a.service_name)} · ${a.duration_minutes} min · ${money(a.price_cents)}<br>${labels[a.status]} · <a href="https://wa.me/${esc(a.phone)}" rel="noopener noreferrer" target="_blank">${esc(a.phone)}</a></small></div><div class="actions"></div>`;
   const actions=card.querySelector('.actions');
   for(const [status,label] of [['confirmed','Confirmar'],['cancelled','Cancelar'],['completed','Concluir']]){if(a.status==='cancelled'||a.status===status)continue;const b=document.createElement('button');b.className='tiny-action';b.textContent=label;b.onclick=()=>mutate('status',{id:a.id,status},b);actions.append(b);}
   if(a.status==='confirmed'){const b=document.createElement('button');b.className='tiny-action';b.textContent='Remarcar';b.onclick=()=>{const f=$('rescheduleForm');f.elements.id.value=a.id;f.elements.date.value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a.starts_at));f.elements.time.value=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at));$('rescheduleDialog').showModal();};actions.append(b);}
   $('appointments').append(card);
  }
  if(!cache.appointments.length)$('appointments').textContent='Nenhum atendimento neste período.';
  $('serviceForms').innerHTML=cache.services.map(s=>`<form class="admin-card admin-form" data-service="${esc(s.id)}"><label class="wide">Serviço<input name="name" maxlength="100" value="${esc(s.name)}" required></label><label class="wide">Descrição<input name="description" value="${esc(s.description)}"></label><label>Duração (min)<input name="duration_minutes" type="number" min="15" max="480" step="15" value="${s.duration_minutes}" required></label><label>Preço (R$)<input name="price" type="text" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${(s.price_cents/100).toFixed(2).replace('.',',')}" required></label><label>Disponível<input name="active" type="checkbox" ${s.active?'checked':''}></label><button class="btn primary" type="submit">Salvar serviço</button></form>`).join('');
  $('hourRows').replaceChildren();cache.availability.forEach(addHour);
  $('blockList').replaceChildren();for(const block of cache.blocks){const row=document.createElement('article');row.className='admin-card';row.innerHTML=`<p>${esc(dateTime(block.starts_at))} → ${esc(dateTime(block.ends_at))}</p><p>${esc(block.reason)}</p>`;const b=document.createElement('button');b.className='tiny-action';b.textContent='Remover bloqueio';b.onclick=()=>mutate('unblock',{id:block.id},b);row.append(b);$('blockList').append(row);}
  loadStats();
 }
 async function loadStats(){const session=token,t=today(),nowDate=new Date(t+'T12:00:00'),start=new Date(nowDate);start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+7);
  try{const data=await rpc('list',{from:key(start)+'T00:00:00-03:00',to:key(end)+'T00:00:00-03:00'});if(token!==session)return;
   const all=data.appointments,active=all.filter(a=>a.status!=='cancelled');const vals=[['Hoje',active.filter(a=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a.starts_at))===t).length],['Na semana',active.length],['Próximos na semana',active.filter(a=>new Date(a.starts_at)>new Date()).length],['Cancelamentos na semana',all.filter(a=>a.status==='cancelled').length],['Concluídos na semana',all.filter(a=>a.status==='completed').length],['Faturamento estimado na semana',money(all.filter(a=>a.status==='completed').reduce((sum,a)=>sum+a.price_cents,0))]];
   $('stats').innerHTML=vals.map(([l,v])=>`<div class="admin-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join('');
  }catch{notice('Não foi possível atualizar os indicadores.');}
 }
 async function loadSlots(){if(!$('slotService').value)return;const date=$('agendaDate').value,serviceId=$('slotService').value,session=token;const data=await rpc('slots',{date,serviceId});if(session!==token||date!==$('agendaDate').value||serviceId!==$('slotService').value)return;$('slots').innerHTML='<p class="admin-small wide">Horários disponíveis em '+esc(date)+'</p>'+data.slots.map(s=>`<span class="slot-label">${esc(s.time)}</span>`).join('');}
 function addHour(h={weekday:1,opens:'09:00',closes:'18:00',active:true}){const row=document.createElement('div');row.className='admin-form hour-row';row.innerHTML=`<label>Dia<select name="weekday">${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((v,i)=>`<option value="${i}" ${i===h.weekday?'selected':''}>${v}</option>`).join('')}</select></label><label>Abertura<input name="opens" type="time" required value="${esc(h.opens.slice(0,5))}"></label><label>Encerramento<input name="closes" type="time" required value="${esc(h.closes.slice(0,5))}"></label><label>Ativo<input name="active" type="checkbox" ${h.active?'checked':''}></label><button class="tiny-action" type="button">Remover turno</button>`;row.querySelector('button').onclick=()=>row.remove();$('hourRows').append(row);}
 $('addHours').onclick=()=>addHour();
 $('hoursForm').onsubmit=e=>{e.preventDefault();const hours=[...$('hourRows').children].map(row=>({weekday:Number(row.querySelector('[name=weekday]').value),opens:row.querySelector('[name=opens]').value,closes:row.querySelector('[name=closes]').value,active:row.querySelector('[name=active]').checked}));mutate('hours',{hours},e.submitter);};
 $('serviceForms').onsubmit=e=>{e.preventDefault();const f=e.target,v=f.elements,parts=v.price.value.replace(',','.').split('.');const cents=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));mutate('service',{id:f.dataset.service,name:v.name.value,description:v.description.value,duration_minutes:Number(v.duration_minutes.value),price_cents:cents,active:v.active.checked},e.submitter);};
 $('blockForm').onsubmit=async e=>{e.preventDefault();const v=e.target.elements;await mutate('block',{starts_at:v.fromDate.value+'T'+v.fromTime.value+':00-03:00',ends_at:v.toDate.value+'T'+v.toTime.value+':00-03:00',reason:v.reason.value},e.submitter);};
 $('rescheduleForm').onsubmit=async e=>{e.preventDefault();const v=e.target.elements;if(await mutate('reschedule',{id:v.id.value,date:v.date.value,time:v.time.value},e.submitter))$('rescheduleDialog').close();};$('closeReschedule').onclick=()=>$('rescheduleDialog').close();
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.admin-panel').forEach(p=>p.classList.toggle('active',p.id===b.dataset.tab));});
 $('agendaDate').value=today();$('agendaDate').onchange=load;$('agendaView').onchange=load;$('slotService').onchange=()=>loadSlots().catch(e=>notice(e.message));$('refresh').onclick=load;
})();
