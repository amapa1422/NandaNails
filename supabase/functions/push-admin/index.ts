import {createPushAdminHandler} from '../_shared/push-handler.mjs';
import {env,userClient,dispatch} from '../_shared/push-runtime.ts';
Deno.serve(createPushAdminHandler({env,dispatch,
 authenticate:async(token:string)=>{
  const db=userClient(token);
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user)return false;
  const admin=await db.rpc('is_admin');return !admin.error&&admin.data===true;
 },
 rpc:(token:string,name:string,args:Record<string,unknown>)=>userClient(token).rpc(name,args)
}));
