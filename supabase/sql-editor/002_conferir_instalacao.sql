-- SOMENTE LEITURA, após executar a instalação completa com sucesso.
-- Não lê clientes, telefones ou conteúdo das reservas.
select id,name,duration_minutes,price_cents,active from public.services order by id;
select weekday,opens,closes,active from public.availability order by weekday,opens;
select weekday,starts from private.allowed_weekday_starts order by weekday;
select version,applied,reason from private.schedule_default_updates order by version;
select c.relname as table_name,c.relrowsecurity as rls_enabled
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in
 ('services','clients','appointments','availability','schedule_blocks','admin_users','audit_log','notification_outbox')
 order by c.relname;
select public.agenda_catalog() as catalogo_e_data_do_servidor;
select has_function_privilege('anon','public.agenda_book(text,date,time,text,text,uuid,text,integer,integer)','EXECUTE') as anon_pode_reservar_diretamente,
 has_function_privilege('anon','public.admin_action(text,jsonb)','EXECUTE') as anon_pode_administrar,
 has_table_privilege('anon','public.clients','SELECT') as anon_pode_listar_clientes,
 has_table_privilege('anon','public.appointments','SELECT') as anon_pode_listar_reservas;
