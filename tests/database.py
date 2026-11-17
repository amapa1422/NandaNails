"""Integration tests against a disposable LOCAL PostgreSQL, never a cloud project.
Start the local cluster on 127.0.0.1:55432 as documented, then run this file.
"""
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import uuid

PSQL = os.environ.get('NN_PSQL', r'C:\Program Files\PostgreSQL\18\bin\psql.exe')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', '55432', '-U', 'postgres', '-d', 'nandanails_test', '-qAt', '-v', 'ON_ERROR_STOP=1']

def sql(query, ok=True):
    result=subprocess.run(BASE, input=query, text=True, encoding='utf-8', capture_output=True)
    if ok and result.returncode: raise AssertionError(result.stderr)
    if not ok and not result.returncode: raise AssertionError('Expected failure: '+query)
    return result.stdout.strip() if ok else result.stderr

def rpc(action, data, admin=True):
    return sql("set role authenticated;set request.jwt.claim.sub='"+('11111111-1111-4111-8111-111111111111' if admin else '22222222-2222-4222-8222-222222222222')+"';select public.admin_action('"+action+"','"+json.dumps(data).replace("'","''")+"');")

def book(day, time, service='molde-f1', request=None, phone='5511912345678', name='Cliente Teste'):
    request=request or str(uuid.uuid4())
    price,duration={'molde-f1':(9000,120),'remocao':(1500,30)}[service]
    return f"set role service_role;select public.agenda_book('{service}','{day}','{time}','{name}','{phone}','{request}',{price},{duration});"

def check(label, fn):
    fn(); print('PASS '+label)

if __name__=='__main__':
    # Recreates only the dedicated database on the fixed local test port.
    admin=BASE.copy();admin[admin.index('nandanails_test')]='postgres'
    for q in ['drop database if exists nandanails_test with (force);','create database nandanails_test;']:
        r=subprocess.run(admin,input=q,text=True,capture_output=True)
        assert r.returncode==0,r.stderr
    bootstrap=Path('tests/bootstrap.sql').read_text(encoding='utf-8')
    bootstrap=bootstrap[bootstrap.index('create schema auth;'):]
    sql(bootstrap)
    sql(Path('supabase/migrations/202611170001_agenda.sql').read_text(encoding='utf-8'))
    sql("insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into public.admin_users values('11111111-1111-4111-8111-111111111111');")
    today=dt.date.fromisoformat(sql("select (now() at time zone 'America/Sao_Paulo')::date;"))
    day=today+dt.timedelta(days=3)
    while day.weekday()>4:day+=dt.timedelta(days=1)
    day=str(day)
    def catalog():
        data=json.loads(sql('set role service_role;select public.agenda_catalog();').splitlines()[-1]);assert sorted((x['duration_minutes'],x['price_cents']) for x in data['services'])==[(30,1500),(60,6000),(60,7000),(90,6500),(120,9000)]
    check('catalog, durations, integer cents',catalog)
    def rls():
        sql('set role anon;select * from public.clients;',False)
        assert sql('set role authenticated;select count(*) from public.clients;').splitlines()[-1]=='0'
        sql("set role anon;select public.agenda_catalog();",False)
        sql("set role authenticated;select public.agenda_book('molde-f1',current_date,'10:00','Cliente Teste','5511912345678',gen_random_uuid(),9000,120);",False)
        sql("set role authenticated;select public.admin_action('list','{}');",False)
        sql("set role authenticated;insert into public.admin_users values(auth.uid());",False)
    check('RLS, anonymous privacy, server-only booking, admin authorization',rls)
    def invalid():
        for phone in ['123','5511012345678','5511812345678']:
            sql(book(day,'09:00',phone=phone),False)
        sql(book(day,'09:00',name='Ana'),False)
    check('name and WhatsApp validation',invalid)
    def availability():
        for date in [today-dt.timedelta(days=1),today+dt.timedelta(days=91)]:
            assert json.loads(sql(f"set role service_role;select public.agenda_availability('molde-f1','{date}','{date}');").splitlines()[-1])['slots']==[]
        sunday=today+dt.timedelta(days=(6-today.weekday())%7+7)
        assert json.loads(sql(f"set role service_role;select public.agenda_availability('molde-f1','{sunday}','{sunday}');").splitlines()[-1])['slots']==[]
    check('past dates, horizon, days off',availability)
    request=str(uuid.uuid4());q=book(day,'09:00',request=request)
    result=json.loads(sql(q).splitlines()[-1])['booking'];appointment=result['id']
    def persistence():
        assert sql('select count(*) from public.appointments;')=='1'
        assert json.loads(sql(q).splitlines()[-1])['booking']['id']==appointment
        assert sql('select count(*) from public.notification_outbox;')=='1'
        assert sql('select duration_minutes||\':\'||price_cents from public.appointments;')=='120:9000'
        sql(book(day,'10:30',service='remocao'),False)
        sql(book(day,'11:00',service='remocao',phone='5511922222222'))
    check('persistence, snapshot, idempotency, overlap and adjacent intervals',persistence)
    def concurrency():
        queries=[book(day,'14:00',phone=p) for p in ['5511933333333','5511944444444']]
        def run(q): return subprocess.run(BASE,input=q,text=True,encoding='utf-8',capture_output=True).returncode
        with concurrent.futures.ThreadPoolExecutor(2) as ex:codes=list(ex.map(run,queries))
        assert sorted(codes)==[0,3],codes
        assert sql(f"select count(*) from public.appointments where starts_at='{day}T14:00:00-03:00';")=='1'
    check('two concurrent overlapping bookings: exactly one persists',concurrency)
    def exclusion():
        # Bypass application functions as DB owner to prove the final constraint.
        err=sql(f"insert into public.appointments(request_id,client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes) select gen_random_uuid(),client_id,service_id,client_name,service_name,starts_at,ends_at,price_cents,duration_minutes from public.appointments where id='{appointment}';",False)
        assert 'exclusion' in err.lower(),err
    check('GiST exclusion blocks overlap even without application validation',exclusion)
    def snapshots():
        rpc('service',dict(id='molde-f1',name='Alongamento Molde F1',description='Atualizado',duration_minutes=60,price_cents=10000,active=True))
        assert 'SERVICE_CHANGED' in sql(book(day,'12:00'),False)
        assert sql(f"select duration_minutes||':'||price_cents from public.appointments where id='{appointment}';")=='120:9000'
        rpc('reschedule',dict(id=appointment,date=day,time='16:00'))
        assert sql(f"select duration_minutes||':'||price_cents from public.appointments where id='{appointment}';")=='120:9000'
        rpc('status',dict(id=appointment,status='cancelled'))
        assert sql(f"select status from public.appointments where id='{appointment}';")=='cancelled'
    check('service editing, reschedule snapshot, cancellation, audit',snapshots)
    def blocks():
        rpc('block',dict(starts_at=day+'T09:00:00-03:00',ends_at=day+'T10:30:00-03:00',reason='Folga'))
        sql(book(day,'09:30',service='remocao'),False)
        block=sql('select id from public.schedule_blocks limit 1;')
        rpc('unblock',{'id':block})
        rpc('hours',{'hours':[dict(weekday=i,opens='12:00',closes='18:00',active=True) for i in range(1,7)]})
        sql(book(day,'09:30',service='remocao'),False)
        rpc('hours',{'hours':[]})
        assert json.loads(sql(f"set role service_role;select public.agenda_availability('molde-f1','{day}','{day}');").splitlines()[-1])['slots']==[]
        assert int(sql('select count(*) from public.audit_log;'))>=6
    check('blocks, unblock, hours and closure',blocks)
    def notifications():
        # First queued appointment was cancelled; claim skips it.
        for _ in range(4):
            out=sql('set role service_role;select public.claim_notification();')
            if not out:continue
            job=json.loads(out)
            if job:
                assert job['attempts']==1
                sql(f"set role service_role;select public.finish_notification('{job['id']}','accepted','mock-id',null);")
        assert int(sql("select count(*) from public.notification_outbox where state='accepted';"))>=1
    check('outbox claim, cancelled skip and provider result persistence',notifications)
    print('All local PostgreSQL integration tests passed.')
