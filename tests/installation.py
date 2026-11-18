"""Tests only against disposable local PostgreSQL on 127.0.0.1:55432."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import uuid
sys.dont_write_bytecode=True
import database as db

initial=Path('supabase/sql-editor/001_instalacao_nandanails.sql').read_text(encoding='utf-8')
seed=Path('supabase/migrations/202611170003_servicos_iniciais.sql').read_text(encoding='utf-8')
def setup(name):
    db.BASE[db.BASE.index(db.BASE[db.BASE.index('-d')+1])]=name
    owner=db.BASE.copy();owner[owner.index(name)]='postgres'
    for q in [f'drop database if exists {name} with (force);',f'create database {name};']:
        result=subprocess.run(owner,input=q,text=True,capture_output=True)
        assert result.returncode==0,result.stderr
    shim=Path('tests/bootstrap.sql').read_text(encoding='utf-8')
    db.sql(shim[shim.index('create schema auth;'):])
    # Model permissive initial grants: migrations must revoke them explicitly.
    db.sql('alter default privileges in schema public grant all on tables to public,anon,authenticated;')

def signature():
    return db.sql("""
    select jsonb_build_object(
      'services',(select jsonb_agg(to_jsonb(s) order by id) from public.services s),
      'hours',(select jsonb_agg(jsonb_build_array(weekday,opens,closes,active) order by weekday) from public.availability),
      'rules',(select jsonb_agg(to_jsonb(r) order by weekday) from private.allowed_weekday_starts r),
      'functions',(select jsonb_agg(pg_get_functiondef(p.oid) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('private','public') and p.proname in ('slots','start_allowed','is_admin','agenda_catalog','agenda_availability','agenda_book','agenda_rate_limit','agenda_consume_challenge','admin_action','claim_notification','finish_notification')),
      'rls',(select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
    );""")

setup('nandanails_install_test')
db.sql(Path('supabase/sql-editor/000_verificar_estrutura.sql').read_text(encoding='utf-8'))
db.sql(initial)
# The consolidated SQL remains the historical 001/002/003 installer.
# Apply the same incremental fix afterward as on an existing installation.
db.sql(Path('supabase/migrations/202611180004_admin_action_alias.sql').read_text(encoding='utf-8'))
full_signature=signature()
db.sql(Path('supabase/sql-editor/002_conferir_instalacao.sql').read_text(encoding='utf-8'))
assert db.sql('select count(*) from public.services;')=='5'
assert db.sql('select count(*) from public.admin_users;')=='0'
assert db.sql('select count(*) from public.appointments;')=='0'
assert db.sql('select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=\'public\' and c.relkind=\'r\';')=='t'
assert json.loads(db.sql('select public.agenda_catalog();'))['today']==db.sql("select (now() at time zone 'America/Sao_Paulo')::date;")
print('PASS complete installation, verification SQL, 5 services, 8 RLS tables, no customer/admin/booking seed, server reference date')

db.sql('set role anon;select * from public.clients;',False)
db.sql('set role anon;select * from public.appointments;',False)
db.sql("set role authenticated;select public.admin_action('list','{}');",False)
db.sql("set role authenticated;insert into public.admin_users values(gen_random_uuid());",False)
assert db.sql('set role authenticated;select count(*) from public.clients;')=='0'
assert db.sql("select has_function_privilege('anon','public.agenda_book(text,date,time,text,text,uuid,integer,integer)','EXECUTE');")=='f'
print('PASS anonymous privacy, denied self-promotion, authorization and restrictive function grants under permissive initial table grants')

db.sql(initial,False)
assert signature()==full_signature
print('PASS installation refuses repeat execution without altering existing data')
db.sql(seed);db.sql(seed)
assert signature()==full_signature
db.sql("update public.services set name='Serviço personalizado',price_cents=12345,duration_minutes=75,active=false where id='remocao';")
custom=signature();db.sql(seed);assert signature()==custom
print('PASS repeated service seed avoids duplicates and preserves customized name/price/duration/inactive state')

today=dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"))
day=today+dt.timedelta(days=(7-today.weekday())%7+7)
slots=json.loads(db.sql(f"set role service_role;select public.agenda_availability('molde-f1','{day}','{day}');"))['slots']
assert [s['time'] for s in slots]==['15:00','16:00']
queries=[db.book(str(day),'15:00',phone=p) for p in ['5511933333333','5511944444444']]
def execute(q):return subprocess.run(db.BASE,input=q,text=True,encoding='utf-8',capture_output=True).returncode
with concurrent.futures.ThreadPoolExecutor(2) as executor: assert sorted(executor.map(execute,queries))==[0,3]
assert db.sql('select count(*) from public.appointments;')=='1'
assert db.sql('select count(*) from public.notification_outbox;')=='1'
print('PASS installed server schedule and concurrent reservations: one persists with one notification queued')

setup('nandanails_chain_test')
for path in sorted(Path('supabase/migrations').glob('*.sql')):db.sql(path.read_text(encoding='utf-8'))
assert signature()==full_signature
print('PASS SQL Editor installation exactly matches versioned migrations: functions, RLS, ACL, services, shifts and allowed starts')
print('All installation tests passed locally. No remote Supabase operation performed.')
