#!/usr/bin/env python3
"""Read-only authenticated SDK probe from an existing runtime on runtimes network."""
import json
import subprocess
import sys
from manage import Api, ENDPOINT, env_file, save, record

runtime = sys.argv[1]
details = json.loads(subprocess.check_output(['docker', 'inspect', runtime]))[0]
if set(details['NetworkSettings']['Networks']) != {'runtimes'}:
    raise SystemExit('Probe requires a runtime connected only to runtimes')
env = env_file('/home/john/workspace/au-cake/.env.local')
api = Api(env)
variables = {v['key']: v['value'] for v in api.variables()}
config = {k: v for k, v in variables.items() if k.startswith('APPWRITE_CUSTOM_CAKE_') or k in ['APPWRITE_CAKE_DATABASE_ID', 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID']}
config.update({'endpoint': ENDPOINT, 'project': env['APPWRITE_PROJECT_ID'], 'key': env['APPWRITE_API_KEY']})
script = 'const config = ' + json.dumps(config) + ';\n' + r'''
import { Client, Databases, Storage, Query } from 'node-appwrite';
import dns from 'node:dns/promises';
try {
  const address = await dns.lookup('appwrite-internal-proxy');
  if (!address.address.startsWith('172.18.')) throw new Error('Unexpected proxy DNS address');
  const client = new Client().setEndpoint(config.endpoint).setProject(config.project).setKey(config.key);
  const databases = new Databases(client), storage = new Storage(client), checks = [];
  for (const databaseId of new Set([config.APPWRITE_CAKE_DATABASE_ID, config.APPWRITE_CUSTOM_CAKE_DATABASE_ID])) {
    const database = await databases.get({ databaseId });
    if (database.$id !== databaseId || !database.enabled) throw new Error('Database mismatch');
    checks.push('database:' + databaseId);
  }
  for (const [key, collectionId] of Object.entries(config).filter(([key]) => key.startsWith('APPWRITE_CUSTOM_CAKE_') && key.endsWith('_TABLE_ID'))) {
    const databaseId = config.APPWRITE_CUSTOM_CAKE_DATABASE_ID;
    const collection = await databases.getCollection({ databaseId, collectionId });
    if (!collection.enabled || collection.$id !== collectionId) throw new Error('Collection mismatch');
    await databases.listDocuments({ databaseId, collectionId, queries: [Query.limit(1)], total: false });
    checks.push(key);
  }
  if (checks.filter(c=>c.endsWith('_TABLE_ID')).length !== 10) throw new Error('Missing Custom Cake collections');
  const bucket = await storage.getBucket({ bucketId: config.APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID });
  if (!bucket.enabled) throw new Error('Bucket disabled');
  checks.push('private-photo-bucket');
  let unauthorized = false;
  try { await new Databases(new Client().setEndpoint(config.endpoint).setProject(config.project)).get({databaseId:config.APPWRITE_CUSTOM_CAKE_DATABASE_ID}); }
  catch (error) { unauthorized = error.code === 401 || error.code === 403; }
  if (!unauthorized) throw new Error('Anonymous API access unexpectedly succeeded');
  console.log(JSON.stringify({passed:true,address:address.address,checks,anonymousDenied:true}));
} catch(error) { console.log(JSON.stringify({passed:false,errorType:error.type||error.name,httpStatus:error.code||null})); process.exitCode=1; }
'''
result = subprocess.run(['docker', 'exec', '-i', '-w', '/usr/local/server/src/function', runtime,
                         'node', '--input-type=module', '-'], input=script, text=True, capture_output=True)
try:
    report = json.loads(result.stdout.strip())
except Exception:
    raise SystemExit('SDK probe failed; raw output suppressed to protect credentials')
save('sdk-preflight.json', report)
print(json.dumps(report))
if result.returncode or not report.get('passed'):
    raise SystemExit(1)
record('sdk-preflight.passed', runtime=runtime)
