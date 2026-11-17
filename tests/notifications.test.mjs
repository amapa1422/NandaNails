import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendNotification} from '../supabase/functions/_shared/whatsapp.mjs';
const job={booking:{client_name:'Cliente Teste',service_name:'Alongamento Molde F1',starts_at:'2026-11-20T17:00:00Z',duration_minutes:120,price_cents:9000}};
const config={version:'v-test',phoneId:'test',recipient:'test',token:'mock',template:'novo_agendamento'};
test('approved template body, Sao Paulo timezone and cents',async()=>{
 let sent;const r=await sendNotification(job,config,async(url,opts)=>{sent=JSON.parse(opts.body);assert.match(url,/\/messages$/);return {ok:true,json:async()=>({messages:[{id:'wamid.mock'}]})};});
 assert.equal(r.state,'accepted');assert.equal(r.providerId,'wamid.mock');assert.deepEqual(sent.template.components[0].parameters.slice(2,5).map(x=>x.text),['20/11/2026','14:00','120']);assert.match(sent.template.components[0].parameters[5].text,/90,00/);
});
test('timeout never claims delivery and does not retry blindly',async()=>{assert.equal((await sendNotification(job,config,async()=>{throw Error('timeout');})).state,'unknown');});
test('explicit rate rejection is retryable; server uncertainty needs review',async()=>{
 for(const [status,state] of [[429,'failed'],[500,'unknown'],[400,'unknown']])assert.equal((await sendNotification(job,config,async()=>({ok:false,status,json:async()=>({error:{code:status}})}))).state,state);
});
