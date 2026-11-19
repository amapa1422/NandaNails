-- MANUAL only, after review and explicit remote authorization.
-- Removes Central history/read state. Does not change Push or appointments.
begin;
drop trigger record_admin_notification on public.appointments;
drop trigger record_admin_notification_push on private.push_deliveries;
drop function public.admin_notifications(text,jsonb);
drop function private.admin_notification_rows(uuid);
drop function private.record_admin_notification();
drop function private.record_admin_notification_push();
drop table private.admin_notification_reads;
drop table private.admin_notification_push;
drop table private.admin_notifications;
commit;
