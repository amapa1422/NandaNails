/* Approved notification-center presentation, backed only by admin RPCs. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const labels={pending:'Pendente',sending:'Em processamento',accepted:'Aceito pelo provedor',failed:'Falhou',expired:'Expirou',unknown:'Resultado desconhecido'};
 const colors={pending:'#d9ac7f',sending:'#d9ac7f',accepted:'#89bd9e',failed:'#d27591',expired:'#d27591',unknown:'#b49bad'};
 const format=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const day=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'long',year:'numeric'});
 const stamp=value=>format.format(new Date(value));
 let rpc=null,openBooking=null,generation=0,revision=0,filter='all',page='dashboard',data=null,cursor=null,previous=[],poll=null,busy=false,renderedSelection='';
 const frames=new Map();
 const params=()=>({filter,period:$('nnPeriod').value,...cursor});
 function say(message){$('nnFeedback').textContent=message;}
 function closePop(focus=false){const wasOpen=!$('nnPopover').hidden;$('nnPopover').hidden=true;$('nnBell').setAttribute('aria-expanded','false');if(wasOpen&&focus)$('nnBell').focus();}
 function count(id,target){
  const e=$(id);if(e.dataset.count===String(target))return;cancelAnimationFrame(frames.get(id));const from=Number(e.dataset.count||0);e.dataset.count=target;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){e.textContent=target;return;}
  const start=performance.now();const tick=t=>{const p=Math.min(1,(t-start)/540);e.textContent=Math.round(from+(target-from)*(1-(1-p)**3));if(p<1)frames.set(id,requestAnimationFrame(tick));else frames.delete(id);};frames.set(id,requestAnimationFrame(tick));
 }
 function badges(n){
  const box=node('div','nn-item-details');
  for(const [state,label] of Object.entries(labels))if(n.push[state])box.append(node('span','nn-pill '+(['failed','expired','unknown'].includes(state)?'fail':state==='accepted'?'ok':'wait'),`${label} · ${n.push[state]}`));
  if(!Object.keys(n.push).length)box.append(node('span','nn-pill','Sem registro de envio Push'));
  box.append(node('span','nn-pill',n.read_at?'✓ Visualizada':'● Não visualizada'));return box;
 }
 async function write(action,p,button){
  if(!rpc||busy)return false;const version=generation;busy=true;revision++;if(button)button.disabled=true;$('nnMarkAll').disabled=true;
  try{const answer=await rpc(action,p);if(version!==generation)return false;cursor=null;previous=[];await refresh();if(version!==generation)return false;say(action==='read_filter'?`${answer.changed} avisos do filtro marcados como lidos.`:'Situação de leitura atualizada.');return true;}
  catch(e){if(version===generation)say(e.message);return false;}
  finally{if(version===generation){busy=false;$('nnMarkAll').disabled=!data;if(button)button.disabled=false;}}
 }
 async function open(n,button){
  if(!rpc||busy)return;const version=generation;button.disabled=true;
  try{await openBooking(n.id);if(version!==generation)return;closePop();if(!n.read_at)await write('read',{id:n.id,read:true});}
  catch(e){if(version===generation)say(e.message);}
  finally{if(version===generation)button.disabled=false;}
 }
 function render(){
  for(const id of ['nnBellCount','nnSideCount','nnMiniCount']){$(id).textContent=data.unread;$(id).hidden=data.unread===0;}
  $('nnBell').setAttribute('aria-label',`Abrir notificações, ${data.unread} não visualizadas`);
  $('nnBell').removeAttribute('title');
  for(const [id,key] of [['nnUnreadMetric','unread'],['nnTotalMetric','total'],['nnAcceptedMetric','accepted'],['nnIssuesMetric','issues']])count(id,data.metrics[key]);
  $('nnReadMetric').textContent=`${data.metrics.read} visualizadas no filtro`;
  document.querySelectorAll('[data-nn-filter]').forEach(b=>{const active=b.dataset.nnFilter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  const host=$('nnList');host.replaceChildren();let lastDay='';
  for(const n of data.items){
   const group=day.format(new Date(n.created_at));if(group!==lastDay){host.append(node('div','nn-daylabel',group));lastDay=group;}
   const row=node('article','nn-item'+(!n.read_at?' unread':''));row.dataset.notification=n.id;
   const content=node('div','nn-item-content'),top=node('div','nn-item-top');
   top.append(node('span','nn-item-name',n.client_name),node('time','nn-item-time',stamp(n.created_at)));
   content.append(top,node('span','nn-item-description',`Novo agendamento · ${n.service_name} · ${stamp(n.starts_at)}`),badges(n));
   const actions=node('div','nn-item-actions'),b=node('button','','Abrir agendamento →'),toggle=node('button','',n.read_at?'Marcar como não lida':'Marcar como lida');
   b.type=toggle.type='button';b.onclick=()=>open(n,b);toggle.onclick=()=>write('read',{id:n.id,read:!n.read_at},toggle);actions.append(b,toggle);content.append(actions);row.append(node('div','nn-symbol','✧'),content);if(!n.read_at)row.append(node('span','nn-read-dot'));host.append(row);
  }
  if(!data.items.length)host.append(node('div','nn-empty','Nenhuma notificação encontrada neste filtro.'));
  const footer=$('nnListFooter');footer.replaceChildren(node('span','',`${data.items.length} avisos nesta página · ${data.total} no filtro `));
  if(previous.length){const b=node('button','btn','Anterior');b.onclick=()=>{cursor=previous.pop();refresh();};footer.append(b);}
  if(data.has_more){const b=node('button','btn','Próxima página');b.onclick=()=>{const last=data.items.at(-1);previous.push(cursor);cursor={before_time:last.created_at,before_id:last.id,until:data.until};refresh();};footer.append(b);}
  const summary=$('nnStatusSummary');summary.replaceChildren();for(const [state,label] of Object.entries(labels)){const row=node('div','nn-statusrow'),left=node('span'),swatch=node('span','nn-swatch');swatch.style.background=colors[state];left.append(swatch,document.createTextNode(label));row.append(left,node('strong','',data.states[state]||0));summary.append(row);}
  const recent=$('nnPopoverList');recent.replaceChildren();for(const n of data.recent){const b=node('button','nn-pop-item'),detail=node('span');detail.append(node('strong','',n.client_name),node('small','',`${n.service_name} · ${stamp(n.created_at)}`));b.append(node('span','npi','✦'),detail);if(!n.read_at)b.append(node('span','new-dot'));b.onclick=()=>open(n,b);recent.append(b);}
  if(!data.recent.length)recent.append(node('div','nn-empty','Nenhuma notificação por enquanto.'));
 }
 async function refresh(){
  if(!rpc)return;const version=generation,request=++revision;say('Atualizando histórico…');$('notificationsScreen').setAttribute('aria-busy','true');$('nnMarkAll').disabled=true;
  try{const selected=params(),selection=JSON.stringify(selected),next=await rpc('list',selected);if(version!==generation||request!==revision)return;const changed=selection!==renderedSelection||JSON.stringify({...next,until:null})!==JSON.stringify(data&&{...data,until:null});data=next;renderedSelection=selection;if(changed)render();$('nnBell').removeAttribute('title');say('Histórico atualizado. Horário de Brasília.');}
  catch(e){if(version===generation&&request===revision){say(`Central indisponível. ${e.message}`);$('nnBell').title='Não foi possível atualizar as notificações.';if(!data){for(const id of ['nnUnreadMetric','nnTotalMetric','nnAcceptedMetric','nnIssuesMetric'])$(id).textContent='—';$('nnList').replaceChildren(node('div','nn-empty','Não foi possível carregar a Central. Tente atualizar.'));$('nnPopoverList').replaceChildren(node('div','nn-empty','Não foi possível carregar os avisos. Abra a Central para tentar novamente.'));}}}
  finally{if(version===generation&&request===revision){$('notificationsScreen').setAttribute('aria-busy','false');$('nnMarkAll').disabled=busy||!data;}}
 }
 function schedule(){clearTimeout(poll);if(!rpc)return;poll=setTimeout(async()=>{if(!document.hidden&&!busy)await refresh();schedule();},30000);}
 function resetPage(){cursor=null;previous=[];refresh();}
 $('nnBell').onclick=()=>{const show=$('nnPopover').hidden;closePop();if(show){$('nnPopover').hidden=false;$('nnBell').setAttribute('aria-expanded','true');$('nnClosePopover').focus();refresh();}};
 $('nnClosePopover').onclick=()=>closePop(true);
 for(const id of ['nnSeeAll','nnOpenCenter'])$(id).onclick=()=>{closePop();window.NNAdminUI.showPage('notifications');$('notificationsScreen').querySelector('h1').focus();};
 $('notificationsScreen').querySelector('h1').tabIndex=-1;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closePop(true);});
 document.addEventListener('click',e=>{if(!$('nnPopover').hidden&&!$('nnPopover').contains(e.target)&&!$('nnBell').contains(e.target))closePop();});
 // Non-modal dialog: moving keyboard focus outside closes it without trapping Tab.
 document.addEventListener('focusin',e=>{if(!$('nnPopover').hidden&&!$('nnPopover').contains(e.target)&&!$('nnBell').contains(e.target))closePop();});
 document.querySelectorAll('[data-nn-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.nnFilter;resetPage();});
 $('nnPeriod').onchange=resetPage;$('nnRefresh').onclick=()=>resetPage();
 $('nnMarkAll').onclick=()=>{if(data)write('read_filter',{filter,period:$('nnPeriod').value,until:data.until},$('nnMarkAll'));};
 const resume=()=>{if(rpc&&!document.hidden&&!busy){refresh();schedule();}};
 window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
 window.NNNotifications={
  start(call,details){this.clear();rpc=call;openBooking=details;$('nnBell').hidden=false;refresh();schedule();},
  navigate(value){page=value;closePop();if(page==='notifications')refresh();},
  clear(){generation++;revision++;clearTimeout(poll);rpc=null;openBooking=null;data=null;busy=false;cursor=null;previous=[];filter='all';$('nnPeriod').value='all';closePop();$('nnBell').hidden=true;$('nnMarkAll').disabled=true;
   for(const frame of frames.values())cancelAnimationFrame(frame);frames.clear();
   for(const id of ['nnBellCount','nnSideCount','nnMiniCount']){$(id).textContent='0';$(id).hidden=true;}
   for(const id of ['nnList','nnListFooter','nnPopoverList','nnStatusSummary'])$(id).replaceChildren();
   for(const id of ['nnUnreadMetric','nnTotalMetric','nnAcceptedMetric','nnIssuesMetric']){$(id).textContent='—';delete $(id).dataset.count;}
   $('nnReadMetric').textContent='';say('');
  }
 };
 window.NNNotifications.clear();
})();
