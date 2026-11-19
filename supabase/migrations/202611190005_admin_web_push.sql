-- Incremental, LOCAL preparation only. Does not rewrite 001/002/003/004.
begin;
create table private.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 20 and 2048),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),
 updated_at timestamptz not null default now(),
 last_test_at timestamptz
);
create table private.push_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references private.push_subscriptions(id) on delete cascade,
 appointment_id uuid references public.appointments(id) on delete cascade,
 kind text not null check(kind in ('booking','test')),
 state text not null default 'pending' check(state in ('pending','sending','accepted','expired','failed','unknown')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 unique(subscription_id,appointment_id),
 check((kind='booking')=(appointment_id is not null))
);
create index push_pending on private.push_deliveries(available_at,created_at) where state='pending';
alter table private.push_subscriptions enable row level security;
alter table private.push_deliveries enable row level security;
revoke all on private.push_subscriptions,private.push_deliveries from public,anon,authenticated;
-- Private tables have no browser policies or direct grants, including for admins.

create function public.admin_push(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare ep text:=p_data->>'endpoint'; sub private.push_subscriptions; delivery uuid;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 -- Serialize per-user registrations/tests and cap the number of devices.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,190005));
 if p_action not in ('status','subscribe','unsubscribe','test') or p_action is null then raise exception 'INVALID_ACTION';end if;
 if ep is null or length(ep)>2048 then raise exception 'INVALID_ENDPOINT';end if;
 select * into sub from private.push_subscriptions where endpoint=ep and user_id=auth.uid();
 if p_action='status' then return jsonb_build_object('enabled',sub.id is not null);end if;
 if p_action='unsubscribe' then
  delete from private.push_subscriptions where id=sub.id;
  return jsonb_build_object('enabled',false);
 elsif p_action='subscribe' then
  -- Defense in depth against arbitrary server-side destinations. Worker validates again.
  if ep !~ '^https://(web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/[^[:space:]?#]+$'
   or p_data->>'p256dh' is null or p_data->>'auth' is null then raise exception 'INVALID_SUBSCRIPTION';end if;
  if sub.id is null and (select count(*) from private.push_subscriptions where user_id=auth.uid())>=20 then raise exception 'DEVICE_LIMIT';end if;
  insert into private.push_subscriptions(user_id,endpoint,p256dh,auth)
   values(auth.uid(),ep,p_data->>'p256dh',p_data->>'auth')
   on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now()
    where private.push_subscriptions.user_id=auth.uid();
  if not found then raise exception 'DEVICE_OWNER_CONFLICT';end if;
  return jsonb_build_object('enabled',true);
 elsif p_action='test' then
  if sub.id is null then raise exception 'NOT_SUBSCRIBED';end if;
  if sub.last_test_at>now()-interval '1 minute' then raise exception 'TEST_RATE_LIMIT';end if;
  update private.push_subscriptions set last_test_at=now() where id=sub.id;
  insert into private.push_deliveries(subscription_id,kind) values(sub.id,'test') returning id into delivery;
  return jsonb_build_object('deliveryId',delivery);
 end if;
 return '{}';
end $$;
revoke all on function public.admin_push(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_push(text,jsonb) to authenticated;

-- Runs in the booking transaction: rollback => no delivery, idempotent replay => no insert.
-- Push errors must not turn a valid appointment into a failed booking.
create function private.queue_booking_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' then
  insert into private.push_deliveries(subscription_id,appointment_id,kind)
   select s.id,new.id,'booking' from private.push_subscriptions s
    join public.admin_users a on a.user_id=s.user_id
   on conflict(subscription_id,appointment_id) do nothing;
 end if;
 return new;
exception when others then
 raise warning 'PUSH_QUEUE_FAILED SQLSTATE %',sqlstate;
 return new;
end $$;
revoke all on function private.queue_booking_push() from public,anon,authenticated;
create trigger queue_booking_push after insert on public.appointments for each row execute function private.queue_booking_push();

create function public.claim_push(p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.push_deliveries; s private.push_subscriptions;
begin
 -- Never blindly resend an uncertain dispatch after a process dies.
 update private.push_deliveries set state='unknown' where state='sending' and claimed_at<now()-interval '5 minutes';
 update private.push_deliveries set state='expired' where state='pending' and created_at<=now()-interval '24 hours';
 delete from private.push_deliveries where created_at<now()-interval '7 days';
 delete from private.push_subscriptions ps where not exists(select 1 from public.admin_users a where a.user_id=ps.user_id);
 select * into d from private.push_deliveries where state='pending' and available_at<=now()
  and created_at>now()-interval '24 hours' and (p_id is null or id=p_id)
  order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 select * into strict s from private.push_subscriptions where id=d.subscription_id;
 update private.push_deliveries set state='sending',claimed_at=now(),attempts=attempts+1 where id=d.id;
 return jsonb_build_object('id',d.id,'kind',d.kind,'appointmentId',d.appointment_id,
  'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)));
end $$;
create function public.finish_push(p_id uuid,p_result text) returns void
language plpgsql security definer set search_path='' as $$
declare d private.push_deliveries;
begin
 select * into d from private.push_deliveries where id=p_id and state='sending' for update;
 if not found then return;end if;
 if p_result='expired' then delete from private.push_subscriptions where id=d.subscription_id;
 elsif p_result='retry' and d.attempts<3 then
  update private.push_deliveries set state='pending',available_at=now()+interval '5 minutes' where id=p_id;
 else
  update private.push_deliveries set state=case when p_result in ('accepted','failed','unknown') then p_result else 'failed' end where id=p_id;
 end if;
end $$;
revoke all on function public.claim_push(uuid),public.finish_push(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_push(uuid),public.finish_push(uuid,text) to service_role;
commit;
