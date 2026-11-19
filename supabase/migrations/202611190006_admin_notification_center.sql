-- Incremental only. Requires migrations 001–005 already installed.
-- Review and back up the production database before manual execution.
-- Never re-run this installation migration after a successful application.
begin;

create table private.admin_notifications (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  created_at timestamptz not null
);
create index admin_notifications_recent
  on private.admin_notifications(created_at desc, appointment_id desc);

create table private.admin_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references private.admin_notifications(appointment_id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(user_id, appointment_id)
);

-- Sanitized ledger survives the Push worker's seven-day cleanup/unsubscribe.
-- No endpoints, subscription keys, tokens or customer snapshots.
create table private.admin_notification_push (
  delivery_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  state text not null check(state in ('pending','sending','accepted','failed','expired','unknown'))
);
create index admin_notification_push_owner
  on private.admin_notification_push(user_id, appointment_id);

alter table private.admin_notifications enable row level security;
alter table private.admin_notification_reads enable row level security;
alter table private.admin_notification_push enable row level security;
revoke all on private.admin_notifications, private.admin_notification_reads,
  private.admin_notification_push from public, anon, authenticated;

-- A notification failure must not cancel a successfully booked appointment.
-- If the ledger insert fails, booking proceeds; reconciliation may be required.
create function private.record_admin_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.admin_notifications(appointment_id, created_at)
  values(new.id, new.created_at)
  on conflict do nothing;
  return new;
exception when others then
  raise warning 'ADMIN_NOTIFICATION_RECORD_FAILED SQLSTATE %', sqlstate;
  return new;
end $$;
revoke all on function private.record_admin_notification() from public, anon, authenticated;
create trigger record_admin_notification after insert on public.appointments
  for each row execute function private.record_admin_notification();

-- Backfill existing reservations; this is independent of notification delivery.
insert into private.admin_notifications(appointment_id, created_at)
  select id, created_at from public.appointments on conflict do nothing;

create function private.record_admin_notification_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    -- 005 deletes subscriptions on 404/410 and unsubscribe. The reason is not
    -- persisted there: never invent an expiry/acceptance for an interrupted send.
    update private.admin_notification_push
       set state='unknown'
     where delivery_id=old.id and state in ('sending','pending');
    return old;
  end if;
  if new.kind='booking' then
    insert into private.admin_notification_push(delivery_id,user_id,appointment_id,state)
      select new.id, s.user_id, new.appointment_id, new.state
      from private.push_subscriptions s where s.id=new.subscription_id
      on conflict(delivery_id) do update set state=excluded.state;
  end if;
  return new;
exception when others then
  -- A diagnostic ledger must never interrupt the existing Push queue/worker.
  raise warning 'ADMIN_NOTIFICATION_PUSH_LOG_FAILED SQLSTATE %',sqlstate;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.record_admin_notification_push() from public,anon,authenticated;
create trigger record_admin_notification_push after insert or update or delete on private.push_deliveries
  for each row execute function private.record_admin_notification_push();
insert into private.admin_notification_push(delivery_id,user_id,appointment_id,state)
  select d.id,s.user_id,d.appointment_id,d.state from private.push_deliveries d
  join private.push_subscriptions s on s.id=d.subscription_id where d.kind='booking';

-- Invoker can only reach this through the guarded definer RPC below.
create function private.admin_notification_rows(p_user uuid)
returns table(id uuid,created_at timestamptz,read_at timestamptz,push jsonb,has_issues boolean)
language sql stable set search_path='' as $$
  with deliveries as (
    select p.appointment_id, jsonb_object_agg(p.state,p.n) as states,
      bool_or(p.state in ('failed','unknown','expired')) as issues
    from (
      select d.appointment_id,d.state,count(*) as n
      from private.admin_notification_push d
      where d.user_id=p_user group by d.appointment_id,d.state
    ) p group by p.appointment_id
  )
  select n.appointment_id,n.created_at,r.read_at,
    coalesce(d.states,'{}'::jsonb),coalesce(d.issues,false)
  from private.admin_notifications n
  left join private.admin_notification_reads r
    on r.appointment_id=n.appointment_id and r.user_id=p_user
  left join deliveries d on d.appointment_id=n.appointment_id
$$;
revoke all on function private.admin_notification_rows(uuid) from public,anon,authenticated;

create function public.admin_notifications(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); f text:=coalesce(p_data->>'filter','all');
  period text:=coalesce(p_data->>'period','all'); lo timestamptz:='-infinity'; hi timestamptz:='infinity';
  cutoff timestamptz:=now(); before_time timestamptz; before_id uuid;
  result jsonb; changed integer; target uuid; day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_action is null or p_action not in ('list','read','read_filter','detail')
    or f not in ('all','unread','read','issues')
    or period not in ('all','today','week','month') then raise exception 'INVALID_ACTION'; end if;

  if period='today' then
    lo:=day::timestamp at time zone 'America/Sao_Paulo'; hi:=lo+interval '1 day';
  elsif period='week' then
    lo:=date_trunc('week',day::timestamp) at time zone 'America/Sao_Paulo'; hi:=lo+interval '7 days';
  elsif period='month' then
    lo:=date_trunc('month',day::timestamp) at time zone 'America/Sao_Paulo'; hi:=lo+interval '1 month';
  end if;
  if p_data ? 'until' then cutoff:=least((p_data->>'until')::timestamptz,cutoff); end if;

  if p_action='detail' then
    select to_jsonb(a) || jsonb_build_object('phone',c.phone) into result
      from public.appointments a join public.clients c on c.id=a.client_id
      where a.id=(p_data->>'id')::uuid;
    if result is null then raise exception 'NOT_FOUND'; end if;
    return result;
  end if;

  if p_action='read' then
    target:=(p_data->>'id')::uuid;
    if not exists(select 1 from private.admin_notifications where appointment_id=target)
      then raise exception 'NOT_FOUND'; end if;
    if coalesce((p_data->>'read')::boolean,true) then
      insert into private.admin_notification_reads(user_id,appointment_id)
        values(uid,target) on conflict do nothing;
    else
      delete from private.admin_notification_reads where user_id=uid and appointment_id=target;
    end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='read_filter' then
    insert into private.admin_notification_reads(user_id,appointment_id)
      select uid,n.id from private.admin_notification_rows(uid) n
      where n.read_at is null and n.created_at>=lo and n.created_at<hi
        and n.created_at<=cutoff
        and (f in ('all','unread') or (f='issues' and n.has_issues))
      on conflict do nothing;
    get diagnostics changed=row_count;
    return jsonb_build_object('changed',changed);
  end if;

  before_time:=(p_data->>'before_time')::timestamptz;
  before_id:=(p_data->>'before_id')::uuid;
  if (before_time is null)<>(before_id is null) then raise exception 'INVALID_CURSOR'; end if;

  with all_rows as materialized (select * from private.admin_notification_rows(uid)),
  filtered as materialized (
    select * from all_rows n where n.created_at>=lo and n.created_at<hi
      and n.created_at<=cutoff
      and (f='all' or (f='unread' and n.read_at is null)
        or (f='read' and n.read_at is not null)
        or (f='issues' and n.has_issues))
  ),
  page as (
    select * from filtered n
    where before_time is null or (n.created_at,n.id)<(before_time,before_id)
    order by n.created_at desc,n.id desc limit 21
  ),
  items as (
    select n.*,a.client_name,a.service_name,a.starts_at from page n
    join public.appointments a on a.id=n.id
    order by n.created_at desc,n.id desc limit 20
  )
  select jsonb_build_object(
    'until',cutoff,
    'unread',(select count(*) from all_rows where read_at is null),
    'total',(select count(*) from filtered),
    'has_more',(select count(*)>20 from page),
    'metrics',(select jsonb_build_object(
      'total',count(*),'unread',count(*) filter(where read_at is null),
      'read',count(*) filter(where read_at is not null),
      'accepted',count(*) filter(where push ? 'accepted'),
      'issues',count(*) filter(where has_issues)
    ) from filtered),
    'states',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb)
      from (select e.key as state,sum(e.value::bigint) as n
        from filtered cross join lateral jsonb_each_text(push) e group by e.key) s),
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id desc),'[]'::jsonb)
      from items i),
    'recent',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb)
      from (select n.*,a.client_name,a.service_name,a.starts_at
        from all_rows n join public.appointments a on a.id=n.id
        order by n.created_at desc,n.id desc limit 4) r)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_notifications(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_notifications(text,jsonb) to authenticated;

commit;
