
/* NandaNails: camada visual não invasiva, sem tocar nas reservas. */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.topbar');
  const booking = document.querySelector('.booking-card');
  let scrolled;
  const updateHeader = () => {
    const next=window.scrollY>24;
    if(next!==scrolled){header?.classList.toggle('nn-scrolled',next);scrolled=next;}
  };
  addEventListener('scroll', updateHeader, {passive:true});
  updateHeader();

  // Etapas já existentes do sistema: apenas refletimos o progresso no traço decorativo.
  const updateStep = () => {
    if (!booking) return;
    const current = document.querySelector('.steps .step.active');
    const step = Math.max(1, Math.min(4, Number(current?.dataset.step) || 1));
    booking.style.setProperty('--nn-booking-progress', `${step * 25}%`);
  };
  updateStep();
  if(booking){
    const stepWatcher = new MutationObserver(updateStep);
    const steps = booking.querySelector('.steps');
    if(steps) stepWatcher.observe(steps,{attributes:true,subtree:true,attributeFilter:['class']});
  }

  if(reduce.matches || !('IntersectionObserver' in window)) return;
  let observer;
  observer = new IntersectionObserver(entries => {
    for(const entry of entries){
      if(entry.isIntersecting){
        entry.target.classList.add('nn-inview');
        observer.unobserve(entry.target);
      }
    }
  },{threshold:.08,rootMargin:'0px 0px -28px 0px'});

  const prepare = () => {
    const items=[];
    const collect=(selector,className,stagger=false)=>document.querySelectorAll(selector).forEach((el,i)=>{
      if(el.dataset.nnObserved!=='1')items.push({el,className,delay:stagger?`${i%4*55}ms`:null});
    });
    collect('.hero-text h1,.hero-actions,.booking-copy h2,.section-heading,.intro-strip,.closing,.gallery-more','nn-reveal');
    collect('.hero-visual','nn-photo-reveal');
    collect('.services-grid .service-card,.gallery-grid .gallery-item','nn-reveal',true);
    // Read all bounds before changing classes/styles: one layout, no read/write loop.
    for(const item of items)item.visible=item.el.getBoundingClientRect().top<innerHeight*.89;
    for(const {el,className,delay,visible} of items){
      el.dataset.nnObserved='1';el.classList.add(className);
      if(delay!==null)el.style.setProperty('--nn-delay',delay);
      if(visible)el.classList.add('nn-inview');else observer.observe(el);
    }
  };
  prepare();
  document.documentElement.classList.add('nn-motion-ready');
  // Serviços/fotos podem ser atualizados por JS: observar só adições, sem loops por atributos.
  const grids = [document.getElementById('servicesGrid'),document.getElementById('galleryGrid')].filter(Boolean);
  let scheduled=false;
  for(const grid of grids){
    new MutationObserver(mutations=>{
      if(!scheduled&&mutations.some(m=>m.addedNodes.length)){
        scheduled=true;requestAnimationFrame(()=>{scheduled=false;prepare();});
      }
    }).observe(grid,{childList:true});
  }
})();
