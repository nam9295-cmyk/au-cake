import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const source=`import importlib.util,tempfile,types,json,time
from pathlib import Path
s=importlib.util.spec_from_file_location('keep','scripts/customer-account-system-smtp-production.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
`;
function run(s){return spawnSync('python3',['-c',source+s],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})}
test('keep confirmation requires current run, approval, all gates and remaining timer margin',()=>{const r=run(`
now=1000;manifest={'runId':'run','confirmationMaxAgeSeconds':30};state={'phase':'active','runId':'run','manifestSha256':'sha','startedAt':800,'rollbackAt':1280};proof={'runId':'run','manifestSha256':'sha','at':995,'verified':True,'gates':{k:True for k in m.GATES}}
m.validate_confirmation(state,proof,manifest,'sha',now)
for change in [{'runId':'old'},{'at':900},{'at':1001},{'verified':False},{'gates':{**proof['gates'],'operatingSemanticUnchanged':False}}]:
 try:m.validate_confirmation(state,{**proof,**change},manifest,'sha',now)
 except ValueError:continue
 raise AssertionError('bad confirmation admitted')
for change in [{'phase':'restoring'},{'rollbackAt':999},{'manifestSha256':'old'}]:
 try:m.validate_confirmation({**state,**change},proof,manifest,'sha',now)
 except ValueError:continue
 raise AssertionError('bad state admitted')
`);assert.equal(r.status,0,r.stderr)});
test('independent timer restores unconfirmed runs; committed state requires matching durable receipt',()=>{const r=run(`
s={'phase':'active','runId':'run','manifestSha256':'sha'}
assert m.timer_should_restore(s,None,'sha') is True
assert m.timer_should_restore({**s,'phase':'restoring'},None,'sha') is True
assert m.timer_should_restore({**s,'phase':'restored'},None,'sha') is False
c={'runId':'run','manifestSha256':'sha','proofSha256':'a'*64,'confirmedAt':1000}
s={**s,'phase':'committed','confirmationSha256':m.digest(c)}
assert m.timer_should_restore(s,c,'sha') is False
assert m.timer_should_restore(s,{**c,'runId':'wrong'},'sha') is True
assert m.timer_should_restore(s,None,'sha') is True
`);assert.equal(r.status,0,r.stderr)});
test('root keep gate rechecks services, queue, candidate bytes and policy before committing; failure cannot disarm timer',()=>{const r=run(`
with tempfile.TemporaryDirectory() as tmp:
 b=Path(tmp);root=b/'root';root.mkdir();(root/'.env').write_bytes(b'candidate');(b/'env.candidate').write_bytes(b'candidate');(root/'docker-compose.yml').write_bytes(b'compose');(b/'compose.before').write_bytes(b'compose');calls=[]
 ns=types.SimpleNamespace(ROOT=root,SERVICES=('appwrite','appwrite-worker-mails'),health=lambda:calls.append('public'),internal_health=lambda:calls.append('internal'),smtp_auth=lambda n:calls.append(n),queue=lambda:{'queue':0,'processing':0,'failed':1},resources=lambda:None,containers=lambda:[{'running':True}],selected=lambda x:{'appwrite':{'State':{'Running':True}},'appwrite-worker-mails':{'State':{'Running':True}}})
 m.verify_keep_runtime(ns,b);assert calls==['public','internal','appwrite','appwrite-worker-mails']
 ns.queue=lambda:{'queue':0,'processing':0,'failed':2}
 try:m.verify_keep_runtime(ns,b)
 except ValueError:pass
 else:raise AssertionError('queue drift admitted')
`);assert.equal(r.status,0,r.stderr)});
test('fixed production adapter rejects old approval/targets before any remote action',()=>{const r=run(`
base={'mode':'production-always-on','executionApproved':False,'runId':m.RUN_ID,'host':'very-server','projectIds':['verygood-main','verygood-au','69cb27ef002b63e77c53','69db3ae20026cdc0c7fe'],'rollbackSeconds':480,'hardDeadlineSeconds':600,'services':['appwrite-worker-mails','appwrite'],'smtpVariableCount':7}
m.validate_manifest(base)
for k,v in [('mode','one-shot'),('executionApproved',True),('rollbackSeconds',0),('services',['database']),('smtpVariableCount',8),('runId','old')]:
 try:m.validate_manifest({**base,k:v})
 except ValueError:continue
 raise AssertionError('bad manifest admitted')
`);assert.equal(r.status,0,r.stderr)});
test('real confirmation commits receipt before cancelling timer; timer skips only that committed run',()=>{const r=run(`
with tempfile.TemporaryDirectory() as tmp:
 b=Path(tmp);m.STAGE=b;store={};events=[];manifest={'runId':'run','confirmationMaxAgeSeconds':30,'semanticBaseline':{'au':'expected'},'responsibleOperator':'nam9295'}
 state={'phase':'active','runId':'run','manifestSha256':'sha','startedAt':time.time()-10,'rollbackAt':time.time()+100,'hardDeadline':time.time()+200,'envChanged':True}
 proof={'runId':'run','manifestSha256':'sha','at':time.time(),'verified':True,'gates':{k:True for k in m.GATES},'semanticBaseline':{'au':'expected'},'resendUsage':{'daily':5,'monthly':87},'responsibleOperator':'nam9295','operatorAcceptance':True}
 store['state.private.json']=state;store['keep-confirmation.private.json']=proof;store['rollback-timer.safe.json']={'unit':'fixed-unit'};store['containers.before.private.json']=[{'x':1}]
 rows={'appwrite':{'State':{'Running':True},'Config':{'Env':['KEEP=same']}},'appwrite-worker-mails':{'State':{'Running':True},'Config':{'Env':['KEEP=same']}}}
 def save(p,v):store[p.name]=json.loads(json.dumps(v));p.write_text(json.dumps(v));events.append(p.name)
 def command(args):
  assert store['state.private.json']['phase']=='committed';events.append('timer-stop')
 base=types.SimpleNamespace(SHA='sha',root_guard=lambda:None,load=lambda p:json.loads(json.dumps(store[p.name])),save=save,SERVICES=('appwrite','appwrite-worker-mails'),selected=lambda x:rows,containers=lambda:[],envmap=lambda r:{'KEEP':'same'},run=command,phase=lambda *a,**kw:None,restore=lambda p:events.append('restore'))
 m.verify_keep_runtime=lambda *a:None
 m.confirm(base,b,manifest)
 assert events.index('keep-receipt.safe.json')<events.index('state.private.json')<events.index('timer-stop')
 assert m.restore_if_unconfirmed(base,b) is False and 'restore' not in events
 # A missing receipt after "committed" is not treated as a successful keep.
 del store['keep-receipt.safe.json']
 (b/'keep-receipt.safe.json').unlink();assert m.restore_if_unconfirmed(base,b) is True and 'restore' in events
`);assert.equal(r.status,0,r.stderr)});
test('keep failure and timer winning the lock preserve rollback and cannot confirm afterwards',()=>{const r=run(`
with tempfile.TemporaryDirectory() as tmp:
 b=Path(tmp);m.STAGE=b;state={'phase':'active','runId':'run','manifestSha256':'sha','startedAt':time.time()-10,'rollbackAt':time.time()+100,'hardDeadline':time.time()+200,'envChanged':True};store={'state.private.json':state};events=[]
 def save(p,v):store[p.name]=v
 def restore(p):assert store['state.private.json']['phase']=='rollback-required';events.append('restore');store['state.private.json']['phase']='restored'
 base=types.SimpleNamespace(SHA='sha',load=lambda p:store[p.name],save=save,restore=restore)
 assert m.restore_if_unconfirmed(base,b) is True
 assert events==['restore']
 proof={'runId':'run','manifestSha256':'sha','at':time.time(),'verified':True,'gates':{k:True for k in m.GATES}}
 try:m.validate_confirmation(store['state.private.json'],proof,{'runId':'run','confirmationMaxAgeSeconds':30},'sha',time.time())
 except ValueError:pass
 else:raise AssertionError('confirmation beat claimed restore')
`);assert.equal(r.status,0,r.stderr)});
test('production timer command contains exactly one interpreter and uses root backup adapter',()=>{const r=run(`
b=Path('/root/verygood-b5-backups/fresh');args=['systemd-run','--unit=fixed','--on-active=480s','--timer-property=AccuracySec=1s','--collect','/usr/bin/python3',str(b/'customer-account-system-smtp-operator.py'),'restore',str(b)]
actual=m.production_timer_command(args,b)
assert actual==['systemd-run','--unit=fixed','--on-active=480s','--timer-property=AccuracySec=1s','--collect','/usr/bin/python3',str(b/'customer-account-system-smtp-production.py'),'restore-if-unconfirmed',str(b)]
assert actual.count('/usr/bin/python3')==1
`);assert.equal(r.status,0,r.stderr)});
test('operating approval is fresh for this run and includes explicit always-on permission',()=>{const r=run(`
p={'executionApproved':True,'runId':m.RUN_ID,'manifestSha256':'sha','alwaysOnApproved':True,'operatingChangeApproved':True,'responsibleOperator':'nam9295','operatorAcceptance':True}
m.validate_operating_approval(p,'sha')
for k,v in [('executionApproved',False),('runId','old-b5'),('manifestSha256','old'),('alwaysOnApproved',False),('operatingChangeApproved',False),('responsibleOperator','unaccepted-other'),('operatorAcceptance',False)]:
 try:m.validate_operating_approval({**p,k:v},'sha')
 except ValueError:continue
 raise AssertionError('old/narrow approval accepted')
`);assert.equal(r.status,0,r.stderr)});
test('global root claim prevents a second apply across fresh backup directories',()=>{const r=run(`
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);a=root/'backup-a';b=root/'backup-b';a.mkdir();b.mkdir()
 m.claim_apply_once(root,'sha',a)
 try:m.claim_apply_once(root,'sha',b)
 except FileExistsError:pass
 else:raise AssertionError('restarted serve applied twice')
 assert len(list(root.glob('*.apply.claim')))==1
`);assert.equal(r.status,0,r.stderr)});
test('harmless independent probe uses new root adapter without touching the historical B5 stage',()=>{const r=run(`
b=Path('/root/verygood-b5-backups/fresh');args=['systemd-run','--unit=probe','--on-active=2s','--timer-property=AccuracySec=1s','--collect','/usr/bin/python3',str(b/'customer-account-system-smtp-operator.py'),'verify',str(b)]
x=m.production_probe_command(args,b)
assert x[-4:]==['/usr/bin/python3',str(b/'customer-account-system-smtp-production.py'),'verify-original',str(b)]
assert x.count('/usr/bin/python3')==1
`);assert.equal(r.status,0,r.stderr)});

test('resumed release binds the new checkpoint and budgets and rejects the prior production approval',()=>{const r=run(`
import hashlib
manifest=json.loads(Path('docs/customer-account-production-release-manifest.json').read_text())
assert m.RUN_ID=='ca-release-resume-20261019'
assert str(m.STAGE)=='/home/john/.verygood-account-smtp-production-resume'
assert manifest['runId']==m.RUN_ID and manifest['executionApproved'] is False
assert manifest['productionRelease']['sourceCommit']=='08799b739f6d8047154c0ea699aab81837196ce2'
assert manifest['productionRelease']['priorPagesDeployment']=='65a7ccae-422a-4d79-9262-fccea9b51c7f'
assert manifest['productionRelease']['mainIntegration']['remainingMergesMax']==0
assert manifest['productionRelease']['pagesNormalDeploymentsMax']==1
assert manifest['completedUsage']['productionPagesBuildAttempts']==2
assert manifest['completedUsage']['productionKeyIssuedThenRevoked']==1
assert hashlib.sha256(Path('docs/customer-account-production-release-manifest.json').read_bytes()).hexdigest()==m.EXPECTED_MANIFEST_SHA256
old={'executionApproved':True,'runId':'ca-smtp-production-20261019','manifestSha256':'ef000413dab463a916e7fe6df821e390750f7d25f14ff44b0600f36a1b1e9fb2','alwaysOnApproved':True,'operatingChangeApproved':True}
try:m.validate_operating_approval(old,m.EXPECTED_MANIFEST_SHA256)
except ValueError:pass
else:raise AssertionError('historical operating approval reused')
`);assert.equal(r.status,0,r.stderr)});
