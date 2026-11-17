-- Atualiza apenas o padrão identificado na migration 001, nunca reservas.
begin;
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

commit;
