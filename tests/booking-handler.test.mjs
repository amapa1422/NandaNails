import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookingHandler,phoneSubject} from '../supabase/functions/_shared/booking-handler.mjs';
const config={ALLOWED_ORIGINS:'https://studio.test',RATE_LIMIT_SALT:'backend-only-salt-with-32-characters'};
const booking={action:'book',serviceId:'molde-f1',date:'2026-11-20',time:'15:00',name:'Cliente Teste',phone:'11912345678',requestId:'11111111-1111-4111-8111-111111111111',expectedPriceCents:9000,expectedDuration:120};
function setup({quota=true,rpcError=null,bookingError=null,bookingData={booking:{id:'persisted-id'}},salt=config.RATE_LIMIT_SALT}={}){
 const calls=[];
 const handler=createBookingHandler({env:key=>key==='RATE_LIMIT_SALT'?salt:config[key],
  rpc:async(name,args)=>{calls.push({name,args});if(name==='agenda_rate_limit')return {data:typeof quota==='function'?quota(args):quota,error:rpcError};return {data:name==='agenda_book'?bookingData:{today:'2026-11-17',slots:[],services:[]},error:name==='agenda_book'?bookingError||rpcError:rpcError};}
 });
 return {calls,run:(body,extra={})=>handler(new Request('https://functions.test/booking',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://studio.test',...extra},body:JSON.stringify(body)})),handler};
}
test('catalog and availability reach service-only RPC through rate-limited gateway',async()=>{
 for(const body of [{action:'catalog'},{action:'availability',serviceId:'molde-f1',from:'2026-11-20',to:'2026-11-21'}]){const t=setup();assert.equal((await t.run(body)).status,200);assert.equal(t.calls[0].name,'agenda_rate_limit');assert.equal(t.calls[1].name,body.action==='catalog'?'agenda_catalog':'agenda_availability');}
});
test('booking uses HMAC derived by backend and never accepts IP/header/request-selected key',async()=>{
 const t=setup();assert.equal((await t.run(booking,{'x-forwarded-for':'attacker','cf-connecting-ip':'spoof'})).status,200);
 assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit','agenda_rate_limit','agenda_book']);
 assert.deepEqual(t.calls[0].args,{p_action:'book'});
 assert.equal(t.calls[1].args.p_subject,await phoneSubject(booking.phone,config.RATE_LIMIT_SALT));
 assert.equal(t.calls[2].args.p_rate_key,undefined);
 const t2=setup();await t2.run({...booking,requestId:'22222222-2222-4222-8222-222222222222'},{'x-forwarded-for':'different'});assert.deepEqual(t.calls[1],t2.calls[1]);
 assert.notEqual(await phoneSubject(booking.phone,config.RATE_LIMIT_SALT),await phoneSubject(booking.phone,'another-server-secret-with-32-characters'));
});
test('caller cannot submit rate buckets in JSON',async()=>{
 for(const key of ['p_rate_key','rateKey','p_subject','ip']){const t=setup();assert.equal((await t.run({...booking,[key]:'chosen-by-client'})).status,400);assert.equal(t.calls.length,0);}
});
test('booking succeeds without CAPTCHA config, token or provider request',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('No external provider is allowed');});
 const s=setup();const r=await s.run(booking);assert.equal(r.status,200);assert.equal((await r.json()).booking.id,'persisted-id');
 assert.ok(!s.calls.some(c=>c.name==='agenda_consume_challenge'));
});
test('global quota rejection fails closed before booking',async()=>{const t=setup({quota:false});assert.equal((await t.run(booking)).status,429);assert.equal(t.calls.length,1);});
test('phone quota rejection prevents database booking without CAPTCHA',async()=>{const t=setup({quota:args=>args.p_action!=='book_phone'});assert.equal((await t.run(booking)).status,429);assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit','agenda_rate_limit']);});
test('missing or short backend salt does not bypass quotas',async()=>{
 for(const salt of [undefined,'short']){const t=setup({salt:salt??''});assert.equal((await t.run(booking)).status,503);assert.deepEqual(t.calls.map(c=>c.name),['agenda_rate_limit']);}
});
test('no success response unless database returns a nonempty booking ID',async()=>{
 for(const bookingData of [null,{}, {booking:{}},{booking:{id:''}},{booking:{id:123}}]){const t=setup({bookingData}),r=await t.run(booking);assert.equal(r.status,503);assert.equal((await r.json()).booking,undefined);}
});
test('database conflict or outage never returns confirmation or database details',async()=>{
 for(const [bookingError,status] of [[{message:'SLOT_CONFLICT'},409],[{code:'23P01',message:'internal relation name'},409],[{message:'secret database details'},503]]){
  const t=setup({bookingError}),response=await t.run(booking),data=await response.json();assert.equal(response.status,status);assert.equal(data.booking,undefined);assert.ok(!JSON.stringify(data).includes('secret database details'));
 }
});
test('rate store outage fails closed',async()=>{
 const t=setup({rpcError:{message:'database unavailable'}});assert.equal((await t.run(booking)).status,503);assert.ok(!t.calls.some(c=>c.name==='agenda_book'));
});
test('strict name, phone, numeric bounds and JSON validation prevent automated junk',async()=>{
 for(const changed of [{name:'Ana'},{name:'Cliente 123'},{phone:'00000000000'},{expectedDuration:31},{expectedDuration:600},{expectedPriceCents:10000001}]){const t=setup();assert.equal((await t.run({...booking,...changed})).status,400);assert.equal(t.calls.length,0);}
 const t=setup();assert.equal((await t.run(booking,{'content-type':'text/plain'})).status,415);assert.equal(t.calls.length,0);
});
test('body size, invalid date and unexpected origins rejected without booking',async()=>{
 const t=setup();assert.equal((await t.run({...booking,name:'a'.repeat(5000)})).status,413);
 assert.equal((await t.run({...booking,date:'2026-02-31'})).status,400);
 assert.equal((await t.run(booking,{origin:'https://attacker.test'})).status,403);
 assert.equal(t.calls.length,0);
});
