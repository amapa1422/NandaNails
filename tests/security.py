"""Review-specific tests against a disposable local database, never Supabase."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode=True
import database as db

db.BASE[db.BASE.index('-d')+1]='nandanails_security_test'
owner=db.BASE.copy();owner[owner.index('nandanails_security_test')]='postgres'
for query in ['drop database if exists nandanails_security_test with (force);','create database nandanails_security_test;']:
    r=subprocess.run(owner,input=query,text=True,capture_output=True);assert r.returncode==0,r.stderr
shim=Path('tests/bootstrap.sql').read_text(encoding='utf-8');db.sql(shim[shim.index('create schema auth;'):])
db.sql('create schema private;alter default privileges in schema public grant all on tables to public,anon,authenticated;alter default privileges in schema public grant all on sequences to public,anon,authenticated;alter default privileges in schema private grant all on tables to public,anon,authenticated;')
for path in sorted(Path('supabase/migrations').glob('*.sql')):db.sql(path.read_text(encoding='utf-8'))
db.sql("insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into public.admin_users values('11111111-1111-4111-8111-111111111111');")
db.sql("""
 insert into public.clients(name,phone) values('Cliente Sigilosa','5511955555555');
 insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes)
  select gen_random_uuid(),id,'remocao',name,'Remoção','2026-01-01T09:00:00-03:00','2026-01-01T09:30:00-03:00',1500,30 from public.clients;
 insert into public.notification_outbox(appointment_id) select id from public.appointments;
 insert into public.audit_log(action) values('test_fixture');
 insert into public.schedule_blocks(starts_at,ends_at,reason) values('2026-01-02T09:00:00-03:00','2026-01-02T10:00:00-03:00','Privado');
""")

tables=['services','clients','appointments','availability','schedule_blocks','admin_users','audit_log','notification_outbox']
for table in tables:
    db.sql(f'set role anon;select * from public.{table};',False)
    assert db.sql(f"set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';select count(*) from public.{table};")=='0'
    assert int(db.sql(f"set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select count(*) from public.{table};"))>0
    assert db.sql(f"select relrowsecurity from pg_class where oid='public.{table}'::regclass;")=='t'
    for role in ['anon','authenticated']:
        for privilege in ['INSERT','UPDATE','DELETE','TRUNCATE']:
            assert db.sql(f"select has_table_privilege('{role}','public.{table}','{privilege}');")=='f'
for table in ['rate_limits','used_challenges','allowed_weekday_starts','schedule_default_updates']:
    for role in ['anon','authenticated']:
        db.sql(f'set role {role};select * from private.{table};',False)
        for privilege in ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']:
            assert db.sql(f"select has_table_privilege('{role}','private.{table}','{privilege}');")=='f'
assert db.sql("select has_sequence_privilege('anon','public.audit_log_id_seq','USAGE');")=='f'
for fn in ['agenda_catalog()','agenda_availability(text,date,date)','agenda_book(text,date,time,text,text,uuid,integer,integer)','agenda_rate_limit(text,text)','agenda_consume_challenge(text)','claim_notification()','finish_notification(uuid,text,text,text)']:
    for role in ['anon','authenticated']:assert db.sql(f"select has_function_privilege('{role}','public.{fn}','EXECUTE');")=='f'
assert db.sql("select to_regprocedure('public.agenda_book(text,date,time,text,text,uuid,text,integer,integer)') is null;")=='t'
assert 'FORBIDDEN' in db.sql("set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';select public.admin_action('hours','{\"hours\":[]}');",False)
db.sql("set role authenticated;insert into public.admin_users values('22222222-2222-4222-8222-222222222222');",False)
print('PASS all public/private tables, RLS, write privileges, service-only RPCs, removed old signature and unauthorized admin escalation')

today=dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"));monday=today+dt.timedelta(days=(7-today.weekday())%7+7)
book=db.book(str(monday),'15:00')
assert db.sql("set role service_role;select public.agenda_rate_limit('book');")=='t'
bad=book.replace("'15:00'","'09:00'")
db.sql(bad,False)
assert db.sql("select count from private.rate_limits where bucket='book:global';")=='1'
db.sql("update private.rate_limits set count=59 where bucket='book:global';")
assert db.sql("set role service_role;select public.agenda_rate_limit('book');")=='t'
assert db.sql("set role service_role;select public.agenda_rate_limit('book');")=='f'
assert db.sql("select count from private.rate_limits where bucket='book:global';")=='61'
db.sql("update private.rate_limits set expires_at=now()-interval '1 second' where bucket='book:global';")
assert db.sql("set role service_role;select public.agenda_rate_limit('book');")=='t'
assert db.sql("select count from private.rate_limits where bucket='book:global';")=='1'
db.sql("set role service_role;select public.agenda_rate_limit('book_phone','chosen-key');",False)
db.sql("set role service_role;select public.agenda_rate_limit('book','"+'a'*64+"');",False)
# Phone quota concurrency: exactly five independent atomic calls succeed.
query="set role service_role;select public.agenda_rate_limit('book_phone','"+'b'*64+"');"
with concurrent.futures.ThreadPoolExecutor(6) as ex:results=list(ex.map(db.sql,[query]*6))
assert sorted(results)==['f','t','t','t','t','t'],results
print('PASS persistent failed-attempt counts, denied-attempt persistence, expiration, fixed global scopes and concurrent phone quotas')
query="set role service_role;select public.agenda_consume_challenge('"+'c'*64+"');"
with concurrent.futures.ThreadPoolExecutor(2) as ex:assert sorted(ex.map(db.sql,[query]*2))==['f','t']
print('PASS database rejects concurrent replay of a verified captcha token')

def slots(date,service='molde-f1'):
    return [s['time'] for s in json.loads(db.sql(f"set role service_role;select public.agenda_availability('{service}','{date}','{date}');"))['slots']]
hours=[dict(weekday=i,opens='15:15',closes='18:00',active=True) for i in range(1,6)]+[dict(weekday=6,opens='08:00',closes='16:00',active=True)]
db.rpc('hours',{'hours':hours})
assert slots(monday)==['16:00']
saved=json.loads(db.sql(db.book(str(monday),'16:00')))['booking']['id']
db.rpc('reschedule',{'id':saved,'date':str(monday+dt.timedelta(days=1)),'time':'16:00'})
before=db.sql("select jsonb_agg(to_jsonb(v) order by weekday) from public.availability v;")
bad_hours=[dict(weekday=1,opens='08:00',closes='12:00',active=True)]
try:db.rpc('hours',{'hours':bad_hours})
except AssertionError as error:assert 'HOURS_WITHOUT_ALLOWED_START' in str(error)
else:raise AssertionError('Incompatible shift accepted')
assert db.sql("select jsonb_agg(to_jsonb(v) order by weekday) from public.availability v;")==before
for payload in [{},{'hours':None},{'hours':'bad'}]:
    try:db.rpc('hours',payload)
    except AssertionError as error:assert 'INVALID_HOURS' in str(error)
    else:raise AssertionError('Malformed hours accepted')
assert db.sql("select jsonb_agg(to_jsonb(v) order by weekday) from public.availability v;")==before
db.rpc('hours',{'hours':[]});assert slots(monday)==[]
assert db.sql(f"select duration_minutes||':'||price_cents from public.appointments where id='{saved}';")=='120:9000'
print('PASS 15:15 opening retains 16:00 slot and reschedule, incompatible/malformed edits roll back, closure preserves bookings')

# FK, immutable snapshots and late starts are also covered by existing suites.
assert 'foreign key' in db.sql("insert into public.admin_users values(gen_random_uuid());",False).lower()
assert 'foreign key' in db.sql(f"insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes) values(gen_random_uuid(),gen_random_uuid(),'remocao','Cliente Teste','Remoção','{monday}T10:00:00-03:00','{monday}T10:30:00-03:00',1500,30);",False).lower()
assert 'foreign key' in db.sql(f"insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes) select gen_random_uuid(),client_id,'missing-service','Cliente Teste','Remoção','{monday}T10:00:00-03:00','{monday}T10:30:00-03:00',1500,30 from public.appointments where id='{saved}';",False).lower()
print('PASS admin, client and service foreign keys reject missing referenced records')
print('All security review tests passed locally.')
