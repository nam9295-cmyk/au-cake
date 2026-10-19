import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const run=source=>spawnSync('python3',['-c',source],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
test('SMTP byte helper preserves non-UTF8 bytes, line endings and restores exactly seven fields',()=>{
 const r=run(`import importlib.util
s=importlib.util.spec_from_file_location('smtp','scripts/customer-account-system-smtp-env.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
keys=m.KEYS
before=b'# original \\xff\\xfe\\r\\nKEEP=abc\\r\\n'+b''.join(k.encode()+b'=old\\r\\n' for k in keys)+b'TAIL=last'
values={k:b'new' for k in keys}
after,state=m.plan_env(before,values)
assert after.startswith(b'# original \\xff\\xfe\\r\\nKEEP=abc\\r\\n') and after.endswith(b'TAIL=last')
assert m.restore_env(after,state)==before
assert m.restore_env(after.replace(b'KEEP=abc',b'KEEP=external'),state)==before.replace(b'KEEP=abc',b'KEEP=external')
`);assert.equal(r.status,0,r.stderr)
})
test('SMTP byte helper rejects missing/extra/duplicate keys, unsafe values and target-field drift',()=>{
 const r=run(`import importlib.util
s=importlib.util.spec_from_file_location('smtp','scripts/customer-account-system-smtp-env.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
before=b''.join(k.encode()+b'=old\\n' for k in m.KEYS);values={k:b'new' for k in m.KEYS}
def denied(f):
 try:f()
 except ValueError:return
 raise AssertionError('must reject')
denied(lambda:m.plan_env(before,{k:v for k,v in values.items() if k!=m.KEYS[0]}))
denied(lambda:m.plan_env(before,{**values,'EXTRA':b'new'}))
denied(lambda:m.plan_env(before+b'_APP_SMTP_HOST=x\\n',values))
denied(lambda:m.plan_env(before,{**values,'_APP_SMTP_HOST':b'x\\nBAD=x'}))
after,state=m.plan_env(before,values)
denied(lambda:m.restore_env(after.replace(b'_APP_SMTP_HOST=new',b'_APP_SMTP_HOST=external'),state))
`);assert.equal(r.status,0,r.stderr)
})
test('root candidate validator allows only SMTP changes in the two approved services',()=>{
 const r=run(`import ast,json,copy
s=ast.parse(open('scripts/customer-account-system-smtp-operator.py').read())
ns={'json':json,'SERVICES':('appwrite','appwrite-worker-mails')}
for name in ('fail','validate_candidate'):
 n=next(n for n in s.body if isinstance(n,ast.FunctionDef) and n.name==name);exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-root-helper','exec'),ns)
a={'services':{'appwrite':{'image':'same','environment':{'_APP_SMTP_HOST':'','KEEP':'same'}},'appwrite-worker-mails':{'image':'same','environment':{'_APP_SMTP_HOST':'','KEEP':'same'}},'database':{'image':'preserved'}}}
b=copy.deepcopy(a)
for name in ns['SERVICES']:b['services'][name]['environment']['_APP_SMTP_HOST']='smtp.resend.com'
ns['validate_candidate'](a,b,{'_APP_SMTP_HOST':b'smtp.resend.com'})
for bad in ('other-service','image','non-smtp'):
 c=copy.deepcopy(b)
 if bad=='other-service':c['services']['database']['image']='changed'
 elif bad=='image':c['services']['appwrite']['image']='changed'
 else:c['services']['appwrite']['environment']['KEEP']='changed'
 try:ns['validate_candidate'](a,c,{'_APP_SMTP_HOST':b'smtp.resend.com'})
 except ValueError:continue
 raise AssertionError('must reject '+bad)
`);assert.equal(r.status,0,r.stderr)
})
test('root health uses verified HTTPS curl without disabling TLS validation',()=>{
 const r=run(`import ast,json,types
s=ast.parse(open('scripts/customer-account-system-smtp-operator.py').read());clock=[0];calls=[]
def command(args,**kwargs):
 calls.append(args)
 assert args[0]=='curl' and '--fail' in args and '--max-time' in args
 assert '--insecure' not in args and '-k' not in args
 assert args[-1]=='https://api.verygood-chocolate.com/v1/health/version'
 return b'{"version":"1.8.1"}'
def sleep(n):clock[0]+=n
ns={'json':json,'run':command,'time':types.SimpleNamespace(monotonic=lambda:clock[0],sleep=sleep)}
for name in ('fail','health'):
 n=next(n for n in s.body if isinstance(n,ast.FunctionDef) and n.name==name);exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-root-helper','exec'),ns)
ns['health']();assert len(calls)==1
`);assert.equal(r.status,0,r.stderr)
})
test('rollback restores both approved services before a failing final health probe',()=>{
 const r=run(`import ast,fcntl,os,tempfile,types
from pathlib import Path
s=ast.parse(open('scripts/customer-account-system-smtp-operator.py').read())
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp)/'root';backup=Path(tmp)/'backup';root.mkdir();backup.mkdir()
 for a,b in [('.env','env.before'),('docker-compose.yml','compose.before')]:
  (root/a).write_bytes(b'original');(backup/b).write_bytes(b'original')
 state={'phase':'active','envChanged':True,'applyServices':['appwrite-worker-mails','appwrite'],'restoreServices':[]};calls=[]
 def unhealthy():raise ValueError('HEALTH_60S_FAILED')
 ns={'fcntl':fcntl,'os':os,'ROOT':root,'SERVICES':('appwrite','appwrite-worker-mails'),'COMPOSE':['compose'],'root_guard':lambda:None,'load':lambda p:state,'save':lambda *a:None,'phase':lambda *a:None,'run':lambda args,**kw:calls.append(args[-1]),'health':unhealthy}
 for name in ('fail','restore'):
  n=next(n for n in s.body if isinstance(n,ast.FunctionDef) and n.name==name);exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-root-helper','exec'),ns)
 try:ns['restore'](backup)
 except ValueError as e:assert str(e)=='HEALTH_60S_FAILED'
 else:raise AssertionError('must not report restoration success with unhealthy API')
 assert calls==['appwrite','appwrite-worker-mails'],calls
 assert state['phase']=='restoring'
`);assert.equal(r.status,0,r.stderr)
})
test('final SMTP attempt rejects previous approval and requires its own run and manifest',()=>{
 const r=run(`import ast
from pathlib import Path
s=ast.parse(open('scripts/customer-account-system-smtp-operator.py').read());proof={};ns={'STAGE':Path('/unused'),'SHA':'new-sha','RUN_ID':'new-run','load':lambda p:proof}
for name in ('fail','approval'):
 n=next((n for n in s.body if isinstance(n,ast.FunctionDef) and n.name==name),None);assert n is not None,'fresh approval validator missing';exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-root-helper','exec'),ns)
for value in [{'executionApproved':True,'manifestSha256':'old-sha','runId':'new-run'},{'executionApproved':True,'manifestSha256':'new-sha','runId':'old-run'},{'executionApproved':False,'manifestSha256':'new-sha','runId':'new-run'}]:
 proof.clear();proof.update(value)
 try:ns['approval']()
 except ValueError:pass
 else:raise AssertionError('stale or absent approval accepted')
proof.clear();proof.update(executionApproved=True,manifestSha256='new-sha',runId='new-run');ns['approval']()
`);assert.equal(r.status,0,r.stderr)
})
test('container health accepts only the fixed API container and exact version response',()=>{
 const r=run(`import ast
s=ast.parse(open('scripts/customer-account-system-smtp-operator.py').read());calls=[];reply=[b'INTERNAL_HEALTH_1.8.1_OK']
def command(args,data=None,**kw):
 assert args==['docker','exec','-i','appwrite','php']
 assert b'http://127.0.0.1/v1/health/version' in data
 calls.append(args);return reply[0]
ns={'run':command}
for name in ('fail','internal_health'):
 n=next((n for n in s.body if isinstance(n,ast.FunctionDef) and n.name==name),None);assert n is not None,'container health missing';exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-root-helper','exec'),ns)
ns['internal_health']();reply[0]=b'wrong-version'
try:ns['internal_health']()
except ValueError:pass
else:raise AssertionError('invalid internal health accepted')
assert len(calls)==2
`);assert.equal(r.status,0,r.stderr)
})
