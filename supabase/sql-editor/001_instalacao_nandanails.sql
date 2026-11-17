-- NandaNails: instalação inicial COMPLETA para SQL Editor.
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

-- Fonte: 202611170001_agenda.sql
-- SHA-256 (UTF-8, LF): 10d23f261aa119fcc30473ceb48faee440e0aee8846c9d870d032179f8320484
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public;

create table public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.services(
 id text primary key, name text not null check(length(name) between 3 and 100), description text not null default '',
 duration_minutes integer not null check(duration_minutes between 15 and 480 and duration_minutes%15=0),
 price_cents integer not null check(price_cents between 0 and 10000000), active boolean not null default true
);
insert into public.services values
 ('molde-f1','Alongamento Molde F1','Alongamento estruturado no molde F1.',120,9000,true),
 ('esmaltacao-gel','Esmaltação em Gel','Brilho e acabamento duradouro nas mãos.',60,7000,true),
 ('esmaltacao-gel-pe','Esmaltação em Gel no Pé','Esmaltação em gel feita especialmente nos pés.',60,6000,true),
 ('manutencao-alongamento','Manutenção de Alongamento','Manutenção para preservar estrutura e acabamento.',90,6500,true),
 ('remocao','Remoção','Remoção cuidadosa do material.',30,1500,true);
create table public.clients(
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 3 and 80),
 phone text not null unique check(phone ~ '^55[1-9]{2}([2-5][0-9]{7}|9[0-9]{8})$'), created_at timestamptz not null default now()
);
-- Uma linha por turno permite intervalos de almoço e múltiplas pausas.
create table public.availability(
 id uuid primary key default gen_random_uuid(), weekday integer not null check(weekday between 0 and 6),
 opens time not null, closes time not null, active boolean not null default true,
 check(opens<closes), unique(weekday,opens)
);
insert into public.availability(weekday,opens,closes)
 select d,'09:00'::time,case when d=6 then '14:00'::time else '18:00'::time end from generate_series(1,6) d;
create table public.appointments(
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 client_id uuid not null references public.clients, service_id text not null references public.services,
 client_name text not null, service_name text not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 price_cents integer not null check(price_cents>=0), duration_minutes integer not null check(duration_minutes>0),
 status text not null default 'confirmed' check(status in ('confirmed','cancelled','completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at=starts_at+duration_minutes*interval '1 minute'),
 exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled')
);
create index appointments_client on public.appointments(client_id);
create index appointments_start on public.appointments(starts_at);
create table public.schedule_blocks(
 id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, ends_at timestamptz not null,
 reason text not null default '' check(length(reason)<=200), check(starts_at<ends_at)
);
create index blocks_range on public.schedule_blocks using gist(tstzrange(starts_at,ends_at,'[)'));
create table public.audit_log(
 id bigint generated always as identity primary key, actor uuid, action text not null, record_id text,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.notification_outbox(
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null unique references public.appointments,
 state text not null default 'pending' check(state in ('pending','processing','accepted','failed','unknown','skipped')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 provider_id text, last_error text, updated_at timestamptz not null default now()
);
create table private.rate_limits(bucket text primary key, count integer not null, expires_at timestamptz not null);

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
do $$ declare t text; begin
 foreach t in array array['admin_users','services','clients','availability','appointments','schedule_blocks','audit_log','notification_outbox'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
 end loop;
end $$;

create function private.slots(p_service text,p_from date,p_to date,p_ignore uuid default null)
returns table(slot_date date,slot_time text,starts_at timestamptz) language sql stable set search_path='' as $$
 select d::date,to_char(x at time zone 'America/Sao_Paulo','HH24:MI'),x
 from public.services s
 cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 join public.availability a on a.weekday=extract(dow from d)::integer and a.active
 cross join lateral generate_series((d::date+a.opens) at time zone 'America/Sao_Paulo',
  (d::date+a.closes) at time zone 'America/Sao_Paulo'-s.duration_minutes*interval '1 minute',interval '30 minutes') x
 where s.id=p_service and s.active and p_to>=p_from and p_to-p_from<=31
 and d::date between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date+90
 and x>now()+interval '30 minutes'
 and not exists(select 1 from public.appointments b where b.status<>'cancelled' and (p_ignore is null or b.id<>p_ignore)
  and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(x,x+s.duration_minutes*interval '1 minute','[)'))
 and not exists(select 1 from public.schedule_blocks b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(x,x+s.duration_minutes*interval '1 minute','[)'))
 order by 1,2
$$;
create function public.agenda_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('today',(now() at time zone 'America/Sao_Paulo')::date,'services',
  coalesce((select jsonb_agg(s order by s.id) from public.services s where active),'[]'::jsonb))
$$;
create function public.agenda_availability(p_service text,p_from date,p_to date) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('slots',coalesce((select jsonb_agg(s) from (select distinct slot_date as date,slot_time as "time" from private.slots(p_service,p_from,p_to)) s),'[]'::jsonb))
$$;
create function public.agenda_book(p_service text,p_date date,p_time time,p_name text,p_phone text,p_request uuid,p_rate_key text,p_expected_price integer,p_expected_duration integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; s public.services; cid uuid; start_time timestamptz; hits integer;
begin
 -- Todas as mutações da agenda compartilham o mesmo bloqueio transacional.
 perform pg_advisory_xact_lock(687341902);
 if p_name is null or length(trim(p_name)) not between 3 and 80 or trim(p_name) !~ '^[^[:digit:][:space:]]+[[:space:]]+[^[:digit:]]+$'
 or p_phone is null or p_phone !~ '^55[1-9]{2}([2-5][0-9]{7}|9[0-9]{8})$' or p_request is null then raise exception 'INVALID_INPUT';end if;
 select * into a from public.appointments where request_id=p_request;
 if found then
  if a.service_id<>p_service or a.starts_at<>(p_date+p_time) at time zone 'America/Sao_Paulo'
   or a.client_name<>trim(p_name) or not exists(select 1 from public.clients where id=a.client_id and phone=p_phone) then raise exception 'INVALID_REQUEST';end if;
 else
  if p_rate_key is null or length(p_rate_key)>128 then raise exception 'INVALID_INPUT';end if;
  insert into private.rate_limits values(p_rate_key,1,now()+interval '1 hour') on conflict(bucket) do update
   set count=case when private.rate_limits.expires_at<now() then 1 else private.rate_limits.count+1 end,
    expires_at=case when private.rate_limits.expires_at<now() then now()+interval '1 hour' else private.rate_limits.expires_at end returning count into hits;
  if hits>8 then raise exception 'RATE_LIMIT';end if;
  if (select count(*) from public.appointments b join public.clients c on c.id=b.client_id where c.phone=p_phone and b.created_at>now()-interval '1 day')>=5 then raise exception 'RATE_LIMIT';end if;
  select * into s from public.services where id=p_service and active;
  if not found then raise exception 'SERVICE_UNAVAILABLE';end if;
  if p_expected_price is distinct from s.price_cents or p_expected_duration is distinct from s.duration_minutes then raise exception 'SERVICE_CHANGED';end if;
  select x.starts_at into start_time from private.slots(p_service,p_date,p_date) x where x.slot_time=to_char(p_time,'HH24:MI') and extract(second from p_time)=0 limit 1;
  if start_time is null then raise exception 'SLOT_CONFLICT';end if;
  insert into public.clients(name,phone) values(trim(p_name),p_phone) on conflict(phone) do update set name=excluded.name returning id into cid;
  insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes)
  values(p_request,cid,s.id,trim(p_name),s.name,start_time,start_time+s.duration_minutes*interval '1 minute',s.price_cents,s.duration_minutes) returning * into a;
  insert into public.notification_outbox(appointment_id) values(a.id);
 end if;
 return jsonb_build_object('booking',jsonb_build_object('id',a.id,'service_name',a.service_name,'price_cents',a.price_cents,'duration_minutes',a.duration_minutes,
  'date',(a.starts_at at time zone 'America/Sao_Paulo')::date,'time',to_char(a.starts_at at time zone 'America/Sao_Paulo','HH24:MI'),'status',a.status));
end $$;

create function public.admin_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.appointments; s public.services; start_time timestamptz; end_time timestamptz; rid uuid; result jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(687341902);
 if p_action='list' then
  return jsonb_build_object(
   'appointments',coalesce((select jsonb_agg(row_to_json(v) order by v.starts_at) from
    (select b.*,c.phone from public.appointments b join public.clients c on c.id=b.client_id
      where b.starts_at>=(p_data->>'from')::timestamptz and b.starts_at<(p_data->>'to')::timestamptz) v),'[]'::jsonb),
   'services',(select jsonb_agg(s) from public.services s),
   'availability',coalesce((select jsonb_agg(v order by v.weekday,v.opens) from public.availability v),'[]'::jsonb),
   'blocks',coalesce((select jsonb_agg(b) from public.schedule_blocks b where b.ends_at>=(p_data->>'from')::timestamptz and b.starts_at<(p_data->>'to')::timestamptz),'[]'::jsonb));
 elsif p_action='slots' then
  return public.agenda_availability(p_data->>'serviceId',(p_data->>'date')::date,(p_data->>'date')::date);
 elsif p_action='status' then
  select * into strict a from public.appointments where id=(p_data->>'id')::uuid for update;
  if p_data->>'status' not in ('confirmed','cancelled','completed') then raise exception 'INVALID_STATUS';end if;
  if a.status='cancelled' and p_data->>'status'<>'cancelled' then raise exception 'CANCELLED_BOOKING';end if;
  if p_data->>'status'='completed' and a.ends_at>now() then raise exception 'NOT_FINISHED';end if;
  update public.appointments set status=p_data->>'status',updated_at=now() where id=a.id;
  rid=a.id;
 elsif p_action='reschedule' then
  select * into strict a from public.appointments where id=(p_data->>'id')::uuid and status='confirmed' for update;
  select * into strict s from public.services where id=a.service_id;
  -- Preserva a duração contratada, mesmo após edição do catálogo.
  start_time=((p_data->>'date')::date+(p_data->>'time')::time) at time zone 'America/Sao_Paulo';
  end_time=start_time+a.duration_minutes*interval '1 minute';
  if start_time<=now()+interval '30 minutes' or (p_data->>'date')::date>(now() at time zone 'America/Sao_Paulo')::date+90
   or extract(second from start_time)<>0
   or not exists(select 1 from public.availability v where v.active and v.weekday=extract(dow from (p_data->>'date')::date)
    and start_time>=((p_data->>'date')::date+v.opens) at time zone 'America/Sao_Paulo' and end_time<=((p_data->>'date')::date+v.closes) at time zone 'America/Sao_Paulo'
    and mod(extract(epoch from start_time-(((p_data->>'date')::date+v.opens) at time zone 'America/Sao_Paulo')),1800)=0)
   or exists(select 1 from public.schedule_blocks b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(start_time,end_time,'[)')) then raise exception 'SLOT_CONFLICT';end if;
  update public.appointments set starts_at=start_time,ends_at=end_time,updated_at=now() where id=a.id;rid=a.id;
 elsif p_action='block' then
  start_time=(p_data->>'starts_at')::timestamptz;end_time=(p_data->>'ends_at')::timestamptz;
  if exists(select 1 from public.appointments b where status<>'cancelled' and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(start_time,end_time,'[)')) then raise exception 'SLOT_CONFLICT';end if;
  insert into public.schedule_blocks(starts_at,ends_at,reason) values(start_time,end_time,coalesce(p_data->>'reason','')) returning id into rid;
 elsif p_action='unblock' then
  delete from public.schedule_blocks where id=(p_data->>'id')::uuid returning id into rid;
 elsif p_action='service' then
  update public.services set name=p_data->>'name',description=p_data->>'description',duration_minutes=(p_data->>'duration_minutes')::integer,
   price_cents=(p_data->>'price_cents')::integer,active=(p_data->>'active')::boolean where id=p_data->>'id';
 elsif p_action='hours' then
  delete from public.availability;
  insert into public.availability(weekday,opens,closes,active)
   select weekday,opens::time,closes::time,active from jsonb_to_recordset(p_data->'hours') as h(weekday integer,opens text,closes text,active boolean);
  if exists(select 1 from public.availability x join public.availability y on x.id<>y.id and x.weekday=y.weekday and x.active and y.active and x.opens<y.closes and y.opens<x.closes) then raise exception 'OVERLAPPING_HOURS';end if;
 else raise exception 'INVALID_ACTION';end if;
 insert into public.audit_log(actor,action,record_id,details) values(auth.uid(),p_action,coalesce(rid::text,p_data->>'id'),
  case when p_action in ('status','reschedule') then jsonb_build_object('before',to_jsonb(a)-'client_name'-'client_id','after',p_data) else p_data end);
 return jsonb_build_object('ok',true);
end $$;

create function public.claim_notification() returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.notification_outbox; result jsonb;
begin
 -- Uma tentativa interrompida tem resultado desconhecido; não reenviar automaticamente.
 update public.notification_outbox set state='unknown',last_error='Worker interrompido; verificar no provedor',updated_at=now()
  where state='processing' and updated_at<now()-interval '5 minutes';
 select * into n from public.notification_outbox where state in ('pending','failed') and attempts<3 and next_attempt_at<=now()
  order by next_attempt_at for update skip locked limit 1;
 if not found then return null;end if;
 if exists(select 1 from public.appointments where id=n.appointment_id and status='cancelled') then
  update public.notification_outbox set state='skipped',updated_at=now() where id=n.id;return null;
 end if;
 update public.notification_outbox set state='processing',attempts=attempts+1,updated_at=now() where id=n.id;
 select jsonb_build_object('id',n.id,'attempts',n.attempts+1,'booking',to_jsonb(b)) into result from public.appointments b where b.id=n.appointment_id;
 return result;
end $$;
create function public.finish_notification(p_id uuid,p_state text,p_provider text default null,p_error text default null) returns void
language sql security definer set search_path='' as $$
 update public.notification_outbox set state=p_state,provider_id=p_provider,last_error=left(p_error,200),updated_at=now(),
 next_attempt_at=now()+interval '5 minutes'*attempts where id=p_id and state='processing'
$$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.agenda_catalog(), public.agenda_availability(text,date,date),
 public.agenda_book(text,date,time,text,text,uuid,text,integer,integer), public.admin_action(text,jsonb),
 public.claim_notification(),public.finish_notification(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.agenda_catalog(), public.agenda_availability(text,date,date),
 public.agenda_book(text,date,time,text,text,uuid,text,integer,integer),public.claim_notification(),public.finish_notification(uuid,text,text,text) to service_role;
grant execute on function public.admin_action(text,jsonb) to authenticated;

-- Fonte: 202611170002_horarios_padrao.sql
-- SHA-256 (UTF-8, LF): 13fdc44bf10e456b87152b3e4e753b9f5aaa5df5990d2d92d0c417b92b8cc100
-- Atualiza apenas o padrão identificado na migration 001, nunca reservas.
select pg_advisory_xact_lock(687341902);
create table if not exists private.schedule_default_updates (
 version text primary key,
 applied boolean not null,
 reason text not null,
 created_at timestamptz not null default now()
);
create table if not exists private.allowed_weekday_starts (
 weekday integer primary key check(weekday between 0 and 6),
 starts time[] not null check(cardinality(starts)>0)
);
revoke all on private.schedule_default_updates,private.allowed_weekday_starts from public,anon,authenticated;

do $$
begin
 if not exists(select 1 from private.schedule_default_updates where version='202611170002') then
  -- Fingerprint completo dos seis turnos sem alterações administrativas anteriores.
  -- Qualquer divergência ou edição registrada torna a origem incerta: preservar.
  if (select count(*) from public.availability)=6
   and (select count(*) from public.availability where active and weekday between 1 and 6
    and opens='09:00'::time and closes=case when weekday=6 then '14:00'::time else '18:00'::time end)=6
   and not exists(select 1 from public.audit_log where action='hours')
   and not exists(select 1 from private.allowed_weekday_starts) then
    update public.availability set opens=case when weekday=6 then '08:00'::time else '15:00'::time end,
     closes=case when weekday=6 then '16:00'::time else closes end where weekday between 1 and 6;
    insert into private.allowed_weekday_starts(weekday,starts)
     select d,array['15:00'::time,'16:00'::time] from generate_series(1,5) d;
    insert into private.schedule_default_updates(version,applied,reason)
     values('202611170002',true,'Padrão original completo, sem edição administrativa registrada');
  else
    insert into private.schedule_default_updates(version,applied,reason)
     values('202611170002',false,'Disponibilidade personalizada ou origem incerta; preservada para revisão manual');
  end if;
 end if;
end $$;

-- A restrição de início é independente dos turnos para não desaparecer ao salvar
-- o funcionamento no painel existente. Turnos continuam limitando o término.
create or replace function private.start_allowed(p_date date,p_start timestamptz)
returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from private.allowed_weekday_starts r where r.weekday=extract(dow from p_date)::integer)
 or exists(select 1 from private.allowed_weekday_starts r where r.weekday=extract(dow from p_date)::integer
  and (p_start at time zone 'America/Sao_Paulo')::time=any(r.starts))
$$;
revoke all on function private.start_allowed(date,timestamptz) from public,anon,authenticated;

-- As funções completas seguem abaixo para versionar a validação de consultas,
-- novas reservas e remarcações, mantendo os grants e a proteção transacional.

create or replace function private.slots(p_service text,p_from date,p_to date,p_ignore uuid default null)
returns table(slot_date date,slot_time text,starts_at timestamptz) language sql stable set search_path='' as $$
 select d::date,to_char(x at time zone 'America/Sao_Paulo','HH24:MI'),x
 from public.services s
 cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 join public.availability a on a.weekday=extract(dow from d)::integer and a.active
 cross join lateral generate_series((d::date+a.opens) at time zone 'America/Sao_Paulo',
  (d::date+a.closes) at time zone 'America/Sao_Paulo'-s.duration_minutes*interval '1 minute',interval '30 minutes') x
 where s.id=p_service and s.active and p_to>=p_from and p_to-p_from<=31
 and d::date between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date+90
 and private.start_allowed(d::date,x)
 and x>now()+interval '30 minutes'
 and not exists(select 1 from public.appointments b where b.status<>'cancelled' and (p_ignore is null or b.id<>p_ignore)
  and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(x,x+s.duration_minutes*interval '1 minute','[)'))
 and not exists(select 1 from public.schedule_blocks b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(x,x+s.duration_minutes*interval '1 minute','[)'))
 order by 1,2
$$;
create or replace function public.agenda_availability(p_service text,p_from date,p_to date) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('slots',coalesce((select jsonb_agg(s order by s.date,s.time) from
  (select distinct slot_date as date,slot_time as "time" from private.slots(p_service,p_from,p_to)) s),'[]'::jsonb))
$$;

create or replace function public.admin_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.appointments; s public.services; start_time timestamptz; end_time timestamptz; rid uuid; result jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(687341902);
 if p_action='list' then
  return jsonb_build_object(
   'appointments',coalesce((select jsonb_agg(row_to_json(v) order by v.starts_at) from
    (select b.*,c.phone from public.appointments b join public.clients c on c.id=b.client_id
      where b.starts_at>=(p_data->>'from')::timestamptz and b.starts_at<(p_data->>'to')::timestamptz) v),'[]'::jsonb),
   'services',(select jsonb_agg(s) from public.services s),
   'availability',coalesce((select jsonb_agg(v order by v.weekday,v.opens) from public.availability v),'[]'::jsonb),
   'blocks',coalesce((select jsonb_agg(b) from public.schedule_blocks b where b.ends_at>=(p_data->>'from')::timestamptz and b.starts_at<(p_data->>'to')::timestamptz),'[]'::jsonb));
 elsif p_action='slots' then
  return public.agenda_availability(p_data->>'serviceId',(p_data->>'date')::date,(p_data->>'date')::date);
 elsif p_action='status' then
  select * into strict a from public.appointments where id=(p_data->>'id')::uuid for update;
  if p_data->>'status' not in ('confirmed','cancelled','completed') then raise exception 'INVALID_STATUS';end if;
  if a.status='cancelled' and p_data->>'status'<>'cancelled' then raise exception 'CANCELLED_BOOKING';end if;
  if p_data->>'status'='completed' and a.ends_at>now() then raise exception 'NOT_FINISHED';end if;
  update public.appointments set status=p_data->>'status',updated_at=now() where id=a.id;
  rid=a.id;
 elsif p_action='reschedule' then
  select * into strict a from public.appointments where id=(p_data->>'id')::uuid and status='confirmed' for update;
  select * into strict s from public.services where id=a.service_id;
  -- Preserva a duração contratada, mesmo após edição do catálogo.
  start_time=((p_data->>'date')::date+(p_data->>'time')::time) at time zone 'America/Sao_Paulo';
  end_time=start_time+a.duration_minutes*interval '1 minute';
  if start_time<=now()+interval '30 minutes' or (p_data->>'date')::date>(now() at time zone 'America/Sao_Paulo')::date+90
   or extract(second from start_time)<>0
   or not private.start_allowed((p_data->>'date')::date,start_time)
   or not exists(select 1 from public.availability v where v.active and v.weekday=extract(dow from (p_data->>'date')::date)
    and start_time>=((p_data->>'date')::date+v.opens) at time zone 'America/Sao_Paulo' and end_time<=((p_data->>'date')::date+v.closes) at time zone 'America/Sao_Paulo'
    and mod(extract(epoch from start_time-(((p_data->>'date')::date+v.opens) at time zone 'America/Sao_Paulo')),1800)=0)
   or exists(select 1 from public.schedule_blocks b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(start_time,end_time,'[)')) then raise exception 'SLOT_CONFLICT';end if;
  update public.appointments set starts_at=start_time,ends_at=end_time,updated_at=now() where id=a.id;rid=a.id;
 elsif p_action='block' then
  start_time=(p_data->>'starts_at')::timestamptz;end_time=(p_data->>'ends_at')::timestamptz;
  if exists(select 1 from public.appointments b where status<>'cancelled' and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(start_time,end_time,'[)')) then raise exception 'SLOT_CONFLICT';end if;
  insert into public.schedule_blocks(starts_at,ends_at,reason) values(start_time,end_time,coalesce(p_data->>'reason','')) returning id into rid;
 elsif p_action='unblock' then
  delete from public.schedule_blocks where id=(p_data->>'id')::uuid returning id into rid;
 elsif p_action='service' then
  update public.services set name=p_data->>'name',description=p_data->>'description',duration_minutes=(p_data->>'duration_minutes')::integer,
   price_cents=(p_data->>'price_cents')::integer,active=(p_data->>'active')::boolean where id=p_data->>'id';
 elsif p_action='hours' then
  delete from public.availability;
  insert into public.availability(weekday,opens,closes,active)
   select weekday,opens::time,closes::time,active from jsonb_to_recordset(p_data->'hours') as h(weekday integer,opens text,closes text,active boolean);
  if exists(select 1 from public.availability x join public.availability y on x.id<>y.id and x.weekday=y.weekday and x.active and y.active and x.opens<y.closes and y.opens<x.closes) then raise exception 'OVERLAPPING_HOURS';end if;
 else raise exception 'INVALID_ACTION';end if;
 insert into public.audit_log(actor,action,record_id,details) values(auth.uid(),p_action,coalesce(rid::text,p_data->>'id'),
  case when p_action in ('status','reschedule') then jsonb_build_object('before',to_jsonb(a)-'client_name'-'client_id','after',p_data) else p_data end);
 return jsonb_build_object('ok',true);
end $$;


-- Fonte: 202611170003_servicos_iniciais.sql
-- SHA-256 (UTF-8, LF): 215903d909854616b327f5ab6c198451862f86845fa5a3230b5e5023e0134dc2
-- Seed repetível: inclui apenas IDs ausentes e preserva serviços personalizados,
-- inclusive nome, descrição, preço, duração e estado ativo/inativo existentes.
select pg_advisory_xact_lock(687341902);
insert into public.services(id,name,description,duration_minutes,price_cents,active) values
 ('molde-f1','Alongamento Molde F1','Alongamento estruturado no molde F1.',120,9000,true),
 ('esmaltacao-gel','Esmaltação em Gel','Brilho e acabamento duradouro nas mãos.',60,7000,true),
 ('esmaltacao-gel-pe','Esmaltação em Gel no Pé','Esmaltação em gel feita especialmente nos pés.',60,6000,true),
 ('manutencao-alongamento','Manutenção de Alongamento','Manutenção para preservar estrutura e acabamento.',90,6500,true),
 ('remocao','Remoção','Remoção cuidadosa do material.',30,1500,true)
on conflict(id) do nothing;

commit;
