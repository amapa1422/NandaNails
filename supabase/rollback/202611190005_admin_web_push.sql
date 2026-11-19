-- Manual rollback ONLY after disabling the nn-web-push Cron job and push functions.
-- Deletes subscriptions and push delivery history; never changes appointments/clients.
begin;
drop trigger if exists queue_booking_push on public.appointments;
drop function if exists private.queue_booking_push();
drop function if exists public.admin_push(text,jsonb);
drop function if exists public.claim_push(uuid);
drop function if exists public.finish_push(uuid,text);
drop table if exists private.push_deliveries;
drop table if exists private.push_subscriptions;
commit;
