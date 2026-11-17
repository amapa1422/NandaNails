-- SOMENTE LEITURA. Executar apenas no projeto correto, após autorização.
-- Não consulta nomes, telefones, reservas ou outros dados pessoais.
select n.nspname as schema_name,c.relname as object_name,c.relkind as object_type,
 c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in
 ('admin_users','services','clients','availability','appointments','schedule_blocks','audit_log','notification_outbox'))
 or (n.nspname='private' and c.relname in ('rate_limits','used_challenges','allowed_weekday_starts','schedule_default_updates'))
order by n.nspname,c.relname;

select n.nspname as schema_name,p.proname as function_name,
 pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in
 ('is_admin','agenda_catalog','agenda_availability','agenda_book','agenda_rate_limit','agenda_consume_challenge','admin_action','claim_notification','finish_notification'))
 or (n.nspname='private' and p.proname in ('slots','start_allowed'))
order by n.nspname,p.proname;
