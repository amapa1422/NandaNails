import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('complete installation contains exact versioned SQL with one transaction',()=>{
 const full=readFileSync('supabase/sql-editor/001_instalacao_nandanails.sql','utf8');
 assert.equal((full.match(/^begin;$/gm)||[]).length,1);
 assert.equal((full.match(/^commit;$/gm)||[]).length,1);
 for(const file of ['202611170001_agenda.sql','202611170002_horarios_padrao.sql','202611170003_servicos_iniciais.sql']){
  const source=readFileSync('supabase/migrations/'+file,'utf8').replace(/\r\n/g,'\n');
  assert.ok(full.includes(createHash('sha256').update(source).digest('hex')));
  assert.ok(full.includes(source.replace(/^begin;\n/m,'').replace(/^commit;\s*$/m,'')));
 }
});
