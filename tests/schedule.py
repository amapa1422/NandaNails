"""New default schedule integration tests. Fixed disposable LOCAL database only."""
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import uuid
sys.dont_write_bytecode=True
import database as db

db.BASE[db.BASE.index('nandanails_test')]='nandanails_schedule_test'
admin=db.BASE.copy();admin[admin.index('nandanails_schedule_test')]='postgres'
for query in ['drop database if exists nandanails_schedule_test with (force);','create database nandanails_schedule_test;']:
    result=subprocess.run(admin,input=query,text=True,capture_output=True)
    assert result.returncode==0,result.stderr
bootstrap=Path('tests/bootstrap.sql').read_text(encoding='utf-8')
db.sql(bootstrap[bootstrap.index('create schema auth;'):])
db.sql(Path('supabase/migrations/202611170001_agenda.sql').read_text(encoding='utf-8'))
db.sql("insert into auth.users values('11111111-1111-4111-8111-111111111111');insert into public.admin_users values('11111111-1111-4111-8111-111111111111');")
migration=Path('supabase/migrations/202611170002_horarios_padrao.sql').read_text(encoding='utf-8')
today=dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"))
monday=today+dt.timedelta(days=(7-today.weekday())%7+7)
saturday=monday+dt.timedelta(days=5)
services={'molde-f1':(120,9000),'esmaltacao-gel':(60,7000),'esmaltacao-gel-pe':(60,6000),'manutencao-alongamento':(90,6500),'remocao':(30,1500)}
def slots(service,date):
    return [s['time'] for s in json.loads(db.sql(f"set role service_role;select public.agenda_availability('{service}','{date}','{date}');"))['slots']]
def book(service,date,time,phone='5511912345678'):
    duration,price=services[service]
    return f"set role service_role;select public.agenda_book('{service}','{date}','{time}','Cliente Teste','{phone}','{uuid.uuid4()}','{uuid.uuid4()}',{price},{duration});"
def snapshot(tables):
    return {table:db.sql(f"select coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text),'[]') from {table} v;") for table in tables}

# An old, now off-hours booking must survive the migration byte-for-byte as JSON.
old=json.loads(db.sql(book('molde-f1',monday,'09:00')))['booking']['id']
protected=['public.clients','public.appointments','public.services','public.schedule_blocks','public.notification_outbox','public.audit_log']
before=snapshot(protected)
db.sql(migration)
assert db.sql("select applied from private.schedule_default_updates;")=='t'
assert snapshot(protected)==before
print('PASS original defaults detected; clients, reservations, services, blocks, outbox and audit preserved')

for d in range(5):
    for service in services:
        assert slots(service,monday+dt.timedelta(days=d))==['15:00','16:00'],(d,service)
print('PASS Monday-Friday: all five durations offer only 15:00 and 16:00')
for service,(duration,_) in services.items():
    expected=[f'{m//60:02}:{m%60:02}' for m in range(8*60,16*60-duration+1,30)]
    assert slots(service,saturday)==expected,(service,slots(service,saturday))
    assert slots(service,saturday+dt.timedelta(days=1))==[]
    db.sql(book(service,saturday,'16:00'),False)
print('PASS Saturday 08:00-16:00 with duration-aware latest starts; Sunday closed')

all_after=snapshot(protected+['public.availability','private.allowed_weekday_starts','private.schedule_default_updates'])
db.sql(migration)
assert snapshot(list(all_after))==all_after
print('PASS idempotent second execution preserves data and identifiers')

occupied=json.loads(db.sql(book('molde-f1',monday,'15:00',phone='5511922222222')))['booking']['id']
assert slots('remocao',monday)==[]
db.sql(book('remocao',monday,'16:00'),False)
for time in ['08:00','14:00','15:30','16:30','17:00','19:00']:
    db.sql(book('remocao',monday+dt.timedelta(days=1),time),False)
    try:db.rpc('reschedule',{'id':old,'date':str(monday+dt.timedelta(days=1)),'time':time})
    except AssertionError as error:assert 'SLOT_CONFLICT' in str(error)
    else:raise AssertionError('Unexpected reschedule to '+time)
db.rpc('status',{'id':occupied,'status':'cancelled'})
assert slots('molde-f1',monday)==['15:00','16:00']
db.rpc('reschedule',{'id':old,'date':str(monday+dt.timedelta(days=1)),'time':'16:00'})
assert db.sql(f"select duration_minutes||':'||price_cents from public.appointments where id='{old}';")=='120:9000'
print('PASS occupied intervals hidden, off-grid booking/reschedule rejected, cancellation and valid reschedule preserved')

# Existing panel does not need new fields: saving hours must not unlock 15:30 etc.
hours=[dict(weekday=i,opens='15:00',closes='18:00',active=True) for i in range(1,6)]+[dict(weekday=6,opens='08:00',closes='16:00',active=True)]
db.rpc('hours',{'hours':hours})
assert slots('remocao',monday+dt.timedelta(days=2))==['15:00','16:00']
print('PASS existing admin hours save retains allowed-start policy')

# Simulate a pre-migration custom installation, including a manually customized turn.
db.sql("delete from private.schedule_default_updates;delete from private.allowed_weekday_starts;update public.availability set opens='10:00',closes='13:00' where weekday=1;")
custom=snapshot(['public.availability']+protected)
db.sql(migration)
assert db.sql('select applied from private.schedule_default_updates;')=='f'
assert snapshot(list(custom))==custom
assert '10:00' in slots('remocao',monday)
print('PASS custom schedule and all existing data preserved; no default policy imposed')

# Same apparent seed hours with a previous admin edit are uncertain, so skip too.
db.sql("delete from private.schedule_default_updates;update public.availability set opens='09:00',closes=case when weekday=6 then '14:00'::time else '18:00'::time end;")
custom=snapshot(['public.availability']+protected)
db.sql(migration)
assert db.sql('select applied from private.schedule_default_updates;')=='f'
assert snapshot(list(custom))==custom
print('PASS previous admin edits prevent replacement even when hours match old seed')
print('All new schedule tests passed on local PostgreSQL.')
