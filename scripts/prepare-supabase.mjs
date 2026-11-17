// Gera SQL local para revisão. Não conecta ao Supabase e não executa SQL.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files=['202611170001_agenda.sql','202611170002_horarios_padrao.sql','202611170003_servicos_iniciais.sql'];
const sources=files.map(file=>({file,sql:readFileSync('supabase/migrations/'+file,'utf8').replace(/\r\n/g,'\n')}));
const preamble=`-- NandaNails: instalação inicial COMPLETA para SQL Editor.
-- Projeto esperado: nandanails-agendamento / fdxocuhgiypynsjxsqtm.
-- GERADO por node scripts/prepare-supabase.mjs. Não editar este arquivo à mão.
-- SOMENTE para banco sem os objetos NandaNails. Não reaplicar após o sucesso.
-- Consulte docs/SUPABASE_PRIMEIRA_ENTREGA.md. Requer autorização antes de executar.
-- Não cria usuários, não autoriza administradores e não envia WhatsApp.
begin;
do $$
declare object_name text;
begin
 foreach object_name in array array['admin_users','services','clients','availability','appointments','schedule_blocks','audit_log','notification_outbox'] loop
  if to_regclass('public.'||object_name) is not null then
   raise exception 'INSTALACAO_ABORTADA: public.% já existe. Não reaplique a instalação inicial; revise migrations pendentes.',object_name;
  end if;
 end loop;
 if to_regclass('private.schedule_default_updates') is not null or to_regclass('private.allowed_weekday_starts') is not null then
  raise exception 'INSTALACAO_ABORTADA: objetos privados da agenda já existem; revisar antes de prosseguir.';
 end if;
end $$;
`;
let result=preamble;
for(const {file,sql} of sources){
 if((sql.match(/^begin;$/gm)||[]).length!==1||(sql.match(/^commit;$/gm)||[]).length!==1)throw Error('Limites transacionais inesperados: '+file);
 const sha=createHash('sha256').update(sql).digest('hex');
 result+=`\n-- Fonte: ${file}\n-- SHA-256 (UTF-8, LF): ${sha}\n`+sql.replace(/^begin;\n/m,'').replace(/^commit;\s*$/m,'');
}
result+='\ncommit;\n';
mkdirSync('supabase/sql-editor',{recursive:true});
writeFileSync('supabase/sql-editor/001_instalacao_nandanails.sql',result);
console.log('SQL completo gerado localmente. Nenhuma operação remota executada.');
