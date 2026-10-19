#!/usr/bin/env python3
"""One approved root maintenance operation; fixed paths/services, no general command channel."""
import base64
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import socket
import stat
import subprocess
import sys
import time

STAGE = Path('/home/john/.verygood-b5-final-native-20261019')
ROOT = Path('/home/john/srv/appwrite/appwrite')
BACKUPS = Path('/root/verygood-b5-backups')
SHA = '179f9f06113e7d81d60316744a86692501ec9b80a49537cb5bca11f55e92ba8f'
RUN_ID = 'b5-final-native-20261019'
OLD_SHA = '6516ad5400b40955f6e6604eca2161560c5e5cb10305a6638af4b9377f1539ce'
IMAGE = 'sha256:d6c8a343ef61ed16389b19664cfc30f0559aa5bfdb81965fcd2763d354f4964d'
SERVICES = ('appwrite', 'appwrite-worker-mails')
ENV = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8'}
UID = pwd.getpwnam('john').pw_uid
COMPOSE = ['docker', 'compose', '--project-directory', str(ROOT), '--env-file', str(ROOT/'.env'), '-p', 'appwrite', '-f', str(ROOT/'docker-compose.yml')]


def fail(code):
    raise ValueError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        fail('UNPROTECTED_INPUT')
    return json.loads(path.read_bytes())


def save(path, value, owner=None):
    tmp = path.with_name(path.name+'.tmp.'+str(os.getpid()))
    fd = os.open(tmp, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(value, f); f.write('\n'); f.flush(); os.fsync(f.fileno())
    if owner is not None:
        os.chown(tmp, owner, pwd.getpwnam('john').pw_gid)
    os.replace(tmp, path)


def run(args, data=None, timeout=45):
    r = subprocess.run(args, input=data, capture_output=True, env=ENV, timeout=timeout)
    if r.returncode:
        fail('FIXED_COMMAND_FAILED')
    return r.stdout


def queue():
    return {k: int(run(['docker','exec','appwrite-redis','redis-cli','--raw','LLEN','utopia-queue.'+k+'.v1-mails']).strip()) for k in ('queue','processing','failed')}


def resources():
    mem = int(next(l for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')).split()[1])*1024
    d = os.statvfs('/')
    if mem < 3*2**30 or d.f_bavail*d.f_frsize < 30*2**30:
        fail('SERVER_RESOURCES_UNSAFE')


def containers():
    ids = run(['docker','ps','-aq','--filter','label=com.docker.compose.project=appwrite']).decode().split()
    if not ids: fail('COMPOSE_EMPTY')
    return json.loads(run(['docker','inspect',*ids]))


def selected(rows):
    d = {x['Name'].lstrip('/'):x for x in rows}
    if not all(n in d for n in SERVICES): fail('TARGET_CONTAINER_MISSING')
    if any(d[n]['Image'] != IMAGE or d[n]['Config']['Image'] != 'appwrite/appwrite:1.8.1' for n in SERVICES): fail('IMAGE_DRIFT')
    return d


def envmap(d):
    return dict(x.split('=',1) for x in d['Config']['Env'] if '=' in x)


def phase(backup, name, **safe):
    result = {'phase':name,'at':time.time(),'backupDirectory':str(backup),**safe}
    save(backup/'status.safe.json',result)
    save(STAGE/'root-status.safe.json',result,UID)
    print('B5 ROOT '+name, flush=True)


def root_guard():
    if os.geteuid()!=0 or socket.gethostname()!='very-server': fail('EXACT_ROOT_HOST_REQUIRED')
    if ROOT.is_symlink() or (ROOT/'.env').is_symlink() or (ROOT/'docker-compose.yml').is_symlink(): fail('SYMLINK_REJECTED')
    if (ROOT/'.env').stat().st_uid!=0: fail('ENV_OWNER_DRIFT')


def module(backup):
    spec=importlib.util.spec_from_file_location('smtp_bytes',backup/'customer-account-system-smtp-env.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


def atomic_env(data):
    tmp=ROOT/'.env.b5-candidate'
    fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    os.replace(tmp,ROOT/'.env');os.chmod(ROOT/'.env',0o600)


def health():
    end=time.monotonic()+60
    while time.monotonic()<end:
        try:
            raw=run(['curl','--silent','--show-error','--fail','--max-time','5','--proto','=https','--tlsv1.2','https://api.verygood-chocolate.com/v1/health/version'],timeout=7)
            if json.loads(raw).get('version')=='1.8.1':return
        except Exception:pass
        time.sleep(2)
    fail('HEALTH_60S_FAILED')


def internal_health():
    code=b'''<?php
$c=stream_context_create(['http'=>['timeout'=>5,'ignore_errors'=>true,'header'=>"Host: api.verygood-chocolate.com\\r\\n"]]);$r=@file_get_contents('http://127.0.0.1/v1/health/version',false,$c);$v=json_decode($r?:'',true);if(($v['version']??null)!=='1.8.1'){exit(1);}echo 'INTERNAL_HEALTH_1.8.1_OK';
'''
    if run(['docker','exec','-i','appwrite','php'],code,timeout=10)!=b'INTERNAL_HEALTH_1.8.1_OK':fail('INTERNAL_HEALTH_FAILED')


def approval():
    proof=load(STAGE/'execution-approval.private.json')
    if proof.get('executionApproved') is not True or proof.get('manifestSha256')!=SHA or proof.get('runId')!=RUN_ID:fail('FRESH_APPROVAL_REQUIRED')


def smtp_auth(service):
    code=b'''<?php
require '/usr/src/code/vendor/autoload.php';
$m=new \\PHPMailer\\PHPMailer\\PHPMailer(true);$m->isSMTP();$m->Host='smtp.resend.com';$m->Port=465;$m->SMTPSecure='ssl';$m->SMTPAutoTLS=false;$m->SMTPAuth=true;$m->Username='resend';$m->Password=getenv('_APP_SMTP_PASSWORD');$m->Timeout=5;$m->SMTPDebug=0;
try{if(!$m->Password||!$m->smtpConnect()){throw new \\RuntimeException();}$m->smtpClose();echo 'SMTP_TLS_AUTH_OK';}catch(\\Throwable $e){$m->smtpClose();exit(1);}
'''
    if run(['docker','exec','-i',service,'php'],code,15).strip()!=b'SMTP_TLS_AUTH_OK':fail('SMTP_TLS_AUTH_FAILED')


def validate_candidate(before, after, values):
    if set(before['services'])!=set(after['services']):fail('COMPOSE_SERVICE_DRIFT')
    for name in before['services']:
        a=json.loads(json.dumps(before['services'][name]));b=json.loads(json.dumps(after['services'][name]))
        if name in SERVICES:
            for key,value in values.items():
                if str(b.get('environment',{}).get(key))!=value.decode():fail('CANDIDATE_VALUE_MISMATCH')
                a['environment'].pop(key,None);b['environment'].pop(key,None)
        if a!=b:fail('NON_SMTP_COMPOSE_DRIFT')


def preflight():
    root_guard()
    manifest=load(STAGE/'manifest.json');old=load(STAGE/'original-manifest.json')
    if sha((STAGE/'manifest.json').read_bytes())!=SHA or sha((STAGE/'original-manifest.json').read_bytes())!=OLD_SHA:fail('MANIFEST_DRIFT')
    if manifest.get('executionApproved') is not False or manifest.get('runId')!=RUN_ID:fail('FRESH_MANIFEST_REQUIRED')
    for name,expected in load(STAGE/'tool-sha.safe.json').items():
        if Path(name).name!=name or sha((STAGE/name).read_bytes())!=expected:fail('TOOL_DRIFT')
    resources()
    if queue()!={'queue':0,'processing':0,'failed':1}:fail('QUEUE_BASELINE_DRIFT')
    before_env=(ROOT/'.env').read_bytes();before_compose=(ROOT/'docker-compose.yml').read_bytes()
    if sha(before_env)!=old['compose']['expectedEnvSha256'] or sha(before_compose)!=old['compose']['expectedComposeSha256']:fail('ORIGINAL_FILE_DRIFT')
    rows=containers();d=selected(rows)
    if any(envmap(d[n]).get('_APP_SMTP_HOST')!='' for n in SERVICES):fail('SMTP_ALREADY_ENABLED')
    health();internal_health()
    BACKUPS.mkdir(mode=0o700,exist_ok=True)
    backup=BACKUPS/(RUN_ID+'-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()))
    backup.mkdir(mode=0o700)
    for name in ('customer-account-system-smtp-env.py','customer-account-system-smtp-operator.py','manifest.json','original-manifest.json','tool-sha.safe.json'):
        shutil.copyfile(STAGE/name,backup/name);os.chmod(backup/name,0o600)
    for source,name in ((ROOT/'.env','env.before'),(ROOT/'docker-compose.yml','compose.before')):
        shutil.copyfile(source,backup/name);os.chmod(backup/name,0o600)
    save(backup/'containers.before.private.json',rows)
    conf=json.loads(run(COMPOSE+['config','--format','json']));save(backup/'compose.before.private.json',conf)
    fd=os.open(backup/'appwrite-1.8.1.tar',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
    run(['docker','image','save','--output',str(backup/'appwrite-1.8.1.tar'),'appwrite/appwrite:1.8.1'],timeout=120)
    resources()
    save(backup/'image-backup.safe.json',{'sha256':sha((backup/'appwrite-1.8.1.tar').read_bytes()),'bytes':(backup/'appwrite-1.8.1.tar').stat().st_size})
    if stat.S_IMODE((ROOT/'.env').stat().st_mode)!=0o600:fail('ENV_NOT_0600')
    state={'phase':'preflight','manifestSha256':SHA,'runId':RUN_ID,'envChanged':False,'applyServices':[],'restoreServices':[],'preparedAt':time.time()};save(backup/'state.private.json',state)
    unit='verygood-b5-final-probe-'+str(os.getpid())
    run(['systemd-run','--unit='+unit,'--on-active=2s','--timer-property=AccuracySec=1s','--collect','/usr/bin/python3',str(backup/'customer-account-system-smtp-operator.py'),'verify',str(backup)])
    deadline=time.monotonic()+20
    while not (backup/'timer-probe.safe.json').exists():
        if time.monotonic()>deadline:fail('ROOT_TIMER_PROBE_FAILED')
        time.sleep(.5)
    if load(backup/'timer-probe.safe.json').get('pass') is not True:fail('ROOT_TIMER_PROBE_FAILED')
    phase(backup,'preflight-pass',backupVerified=True,rootTimerVerified=True,publicCurlHealthy=True,containerInternalHealthy=True,commonSmtpUnchanged=True,toolSha256=sha((backup/'customer-account-system-smtp-operator.py').read_bytes()))
    return backup


def prepare(backup):
    manifest=load(STAGE/'manifest.json')
    end=time.monotonic()+1800
    while not (STAGE/'system-key.private.json').exists() or not (STAGE/'execution-approval.private.json').exists():
        if time.monotonic()>end:fail('PREPARE_WAIT_EXPIRED')
        time.sleep(2)
    approval()
    save(backup/'execution-approval.private.json',load(STAGE/'execution-approval.private.json'))
    credential=load(STAGE/'system-key.private.json')
    if credential.get('permission')!='sending_access' or credential.get('domainId')!=manifest['systemCredential']['domainId'] or credential.get('name')!=manifest['systemCredential']['name'] or credential.get('consoleFormVerified') is not True or not re.fullmatch(r're_[A-Za-z0-9_-]{20,}',credential.get('secret','')):fail('CREDENTIAL_SCOPE_INVALID')
    save(backup/'system-key.private.json',credential)
    values={'_APP_SMTP_HOST':b'smtp.resend.com','_APP_SMTP_PORT':b'465','_APP_SMTP_SECURE':b'ssl','_APP_SMTP_USERNAME':b'resend','_APP_SMTP_PASSWORD':credential['secret'].encode(),'_APP_SYSTEM_EMAIL_NAME':b'VERYGOOD%20Chocolate%20System','_APP_SYSTEM_EMAIL_ADDRESS':b'appwrite-system@verygood-chocolate.com'}
    after,transform=module(backup).plan_env((backup/'env.before').read_bytes(),values)
    fd=os.open(backup/'env.candidate',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(after)
    save(backup/'env-transform.private.json',transform)
    candidate_cmd=COMPOSE.copy();candidate_cmd[candidate_cmd.index('--env-file')+1]=str(backup/'env.candidate')
    candidate=json.loads(run(candidate_cmd+['config','--format','json']));validate_candidate(load(backup/'compose.before.private.json'),candidate,values)
    state=load(backup/'state.private.json');state['phase']='prepared';save(backup/'state.private.json',state)
    phase(backup,'prepared',backupVerified=True,candidateExactSeven=True,rootTimerVerified=True)
    return backup


def apply(backup):
    root_guard();lock=open(backup/'operation.lock','a');os.chmod(backup/'operation.lock',0o600);fcntl.flock(lock,fcntl.LOCK_EX)
    state=load(backup/'state.private.json')
    if state['phase']!='prepared' or state['envChanged']:fail('APPLY_ONCE_REQUIRED')
    approval()
    resources()
    if queue()!={'queue':0,'processing':0,'failed':1}:fail('QUEUE_BASELINE_DRIFT')
    if (ROOT/'.env').read_bytes()!=(backup/'env.before').read_bytes() or (ROOT/'docker-compose.yml').read_bytes()!=(backup/'compose.before').read_bytes():fail('BEFORE_APPLY_DRIFT')
    selected(containers())
    claim=backup/'apply.claim';fd=os.open(claim,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    state.update({'phase':'applying','startedAt':time.time(),'rollbackAt':time.time()+480,'hardDeadline':time.time()+600});save(backup/'state.private.json',state)
    run(['systemd-run','--unit=verygood-b5-rollback-'+str(int(state['startedAt'])),'--on-active=480s','--timer-property=AccuracySec=1s','--collect','/usr/bin/python3',str(backup/'customer-account-system-smtp-operator.py'),'restore',str(backup)])
    state['envChanged']=True;save(backup/'state.private.json',state)
    atomic_env((backup/'env.candidate').read_bytes())
    phase(backup,'applying',hardDeadline=state['hardDeadline'],rollbackAt=state['rollbackAt'])
    try:
        for name in ('appwrite-worker-mails','appwrite'):
            state['applyServices'].append(name);save(backup/'state.private.json',state)
            run(COMPOSE+['up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--timeout','30',name],timeout=90)
            d=selected(containers())
            if not d[name]['State']['Running']:fail('CONTAINER_NOT_RUNNING')
            smtp_auth(name)
            save(backup/(name+'-smtp-auth.safe.json'),{'pass':True,'at':time.time()})
            if name=='appwrite':health();internal_health()
        state['phase']='active';save(backup/'state.private.json',state);phase(backup,'active',hardDeadline=state['hardDeadline'],rollbackAt=state['rollbackAt'],smtpTlsAuth=True)
    except Exception:
        lock.close();restore(backup);raise
    finally:
        if not lock.closed:lock.close()


def restore(backup):
    root_guard();lock=open(backup/'operation.lock','a');os.chmod(backup/'operation.lock',0o600);fcntl.flock(lock,fcntl.LOCK_EX)
    state=load(backup/'state.private.json')
    if state['phase']=='restored':return
    if not state['envChanged']:
        phase(backup,'not-applied',commonSmtpUnchanged=True);return
    state['phase']='restoring';save(backup/'state.private.json',state);phase(backup,'restoring')
    current=(ROOT/'.env').read_bytes()
    if current!=(backup/'env.before').read_bytes():
        old=module(backup).restore_env(current,load(backup/'env-transform.private.json'));atomic_env(old)
    for name in SERVICES:
        if name in state['applyServices']:
            if name in state['restoreServices']:fail('RESTORE_ALREADY_ATTEMPTED')
            state['restoreServices'].append(name);save(backup/'state.private.json',state)
            run(COMPOSE+['up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--timeout','30',name],timeout=90)
    # Complete both approved restorations before the final API health gate.
    # A public probe failure must not leave the worker on the trial credential.
    health();internal_health();d=selected(containers());before=selected(load(backup/'containers.before.private.json'))
    for name in SERVICES:
        a=envmap(before[name]);b=envmap(d[name])
        if a!=b or not d[name]['State']['Running']:fail('RESTORE_ENV_MISMATCH')
    for name,x in before.items():
        if name not in SERVICES and (name not in d or d[name]['Id']!=x['Id'] or d[name]['State']['StartedAt']!=x['State']['StartedAt']):fail('OTHER_CONTAINER_DRIFT')
    if (ROOT/'.env').read_bytes()!=(backup/'env.before').read_bytes() or (ROOT/'docker-compose.yml').read_bytes()!=(backup/'compose.before').read_bytes():fail('RESTORE_FILE_DRIFT')
    if queue()!={'queue':0,'processing':0,'failed':1}:fail('RESTORE_QUEUE_NOT_BASELINE')
    state['phase']='restored';state['restoredAt']=time.time();save(backup/'state.private.json',state)
    phase(backup,'restored',commonSmtpRestored=True,filesRestored=True,sameImage=True,otherContainersUnchanged=True,queuePreserved=True,apiHealthy=True,exposureSeconds=round(time.time()-state['startedAt'],3))


def main():
    root_guard()
    if sys.argv[1:] == ['serve']:
        backup=preflight();prepare(backup);end=time.monotonic()+1800
        while time.monotonic()<end:
            for name in ('apply','restore','abort'):
                p=STAGE/(name+'.request.json')
                if not p.exists():continue
                request=load(p)
                if request.get('manifestSha256')!=SHA:fail('REQUEST_REJECTED')
                consumed=STAGE/(name+'.consumed.safe.json')
                if consumed.exists():continue
                save(consumed,{'consumed':True,'at':time.time()},UID)
                if name=='apply':apply(backup)
                else:restore(backup);return
            state=load(backup/'state.private.json')
            if state['phase']=='restored':return
            time.sleep(1)
        restore(backup)
    elif len(sys.argv)==3 and sys.argv[1] in ('verify','restore'):
        backup=Path(sys.argv[2])
        if backup.parent!=BACKUPS or backup.is_symlink() or backup.stat().st_uid!=0:fail('BACKUP_TARGET_REJECTED')
        if sys.argv[1]=='verify':
            if (ROOT/'.env').read_bytes()!=(backup/'env.before').read_bytes():fail('PROBE_ENV_DRIFT')
            health();internal_health()
            save(backup/'timer-probe.safe.json',{'pass':True,'uid':os.geteuid(),'at':time.time(),'publicCurlHealthy':True,'containerInternalHealthy':True})
        else:restore(backup)
    else:fail('EXPLICIT_FIXED_ACTION_REQUIRED')


if __name__=='__main__':
    try:main()
    except Exception as error:
        code=str(error) if isinstance(error,ValueError) and re.fullmatch('[A-Z0-9_]+',str(error)) else 'ROOT_OPERATION_FAILED'
        try:save(STAGE/'root-failure.safe.json',{'code':code,'at':time.time()},UID)
        except Exception:pass
        print('B5 ROOT STOPPED: '+code+'; no secret printed. Manual verification required.',flush=True);sys.exit(1)
