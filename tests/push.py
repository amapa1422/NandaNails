"""Push regression: ONLY a disposable database on 127.0.0.1:55432."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode=True
import database as db
db.BASE[db.BASE.index('-d')+1]='nandanails_push_test'
owner=db.BASE.copy();owner[owner.index('nandanails_push_test')]='postgres'
for q in ['drop database if exists nandanails_push_test with (force);','create database nandanails_push_test;']:
 r=subprocess.run(owner,input=q,text=True,capture_output=True);assert r.returncode==0,r.stderr
shim=Path('tests/bootstrap.sql').read_text(encoding='utf-8');db.sql(shim[shim.index('create schema auth;'):])
for path in sorted(Path('supabase/migrations').glob('*.sql')):db.sql(path.read_text(encoding='utf-8'))
admin='11111111-1111-4111-8111-111111111111';common='22222222-2222-4222-8222-222222222222'
db.sql(f"insert into auth.users values('{admin}'),('{common}');insert into public.admin_users values('{admin}');")
def push(action,data,uid=admin,ok=True):
 return db.sql(f"set role authenticated;set request.jwt.claim.sub='{uid}';select public.admin_push('{action}','{json.dumps(data)}');",ok)
sub={'endpoint':'https://web.push.apple.com/token1','p256dh':'B'*87,'auth':'a'*22}
for role in ['anon','authenticated']:
 for table in ['push_subscriptions','push_deliveries']:db.sql(f'set role {role};select * from private.{table};',False)
 db.sql(f'set role {role};select public.claim_push();',False)
 db.sql(f"set role {role};select public.finish_push(gen_random_uuid(),'accepted');",False)
assert 'FORBIDDEN' in push('subscribe',sub,common,False)
assert json.loads(push('subscribe',sub))['enabled']
push('subscribe',sub)
assert db.sql('select count(*) from private.push_subscriptions;')=='1'
push('subscribe',{**sub,'endpoint':'https://fcm.googleapis.com/token2'})
push('subscribe',{**sub,'endpoint':'https://127.0.0.1/token'},ok=False)
other='44444444-4444-4444-8444-444444444444'
db.sql(f"insert into auth.users values('{other}');insert into public.admin_users values('{other}');")
assert not json.loads(push('status',{'endpoint':sub['endpoint']},other))['enabled']
push('unsubscribe',{'endpoint':sub['endpoint']},other)
assert 'DEVICE_OWNER_CONFLICT' in push('subscribe',sub,other,False)
assert db.sql('select count(*) from private.push_subscriptions;')=='2'
print('PASS admin-only registrations, RLS/direct grants, worker isolation, idempotent subscription and multiple devices')
today=dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"));day=today+dt.timedelta(days=7)
while day.weekday()>4:day+=dt.timedelta(days=1)
query=db.book(str(day),'15:00',service='remocao',request='33333333-3333-4333-8333-333333333333')
result=json.loads(db.sql(query))
assert db.sql('select count(*) from private.push_deliveries;')=='2'
assert json.loads(db.sql(query))==result
assert db.sql('select count(*) from private.push_deliveries;')=='2'
db.sql(db.book(str(day),'15:00',service='remocao'),False)
assert db.sql('select count(*) from private.push_deliveries;')=='2'
db.sql('begin;'+db.book(str(day),'16:00',service='remocao')+'rollback;')
assert db.sql('select count(*) from private.push_deliveries;')=='2'
print('PASS persistent booking queues exactly once per device; replay, conflict and transaction rollback create no extra push')
def claim():return db.sql('set role service_role;select public.claim_push();')
with concurrent.futures.ThreadPoolExecutor(4) as ex:jobs=[json.loads(x) for x in ex.map(lambda _:claim(),range(4)) if x]
assert len(jobs)==2 and len({j['id'] for j in jobs})==2
assert claim()==''
db.sql(f"set role service_role;select public.finish_push('{jobs[0]['id']}','accepted');")
db.sql(f"set role service_role;select public.finish_push('{jobs[1]['id']}','unknown');")
assert claim()==''
retry=json.loads(push('test',{'endpoint':'https://fcm.googleapis.com/token2'}))['deliveryId']
for attempt in range(3):
 db.sql(f"update private.push_deliveries set available_at=now() where id='{retry}';")
 assert json.loads(db.sql(f"set role service_role;select public.claim_push('{retry}');"))['id']==retry
 db.sql(f"set role service_role;select public.finish_push('{retry}','retry');")
assert db.sql(f"select state from private.push_deliveries where id='{retry}';")=='failed'
db.sql("update private.push_subscriptions set last_test_at=null;")
stale=json.loads(push('test',{'endpoint':'https://fcm.googleapis.com/token2'}))['deliveryId']
assert json.loads(claim())['id']==stale
db.sql(f"update private.push_deliveries set claimed_at=now()-interval '6 minutes' where id='{stale}';")
assert claim()==''
assert db.sql(f"select state from private.push_deliveries where id='{stale}';")=='unknown'
db.sql("update private.push_subscriptions set last_test_at=null;")
old=json.loads(push('test',{'endpoint':'https://fcm.googleapis.com/token2'}))['deliveryId']
db.sql(f"update private.push_deliveries set created_at=now()-interval '25 hours' where id='{old}';")
assert claim()==''
assert db.sql(f"select state from private.push_deliveries where id='{old}';")=='expired'
print('PASS concurrent workers never claim the same dispatch; accepted/uncertain dispatch is never resent')
test=json.loads(push('test',{'endpoint':sub['endpoint']}))['deliveryId']
push('test',{'endpoint':sub['endpoint']},ok=False)
j=json.loads(db.sql(f"set role service_role;select public.claim_push('{test}');"));assert j['kind']=='test'
db.sql(f"set role service_role;select public.finish_push('{test}','expired');")
assert db.sql(f"select count(*) from private.push_subscriptions where endpoint='{sub['endpoint']}';")=='0'
push('unsubscribe',{'endpoint':'https://fcm.googleapis.com/token2'})
assert db.sql('select count(*) from private.push_subscriptions;')=='0'
print('PASS test push without booking, rate limit, expired subscription cleanup and cancellation')
# Simulate outbox failure: booking still commits, trigger logs only SQLSTATE.
db.sql("create function private.break_push() returns trigger language plpgsql as $$ begin raise exception 'SIMULATED_QUEUE_FAILURE';end $$;create trigger break_push before insert on private.push_deliveries for each row execute function private.break_push();")
push('subscribe',sub)
booked=json.loads(db.sql(db.book(str(day),'16:00',service='remocao')));assert booked['booking']['id']
db.sql('drop trigger break_push on private.push_deliveries;drop function private.break_push();')
push('test',{'endpoint':sub['endpoint']})
db.sql(f"delete from public.admin_users where user_id='{admin}';")
assert claim()==''
assert db.sql('select count(*) from private.push_subscriptions;')=='0'
print('PASS queue failure does not fail booking; revoking admin authorization removes pending recipients')
before=db.sql('select count(*) from public.appointments;')
db.sql(Path('supabase/rollback/202611190005_admin_web_push.sql').read_text(encoding='utf-8'))
assert db.sql('select count(*) from public.appointments;')==before
assert db.sql("select to_regclass('private.push_subscriptions') is null;")=='t'
print('PASS rollback removes only push objects and preserves appointments')
