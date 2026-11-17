import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createBookingHandler} from '../_shared/booking-handler.mjs';

// This credential stays exclusively in the Supabase backend environment.
Deno.serve(createBookingHandler({
 env:name=>Deno.env.get(name),
 rpc:(name,args)=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).rpc(name,args)
}));
