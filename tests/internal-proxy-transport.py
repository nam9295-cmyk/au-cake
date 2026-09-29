"""Real nginx transport checks on disposable Docker networks, never production APIs."""
import json
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'ops/reservation-api-internal-routing/nginx.conf'
IMAGE = 'nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236'
name = 'reservation-proxy-test-' + uuid.uuid4().hex[:10]


def docker(*args, check=True):
    return subprocess.run(['docker', *args], check=check, capture_output=True, text=True)


server = r'''
const http = require('http'); let calls = 0;
http.createServer(async (req,res) => {
  let body=''; for await(const chunk of req) body+=chunk; calls++;
  res.writeHead(req.url.startsWith('/v1/fail') ? 503 : 200, {'Content-Type':'application/json','Cache-Control':'public, max-age=3600'});
  res.end(JSON.stringify({method:req.method,url:req.url,body,headers:req.headers,calls}));
}).listen(80,'0.0.0.0');
'''
client = r'''
const assert = require('node:assert/strict');
(async()=>{
const base='http://proxy';
assert.equal((await fetch(base+'/healthz')).status,200);
assert.equal((await fetch(base+'/not-api')).status,404);
const payload=JSON.stringify({text:'[Flavour: Triple Berry]\n\n그대로',blob:'x'.repeat(2*1024*1024)});
const r=await fetch(base+'/v1/echo?encoded=a%2Fb',{method:'POST',headers:{'Content-Type':'application/json','X-Appwrite-Project':'synthetic-project','X-Appwrite-Key':'synthetic-key','X-Appwrite-JWT':'synthetic-jwt','X-Custom-Cake-Upload-Token':'synthetic-photo-token'},body:payload});
const v=await r.json();assert.equal(v.url,'/v1/echo?encoded=a%2Fb');assert.equal(v.method,'POST');assert.equal(v.body,payload);assert.equal(v.headers.host,'appwrite');
assert.equal(v.headers['x-appwrite-key'],'synthetic-key');assert.equal(v.headers['x-appwrite-project'],'synthetic-project');assert.equal(v.headers['x-appwrite-jwt'],'synthetic-jwt');assert.equal(v.headers['x-custom-cake-upload-token'],'synthetic-photo-token');
const a=await fetch(base+'/v1/cache').then(r=>r.json());const b=await fetch(base+'/v1/cache').then(r=>r.json());assert.equal(b.calls,a.calls+1);
const failed=await fetch(base+'/v1/fail',{method:'POST',body:'single-write'});assert.equal(failed.status,503);const f=await failed.json();assert.equal(f.calls,b.calls+1);
const after=await fetch(base+'/v1/after').then(r=>r.json());assert.equal(after.calls,f.calls+1);
console.log(JSON.stringify({passed:true,checks:['path/query','2MiB body','auth headers','no cache','no retry on failed write','healthcheck','non-API 404']}));
})().catch(e=>{console.error(e.message);process.exit(1)});
'''

try:
    docker('network', 'create', '--internal', name)
    docker('run', '-d', '--name', name + '-upstream', '--network', name, '--network-alias', 'appwrite',
           '--entrypoint', 'node', 'node:22-bullseye', '-e', server)
    docker('run', '-d', '--name', name + '-proxy', '--network', name, '--network-alias', 'proxy',
           '--read-only', '--tmpfs', '/var/cache/nginx', '--tmpfs', '/var/run',
           '-v', str(CONFIG) + ':/etc/nginx/nginx.conf:ro', '--entrypoint', 'nginx', IMAGE, '-g', 'daemon off;')
    for _ in range(20):
        if docker('exec', name + '-proxy', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1/healthz', check=False).returncode == 0:
            break
        time.sleep(0.2)
    result = docker('exec', name + '-upstream', 'node', '-e', client)
    print(result.stdout.strip())
finally:
    docker('rm', '-f', name + '-proxy', name + '-upstream', check=False)
    docker('network', 'rm', name, check=False)
