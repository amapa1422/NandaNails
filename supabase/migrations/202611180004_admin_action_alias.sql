-- Correção pontual de SQLSTATE 42702 em admin_action('list').
-- Incremental: executar SOMENTE este arquivo no banco existente com 001/002/003.
-- Não reaplicar migrations anteriores. Não altera dados, owner ou grants.
begin;

-- CREATE OR REPLACE preserva OID, proprietário e ACL da função existente.
-- Recusar banco sem a função evita criá-la com privilégios padrão de PUBLIC.
do $$
begin
 if pg_catalog.to_regprocedure('public.admin_action(text,jsonb)') is null then
  raise exception 'ADMIN_ACTION_NOT_FOUND: função existente obrigatória; não reaplique migrations antigas.';
 end if;
end $$;

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
   'services',(select jsonb_agg(svc) from public.services as svc),
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
    and (exists(select 1 from private.allowed_weekday_starts r where r.weekday=v.weekday)
     or mod(extract(epoch from start_time-(((p_data->>'date')::date+v.opens) at time zone 'America/Sao_Paulo')),1800)=0))
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
  if jsonb_typeof(p_data->'hours') is distinct from 'array' or jsonb_array_length(p_data->'hours')>28 then raise exception 'INVALID_HOURS';end if;
  delete from public.availability;
  insert into public.availability(weekday,opens,closes,active)
   select weekday,opens::time,closes::time,active from jsonb_to_recordset(p_data->'hours') as h(weekday integer,opens text,closes text,active boolean);
  if exists(select 1 from public.availability x join public.availability y on x.id<>y.id and x.weekday=y.weekday and x.active and y.active and x.opens<y.closes and y.opens<x.closes) then raise exception 'OVERLAPPING_HOURS';end if;
  -- Uma abertura incompatível não pode ser salva silenciosamente como dia vazio.
  if exists(select 1 from public.availability v join private.allowed_weekday_starts r on r.weekday=v.weekday
    where v.active and not exists(select 1 from unnest(r.starts) t where t>=v.opens and t<v.closes)) then
   raise exception 'HOURS_WITHOUT_ALLOWED_START';
  end if;
 else raise exception 'INVALID_ACTION';end if;
 insert into public.audit_log(actor,action,record_id,details) values(auth.uid(),p_action,coalesce(rid::text,p_data->>'id'),
  case when p_action in ('status','reschedule') then jsonb_build_object('before',to_jsonb(a)-'client_name'-'client_id','after',p_data) else p_data end);
 return jsonb_build_object('ok',true);
end $$;

commit;
