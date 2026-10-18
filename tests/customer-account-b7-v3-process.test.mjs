import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const api=await import('../scripts/customer-account-b7-v3-watchdog-process.mjs').catch(()=>({}))
test('independent watchdog process survives parent disconnect and confirms all OFF operations on deadline',async()=>{
 assert.equal(typeof api.startB7WatchdogProcess,'function')
 const dir=await mkdtemp(join(tmpdir(),'b7-watchdog-test-')),config=join(dir,'config.json')
 await writeFile(config,JSON.stringify({mode:'self-test',endsAt:Date.now()+250,intervalMs:20,directory:dir}),{mode:0o600})
 const child=api.startB7WatchdogProcess({configPath:config})
 assert.notEqual(child.pid,process.pid)
 let result
 for(let i=0;i<100;i++){try{result=JSON.parse(await readFile(join(dir,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,25))}}
 assert.equal(result?.verified,true);assert.equal(result?.mode,'self-test');assert.equal(result?.operations.length,8)
})
test('watchdog process rejects readable credentials and invalid modes before spawning',async()=>{
 assert.equal(typeof api.startB7WatchdogProcess,'function')
 const dir=await mkdtemp(join(tmpdir(),'b7-watchdog-invalid-')),config=join(dir,'config.json');await writeFile(config,'{}',{mode:0o644})
 assert.throws(()=>api.startB7WatchdogProcess({configPath:config}))
})
test('manual stop request closes an independent process before its immutable deadline',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'b7-watchdog-manual-')),config=join(dir,'config.json')
 await writeFile(config,JSON.stringify({mode:'self-test',endsAt:Date.now()+10000,intervalMs:20,directory:dir}),{mode:0o600})
 api.startB7WatchdogProcess({configPath:config});await api.requestB7Stop({configPath:config})
 let result;for(let i=0;i<100;i++){try{result=JSON.parse(await readFile(join(dir,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,20))}}
 assert.equal(result?.verified,true);assert.ok(Date.now()<result.endsAt)
})
test('activation lease rejects invalid or stale heartbeat and a stop marker',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'b7-lease-test-')),config=join(dir,'config.json'),now=Date.now()
 await writeFile(config,JSON.stringify({mode:'controlled-run',manifestSha256:'1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90',liveExecutionAuthorized:true,endsAt:now+900000,directory:dir}),{mode:0o600})
 const lease=api.createB7ActivationLease({configPath:config,clock:()=>now})
 const heart={mode:'controlled-run',closed:false,endsAt:now+900000,pid:process.pid}
 await writeFile(join(dir,'heartbeat.json'),JSON.stringify({...heart,at:'invalid'}),{mode:0o600});assert.equal(await lease(),false)
 await writeFile(join(dir,'heartbeat.json'),JSON.stringify({...heart,at:new Date(now-6000).toISOString()}),{mode:0o600});assert.equal(await lease(),false)
 await writeFile(join(dir,'heartbeat.json'),JSON.stringify({...heart,at:new Date(now).toISOString()}),{mode:0o600});assert.equal(await lease(),true)
 await api.requestB7Stop({configPath:config});assert.equal(await lease(),false)
})
test('V3 activation lease rejects an older manifest binding even with a fresh live PID heartbeat',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'b7-v3-proof-')),config=join(dir,'config.json'),now=Date.now()
 await writeFile(config,JSON.stringify({mode:'controlled-run',manifestSha256:'2421d820d99e38652a1adff4e37ca4afdbd0c002a37281462ac9b5a892d50c41',liveExecutionAuthorized:true,endsAt:now+900000,directory:dir}),{mode:0o600})
 await writeFile(join(dir,'heartbeat.json'),JSON.stringify({mode:'controlled-run',closed:false,endsAt:now+900000,pid:process.pid,at:new Date(now).toISOString()}),{mode:0o600})
 assert.equal(await api.createB7ActivationLease({configPath:config,clock:()=>now})(),false)
})
