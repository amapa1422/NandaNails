import {env,dispatch} from '../_shared/push-runtime.ts';
import {createPushWorkerHandler} from '../_shared/push-handler.mjs';
Deno.serve(createPushWorkerHandler({env,dispatch}));
