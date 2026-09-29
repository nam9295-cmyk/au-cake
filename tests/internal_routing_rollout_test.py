import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('routing_manage', Path(__file__).resolve().parents[1] / 'ops/reservation-api-internal-routing/manage.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Api:
    def __init__(self, fail_at=None):
        self.active = 'checkpoint-id'; self.calls = []; self.fail_at = fail_at
    def function(self): return {'deploymentId': self.active}
    def variables(self): return []
    def execution(self, action):
        self.calls.append(action)
        return {'$id': str(len(self.calls)), 'responseStatusCode': 503 if self.fail_at == len(self.calls) else 200,
                'responseBody': json.dumps({'ok': True, 'result': {'status': 'ready', 'customCakeV1': True, 'cakeOrderV2': True,
                 'capabilities': {k: 1 for k in ['cakeOrderLines', 'smoreStoredOrders', 'smoreWrites', 'chocolateOrderLines']}}})}
    def call(self, method, path, *args, **kwargs):
        self.calls.append((method, path))
        if method == 'PATCH': self.active = path.split('/')[-1]
        return {}


class Rollout(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.old = m.STATE; m.STATE = Path(self.temp.name)
        m.save('baseline.json', {'metadata': {k: None for k in m.METADATA}, 'variableFingerprints': {}})
        m.save('checkpoint.json', {'id': 'checkpoint-id', 'previousId': m.ORIGINAL})
    def tearDown(self):
        m.STATE = self.old; self.temp.cleanup()
    def test_gate_requires_sixty_successful_sequential_requests(self):
        api = Api()
        with contextlib.redirect_stdout(io.StringIO()): m.gate(api, 'checkpoint')
        self.assertEqual(api.calls, ['health'] * 30 + ['get-cake-wire-capabilities'] * 30)
        self.assertTrue(m.load('checkpoint-gate.json')['passed'])
    def test_first_failure_stops_without_retry_or_activation(self):
        api = Api(fail_at=4)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError): m.gate(api, 'checkpoint')
        self.assertEqual(api.calls, ['health'] * 4)
        self.assertFalse(m.load('checkpoint-gate.json')['passed'])
    def test_rollback_restores_original_active_deployment(self):
        api = Api()
        with contextlib.redirect_stdout(io.StringIO()): m.rollback(api)
        self.assertEqual(api.active, m.ORIGINAL)
        self.assertEqual(api.calls, [('PATCH', '/functions/reservation-api/deployments/' + m.ORIGINAL)])
    def test_unknown_active_deployment_cannot_be_overwritten(self):
        api = Api(); api.active = 'someone-elses-deployment'
        with self.assertRaises(RuntimeError): m.rollback(api)
        self.assertEqual(api.calls, [])
    def test_malformed_response_records_latency_and_stops(self):
        api = Api()
        api.execution = lambda action: {'$id': 'broken', 'responseStatusCode': 200, 'responseBody': 'not-json'}
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(json.JSONDecodeError): m.gate(api, 'checkpoint')
        result = m.load('checkpoint-gate.json')
        self.assertFalse(result['passed'])
        self.assertEqual(len(result['requests']), 1)
        self.assertIn('latencyMs', result['requests'][0])
    def test_timeout_is_not_retried(self):
        api = Api(); calls = []
        def timeout(action):
            calls.append(action); raise TimeoutError()
        api.execution = timeout
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(TimeoutError): m.gate(api, 'checkpoint')
        self.assertEqual(calls, ['health'])
        self.assertEqual(m.load('checkpoint-gate.json')['requests'][0]['failureType'], 'TimeoutError')


if __name__ == '__main__': unittest.main()
