import test from 'node:test'
import assert from 'node:assert/strict'
const api=await import('../scripts/customer-account-b7-watchdog.mjs').catch(()=>({}))
const steps=['accountOff','functionOff','flagsOff','invalidateSigningKey','restoreB6','siteOff','restoreAuthLimit','cleanupRunSessions']
function setup({failedStep,verify=false}={}){let now=0;const calls=[];const operations=Object.fromEntries(steps.map(step=>[step,async()=>{calls.push(step);if(step===failedStep)throw Error('transport')}]))
 assert.equal(typeof api.createB7Watchdog,'function')
 const wd=api.createB7Watchdog({endsAt:900000,clock:()=>now,operations,verifyClosed:async()=>verify,probe:async()=>({apiHealthy:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0,unexpectedExecutions:0,unexpectedUsers:false,metadataChanged:false})})
 return {wd,calls,set now(n){now=n}}
}
test('deadline cannot extend and expiry runs all close steps then verifies',async()=>{
 const s=setup({verify:true});assert.equal((await s.wd.tick()).closed,false);s.now=900000;assert.deepEqual(await s.wd.tick(),{closed:true,verified:true,failedSteps:[]});assert.deepEqual(s.calls,steps)
 assert.deepEqual(await s.wd.tick(),{closed:true,verified:true,failedSteps:[]});assert.equal(s.calls.length,8)
})
test('failed close action retries at most three, still closes other services and reports incomplete',async()=>{
 const s=setup({failedStep:'accountOff'});const result=await s.wd.stop()
 assert.equal(result.verified,false);assert.deepEqual(result.failedSteps,['accountOff','verifyClosed']);assert.equal(s.calls.filter(x=>x==='accountOff').length,3)
 for(const step of steps.slice(1))assert.equal(s.calls.filter(x=>x===step).length,1)
})
test('unexpected execution, user, metadata, health or resource drift stops immediately',async()=>{
 for(const override of [{unexpectedExecutions:1},{unexpectedUsers:true},{metadataChanged:true},{apiHealthy:false},{memoryAvailableBytes:1},{diskAvailableBytes:1},{oomKills:1}]){
  let calls=0
  const wd=api.createB7Watchdog({endsAt:900000,clock:()=>0,baselineOom:0,probe:async()=>({apiHealthy:true,memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0,unexpectedExecutions:0,unexpectedUsers:false,metadataChanged:false,...override}),operations:Object.fromEntries(steps.map(s=>[s,async()=>{calls++}])),verifyClosed:async()=>true})
  assert.equal((await wd.tick()).closed,true);assert.equal(calls,8)
 }
})
test('hanging OFF operation is bounded and does not prevent the remaining closures',async()=>{
 const calls=[]
 const operations=Object.fromEntries(steps.map(s=>[s,async()=>{calls.push(s);if(s==='accountOff')await new Promise(()=>{})}]))
 const wd=api.createB7Watchdog({endsAt:1,clock:()=>2,operations,verifyClosed:async()=>false,probe:async()=>({}),operationTimeoutMs:5})
 const result=await wd.stop();assert.equal(result.verified,false);assert.equal(calls.length,10);assert.ok(calls.includes('cleanupRunSessions'));assert.ok(result.failedSteps.includes('accountOff'))
})
