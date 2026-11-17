import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {sendNotification} from '../_shared/whatsapp.mjs';
import {json} from '../_shared/http.ts';
Deno.serve(async req=>{
  const workerSecret=Deno.env.get('NOTIFY_WORKER_SECRET');
  if(!workerSecret||req.headers.get('Authorization')!=='Bearer '+workerSecret)return json({error:'Unauthorized'},401);
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const config={token:Deno.env.get('WHATSAPP_TOKEN'),phoneId:Deno.env.get('WHATSAPP_PHONE_ID'),recipient:Deno.env.get('WHATSAPP_RECIPIENT'),template:Deno.env.get('WHATSAPP_TEMPLATE'),version:Deno.env.get('WHATSAPP_GRAPH_VERSION')};
  if(Deno.env.get('WHATSAPP_RECIPIENT_OPT_IN')!=='true'||Object.values(config).some(v=>!v))return json({state:'not_configured'},503);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:job,error}=await db.rpc('claim_notification');
  if(error)return json({error:'Queue unavailable'},503);
  if(!job)return json({state:'empty'});
  const result=await sendNotification(job,config);
  const done=await db.rpc('finish_notification',{p_id:job.id,p_state:result.state,p_provider:result.providerId||null,p_error:result.error||null});
  if(done.error)return json({state:'unknown'},503);
  return json({state:result.state});
});
