import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const gate=await import('../scripts/customer-account-b7-v3-activation-gate.mjs').catch(()=>({}))
const watchdog=await import('../scripts/customer-account-b7-v3-watchdog-process.mjs')
const sha='1c4245230e8bd89e72548bc0573ca158247462e93a8b427cdaa175d84b4d7c90'
const origin='https://au-account-test.verygood-chocolate.com',start=1792301099634
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'b7-gate-')),configPath=join(directory,'config.json')
 const window={startsAt:start,endsAt:start+900000}
 await writeFile(configPath,JSON.stringify({mode:'controlled-run',manifestSha256:sha,liveExecutionAuthorized:true,endsAt:window.endsAt,directory}),{mode:0o600})
 const heart={mode:'controlled-run',closed:false,at:new Date(start).toISOString(),endsAt:window.endsAt,pid:process.pid,probe:{startedAt:start-1200,finishedAt:start,durationMs:1200,wallElapsedMs:1200,clockDeltaMs:0,loopGapMs:1000}}
 const heartbeat=async(changes={})=>writeFile(join(directory,'heartbeat.json'),JSON.stringify({...heart,...changes}),{mode:0o600})
 await heartbeat();return {directory,configPath,window,heartbeat}
}
test('lease diagnostics distinguish fresh PID, stale heartbeat, missing heartbeat and stop evidence',async()=>{
 assert.equal(typeof watchdog.inspectB7ActivationLease,'function')
 const f=await fixture(),inspect=()=>watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>start})
 let r=await inspect();assert.equal(r.pass,true);assert.equal(r.details.heartbeatAgeMs,0);assert.equal(r.details.probeDurationMs,1200);assert.equal(r.checks.workerAlive,'PASS')
 await f.heartbeat({at:new Date(start-5001).toISOString()});r=await inspect();assert.equal(r.pass,false);assert.equal(r.checks.heartbeatFresh,'FAIL');assert.equal(r.details.heartbeatAgeMs,5001)
 await f.heartbeat();await writeFile(join(f.directory,'stop.request'),'stop',{mode:0o600});r=await inspect();assert.equal(r.pass,false);assert.equal(r.checks.noStopMarkers,'FAIL');assert.deepEqual(r.details.markers,['stop.request'])
 const other=await fixture();await (await import('node:fs/promises')).unlink(join(other.directory,'heartbeat.json'));assert.equal((await watchdog.inspectB7ActivationLease({configPath:other.configPath,clock:()=>start})).checks.heartbeatReadable,'FAIL')
})
test('lease never treats dead PID, failed worker, mismatched deadline or future timestamp as success',async()=>{
 assert.equal(typeof watchdog.inspectB7ActivationLease,'function')
 for(const [change,key] of [[{pid:2147483647},'workerAlive'],[{endsAt:start+1},'heartbeatContract'],[{at:new Date(start+1001).toISOString()},'heartbeatFresh']]){
  const f=await fixture();await f.heartbeat(change);const r=await watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>start});assert.equal(r.pass,false);assert.equal(r.checks[key],'FAIL')
 }
 const f=await fixture();await writeFile(join(f.directory,'worker-failed.json'),'{}',{mode:0o600});assert.equal((await watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>start})).pass,false)
})
test('stale lease exposes a still-running probe separately from the last completed probe',async()=>{
 const f=await fixture();await f.heartbeat({at:new Date(start-7000).toISOString(),probe:{startedAt:start-8000,finishedAt:start-7000,durationMs:1000,clockDeltaMs:0}})
 await writeFile(join(f.directory,'probe-start.json'),JSON.stringify({startedAt:start-6000}),{mode:0o600})
 const r=await watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>start});assert.equal(r.pass,false);assert.equal(r.details.inFlightProbe,true);assert.equal(r.details.inFlightProbeElapsedMs,6000)
})
async function run({responses=[()=>Response.json({enabled:true,startsAt:start,endsAt:start+900000})],mutate,window={startsAt:start,endsAt:start+900000},clockJump=0,networkDelay=0}={}){
 assert.equal(typeof gate.waitForB7ActivationGate,'function')
 const f=await fixture(),events=[],calls=[];let now=start,mono=0
 const inspectLease=()=>watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>now})
 if(mutate)await mutate(f)
 const result=await gate.waitForB7ActivationGate({siteOrigin:origin,manifestSha256:sha,window,inspectLease,clock:()=>now,monotonic:()=>mono,record:async e=>{events.push(e)},sleep:async ms=>{now+=ms;mono+=ms;await f.heartbeat({at:new Date(now).toISOString()})},transport:async(url,options)=>{calls.push({url,...options});const response=await responses[Math.min(calls.length-1,responses.length-1)]();now+=clockJump+networkDelay;mono+=networkDelay;return response}})
 return {result,events,calls}
}
test('healthy site records each HTTP/window/deadline/lease predicate and permits only exact GET',async()=>{
 const {result,events,calls}=await run();assert.equal(result.ready,true);assert.equal(result.attempts,1)
 assert.equal(events[0].site.checks.httpStatus,'PASS');assert.equal(events[0].site.checks.windowExact,'PASS');assert.equal(events[0].leaseBefore.pass,true);assert.equal(events[0].leaseAfter.pass,true)
 assert.equal(calls[0].url,origin+'/test-window.json');assert.equal(calls[0].method,'GET');assert.equal(calls[0].redirect,'manual');assert.equal(calls[0].cache,'no-store');assert.equal(calls[0].headers,undefined)
})
test('closed Pages propagation retries reads within the same immutable window, then accepts exact tuple',async()=>{
 const {result,events,calls}=await run({responses:[()=>Response.json({enabled:false},{headers:{'cf-cache-status':'HIT',age:'7'}}),()=>Response.json({enabled:true,startsAt:start,endsAt:start+900000})]})
 assert.equal(result.ready,true);assert.equal(calls.length,2);assert.equal(events[0].site.details.cacheStatus,'HIT');assert.equal(events[0].site.details.cacheAgeSeconds,7);assert.equal(events[0].retryable,true);assert.equal(events[1].window.endsAt,start+900000)
})
test('persistent propagation is bounded to five GETs without deployment or deadline extension',async()=>{
 const {result,calls}=await run({responses:[()=>new Response(null,{status:404})]});assert.equal(result.ready,false);assert.equal(result.reason,'SITE_NOT_READY');assert.equal(calls.length,5)
})
test('stale lease prevents even the first site GET and is never retried into success',async()=>{
 const {result,calls,events}=await run({mutate:f=>f.heartbeat({at:new Date(start-6000).toISOString()})});assert.equal(result.ready,false);assert.equal(result.reason,'LEASE_FAILED');assert.equal(calls.length,0);assert.equal(events[0].leaseBefore.checks.heartbeatFresh,'FAIL')
})
test('worker failure during site request denies readiness despite a matching site window',async()=>{
 const f=await fixture();assert.equal(typeof gate.waitForB7ActivationGate,'function')
 const result=await gate.waitForB7ActivationGate({siteOrigin:origin,manifestSha256:sha,window:f.window,inspectLease:()=>watchdog.inspectB7ActivationLease({configPath:f.configPath,clock:()=>start}),clock:()=>start,record:async()=>{},transport:async()=>{await writeFile(join(f.directory,'worker-failed.json'),'{}',{mode:0o600});return Response.json({enabled:true,...f.window})}})
 assert.equal(result.ready,false);assert.equal(result.reason,'LEASE_FAILED')
})
test('enabled but wrong window fails immediately rather than treating it as propagation',async()=>{
 const {result,calls,events}=await run({responses:[()=>Response.json({enabled:true,startsAt:start+1,endsAt:start+900000})]});assert.equal(result.ready,false);assert.equal(calls.length,1);assert.equal(events[0].site.checks.windowExact,'FAIL');assert.equal(events[0].site.checks.startsAtExact,'FAIL');assert.equal(events[0].site.checks.endsAtExact,'PASS');assert.equal(events[0].retryable,false)
})
test('deadline expiring in fetch or a clock/sleep discontinuity cannot create readiness',async()=>{
 for(const jump of [900000,2000]){const {result,events}=await run({clockJump:jump});assert.equal(result.ready,false);assert.equal(events[0].timing.checks[jump===900000?'beforeDeadline':'clockContinuous'],'FAIL')}
})
test('slow network cannot hide an aged heartbeat after an otherwise valid site GET',async()=>{
 const {result,events}=await run({networkDelay:5001});assert.equal(result.ready,false);assert.equal(result.reason,'LEASE_FAILED');assert.equal(events[0].leaseAfter.details.heartbeatAgeMs,5001);assert.equal(events[0].timing.checks.clockContinuous,'PASS')
})
test('a near deadline bounds propagation reads without starting another request at expiry',async()=>{
 const {result,calls}=await run({window:{startsAt:start,endsAt:start+1500},responses:[()=>new Response(null,{status:503})]});assert.equal(result.ready,false);assert.equal(calls.length,2)
})
test('malformed or oversized JSON and a network error stop without logging body/error text',async()=>{
 for(const response of [()=>new Response('JWT=secret-token',{headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(4097),{headers:{'content-type':'application/json'}}),()=>{throw Error('Cookie=secret-token')}]){const {result,events,calls}=await run({responses:[response]});assert.equal(result.ready,false);assert.equal(calls.length,1);assert.ok(!JSON.stringify(events).includes('secret-token'))}
})
test('server Date skew is recorded with HTTP round-trip context without replacing the fixed deadline',async()=>{
 const {result,events}=await run({responses:[()=>Response.json({enabled:true,startsAt:start,endsAt:start+900000},{headers:{date:new Date(start+3000).toUTCString()}})]});assert.equal(result.ready,true);assert.equal(events[0].site.details.serverClockOffsetMs,2366);assert.equal(events[0].site.details.serverRemainingMs,897634)
})
test('lease authentication/probe errors fail closed and diagnostic writer errors never grant readiness',async()=>{
 assert.equal(typeof gate.waitForB7ActivationGate,'function')
 let calls=0;const base={siteOrigin:origin,manifestSha256:sha,window:{startsAt:start,endsAt:start+900000},clock:()=>start,inspectLease:async()=>{throw Error('Cookie=DO_NOT_PRINT')},transport:async()=>{calls++;throw Error('unused')},record:async()=>{}}
 const r=await gate.waitForB7ActivationGate(base);assert.equal(r.ready,false);assert.equal(r.reason,'LEASE_FAILED');assert.equal(calls,0);assert.ok(!JSON.stringify(r).includes('Cookie'))
 await assert.rejects(gate.waitForB7ActivationGate({...base,record:async()=>{throw Error('disk unavailable')}}),/B7_GATE_EVIDENCE_UNAVAILABLE/)
})
test('redirects and hostile response values never leak credentials into diagnostics',async()=>{
 const leaked='super-secret-value';const {result,events}=await run({responses:[()=>new Response(null,{status:302,headers:{location:'https://user:'+leaked+'@evil.invalid/path?jwt='+leaked,'cf-cache-status':leaked,etag:leaked}})]})
 assert.equal(result.ready,false);assert.equal(events[0].site.checks.noRedirect,'FAIL');assert.equal(events[0].site.details.redirectLocationPresent,true);assert.ok(!JSON.stringify(events).includes(leaked))
 const other=await run({responses:[()=>Response.json({enabled:true,startsAt:leaked,endsAt:leaked,token:leaked})]});assert.equal(other.result.ready,false);assert.ok(!JSON.stringify(other.events).includes(leaked))
})
test('wrong origin/hash or expired window are rejected before network or leases',async()=>{
 assert.equal(typeof gate.waitForB7ActivationGate,'function')
 for(const change of [{siteOrigin:'https://user:credential@evil.invalid'},{manifestSha256:'bad'},{window:{startsAt:start-900000,endsAt:start}}]){let calls=0;await assert.rejects(gate.waitForB7ActivationGate({siteOrigin:origin,manifestSha256:sha,window:{startsAt:start,endsAt:start+900000},clock:()=>start,inspectLease:async()=>{calls++},record:async()=>{},transport:async()=>{calls++},...change}),/B7_GATE_CONFIGURATION_REJECTED/);assert.equal(calls,0)}
})
test('independent worker preserves per-tick timing history instead of only its latest heartbeat',async()=>{
 const f=await fixture();await writeFile(f.configPath,JSON.stringify({mode:'self-test',endsAt:Date.now()+1000,intervalMs:20,directory:f.directory}),{mode:0o600})
 watchdog.startB7WatchdogProcess({configPath:f.configPath});let closed
 for(let i=0;i<100;i++){try{closed=JSON.parse(await readFile(join(f.directory,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,20))}}
 assert.equal(closed?.verified,true);const history=(await readFile(join(f.directory,'heartbeat-history.jsonl'),'utf8')).trim().split('\n').map(JSON.parse)
 assert.ok(history.length>=2);assert.ok(history.every(x=>Number.isFinite(x.probe.durationMs)&&Number.isFinite(x.probe.clockDeltaMs)));assert.equal(history.at(-1).closed,true)
})
test('diagnostic write failure cannot prevent watchdog OFF operations',async()=>{
 const f=await fixture();await writeFile(f.configPath,JSON.stringify({mode:'self-test',endsAt:Date.now()+10000,intervalMs:20,directory:f.directory}),{mode:0o600})
 await (await import('node:fs/promises')).mkdir(join(f.directory,'probe-start.json.tmp'))
 watchdog.startB7WatchdogProcess({configPath:f.configPath});let result
 for(let i=0;i<100;i++){try{result=JSON.parse(await readFile(join(f.directory,'closed.json'),'utf8'));break}catch{await new Promise(r=>setTimeout(r,20))}}
 assert.equal(result?.verified,true);assert.equal(result.operations.length,8);assert.equal(result.diagnosticRecordingFailed,true)
})
