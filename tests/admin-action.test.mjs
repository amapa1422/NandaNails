import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('incremental admin_action keeps the latest complete function except the services alias',()=>{
 const read=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 const extract=sql=>sql.match(/create or replace function public\.admin_action\([\s\S]*?end \$\$;/)[0];
 const original=extract(read('supabase/migrations/202611170002_horarios_padrao.sql'));
 const migration=read('supabase/migrations/202611180004_admin_action_alias.sql');
 assert.equal(extract(migration),original.replace("'services',(select jsonb_agg(s) from public.services s)","'services',(select jsonb_agg(svc) from public.services as svc)"));
 assert.match(migration,/ADMIN_ACTION_NOT_FOUND/);
 assert.equal((migration.match(/^begin;$/gm)||[]).length,1);
 assert.equal((migration.match(/^commit;$/gm)||[]).length,1);
 assert.doesNotMatch(migration,/^(?:grant|revoke|alter function|drop function)\b/im);
});
