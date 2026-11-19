"""Only a disposable PostgreSQL database on the fixed local test port."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode = True
import database as db

db.BASE[db.BASE.index('-d')+1] = 'nandanails_notification_center_test'
owner = db.BASE.copy(); owner[owner.index('nandanails_notification_center_test')] = 'postgres'
for query in ['drop database if exists nandanails_notification_center_test with (force);', 'create database nandanails_notification_center_test;']:
    result = subprocess.run(owner, input=query, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
shim = Path('tests/bootstrap.sql').read_text(encoding='utf-8')
db.sql(shim[shim.index('create schema auth;'):])
paths = sorted(Path('supabase/migrations').glob('*.sql'))
for path in paths[:-1]: db.sql(path.read_text(encoding='utf-8'))
admin = '11111111-1111-4111-8111-111111111111'
common = '22222222-2222-4222-8222-222222222222'
other = '44444444-4444-4444-8444-444444444444'
db.sql(f"insert into auth.users values('{admin}'),('{common}'),('{other}');insert into public.admin_users values('{admin}'),('{other}');")
today = dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"))
date = today + dt.timedelta(days=7)
while date.weekday() > 4: date += dt.timedelta(days=1)
query = db.book(str(date), '15:00', service='remocao', request='33333333-3333-4333-8333-333333333333')
booking = json.loads(db.sql(query))['booking']['id']
db.sql(paths[-1].read_text(encoding='utf-8'))

def rpc(action='list', data=None, uid=admin, ok=True):
    result = db.sql(f"set role authenticated;set request.jwt.claim.sub='{uid}';select public.admin_notifications('{action}','{json.dumps(data or {})}');", ok)
    return json.loads(result) if ok else result

for role in ['anon', 'authenticated']:
    for table in ['admin_notifications','admin_notification_reads','admin_notification_push','push_subscriptions','push_deliveries']:
        db.sql(f'set role {role};select * from private.{table};', False)
db.sql("set role anon;select public.admin_notifications('list');", False)
for action in ['list','read','read_filter','detail']:
    assert 'FORBIDDEN' in rpc(action, uid=common, ok=False)
assert rpc()['unread'] == 1 and rpc()['items'][0]['id'] == booking
assert rpc()['items'][0]['push'] == {}
assert rpc('detail', {'id': booking})['phone'] == '5511912345678'
assert json.loads(db.sql(query))['booking']['id'] == booking
assert rpc()['total'] == 1
print('PASS guarded RPCs, RLS/grants, historical backfill, no subscription, replay without duplicates, existing booking details')

rpc('read', {'id':booking}); assert rpc()['unread'] == 0
# Separate connection/device sees the persisted value, other account remains unread.
assert rpc()['items'][0]['read_at'] and rpc(uid=other)['unread'] == 1
rpc('read', {'id':booking,'read':False}); assert rpc()['unread'] == 1
db.sql(f"begin;{db.book(str(date),'16:00',service='remocao')}rollback;")
assert rpc()['total'] == 1
print('PASS individual read/unread, separate-device persistence, account isolation and rollback atomicity')

def push(action, data, uid=admin):
    return json.loads(db.sql(f"set role authenticated;set request.jwt.claim.sub='{uid}';select public.admin_push('{action}','{json.dumps(data)}');"))
for i in range(6):
    push('subscribe', {'endpoint':f'https://web.push.apple.com/fixture{i}','p256dh':'B'*87,'auth':'a'*22})
new = json.loads(db.sql(db.book(str(date),'16:00',service='remocao')))['booking']['id']
assert rpc()['total'] == 2
assert next(x for x in rpc()['items'] if x['id']==new)['push'] == {'pending':6}
for i, state in enumerate(['accepted','failed','expired','unknown','sending','pending']):
    db.sql(f"update private.push_deliveries set state='{state}' where subscription_id=(select id from private.push_subscriptions where endpoint='https://web.push.apple.com/fixture{i}');")
row = next(x for x in rpc()['items'] if x['id']==new)
assert row['has_issues'] and len(row['push'])==6
assert rpc()['metrics']['accepted']==1 and rpc()['metrics']['issues']==1
assert rpc(uid=other)['metrics']['accepted']==0
assert rpc(data={'filter':'issues'})['total']==1
assert rpc(data={'period':'today'})['total']==2
# No private endpoints/subscription keys in any response.
assert 'web.push.apple' not in json.dumps(rpc()) and 'p256dh' not in json.dumps(rpc())
db.sql('delete from private.push_deliveries;')
row = next(x for x in rpc()['items'] if x['id']==new)
assert row['push']['accepted']==1 and row['push']['unknown']==3 and 'sending' not in row['push'] and 'pending' not in row['push']
print('PASS all Push states, mixed-device acceptance/failure, sanitized ownership and durable cleanup snapshots')

# Ten thousand cancelled fixture reservations avoid occupying any real schedule.
db.sql(f"""insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes,status,created_at)
 select gen_random_uuid(),a.client_id,a.service_id,'Synthetic '||g,a.service_name,a.starts_at,a.ends_at,a.price_cents,a.duration_minutes,'cancelled',now()-interval '2 days'
 from public.appointments a cross join generate_series(1,10000) g where a.id='{booking}';""")
page=rpc(); cutoff=page['until']
assert page['total']==10002 and len(page['items'])==20
db.sql(f"""set role authenticated;set request.jwt.claim.sub='{admin}';
do $$ declare page jsonb; params jsonb:='{{}}'; last jsonb; begin
 create temporary table nn_seen(id uuid primary key) on commit drop;
 loop
  page:=public.admin_notifications('list',params);
  assert jsonb_array_length(page->'items')<=20;
  insert into nn_seen select (value->>'id')::uuid from jsonb_array_elements(page->'items');
  exit when not (page->>'has_more')::boolean;
  last:=(page->'items')->-1;
  params:=jsonb_build_object('until',page->>'until','before_time',last->>'created_at','before_id',last->>'id');
 end loop;
 assert (select count(*) from nn_seen)=10002;
end $$;""")
assert rpc('read_filter', {'period':'today','until':cutoff})['changed']==2
assert rpc(data={'filter':'unread','period':'today'})['total']==0
assert rpc(data={'filter':'read'})['total']==2
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    counts=list(pool.map(lambda _:rpc('read_filter',{'until':cutoff})['changed'],range(2)))
assert sum(counts)==10000 and rpc()['unread']==0
assert rpc(uid=other)['unread']==10002
assert rpc(data={'filter':'unread'})['items']==[]
print('PASS 10,002 records, keyset ties/order/no omissions, period/read filters, concurrent filter-wide marking and empty state')
# Broken diagnostics must not change the original queue/dispatch contract.
db.sql("create function private.break_notification_log() returns trigger language plpgsql as $$ begin raise exception 'SIMULATED_LOG_FAILURE';end $$;create trigger break_notification_log before insert or update on private.admin_notification_push for each row execute function private.break_notification_log();")
latest = json.loads(db.sql(db.book(str(date+dt.timedelta(days=7)),'15:00',service='remocao')))['booking']['id']
assert db.sql(f"select count(*) from private.push_deliveries where appointment_id='{latest}';")=='6'
job=json.loads(db.sql('set role service_role;select public.claim_push();'))
db.sql(f"set role service_role;select public.finish_push('{job['id']}','accepted');")
assert db.sql(f"select state from private.push_deliveries where id='{job['id']}';")=='accepted'
db.sql('drop trigger break_notification_log on private.admin_notification_push;drop function private.break_notification_log();')
assert rpc('read_filter',{'until':cutoff})['changed']==0 and rpc()['unread']==1
print('PASS diagnostic failure preserves booking/Push; filter batch cutoff leaves later reservation unread')
db.sql(f"delete from public.admin_users where user_id='{admin}';")
assert 'FORBIDDEN' in rpc(ok=False)
print('PASS revoked administrator denied after prior reads')
before=db.sql('select count(*) from public.appointments;')
db.sql(Path('supabase/rollback/202611190006_admin_notification_center.sql').read_text(encoding='utf-8'))
assert db.sql('select count(*) from public.appointments;')==before
assert db.sql("select to_regclass('private.push_subscriptions') is not null and to_regclass('private.push_deliveries') is not null;")=='t'
assert db.sql("select count(*) from pg_trigger where tgname='queue_booking_push';")=='1'
print('PASS Central-only rollback preserves appointments, original Push tables and queue trigger')
