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
