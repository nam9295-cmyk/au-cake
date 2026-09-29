#!/usr/bin/env python3
"""Narrow Reservation API rollout. Never prints credentials or changes Function settings.

Run on very-server; credentials stay in memory. Every mutation is preceded by a
durable intent record. A timeout of a mutation is ambiguous: stop, inspect, and
never repeat it automatically. No business write is performed by this tool.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import statistics
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'state'
FUNCTION = 'reservation-api'
ORIGINAL = '6aba25d85d117e8969b2'
ENDPOINT = 'http://appwrite-internal-proxy/v1'
KEY = 'APPWRITE_INTERNAL_API_ENDPOINT'
METADATA = ('runtime', 'enabled', 'schedule', 'scopes', 'execute', 'events', 'timeout', 'logging', 'entrypoint', 'commands')


def env_file(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            result[key.strip()] = value.strip().strip('\"\x27')
    return result


def save(name, data):
    STATE.mkdir(mode=0o700, exist_ok=True)
    temp = STATE / (name + '.tmp')
    temp.write_text(json.dumps(data, indent=2) + '\n')
    os.chmod(temp, 0o600)
    temp.replace(STATE / name)


def load(name):
    return json.loads((STATE / name).read_text())


def record(event, **details):
    STATE.mkdir(mode=0o700, exist_ok=True)
    row = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'event': event, **details}
    with (STATE / 'journal.jsonl').open('a') as f:
        f.write(json.dumps(row) + '\n'); f.flush(); os.fsync(f.fileno())
    print(json.dumps(row), flush=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Api:
    def __init__(self, env):
        self.env = env
        self.opener = urllib.request.build_opener(NoRedirect)

    def call(self, method, path, data=None, *, public=False, raw=None, content_type=None):
        base = self.env['APPWRITE_ENDPOINT'].rstrip('/') if public else 'http://127.0.0.1:8080/v1'
        headers = {'User-Agent': 'node', 'X-Appwrite-Project': self.env['APPWRITE_PROJECT_ID']}
        if not public:
            headers.update({'Host': 'appwrite', 'X-Appwrite-Key': self.env['APPWRITE_API_KEY']})
        if data is not None:
            raw = json.dumps(data).encode(); content_type = 'application/json'
        if content_type:
            headers['Content-Type'] = content_type
        request = urllib.request.Request(base + path, data=raw, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=75) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Never expose response bodies, build logs, environment or request headers.
            raise RuntimeError(f'Appwrite HTTP {error.code} for {method} {path.split("?")[0]}') from None

    def function(self):
        return self.call('GET', '/functions/' + FUNCTION)

    def variables(self):
        return self.call('GET', '/functions/' + FUNCTION + '/variables')['variables']

    def execution(self, action):
        return self.call('POST', '/functions/' + FUNCTION + '/executions',
                         {'body': json.dumps({'action': action}), 'async': False, 'path': '/', 'method': 'POST'}, public=True)


def fingerprints(variables):
    return {v['key']: hashlib.sha256(v.get('value', '').encode()).hexdigest()
            for v in variables if v['key'] != KEY}


def assert_unchanged(api, baseline):
    current = api.function()
    if {k: current.get(k) for k in METADATA} != baseline['metadata']:
        raise RuntimeError('Unexpected Function metadata drift; stopped')
    if fingerprints(api.variables()) != baseline['variableFingerprints']:
        raise RuntimeError('Unexpected Function variable drift; stopped')
    return current


def snapshot(api):
    if (STATE / 'baseline.json').exists():
        raise RuntimeError('Baseline already exists; refusing overwrite')
    fn = api.function()
    if fn['deploymentId'] != ORIGINAL:
        raise RuntimeError('Unexpected active Reservation API deployment')
    variables = api.variables()
    if any(v['key'] == KEY for v in variables):
        raise RuntimeError('Internal endpoint variable already exists; stopped')
    ids = {FUNCTION: ORIGINAL}
    for name in ['reservation-notification', 'booking-reminder']:
        ids[name] = api.call('GET', '/functions/' + name)['deploymentId']
    expected = {'reservation-notification': '6aba24438e574b5dc16c', 'booking-reminder': '6aba250c3e948ae0193e'}
    if any(ids[k] != value for k, value in expected.items()):
        raise RuntimeError('Unexpected notification/reminder deployment drift')
    save('baseline.json', {'deployments': ids, 'metadata': {k: fn.get(k) for k in METADATA},
                           'variableFingerprints': fingerprints(variables), 'internalVariableAbsent': True})
    record('baseline', deployments=ids)


def configure(api):
    if not load('sdk-preflight.json')['passed']:
        raise RuntimeError('Authenticated internal SDK preflight has not passed')
    baseline = load('baseline.json')
    current = assert_unchanged(api, baseline)
    if current['deploymentId'] != ORIGINAL or any(v['key'] == KEY for v in api.variables()):
        raise RuntimeError('Endpoint configuration precondition failed')
    record('intent.create-variable', key=KEY, previousDeploymentId=ORIGINAL)
    variable = api.call('POST', f'/functions/{FUNCTION}/variables', {'key': KEY, 'value': ENDPOINT, 'secret': False})
    save('endpoint-variable.json', {'id': variable['$id'], 'key': KEY})
    record('created-variable', key=KEY, variableId=variable['$id'])


def create_deployment(api, phase):
    baseline = load('baseline.json'); current = assert_unchanged(api, baseline)
    expected = ORIGINAL if phase == 'checkpoint' else load('checkpoint.json')['id']
    if current['deploymentId'] != expected:
        raise RuntimeError('Unexpected previous active deployment')
    if phase == 'full' and not load('checkpoint-gate.json')['passed']:
        raise RuntimeError('Checkpoint gate has not passed')
    if (STATE / f'{phase}.json').exists():
        raise RuntimeError('Phase deployment already recorded; refusing duplicate create')
    if not any(v['key'] == KEY and v['value'] == ENDPOINT for v in api.variables()):
        raise RuntimeError('Internal endpoint variable not configured')
    archive = (ROOT / 'reservation-api.tar.gz').read_bytes()
    boundary = 'internal-routing-' + uuid.uuid4().hex
    parts = []
    for key, value in {'activate': 'false', 'entrypoint': 'src/main.js', 'commands': 'npm ci --omit=dev'}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="code"; filename="code.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n'.encode() + archive + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    record('intent.create-deployment', phase=phase, previousDeploymentId=expected, archiveSha256=hashlib.sha256(archive).hexdigest())
    deployment = api.call('POST', f'/functions/{FUNCTION}/deployments', raw=b''.join(parts), content_type=f'multipart/form-data; boundary={boundary}')
    save(f'{phase}.json', {'id': deployment['$id'], 'previousId': expected, 'archiveSha256': hashlib.sha256(archive).hexdigest()})
    record('created-deployment', phase=phase, deploymentId=deployment['$id'])


def wait_ready(api, phase):
    deployment_id = load(f'{phase}.json')['id']
    for _ in range(120):
        deployment = api.call('GET', f'/functions/{FUNCTION}/deployments/{deployment_id}')
        if deployment['status'] == 'ready':
            record('ready', phase=phase, deploymentId=deployment_id); return
        if deployment['status'] == 'failed':
            raise RuntimeError('Deployment build failed; no activation performed')
        time.sleep(2)
    raise RuntimeError('Deployment readiness wait expired; no activation performed')


def set_active(api, deployment_id):
    record('intent.activate', previousDeploymentId=api.function()['deploymentId'], deploymentId=deployment_id)
    api.call('PATCH', f'/functions/{FUNCTION}/deployments/{deployment_id}')
    for _ in range(30):
        if api.function()['deploymentId'] == deployment_id:
            record('active-confirmed', deploymentId=deployment_id); return
        time.sleep(1)
    raise RuntimeError('Active deployment ID did not converge; inspect before continuing')


def activate(api, phase):
    phase_info = load(f'{phase}.json')
    current = assert_unchanged(api, load('baseline.json'))
    if current['deploymentId'] != phase_info['previousId']:
        raise RuntimeError('Activation previous deployment changed')
    if phase == 'full' and not load('checkpoint-gate.json')['passed']:
        raise RuntimeError('Checkpoint gate has not passed')
    deployment = api.call('GET', f'/functions/{FUNCTION}/deployments/{phase_info["id"]}')
    if deployment['status'] != 'ready':
        raise RuntimeError('Deployment is not ready')
    set_active(api, phase_info['id'])


def gate(api, phase):
    deployment_id = load(f'{phase}.json')['id']
    result = {'passed': False, 'deploymentId': deployment_id, 'requests': []}
    try:
        if assert_unchanged(api, load('baseline.json'))['deploymentId'] != deployment_id:
            raise RuntimeError('Gate active deployment mismatch')
        for action in ['health', 'get-cake-wire-capabilities']:
            for index in range(30):
                started = time.monotonic()
                row = {'action': action, 'index': index + 1}
                try:
                    execution = api.execution(action)
                    row.update({'status': execution.get('responseStatusCode'), 'executionId': execution['$id']})
                    body = json.loads(execution.get('responseBody', ''))
                    if not isinstance(body, dict) or not isinstance(body.get('result', {}), dict):
                        raise ValueError('Malformed Function response')
                    value = body.get('result', {})
                except Exception as error:
                    row['failureType'] = type(error).__name__
                    record('gate.failed-request', phase=phase, **row)
                    raise
                finally:
                    row['latencyMs'] = round((time.monotonic() - started) * 1000, 2)
                    result['requests'].append(row)
                valid = row['status'] == 200 and body.get('ok') is True and value.get('status') == 'ready'
                if action == 'health':
                    valid = valid and all(value.get('capabilities', {}).get(k) == 1 for k in ['cakeOrderLines', 'smoreStoredOrders', 'smoreWrites', 'chocolateOrderLines'])
                else:
                    valid = valid and value.get('customCakeV1') is True and value.get('cakeOrderV2') is True
                if not valid:
                    raise RuntimeError(f'Gate failed: {action} request {index + 1}, HTTP {row["status"]}')
                record('gate.request', phase=phase, **row)
        if api.function()['deploymentId'] != deployment_id:
            raise RuntimeError('Active deployment changed during gate')
        result['passed'] = True
        result['summary'] = {}
        for action in ['health', 'get-cake-wire-capabilities']:
            values = [r['latencyMs'] for r in result['requests'] if r['action'] == action]
            result['summary'][action] = {'count': len(values), 'minMs': min(values), 'medianMs': statistics.median(values), 'maxMs': max(values)}
        record('gate.passed', phase=phase, summary=result['summary'])
    finally:
        save(f'{phase}-gate.json', result)


def rollback(api):
    baseline = load('baseline.json')
    current = assert_unchanged(api, baseline)
    known = {ORIGINAL}
    for phase in ['checkpoint', 'full']:
        if (STATE / f'{phase}.json').exists(): known.add(load(f'{phase}.json')['id'])
    if current['deploymentId'] not in known:
        raise RuntimeError('Unknown active deployment; refusing to overwrite unrelated work')
    if current['deploymentId'] != ORIGINAL: set_active(api, ORIGINAL)
    variables = [v for v in api.variables() if v['key'] == KEY]
    if variables:
        variable = variables[0]
        if variable['value'] != ENDPOINT: raise RuntimeError('Internal endpoint variable drift; refusing removal')
        record('intent.delete-variable', key=KEY, variableId=variable['$id'])
        # DELETE returns an empty 204 response.
        try: api.call('DELETE', f'/functions/{FUNCTION}/variables/{variable["$id"]}')
        except json.JSONDecodeError: pass
    if api.function()['deploymentId'] != ORIGINAL: raise RuntimeError('Rollback confirmation failed')
    record('rollback.complete', deploymentId=ORIGINAL)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['snapshot', 'configure', 'deploy', 'wait', 'activate', 'gate', 'rollback'])
    parser.add_argument('--phase', choices=['checkpoint', 'full'], default='checkpoint')
    parser.add_argument('--env-file', default='/home/john/workspace/au-cake/.env.local')
    args = parser.parse_args()
    api = Api(env_file(args.env_file))
    if args.command in ['snapshot', 'configure', 'rollback']:
        globals()[args.command](api)
    else:
        {'deploy': create_deployment, 'wait': wait_ready, 'activate': activate, 'gate': gate}[args.command](api, args.phase)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Exception messages in this tool are controlled, but transport failures
        # may contain URLs: expose the class only unless explicitly raised here.
        message = str(error) if type(error) is RuntimeError else type(error).__name__
        print(json.dumps({'stopped': True, 'error': message}), flush=True)
        raise SystemExit(1)
