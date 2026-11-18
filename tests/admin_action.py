"""Regression 42702: fixed disposable LOCAL PostgreSQL, never Supabase."""
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode = True
import database as db

db.BASE[db.BASE.index('-d') + 1] = 'nandanails_admin_alias_test'
owner = db.BASE.copy()
owner[owner.index('nandanails_admin_alias_test')] = 'postgres'
for query in ['drop database if exists nandanails_admin_alias_test with (force);',
              'create database nandanails_admin_alias_test;']:
    result = subprocess.run(owner, input=query, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr

shim = Path('tests/bootstrap.sql').read_text(encoding='utf-8')
db.sql(shim[shim.index('create schema auth;'):])
fix = Path('supabase/migrations/202611180004_admin_action_alias.sql').read_text(encoding='utf-8')
# Missing-function guard must fail without creating a new PUBLIC-executable function.
assert 'ADMIN_ACTION_NOT_FOUND' in db.sql(fix, False)
assert db.sql("select to_regprocedure('public.admin_action(text,jsonb)') is null;") == 't'

# Historical migrations are applied ONLY to this new disposable local database.
for filename in ['202611170001_agenda.sql', '202611170002_horarios_padrao.sql', '202611170003_servicos_iniciais.sql']:
    db.sql(Path('supabase/migrations', filename).read_text(encoding='utf-8'))
db.sql("insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');"
       "insert into public.admin_users values('11111111-1111-4111-8111-111111111111');")
today = dt.date.fromisoformat(db.sql("select (now() at time zone 'America/Sao_Paulo')::date;"))
day = today + dt.timedelta(days=(7 - today.weekday()) % 7 + 7)
appointment = json.loads(db.sql(db.book(str(day), '15:00', service='remocao')))['booking']['id']
period = {'from': '2000-01-01T00:00:00-03:00', 'to': '2100-01-01T00:00:00-03:00'}
admin_list = "set plpgsql.variable_conflict=error;set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.admin_action('list','" + json.dumps(period) + "');"
failure = db.sql('\\set VERBOSITY verbose\n' + admin_list, False)
assert '42702' in failure and '"s"' in failure, failure
print('PASS historical authorized list reproduces SQLSTATE 42702 with variable_conflict=error')

tables = ['public.' + t for t in ['services', 'clients', 'appointments', 'availability', 'schedule_blocks', 'admin_users', 'audit_log', 'notification_outbox']]
tables += ['private.allowed_weekday_starts', 'private.schedule_default_updates', 'private.rate_limits', 'private.used_challenges']
def snapshot():
    return {table: db.sql(f"select coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text),'[]') from {table} v;") for table in tables}
metadata_query = """select jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,
 'security_definer',prosecdef,'config',proconfig,'args',pg_get_function_arguments(oid))
 from pg_proc where oid='public.admin_action(text,jsonb)'::regprocedure;"""
before, metadata = snapshot(), db.sql(metadata_query)
db.sql(fix)
assert snapshot() == before
assert db.sql(metadata_query) == metadata
assert db.sql("select prosecdef and proconfig=array['search_path=\"\"'] from pg_proc where oid='public.admin_action(text,jsonb)'::regprocedure;") == 't'
print('PASS incremental replacement preserves all rows, function OID/owner/ACL/default args, SECURITY DEFINER and empty search_path')

data = json.loads(db.sql(admin_list))
assert set(data) == {'appointments', 'services', 'availability', 'blocks'}
assert len(data['services']) == 5 and len(data['appointments']) == 1
assert data['appointments'][0]['id'] == appointment
assert data['appointments'][0]['phone'] == '5511912345678'
assert sorted((s['duration_minutes'], s['price_cents']) for s in data['services']) == [(30,1500),(60,6000),(60,7000),(90,6500),(120,9000)]
assert data['availability'] and data['blocks'] == []
assert snapshot() == before  # list remains read-only, including the audit log.
db.sql(fix)
assert json.loads(db.sql(admin_list)) == data
assert snapshot() == before and db.sql(metadata_query) == metadata
print('PASS authorized list returns all four sections without 42702; repeat migration changes no data or privileges')

assert db.sql("select has_function_privilege('anon','public.admin_action(text,jsonb)','EXECUTE');") == 'f'
assert db.sql("select has_function_privilege('authenticated','public.admin_action(text,jsonb)','EXECUTE');") == 't'
assert db.sql("select count(*) from pg_proc p cross join lateral aclexplode(p.proacl) g where p.oid='public.admin_action(text,jsonb)'::regprocedure and g.grantee=0 and g.privilege_type='EXECUTE';") == '0'
assert '42501' in db.sql('\\set VERBOSITY verbose\nset role anon;select public.admin_action(\'list\',\'{}\');', False)
for identity in ['', '22222222-2222-4222-8222-222222222222']:
    for action, payload in [('list', period), ('slots', {'serviceId':'remocao','date':str(day)}), ('hours', {'hours':[]})]:
        query = "set role authenticated;set request.jwt.claim.sub='" + identity + "';select public.admin_action('" + action + "','" + json.dumps(payload) + "');"
        failure = db.sql('\\set VERBOSITY verbose\n' + query, False)
        assert '42501' in failure and 'FORBIDDEN' in failure, failure
assert snapshot() == before
print('PASS anonymous, missing-identity and unauthorized users cannot read admin data or mutate hours')

# Exercise every other branch against local fixtures, keeping original values where possible.
assert json.loads(db.rpc('slots', {'serviceId':'remocao','date':str(day)}))['slots']
db.rpc('reschedule', {'id':appointment,'date':str(day),'time':'16:00'})
db.rpc('status', {'id':appointment,'status':'cancelled'})
db.rpc('block', {'starts_at':str(day)+'T15:00:00-03:00','ends_at':str(day)+'T15:30:00-03:00','reason':'Fixture local'})
block = db.sql('select id from public.schedule_blocks;')
db.rpc('unblock', {'id':block})
service = next(s for s in data['services'] if s['id']=='remocao')
db.rpc('service', service)
hours = [{key:row[key] for key in ['weekday','opens','closes','active']} for row in data['availability']]
db.rpc('hours', {'hours':hours})
assert db.sql("select count(*) from public.appointments;") == '1'
assert db.sql(f"select status from public.appointments where id='{appointment}';") == 'cancelled'
assert db.sql('select count(*) from public.audit_log;') == '6'
print('PASS slots, reschedule, status, block, unblock, service, hours and audit still work on local fixtures')
print('All admin_action regression tests passed. No remote operation performed.')
