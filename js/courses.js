// Cursos independentes da configuração, catálogo e disponibilidade da agenda.
(()=>{'use strict';
const choices=document.getElementById('bookingCourses');
const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),money=v=>formatter.format(v);
const courses={completo:{title:'Curso completo',desc:'Três dias de formação presencial, com acompanhamento, café, teoria e prática.',items:['Molde F1','Esmaltação em gel','Soft Gel','Orientação presencial na loja indicada para os materiais necessários'],price:'R$ 300,00',payment:'Até 2× de R$ 150,00 sem juros'},tradicional:{title:'Curso tradicional',desc:'Dois dias para conhecer a esmaltação tradicional, seus fundamentos e a aplicação prática.',items:['Primeiro dia: teoria e café','Segundo dia: prática em modelo e café','Esmaltação tradicional sem alongamento','Diferenças entre esmaltação em gel, blindagem e banho de gel'],price:'R$ 200,00',payment:'À vista ou em até 2 parcelas com juros (taxa e total a confirmar)'}};
for(const [key,name,price,duration] of [['completo','Curso completo',300,'3 dias'],['tradicional','Curso tradicional',200,'2 dias']]){const b=document.createElement('button');b.type='button';b.className='choice course-choice';b.innerHTML='<span class="choice-icon"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m2 9 10-5 10 5-10 5-10-5Z"/><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v7"/></svg></span><span class="choice-copy"><span class="course-tag">FORMAÇÃO · '+duration.toUpperCase()+'</span><strong></strong><small></small></span><span class="choice-arrow"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';b.querySelector('strong').textContent=name;b.querySelector('small').textContent=money(price)+' · Conheça o curso';b.addEventListener('click',()=>open(key));choices.append(b)};
let selectedCourse='',opener=null,previousOverflow='';
const modal=document.getElementById('courseModal'),by=id=>document.getElementById(id);
const close=()=>{
 if(modal.hidden)return;
 modal.hidden=true;document.body.style.overflow=previousOverflow;
 document.querySelector('main').inert=false;
 document.querySelector('header').inert=false;
 document.querySelector('footer').inert=false;
 opener?.focus({preventScroll:true});
};
function open(key){
 const c=courses[key];if(!c)return;
 selectedCourse=key;opener=document.activeElement;previousOverflow=document.body.style.overflow;
 by('modalTitle').textContent=c.title;by('modalDesc').textContent=c.desc;
 by('modalPrice').textContent=c.price;by('modalPayment').textContent=c.payment;
 const list=by('modalList');list.replaceChildren();
 for(const text of c.items){const li=document.createElement('li');li.textContent=text;list.append(li);}
 modal.hidden=false;document.body.style.overflow='hidden';
 document.querySelector('main').inert=true;
 document.querySelector('header').inert=true;
 document.querySelector('footer').inert=true;
 by('closeModal').focus({preventScroll:true});
}
document.querySelectorAll('[data-course]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.course)));
by('closeModal').addEventListener('click',close);by('backModal').addEventListener('click',close);
by('interestButton').addEventListener('click',()=>{
 const c=courses[selectedCourse];if(!c||modal.hidden)return;
 const msg=`Olá! Tenho interesse no ${c.title} da NandaNails (${c.price}). Gostaria de receber mais informações sobre as próximas turmas, datas, horários, conteúdo do curso e formas de pagamento.`;
 window.open('https://wa.me/554491712430?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
});
modal.addEventListener('click',e=>{if(e.target===modal)close();});
document.addEventListener('keydown',e=>{
 if(modal.hidden)return;
 if(e.key==='Escape'){e.preventDefault();close();}
 if(e.key==='Tab'){
  const items=[...modal.querySelectorAll('button,a[href]')].filter(el=>!el.disabled);
  const first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
})();
