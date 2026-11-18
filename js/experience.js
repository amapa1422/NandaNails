
/* NandaNails v2.1 — camada de experiência (não altera a agenda nem as chaves de armazenamento). */
(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],L=window.Lumiere,reduce=matchMedia('(prefers-reduced-motion: reduce)');
let prev=1;
// Replay the same keyframes without forcing synchronous layout via offsetWidth.
const swaps=new WeakMap();
function swap(element,photo=false){
 swaps.get(element)?.cancel();
 if(reduce.matches||!element.animate)return;
 swaps.set(element,element.animate(photo?[{opacity:.2,transform:'scale(.97)'},{opacity:1,transform:'none'}]:[{opacity:0},{opacity:1}],{duration:photo?350:220,easing:'cubic-bezier(.22,1,.36,1)'}));
}
// aviso discreto (substitui alert())
const toast=document.createElement('div');toast.className='nn-toast';toast.setAttribute('role','status');document.body.append(toast);let tt;
window.nnNotice=m=>{toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),4200)};
// resumo da escolha nas etapas 2 e 3
const chips={};[2,3].forEach(n=>{const c=document.createElement('div');c.className='nn-chip';c.hidden=true;$('#panel'+n+' .panel-heading').after(c);chips[n]=c});
window.nnStage=(n,st)=>{
 const panel=$(n===5?'#panelSuccess':'#panel'+n),card=$('.booking-card');
 panel.classList.remove('nn-fwd','nn-back');panel.classList.add(n>=prev?'nn-fwd':'nn-back');prev=n;
 $$('.step').forEach(x=>x.setAttribute('aria-current',Number(x.dataset.step)===Math.min(n,4)?'step':'false'));
 const svc=L.getConfig().services.find(x=>x.id===st.serviceId);
 if(n===1)$$('#bookingServices .choice').forEach(b=>b.classList.toggle('selected',b.dataset.id===st.serviceId));
 if(n===3)$$('#timeGrid .time').forEach(b=>b.classList.toggle('selected',b.textContent===st.time));
 if(n===2)swap($('#calendarDays'));
 [2,3].forEach(k=>{const c=chips[k];if(svc&&n===k){c.hidden=false;c.innerHTML='<b>'+L.escape(svc.name)+'</b><i>•</i><span>'+L.escape(svc.minutes)+' min</span><i>•</i><span>'+L.formatPrice(svc.price)+'</span>'}else c.hidden=true});
 const h=panel.querySelector('h4');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}
 if(n>2&&card.getBoundingClientRect().top<8)card.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});
};
$('#prevMonth').addEventListener('click',()=>swap($('#calendarDays')));
$('#nextMonth').addEventListener('click',()=>swap($('#calendarDays')));
// calendário acessível
new MutationObserver(()=>$$('#calendarDays .cal-day:not(.blank)').forEach(b=>{if(!b.disabled&&!b.hasAttribute('aria-pressed')){b.setAttribute('aria-pressed',b.classList.contains('selected'));b.setAttribute('aria-label',b.title)}})).observe($('#calendarDays'),{childList:true});
// cartões de serviço acessíveis por teclado
const sg=$('#servicesGrid'),fix=()=>$$('#servicesGrid .service-card').forEach(c=>{c.tabIndex=0;c.setAttribute('role','button')});
new MutationObserver(fix).observe(sg,{childList:true});fix();
sg.addEventListener('keydown',e=>{const c=e.target.closest('.service-card');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();c.click()}});
// validação com mensagens claras
const name=$('#clientName'),phone=$('#clientPhone'),form=$('#bookingForm');
const err=(i,m)=>{let e=i.parentElement.querySelector('.nn-err');if(!e){e=document.createElement('small');e.className='nn-err';e.id=i.id+'Err';e.setAttribute('role','alert');i.parentElement.append(e);i.setAttribute('aria-describedby',e.id)}e.textContent=m;i.setAttribute('aria-invalid',m?'true':'false');return !m};
const okName=()=>err(name,name.value.trim().length<3?'Digite seu nome completo (mínimo 3 letras).':'');
const okPhone=()=>{const d=phone.value.replace(/\D/g,'');let m='';
 if(d.length<10)m='Faltam números. Digite DDD + telefone, por exemplo (11)91234-5678.';
 else if(!/^[1-9][1-9]/.test(d))m='Confira o DDD: são dois dígitos, sem começar com 0.';
 else if(d.length===11&&d[2]!=='9')m='Celular com 11 dígitos começa com 9 depois do DDD.';
 return err(phone,m)};
name.addEventListener('input',()=>name.getAttribute('aria-invalid')==='true'&&okName());
phone.addEventListener('input',()=>phone.getAttribute('aria-invalid')==='true'&&okPhone());
form.addEventListener('submit',e=>{const a=okName(),b=okPhone();if(!(a&&b)){e.preventDefault();e.stopImmediatePropagation();(a?phone:name).focus()}},true);
// visualizador de fotos
const lb=$('#lightbox'),img=$('#lightboxImage'),grid=$('#galleryGrid');let idx=0,last=null,list=[];
lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Galeria de fotos');
const arrow=d=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+d+'"/></svg>';
const mk=(c,l,d)=>{const b=document.createElement('button');b.type='button';b.className='nn-lb-nav '+c;b.setAttribute('aria-label',l);b.innerHTML=arrow(d);lb.append(b);return b};
const bp=mk('prev','Foto anterior','m15 6-6 6 6 6'),bn=mk('next','Próxima foto','m9 6 6 6-6 6');
const cnt=document.createElement('div');cnt.className='nn-lb-count';cnt.setAttribute('aria-live','polite');lb.append(cnt);
function show(i){list=$$('#galleryGrid .gallery-item img');if(!list.length)return;idx=(i+list.length)%list.length;img.src=list[idx].src;img.alt=list[idx].alt;cnt.textContent=(idx+1)+' / '+list.length;bp.hidden=bn.hidden=list.length<2;swap(img,true)}
grid.addEventListener('click',e=>{const b=e.target.closest('.gallery-item');if(!b)return;e.stopPropagation();last=b;show([...grid.children].indexOf(b));lb.hidden=false;document.body.style.overflow='hidden';$('#closeLightbox').focus({preventScroll:true})},true);
new MutationObserver(()=>{if(lb.hidden&&last){last.focus({preventScroll:true});last=null}}).observe(lb,{attributes:true,attributeFilter:['hidden']});
bp.onclick=()=>show(idx-1);bn.onclick=()=>show(idx+1);
document.addEventListener('keydown',e=>{if(lb.hidden)return;if(e.key==='ArrowLeft')show(idx-1);else if(e.key==='ArrowRight')show(idx+1);else if(e.key==='Tab'){const f=[$('#closeLightbox'),bp,bn].filter(x=>!x.hidden),i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus()}});
let x0=0,y0=0;lb.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
lb.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)show(idx+(dx<0?1:-1))},{passive:true});
})();
