import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
test('new-key capture validates only the exact Penpot endpoint and never accepts credential arguments',()=>{
 const source=`import importlib.util,json,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('capture','scripts/security/capture-penpot-mcp-url.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
results=[]
for url in json.load(sys.stdin):
 try:m.validate_url(url);results.append(True)
 except Exception:results.append(False)
print(json.dumps(results))`
 const value='AAAA.BBBB.CCCC.DDDD.EEEE',base='https://very-server.tailb0ea56.ts.net:8443/mcp/stream?userToken='+value
 const r=spawnSync('python3',['-c',source],{input:JSON.stringify([base,base.replace('very-server.tailb0ea56.ts.net','wrong.invalid'),base+'&other=1',base+'\n',base.replace('https:','http:')]),encoding:'utf8'})
 assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),[true,false,false,false,false]);assert.equal(r.stdout.includes(value),false)
 const args=spawnSync('python3',['scripts/security/capture-penpot-mcp-url.py',value],{encoding:'utf8'});assert.equal(args.status,1);assert.equal((args.stdout+args.stderr).includes(value),false)
})
test('native HTTP reconnect replaces only Penpot and removes credential-bearing command arguments',()=>{
 const source=`import importlib.util,json,pathlib,sys,tomllib
sys.dont_write_bytecode=True
p=pathlib.Path('scripts/security/reconnect-penpot-mcp.py')
assert p.is_file(), 'native reconnect helper missing'
spec=importlib.util.spec_from_file_location('reconnect',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data=json.load(sys.stdin)
after=m.render_native_http_config(data['config'],data['url'])
parsed=tomllib.loads(after)
assert parsed['mcp_servers']['penpot']=={'url':data['url']}
assert after.startswith(data['prefix']) and after.endswith(data['suffix'])
assert data['old'] not in after
for broken in [data['config']+'\\n[mcp_servers.penpot]\\nurl="x"',data['config'].replace('[mcp_servers.penpot]','[mcp_servers.other]')]:
 try:m.render_native_http_config(broken,data['url']);raise AssertionError('accepted bad config')
 except ValueError:pass
print('native reconnect contract passed')`
 const old='old-fixture-key',url='https://very-server.tailb0ea56.ts.net:8443/mcp/stream?userToken=AAAA.BBBB.CCCC.DDDD.EEEE'
 const prefix='model = "existing"\n[mcp_servers.first]\ncommand="preserve"\n',suffix='[mcp_servers.last]\ncommand="keep exactly"\n'
 const config=prefix+'[mcp_servers.penpot]\ncommand="npx"\nargs=["mcp-remote","https://fixture.invalid/?userToken='+old+'"]\n\n'+suffix
 const r=spawnSync('python3',['-c',source],{input:JSON.stringify({config,url,old,prefix,suffix}),encoding:'utf8'})
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'native reconnect contract passed');assert.equal((r.stderr+r.stdout).includes(old),false)
})
