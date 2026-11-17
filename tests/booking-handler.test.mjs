import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookingHandler,phoneSubject} from '../supabase/functions/_shared/booking-handler.mjs';
const clock=Date.parse('2026-11-17T17:00:00Z');
const config={ALLOWED_ORIGINS:'https://studio.test',TURNSTILE_SECRET_KEY:'backend-only-test',RATE_LIMIT_SALT:'backend-only-salt-with-32-characters',TURNSTILE_HOSTNAMES:'studio.test'};
const booking={action:'book',serviceId:'molde-f1',date:'2026-11-20',time:'15:00',name:'Cliente Teste',phone:'11912345678',requestId:'11111111-1111-4111-8111-111111111111',expectedPriceCents:9000,expectedDuration:120,captchaToken:'single-use-proof'};
function setup({proof={},quota=true,claim=true,providerError=false,rpcError=null,bookingError=null}={}){
 const calls=[],fetches=[];
 const handler=createBookingHandler({env:key=>config[key],now:()=>clock,
  rpc:async(name,args)=>{calls.push({name,args});if(name==='agenda_rate_limit')return {data:typeof quota==='function'?quota(args):quota,error:rpcError};if(name==='agenda_consume_challenge')return {data:claim,error:rpcError};return {data:name==='agenda_book'?{booking:{id:'persisted-id'}}:{today:'2026-11-17',slots:[],services:[]},error:name==='agenda_book'?bookingError||rpcError:rpcError};},
  fetcher:async(url,opts)=>{fetches.push({url,opts});if(providerError)throw Error('timeout');return {ok:true,json:async()=>({success:true,hostname:'studio.test',action:'booking',challenge_ts:new Date(clock-1000).toISOString(),...proof})};}
 });
 return {calls,fetches,run:(body,extra={})=>handler(new Request('https://functions.test/booking',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://studio.test',...extra},body:JSON.stringify(body)})),handler};
}
test('catalog and availability reach service-only RPC through rate-limited gateway',async()=>{
 for(const body of [{action:'catalog'},{action:'availability',serviceId:'molde-f1',from:'2026-11-20',to:'2026-11-21'}]){const t=setup();assert.equal((await t.run(body)).status,200);assert.equal(t.calls[0].name,'agenda_rate_limit');assert.equal(t.calls[1].name,body.action==='catalog'?'agenda_catalog':'agenda_availability');assert.equal(t.fetches.length,0);}
});
test('booking uses HMAC derived by backend and never accepts IP/header/request-selected key',async()=>{
 const t=setup();assert.equal((await t.run(booking,{'x-forwarded-for':'attacker','cf-connecting-ip':'spoof'})).status,200);
 assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit','agenda_consume_challenge','agenda_rate_limit','agenda_book']);
 assert.deepEqual(t.calls[0].args,{p_action:'book'});
 assert.equal(t.calls[2].args.p_subject,await phoneSubject(booking.phone,config.RATE_LIMIT_SALT));
 assert.equal(t.calls[3].args.p_rate_key,undefined);
 const t2=setup();await t2.run({...booking,requestId:'22222222-2222-4222-8222-222222222222'},{'x-forwarded-for':'different'});assert.deepEqual(t.calls[2],t2.calls[2]);
 assert.notEqual(await phoneSubject(booking.phone,config.RATE_LIMIT_SALT),await phoneSubject(booking.phone,'another-server-secret-with-32-characters'));
});
test('caller cannot submit rate buckets in JSON',async()=>{
 for(const key of ['p_rate_key','rateKey','p_subject','ip']){const t=setup();assert.equal((await t.run({...booking,[key]:'chosen-by-client'})).status,400);assert.equal(t.calls.length,0);}
});
test('invalid, reused, wrong-host, wrong-action and expired captcha never reach booking',async()=>{
 for(const proof of [{success:false},{hostname:'attacker.test'},{action:'login'},{challenge_ts:new Date(clock-301000).toISOString()},{challenge_ts:'invalid'}]){const t=setup({proof});assert.equal((await t.run(booking)).status,400);assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit']);}
});
test('global quota rejection fails closed before captcha or booking',async()=>{const t=setup({quota:false});assert.equal((await t.run(booking)).status,429);assert.equal(t.calls.length,1);assert.equal(t.fetches.length,0);});
test('phone quota rejection prevents database booking after valid captcha',async()=>{const t=setup({quota:args=>args.p_action!=='book_phone'});assert.equal((await t.run(booking)).status,429);assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit','agenda_consume_challenge','agenda_rate_limit']);assert.equal(t.fetches.length,1);});
test('already claimed captcha is rejected even if provider reports success',async()=>{const t=setup({claim:false});assert.equal((await t.run(booking)).status,400);assert.deepEqual(t.calls.map(x=>x.name),['agenda_rate_limit','agenda_consume_challenge']);});
test('database conflict or outage never returns confirmation or database details',async()=>{
 for(const [bookingError,status] of [[{message:'SLOT_CONFLICT'},409],[{code:'23P01',message:'internal relation name'},409],[{message:'secret database details'},503]]){
  const t=setup({bookingError}),response=await t.run(booking),data=await response.json();assert.equal(response.status,status);assert.equal(data.booking,undefined);assert.ok(!JSON.stringify(data).includes('secret database details'));
 }
});
test('rate store outage and captcha outage fail closed',async()=>{
 for(const opts of [{rpcError:{message:'database unavailable'}},{providerError:true}]){const t=setup(opts);assert.equal((await t.run(booking)).status,503);assert.ok(!t.calls.some(c=>c.name==='agenda_book'));}
});
test('body size, invalid date and unexpected origins rejected without booking',async()=>{
 const t=setup();assert.equal((await t.run({...booking,name:'a'.repeat(5000)})).status,413);
 assert.equal((await t.run({...booking,date:'2026-02-31'})).status,400);
 assert.equal((await t.run(booking,{origin:'https://attacker.test'})).status,403);
 assert.equal(t.calls.length,0);
});
