supabase/ops/enable-web-push-cron.sql-- MANUAL, after explicit remote authorization. Enable Cron/pg_net in Dashboard first.
-- Create nn_push_worker_url and nn_push_worker_secret in Vault UI, never in this file.
do $$
begin
 if (select count(*) from vault.decrypted_secrets where name in ('nn_push_worker_url','nn_push_worker_secret'))<>2 then
  raise exception 'Configure the two named Vault secrets first';
 end if;
 if exists(select 1 from cron.job where jobname='nn-web-push') then
  raise exception 'nn-web-push already exists; inspect it instead of duplicating';
 end if;
end $$;
select cron.schedule('nn-web-push','* * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='nn_push_worker_url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-push-worker-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='nn_push_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
