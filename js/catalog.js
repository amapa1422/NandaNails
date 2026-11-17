
/* Edite as informações reais do estúdio aqui ou na área administrativa da prévia. */
window.LUMIERE_DEFAULTS = {
  business: 'NandaNails',
  tagline: 'Seu momento de cuidado começa aqui.',
  whatsapp: '',
  address: '',
  instagram: '',
  // Catálogo e valores informados pela profissional nas imagens de referência.
  services: [
    {id:'molde-f1',name:'Alongamento Molde F1',description:'Alongamento estruturado no molde F1.',minutes:120,price:90,active:true},
    {id:'esmaltacao-gel',name:'Esmaltação em Gel',description:'Brilho e acabamento duradouro nas mãos.',minutes:60,price:70,active:true},
    {id:'esmaltacao-gel-pe',name:'Esmaltação em Gel no Pé',description:'Esmaltação em gel feita especialmente nos pés.',minutes:60,price:60,active:true},
    {id:'manutencao-alongamento',name:'Manutenção de Alongamento',description:'Manutenção para preservar estrutura e acabamento.',minutes:90,price:65,active:true},
    {id:'remocao',name:'Remoção',description:'Remoção cuidadosa do material.',minutes:30,price:15,active:true}
  ],
  // Dias úteis: 18h é o limite técnico herdado, não um novo início permitido.
  schedule: {0:null,1:['15:00','18:00'],2:['15:00','18:00'],3:['15:00','18:00'],4:['15:00','18:00'],5:['15:00','18:00'],6:['08:00','16:00']},
  allowedStarts: {1:['15:00','16:00'],2:['15:00','16:00'],3:['15:00','16:00'],4:['15:00','16:00'],5:['15:00','16:00']},
  intervalMinutes:30,
  bufferMinutes:0,
  // Datas indisponíveis do HTML original (já passadas, mantidas como referência).
  blockedDates:['2026-10-02','2026-10-09'],
  blockedTimes:[],
  daysAhead:90
};

