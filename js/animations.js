
/* NandaNails: camada visual não invasiva, sem tocar nas reservas. */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.topbar');
  const booking = document.querySelector('.booking-card');
  const updateHeader = () => header?.classList.toggle('nn-scrolled', window.scrollY > 24);
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
  const reveal = element => {
    if(!element || element.dataset.nnObserved === '1') return;
    element.dataset.nnObserved='1';
    // Elementos destacados no viewport inicial não precisam ficar ocultos.
    if(element.getBoundingClientRect().top < innerHeight * .89) {
      element.classList.add('nn-inview');
    }
    observer.observe(element);
  };
  observer = new IntersectionObserver(entries => {
    for(const entry of entries){
      if(entry.isIntersecting){
        entry.target.classList.add('nn-inview');
        observer.unobserve(entry.target);
      }
    }
  },{threshold:.08,rootMargin:'0px 0px -28px 0px'});

  const prepare = () => {
    document.querySelectorAll('.hero-text h1,.hero-actions,.booking-copy h2,.section-heading,.intro-strip,.closing,.gallery-more').forEach(el=>{
      el.classList.add('nn-reveal');reveal(el);
    });
    document.querySelectorAll('.hero-visual').forEach(el=>{
      el.classList.add('nn-photo-reveal');reveal(el);
    });
    document.querySelectorAll('.services-grid .service-card,.gallery-grid .gallery-item').forEach((el,i)=>{
      el.classList.add('nn-reveal');
      el.style.setProperty('--nn-delay',`${Math.min(i%4,3)*55}ms`);
      reveal(el);
    });
  };
  prepare();
  document.documentElement.classList.add('nn-motion-ready');
  // Serviços/fotos podem ser atualizados por JS: observar só adições, sem loops por atributos.
  const grids = [document.getElementById('servicesGrid'),document.getElementById('galleryGrid')].filter(Boolean);
  for(const grid of grids){
    new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes.length)) requestAnimationFrame(prepare);
    }).observe(grid,{childList:true});
  }
})();
