import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm,lstat,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import * as watchdog from '../scripts/customer-account-google-only-watchdog.mjs'
import {createGoogleOnlyTestManager,GOOGLE_TEST_TARGET as target} from '../scripts/customer-account-google-test.mjs'
import {createGoogleOnlyLiveAdapters} from '../scripts/customer-account-google-only-live.mjs'
import {createCustomerAccountTestProbe} from '../scripts/customer-account-test-monitor.mjs'
import {managementFixture,G,H,M,now,window,proof} from './fixtures/customer-account/google-only-management.mjs'
const sample={safe:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0}
function core({probe=async()=>sample,clock=()=>now,onDiagnostic=()=>{},off=async()=>{},verify=async()=>true}={}){
 const steps=[]
 const wd=watchdog.createGoogleOnlyWatchdog({window,clock,onDiagnostic,probe,off:async()=>{steps.push('off');await off()},cleanup:async()=>{steps.push('cleanup')},siteOff:async()=>{steps.push('closed')},verify})
 return {wd,steps}
}
function makeManager(h,options={}){return createGoogleOnlyTestManager({target,cliSession:{endpoint:target.endpoint,cookie:'synthetic-secret-cookie'},transport:h.transport,clock:()=>now,...options})}
async function adapterFixture({onDiagnostic=()=>{},clock=()=>now}={}){
 const h=managementFixture(),state=await makeManager(h).inspect()
 const config={kind:'GOOGLE_ONLY',startAuthorized:true,planSha256:proof.planSha256,window,directory:'/tmp/unused-google-diagnostics',artifactDirectory:'/tmp/unused-google-diagnostics/artifact',wranglerPath:'/synthetic/wrangler.mjs',approvalProofPath:'proof',cliSessionPath:'cli',baselinePath:'baseline',journalPath:'journal'}
 const data={proof,cli:{endpoint:target.endpoint,cookie:'synthetic-secret-cookie'},baseline:{ownerVerified:true,functionExecutionsUsed:8,pagesUsed:7,state},journal:{kind:'GOOGLE_ONLY',runId:window.runId,phase:'prepared',accountOn:false,loginIntents:[]}}
 const adapter=await createGoogleOnlyLiveAdapters(config,{transport:async(url,o)=>url.endsWith('/health/version')?new Response('{"version":"1.8.1"}'):h.transport(url,o),readMetrics:async()=>sample,readJson:async path=>data[path],clock,onDiagnostic})
 return {h,data,adapter}
}
test('unexpected session is a distinct fail-closed reason without logging user/session data',async()=>{
 const events=[],{h,adapter}=await adapterFixture({onDiagnostic:e=>events.push(e)})
 h.sessions[G]=[{$id:'sensitive-session-id',userId:G,provider:'google',$createdAt:new Date(now).toISOString()}]
 const {wd,steps}=core({probe:adapter.probe,onDiagnostic:e=>events.push(e)})
 const result=await wd.tick()
 assert.equal(result.reason.code,'SESSION_LOGIN_INTENT_MISSING');assert.equal(result.verified,true)
 assert.deepEqual(steps,['off','cleanup','closed'])
 const text=JSON.stringify(events);for(const secret of [G,'sensitive-session-id','synthetic-secret-cookie'])assert.ok(!text.includes(secret))
})
test('valid attributed G/H sessions pass; wrong UID/provider/time and M sessions have distinct reasons',async()=>{
 for(const [change,code] of [
  [{},null],[{userId:H},'SESSION_USER_MISMATCH'],[{provider:'email'},'SESSION_PROVIDER_MISMATCH'],
  [{$createdAt:new Date(now-1).toISOString()},'SESSION_OUTSIDE_WINDOW'],[{$createdAt:'bad'},'SESSION_TIMESTAMP_INVALID'],
 ]){
  const {h,data,adapter}=await adapterFixture();h.project.serviceStatusForAccount=true
  data.journal={...data.journal,phase:'open',accountOn:true,loginIntents:[{userId:G,at:now}]}
  h.sessions[G]=[{$id:'synthetic-session',userId:G,provider:'google',$createdAt:new Date(now).toISOString(),...change}]
  const result=await core({probe:adapter.probe}).wd.tick()
  assert.equal(result.closed,code!==null);if(code)assert.equal(result.reason.code,code)
 }
 const {h,adapter}=await adapterFixture();h.sessions[M]=[{$id:'m-session',userId:M,provider:'google',$createdAt:new Date(now).toISOString()}]
 assert.equal((await core({probe:adapter.probe}).wd.tick()).reason.code,'SESSION_USER_NOT_ALLOWED')
})
test('Account policy API duration and timeout/network/auth failures are recorded without raw errors',async()=>{
 for(const [failure,code] of [['network','API_NETWORK_EXCEPTION'],['timeout','API_TIMEOUT'],['auth','OWNER_AUTH_DENIED']]){
  const h=managementFixture(),events=[];let at=now
  const m=makeManager(h,{clock:()=>at,onDiagnostic:e=>events.push(e),transport:async(url,o)=>{
   if(url===target.endpoint+'/projects/'+target.projectId){at+=37;if(failure==='auth')return new Response('{"message":"secret-response"}',{status:403});const error=Error('cookie=synthetic-secret-cookie');if(failure==='timeout')error.name='TimeoutError';throw error}
   return h.transport(url,o)
  }})
  const result=await core({probe:()=>m.inspect(),onDiagnostic:e=>events.push(e)}).wd.tick()
  assert.equal(result.reason.code,code);assert.equal(result.reason.stage,'project.get')
  assert.ok(events.some(e=>e.stage==='project.get'&&e.phase==='fail'&&e.durationMs===37&&e.code===code))
  assert.ok(!JSON.stringify([result,events]).includes('synthetic-secret-cookie'));assert.ok(!JSON.stringify(events).includes('secret-response'))
 }
})
test('a timeout while reading the Account policy response body is still API_TIMEOUT',async()=>{
 const h=managementFixture(),events=[]
 const m=makeManager(h,{onDiagnostic:e=>events.push(e),transport:async(url,o)=>{
  if(url===target.endpoint+'/projects/'+target.projectId){const response=new Response('{}');response.json=async()=>{const error=Error('secret-body-timeout');error.name='TimeoutError';throw error};return response}
  return h.transport(url,o)
 }})
 const result=await core({probe:()=>m.inspect()}).wd.tick()
 assert.equal(result.reason.code,'API_TIMEOUT');assert.equal(result.reason.stage,'project.get')
 assert.ok(!JSON.stringify(events).includes('secret-body-timeout'))
})
test('settings, flags, variables, Function execution drift cannot become a fresh baseline',async()=>{
 for(const [change,code] of [
  [h=>{h.project.smtpHost='new-private-host'},'PROJECT_SETTINGS_DRIFT'],
  [h=>{h.project.authEmailOtp=true},'AUTH_POLICY_DRIFT'],
  [h=>{h.variables[29].value='sensitive-new-value'},'FUNCTION_VARIABLE_DRIFT'],
  [h=>{h.variables[0].value='true'},'FUNCTION_FLAGS_DRIFT'],
  [h=>{h.executions.total++},'FUNCTION_EXECUTION_DRIFT'],
 ]){
  const h=managementFixture(),baseline=await makeManager(h).inspect(),events=[];change(h)
  const m=makeManager(h,{expectedBaseline:baseline,onDiagnostic:e=>events.push(e)})
  const result=await core({probe:()=>m.inspect(),onDiagnostic:e=>events.push(e)}).wd.tick()
  assert.equal(result.reason.code,code);assert.ok(!JSON.stringify(events).includes('sensitive-new-value'))
 }
})
test('a pending probe closes at the existing 4500ms bound with a timeout reason, no retries',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0
 const {wd,steps}=core({probe:()=>{calls++;return new Promise(()=>{})}})
 const pending=wd.tick();await Promise.resolve();t.mock.timers.tick(4500)
 const result=await pending
 assert.equal(result.reason.code,'PROBE_TIMEOUT');assert.equal(result.reason.stage,'probe');assert.equal(calls,1)
 assert.deepEqual(steps,['off','cleanup','closed'])
})
test('5-second lease boundary distinguishes stale heartbeat, stale completed probe and worker death',async()=>{
 assert.equal(typeof watchdog.inspectGoogleOnlyLeaseDetailed,'function')
 const directory=await mkdtemp(join(tmpdir(),'google-only-diagnostic-lease-'))
 try{
  const configPath=join(directory,'config.json');await writeFile(configPath,JSON.stringify({kind:'GOOGLE_ONLY',planSha256:proof.planSha256,mode:'live',startAuthorized:true,directory,adapterPath:'/synthetic/adapter.mjs',window}),{mode:0o600})
  const heartbeat={closed:false,pid:process.pid,at:now,checkedAt:now,startsAt:now,endsAt:window.endsAt,runId:window.runId}
  for(const [change,expected] of [[{at:now-5000,checkedAt:now-5000},'LEASE_FRESH'],[{at:now-5001},'LEASE_HEARTBEAT_STALE'],[{checkedAt:now-5001},'LEASE_PROBE_STALE'],[{checkedAt:now+1},'LEASE_CLOCK_INVALID'],[{pid:2147483647},'LEASE_WORKER_DEAD']]){
   await writeFile(join(directory,'heartbeat.json'),JSON.stringify({...heartbeat,...change}),{mode:0o600})
   const result=await watchdog.inspectGoogleOnlyLeaseDetailed({configPath,clock:()=>now})
   assert.equal(result.code,expected);assert.equal(await watchdog.inspectGoogleOnlyLease({configPath,clock:()=>now}),expected==='LEASE_FRESH')
  }
 }finally{await rm(directory,{recursive:true,force:true})}
})
test('metrics SSH failure and Appwrite version network failure retain separate safe stages',async()=>{
 for(const [failure,expected] of [['metrics','METRICS_READ_FAILED'],['version','API_NETWORK_EXCEPTION']]){
  const events=[]
  const probe=createCustomerAccountTestProbe({target:{endpoint:target.endpoint,projectId:target.projectId,resources:{databaseIds:[],functionIds:[]}},clock:()=>now,onDiagnostic:e=>events.push(e),readMetrics:async()=>{if(failure==='metrics')throw Error('secret-metrics');return sample},transport:async()=>{throw Error('secret-network')}})
  const result=await core({probe:async()=>({...await probe(),safe:false}),onDiagnostic:e=>events.push(e)}).wd.tick()
  assert.equal(result.closed,true)
  assert.ok(events.some(e=>e.stage===(failure==='metrics'?'resource.metrics':'resource.api-version')&&e.code===expected))
  assert.ok(!JSON.stringify([result,events]).includes('secret-'))
 }
})
test('a failed version diagnostic cannot leave apiHealthy true after the response was accepted',async()=>{
 const probe=createCustomerAccountTestProbe({target:{endpoint:target.endpoint,projectId:target.projectId,resources:{databaseIds:[],functionIds:[]}},clock:()=>now,readMetrics:async()=>sample,transport:async()=>new Response('{"version":"1.8.1"}'),onDiagnostic:e=>{if(e.stage==='resource.api-version'&&e.phase==='pass')throw Error('write-failed')}})
 const result=await probe()
 assert.equal(result.apiHealthy,false);assert.equal(result.reason.code,'DIAGNOSTICS_FAILED')
})
test('stop reason is immutable through concurrent stop requests and restore failures still fail verification',async()=>{
 const events=[],{wd,steps}=core({onDiagnostic:e=>events.push(e),off:async()=>{throw Error('secret-off')},verify:async()=>false})
 const first=wd.stop({code:'LEASE_PROBE_STALE',stage:'lease',probeAgeMs:5001})
 const second=wd.stop({code:'MANUAL_STOP',stage:'worker'})
 const result=await first;assert.deepEqual(await second,result)
 assert.equal(result.reason.code,'LEASE_PROBE_STALE');assert.equal(result.reason.probeAgeMs,5001)
 assert.equal(result.verified,false);assert.deepEqual(result.failedSteps,['accountOff','verifyClosed'])
 assert.deepEqual(steps,['off','cleanup','closed']);assert.ok(events.some(e=>e.stage==='accountOff'&&e.phase==='fail'&&Number.isFinite(e.durationMs)))
})
test('diagnostic sink failure cannot suppress OFF or be reported as verified recovery',async()=>{
 const {wd,steps}=core({onDiagnostic:()=>{throw Error('secret-sink')}})
 const result=await wd.tick()
 assert.equal(result.closed,true);assert.equal(result.verified,false);assert.ok(result.failedSteps.includes('diagnostics'))
 assert.deepEqual(steps,['off','cleanup','closed']);assert.ok(!JSON.stringify(result).includes('secret-sink'))
})
test('even a failed diagnostic file must not suppress the actual manager Account OFF mutation',async()=>{
 const h=managementFixture();h.project.serviceStatusForAccount=true
 const manager=makeManager(h,{onDiagnostic:()=>{throw Error('disk-full-secret')}})
 await assert.rejects(manager.stop())
 assert.equal(h.project.serviceStatusForAccount,false)
 assert.deepEqual(h.writes,[{path:'/projects/verygood-au-account-test/service',method:'PATCH'}])
})
test('diagnostic output rejects arbitrary codes, raw exception properties, keys and URLs',async()=>{
 const events=[],{wd}=core({onDiagnostic:e=>events.push(e)})
 const result=await wd.stop({code:'https://secret-host/?key=private',stage:'secret-stage',message:'raw-secret',cookie:'secret-cookie',probeAgeMs:5001})
 assert.equal(result.reason.code,'UNVERIFIED');assert.equal(result.reason.stage,'unknown')
 assert.ok(!JSON.stringify([result,events]).includes('secret'))
})
test('a stalled Owner project GET leaves its pending stage visible before the bounded OFF',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=managementFixture(),events=[]
 const m=makeManager(h,{onDiagnostic:e=>events.push(e),transport:(url,o)=>url===target.endpoint+'/projects/'+target.projectId?new Promise(()=>{}):h.transport(url,o)})
 const {wd,steps}=core({probe:()=>m.inspect(),onDiagnostic:e=>events.push(e)})
 const pending=wd.tick();await Promise.resolve();t.mock.timers.tick(4500)
 const result=await pending
 assert.equal(result.reason.code,'PROBE_TIMEOUT');assert.deepEqual(steps,['off','cleanup','closed'])
 assert.ok(events.some(e=>e.stage==='project.get'&&e.phase==='start'))
 assert.ok(!events.some(e=>e.stage==='project.get'&&e.phase==='pass'))
})
test('independent local worker persists a private safe reason and recovery timings; symlink log fails closed',async()=>{
 for(const hostileLog of [false,true]){
  const directory=await mkdtemp(join(tmpdir(),'google-only-diagnostic-worker-'));let pid
  try{
   const t=Date.now(),configPath=join(directory,'config.json')
   await writeFile(configPath,JSON.stringify({kind:'GOOGLE_ONLY',planSha256:proof.planSha256,mode:'self-test',directory,window:{...window,startsAt:t,endsAt:t+500}}),{mode:0o600})
   if(hostileLog){await writeFile(join(directory,'unchanged.txt'),'preserve-me',{mode:0o600});await symlink(join(directory,'unchanged.txt'),join(directory,'diagnostics.jsonl'))}
   ;({pid}=await watchdog.startGoogleOnlyWatchdog({configPath}))
   let result
   for(let i=0;i<40;i++){try{result=JSON.parse(await readFile(join(directory,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,100))}}
   assert.equal(result?.closed,true);assert.equal(result.verified,!hostileLog)
   if(hostileLog){assert.equal(await readFile(join(directory,'unchanged.txt'),'utf8'),'preserve-me');assert.ok(result.failedSteps.includes('diagnostics'))}
   else{
    assert.equal(result.reason.code,'DEADLINE')
    const path=join(directory,'diagnostics.jsonl'),events=(await readFile(path,'utf8')).trim().split('\n').map(x=>JSON.parse(x))
    assert.equal((await lstat(path)).mode&0o077,0)
    assert.ok(events.some(e=>e.phase==='stop'&&e.code==='DEADLINE'))
    for(const stage of ['accountOff','cleanup','siteClosed','verifyClosed'])assert.ok(events.some(e=>e.stage===stage&&e.phase==='pass'&&e.durationMs>=0))
   }
  }finally{if(pid){try{process.kill(pid,'SIGTERM')}catch{/* already exited */}}await rm(directory,{recursive:true,force:true})}
 }
})
