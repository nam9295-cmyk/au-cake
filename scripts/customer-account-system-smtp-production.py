#!/usr/bin/env python3
"""Fixed production keep-confirmation adapter over the preserved B5 operator.
No operation occurs on import. Running it requires a NEW explicit operating approval.
"""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sys
import time

STAGE = Path('/home/john/.verygood-account-smtp-production-resume')
RUN_ID = 'ca-release-resume-20261019'
EXPECTED_MANIFEST_SHA256 = "9972124a53e9a1bb8c9962e4165c5b1bf7c9dc1e427a4ec45e7b4dd1caf2fc4f"
GATES = ('operatingSemanticUnchanged','consoleUnchanged','quotaAccepted','onCallAssigned')
PROJECTS = ['verygood-main','verygood-au','69cb27ef002b63e77c53','69db3ae20026cdc0c7fe']
SMTP_KEYS = ('_APP_SMTP_HOST','_APP_SMTP_PORT','_APP_SMTP_SECURE','_APP_SMTP_USERNAME','_APP_SMTP_PASSWORD','_APP_SYSTEM_EMAIL_NAME','_APP_SYSTEM_EMAIL_ADDRESS')


def fail(code):
    raise ValueError(code)


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def validate_manifest(m):
    expected={'mode':'production-always-on','executionApproved':False,'runId':RUN_ID,'host':'very-server','projectIds':PROJECTS,'rollbackSeconds':480,'hardDeadlineSeconds':600,'services':['appwrite-worker-mails','appwrite'],'smtpVariableCount':7}
    if any(m.get(k)!=v for k,v in expected.items()):fail('PRODUCTION_MANIFEST_REJECTED')


def validate_operating_approval(proof,sha):
    expected={'executionApproved':True,'runId':RUN_ID,'manifestSha256':sha,'alwaysOnApproved':True,'operatingChangeApproved':True,'responsibleOperator':'nam9295','operatorAcceptance':True}
    if any(proof.get(k)!=v for k,v in expected.items()) or any(proof.get(k) is not True for k in ('executionApproved','alwaysOnApproved','operatingChangeApproved','operatorAcceptance')):fail('NEW_OPERATING_APPROVAL_REQUIRED')


def claim_apply_once(backups,sha,backup):
    path=backups/(RUN_ID+'.apply.claim')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:
        json.dump({'runId':RUN_ID,'manifestSha256':sha,'backup':str(backup)},f);f.flush();os.fsync(f.fileno())


def validate_confirmation(state,proof,manifest,sha,now):
    if state.get('phase')!='active' or state.get('runId')!=manifest['runId'] or state.get('manifestSha256')!=sha:fail('KEEP_STATE_REJECTED')
    if now>=state.get('rollbackAt',0) or now>=state.get('hardDeadline',state.get('rollbackAt',0)):fail('KEEP_DEADLINE_EXPIRED')
    if proof.get('runId')!=state['runId'] or proof.get('manifestSha256')!=sha or proof.get('verified') is not True:fail('KEEP_PROOF_REJECTED')
    if not isinstance(proof.get('at'),(int,float)) or not state['startedAt']<=proof['at']<=now or now-proof['at']>manifest['confirmationMaxAgeSeconds']:fail('KEEP_PROOF_STALE')
    if set(proof.get('gates',{}))!=set(GATES) or any(proof['gates'][k] is not True for k in GATES):fail('KEEP_GATES_FAILED')


def timer_should_restore(state,receipt,sha):
    if state.get('phase')=='restored':return False
    if state.get('phase')!='committed' or not receipt:return True
    return not (receipt.get('runId')==state.get('runId') and receipt.get('manifestSha256')==sha==state.get('manifestSha256') and state.get('confirmationSha256')==digest(receipt))


def verify_keep_runtime(base,backup):
    base.health();base.internal_health()
    for service in base.SERVICES:base.smtp_auth(service)
    base.resources()
    if base.queue()!={'queue':0,'processing':0,'failed':1}:fail('KEEP_QUEUE_DRIFT')
    if (base.ROOT/'.env').read_bytes()!=(backup/'env.candidate').read_bytes() or (base.ROOT/'docker-compose.yml').read_bytes()!=(backup/'compose.before').read_bytes():fail('KEEP_FILE_DRIFT')
    current=base.selected(base.containers())
    if any(not current[n]['State']['Running'] for n in base.SERVICES):fail('KEEP_CONTAINER_NOT_RUNNING')


def confirm(base,backup,manifest):
    base.root_guard();lock=open(backup/'operation.lock','a');os.chmod(backup/'operation.lock',0o600)
    with lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        state=base.load(backup/'state.private.json');proof=base.load(STAGE/'keep-confirmation.private.json')
        validate_confirmation(state,proof,manifest,base.SHA,time.time())
        if proof.get('semanticBaseline')!=manifest['semanticBaseline']:fail('KEEP_SEMANTIC_DRIFT')
        if proof.get('responsibleOperator')!=manifest['responsibleOperator'] or proof.get('operatorAcceptance') is not True:fail('KEEP_ON_CALL_UNACCEPTED')
        used=proof.get('resendUsage',{})
        if not all(isinstance(used.get(k),int) and not isinstance(used.get(k),bool) for k in ('daily','monthly')) or not 0<=used['daily']<=50 or not 0<=used['monthly']<=2000:fail('KEEP_QUOTA_UNSAFE')
        verify_keep_runtime(base,backup)
        # Recheck complete original environments except the approved seven values.
        before=base.selected(base.load(backup/'containers.before.private.json'));after=base.selected(base.containers())
        for name,row in before.items():
            if name in base.SERVICES:
                a=base.envmap(row);b=base.envmap(after[name])
                for k in SMTP_KEYS:a.pop(k,None);b.pop(k,None)
                if a!=b:fail('KEEP_NON_SMTP_ENV_DRIFT')
            elif name not in after or row['Id']!=after[name]['Id'] or row['State']['StartedAt']!=after[name]['State']['StartedAt']:fail('KEEP_OTHER_CONTAINER_DRIFT')
        validate_confirmation(state,proof,manifest,base.SHA,time.time())
        receipt={'runId':state['runId'],'manifestSha256':base.SHA,'proofSha256':digest(proof),'confirmedAt':time.time()}
        base.save(backup/'keep-receipt.safe.json',receipt)
        state.update({'phase':'committed','confirmationSha256':digest(receipt),'confirmedAt':receipt['confirmedAt']});base.save(backup/'state.private.json',state)
        # Durable commit precedes timer cancellation. An already-started timer
        # waits on this same lock and validates the receipt instead of racing.
        timer=base.load(backup/'rollback-timer.safe.json')['unit']
        base.run(['systemctl','stop',timer+'.timer'])
        base.phase(backup,'committed',smtpKept=True,rootGatesPassed=True,rollbackTimerDisarmed=True)


def restore_if_unconfirmed(base,backup):
    lock=open(backup/'operation.lock','a');os.chmod(backup/'operation.lock',0o600)
    with lock:
        fcntl.flock(lock,fcntl.LOCK_EX);state=base.load(backup/'state.private.json')
        receipt=base.load(backup/'keep-receipt.safe.json') if (backup/'keep-receipt.safe.json').exists() else None
        if not timer_should_restore(state,receipt,base.SHA):return False
        # Claim rollback under the lock; a later confirmation cannot win.
        state['phase']='rollback-required';base.save(backup/'state.private.json',state)
    base.restore(backup);return True


def production_timer_command(args,backup):
    tail=['/usr/bin/python3',str(backup/'customer-account-system-smtp-operator.py'),'restore',str(backup)]
    if args[-4:]!=tail or '--on-active=480s' not in args:fail('FIXED_TIMER_COMMAND_REJECTED')
    return [*args[:-4],'/usr/bin/python3',str(backup/'customer-account-system-smtp-production.py'),'restore-if-unconfirmed',str(backup)]


def production_probe_command(args,backup):
    tail=['/usr/bin/python3',str(backup/'customer-account-system-smtp-operator.py'),'verify',str(backup)]
    if args[-4:]!=tail or '--on-active=2s' not in args:fail('FIXED_PROBE_COMMAND_REJECTED')
    return [*args[:-4],'/usr/bin/python3',str(backup/'customer-account-system-smtp-production.py'),'verify-original',str(backup)]


def configure_base():
    if os.geteuid()!=0 or socket.gethostname()!='very-server':fail('EXACT_ROOT_HOST_REQUIRED')
    here=Path(__file__).resolve().parent
    source=here if here.parent==Path('/root/verygood-b5-backups') and here.stat().st_uid==0 else STAGE
    spec=importlib.util.spec_from_file_location('b5_preserved',source/'customer-account-system-smtp-operator.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
    manifest=base.load(source/'manifest.json');validate_manifest(manifest)
    if base.sha((source/'manifest.json').read_bytes())!=EXPECTED_MANIFEST_SHA256:fail('PRODUCTION_MANIFEST_HASH_DRIFT')
    if source!=STAGE:
        for name,expected in base.load(source/'tool-sha.safe.json').items():
            if Path(name).name!=name or base.sha((source/name).read_bytes())!=expected:fail('ROOT_BACKUP_TOOL_DRIFT')
    base.STAGE=STAGE;base.RUN_ID=RUN_ID;base.SHA=EXPECTED_MANIFEST_SHA256;base.OLD_SHA=manifest['originalManifestSha256']
    def approved():
        # The independent/manual root-backup path uses the root-copied approval,
        # not a mutable staging credential or a previous trial approval.
        validate_operating_approval(base.load(source/'execution-approval.private.json'),base.SHA)
    base.approval=approved
    original_run=base.run
    def fixed_run(args,data=None,timeout=45):
        if args[0]=='systemd-run' and '--on-active=2s' in args:
            backup=Path(args[-1]);shutil.copyfile(STAGE/'customer-account-system-smtp-production.py',backup/'customer-account-system-smtp-production.py');os.chmod(backup/'customer-account-system-smtp-production.py',0o600)
            args=production_probe_command(args,backup)
        elif args[0]=='systemd-run' and '--on-active=480s' in args:
            backup=Path(args[-1]);unit=next(a.split('=',1)[1] for a in args if a.startswith('--unit='))
            args=production_timer_command(args,backup)
            base.save(backup/'rollback-timer.safe.json',{'unit':unit})
        return original_run(args,data,timeout)
    base.run=fixed_run
    return base,manifest


def main():
    base,manifest=configure_base();args=sys.argv[1:]
    if args==['serve']:
        backup=base.preflight();shutil.copyfile(STAGE/'customer-account-system-smtp-production.py',backup/'customer-account-system-smtp-production.py');os.chmod(backup/'customer-account-system-smtp-production.py',0o600)
        base.prepare(backup);end=time.monotonic()+1800
        try:
            while time.monotonic()<end:
                state=base.load(backup/'state.private.json')
                if state['phase'] in ('restored','committed'):return
                if (STAGE/'restore.request.json').exists():
                    request=base.load(STAGE/'restore.request.json')
                    if request.get('manifestSha256')!=base.SHA:fail('RESTORE_REQUEST_REJECTED')
                    base.restore(backup);return
                if state['phase']=='prepared' and (STAGE/'apply.request.json').exists():
                    request=base.load(STAGE/'apply.request.json')
                    if request.get('manifestSha256')!=base.SHA:fail('APPLY_REQUEST_REJECTED')
                    base.approval();claim_apply_once(base.BACKUPS,base.SHA,backup)
                    base.apply(backup)
                if (STAGE/'keep-confirmation.private.json').exists():confirm(base,backup,manifest);return
                time.sleep(1)
            base.restore(backup)
        except Exception:
            state=base.load(backup/'state.private.json')
            if state.get('envChanged') and state.get('phase') not in ('restored','committed'):base.restore(backup)
            raise
    elif len(args)==2 and args[0] in ('restore-if-unconfirmed','restore','confirm','verify-original'):
        backup=Path(args[1])
        if backup.parent!=base.BACKUPS or backup.is_symlink() or backup.stat().st_uid!=0:fail('BACKUP_TARGET_REJECTED')
        if base.sha((backup/'manifest.json').read_bytes())!=base.SHA:fail('BACKUP_MANIFEST_DRIFT')
        if args[0]=='verify-original':
            if (base.ROOT/'.env').read_bytes()!=(backup/'env.before').read_bytes():fail('PROBE_ENV_DRIFT')
            base.health();base.internal_health();base.save(backup/'timer-probe.safe.json',{'pass':True,'uid':os.geteuid(),'at':time.time(),'publicCurlHealthy':True,'containerInternalHealthy':True})
        elif args[0]=='restore-if-unconfirmed':restore_if_unconfirmed(base,backup)
        elif args[0]=='confirm':confirm(base,backup,manifest)
        else:base.approval();base.restore(backup)
    else:fail('EXPLICIT_FIXED_ACTION_REQUIRED')


if __name__=='__main__':
    try:main()
    except Exception as e:
        code=str(e) if isinstance(e,ValueError) and re.fullmatch('[A-Z0-9_]+',str(e)) else 'PRODUCTION_SMTP_STOPPED'
        print(code+'; no secret printed. Verify restoration before continuing.');sys.exit(1)
