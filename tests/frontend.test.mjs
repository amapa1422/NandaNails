import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function api(){
 const calls=[],timers=new Map();let timerId=0;
 const window={NN_CONFIG:{supabaseUrl:'https://mock.invalid',publishableKey:'mock'},LUMIERE_DEFAULTS:{services:[]}};
 runInNewContext(readFileSync('js/api.js','utf8'),{window,Intl,Date,structuredClone,AbortController,
  setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  fetch:(url,options)=>new Promise((resolve,reject)=>{
   calls.push({body:JSON.parse(options.body),resolve:data=>resolve({ok:true,json:async()=>data}),reject});
   options.signal.addEventListener('abort',()=>reject(new Error('aborted')));
  })});
 return {NN:window.NN,calls,timers};
}
test('public availability shares pending reads, never caches settled availability',async()=>{
 const {NN,calls,timers}=api();
 const reads=Array.from({length:4},()=>NN.availability('molde-f1','2026-11-20'));
 assert.equal(calls.length,1);
 calls[0].resolve({slots:[{time:'15:00'}]});await Promise.all(reads);
 const next=NN.availability('molde-f1','2026-11-20');assert.equal(calls.length,2);
 calls[1].resolve({slots:[]});assert.equal((await next).slots.length,0);assert.equal(timers.size,0);
});
test('failed reads release pending state so the next attempt reaches the server',async()=>{
 const {NN,calls,timers}=api();
 const first=NN.availability('molde-f1','2026-11-20'),second=NN.availability('molde-f1','2026-11-20');
 calls[0].reject(new Error('network failed'));
 const failures=await Promise.allSettled([first,second]);assert.ok(failures.every(r=>r.status==='rejected'));
 const retry=NN.availability('molde-f1','2026-11-20');assert.equal(calls.length,2);calls[1].resolve({slots:[]});await retry;
 assert.equal(timers.size,0);
});
test('reservation invalidates pending reads and sends every mutation to the server',async()=>{
 const {NN,calls}=api();
 const old=NN.availability('molde-f1','2026-11-20');
 const booking=NN.book({requestId:'same-id'});assert.equal(calls[1].body.action,'book');
 const fresh=NN.availability('molde-f1','2026-11-20');assert.equal(calls.length,3);
 calls[0].resolve({slots:[]});await old;
 const shared=NN.availability('molde-f1','2026-11-20');assert.equal(calls.length,3);
 calls[2].resolve({slots:[]});await Promise.all([fresh,shared]);
 calls[1].resolve({booking:{id:'mock'}});await booking;
 const again=NN.book({requestId:'same-id'});assert.equal(calls.length,4);calls[3].resolve({booking:{id:'mock'}});await again;
});
test('request timeout releases loading promises without AbortSignal.timeout',async()=>{
 const {NN,calls,timers}=api();
 const read=NN.availability('molde-f1','2026-11-20');
 [...timers.values()][0]();await assert.rejects(read,/aborted/);assert.equal(timers.size,0);
 const retry=NN.availability('molde-f1','2026-11-20');assert.equal(calls.length,2);calls[1].resolve({slots:[]});await retry;
});
test('reused formatters preserve price and date text',()=>{
 const {NN}=api();
 assert.equal(NN.formatPrice(90),new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(90));
 for(const opts of [{},{weekday:'long',day:'numeric',month:'long'}])assert.equal(NN.displayDate('2026-11-20',opts),new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',...opts}).format(new Date('2026-11-20T12:00:00')));
});
