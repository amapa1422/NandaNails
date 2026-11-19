import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import webpush from 'npm:web-push@3.6.7';
import {dispatchPush} from './push-handler.mjs';

export const env=(name:string)=>Deno.env.get(name);
export const userClient=(token:string)=>createClient(env('SUPABASE_URL')!,env('SUPABASE_ANON_KEY')!,{
 auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}
});
export async function dispatch(id:string|null=null){
 if(!env('VAPID_PUBLIC_KEY')||!env('VAPID_PRIVATE_KEY')||!env('VAPID_SUBJECT'))throw Error('PUSH_NOT_CONFIGURED');
 // Validate backend configuration before claiming any delivery.
 webpush.setVapidDetails(env('VAPID_SUBJECT')!,env('VAPID_PUBLIC_KEY')!,env('VAPID_PRIVATE_KEY')!);
 const db=createClient(env('SUPABASE_URL')!,env('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 return dispatchPush({rpc:(name:string,args:Record<string,unknown>)=>db.rpc(name,args),
  send:(subscription:unknown,payload:string)=>webpush.sendNotification(subscription,payload,{
   vapidDetails:{subject:env('VAPID_SUBJECT')!,publicKey:env('VAPID_PUBLIC_KEY')!,privateKey:env('VAPID_PRIVATE_KEY')!},
   TTL:3600,urgency:'normal',timeout:10000
  })},id,5);
}
