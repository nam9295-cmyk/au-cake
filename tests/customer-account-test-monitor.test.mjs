import assert from 'node:assert/strict'
import test from 'node:test'
import {assertCustomerAccountTestBudget} from '../scripts/provision-customer-account-test-project.mjs'
const module=await import('../scripts/customer-account-test-monitor.mjs').catch(()=>({}))
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',resources:{databaseIds:['ca_test_cake_au','ca_test_kids_au'],functionIds:[]}}
const healthy={memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0.2,oomKills:7}
test('resource probe rejects a production target before SSH or HTTP and never accepts stale samples',async()=>{
 assert.equal(typeof module.createCustomerAccountTestProbe,'function')
 let reads=0,requests=0,at=0
 const options={target,readMetrics:async()=>{reads++;return healthy},transport:async(url,opts)=>{requests++;assert.equal(url,'https://api.verygood-chocolate.com/v1/health/version');assert.equal(opts.redirect,'error');assert.equal(opts.headers['X-Appwrite-Project'],target.projectId);return new Response('{"version":"1.8.1"}')},clock:()=>at}
 assert.throws(()=>module.createCustomerAccountTestProbe({...options,target:{...target,projectId:'verygood-au'}}));assert.equal(reads+requests,0)
 const probe=module.createCustomerAccountTestProbe(options);assert.equal((await probe()).apiHealthy,true);at=4999;await probe();assert.equal(reads,1);at=5000;await probe();assert.equal(reads,2);assert.equal(requests,2)
})
test('invalid SSH metrics, unavailable API or version drift fail the existing resource budget gate',async()=>{
 assert.equal(typeof module.createCustomerAccountTestProbe,'function')
 for(const [metrics,body,status]of [[{},'{"version":"1.8.1"}',200],[healthy,'{}',503],[healthy,'{"version":"1.9.0"}',200]]){
  const probe=module.createCustomerAccountTestProbe({target,readMetrics:async()=>metrics,transport:async()=>new Response(body,{status})})
  await assert.rejects(async()=>assertCustomerAccountTestBudget(await probe(),{baselineOom:7,nowMs:0,highLoadSince:null}))
 }
})
