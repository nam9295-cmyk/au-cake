import test from 'node:test'
import assert from 'node:assert/strict'
const m=await import('../scripts/customer-account-test-function.mjs').catch(()=>({}))
const target={endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',resources:{databaseIds:['ca_test_cake_au','ca_test_kids_au'],functionIds:['ca-test-reservation-api']}}
const env={APPWRITE_ENDPOINT:target.endpoint,APPWRITE_PROJECT_ID:target.projectId,APPWRITE_API_KEY:'not-used-owner-session',APPWRITE_RESERVATION_API_FUNCTION_ID:'ca-test-reservation-api',APPWRITE_CAKE_DATABASE_ID:'ca_test_cake_au',APPWRITE_KIDS_DATABASE_ID:'ca_test_kids_au',APPWRITE_RESERVATION_API_RUNTIME:'node-22',APPWRITE_ADMIN_USER_IDS:'ca-test-admin-m-20261017',REVIEW_ADMIN_USER_IDS:'ca-test-admin-m-20261017',CALENDAR_VIEW_PIN:'123456',CALENDAR_TOKEN_SECRET:'test-only-32-character-calendar-secret',REVIEW_COUPON_HMAC_SECRET:'A'.repeat(43)}
const cliSession={endpoint:target.endpoint,cookie:'official-cli-test-session'}
const probe=async()=>({memoryAvailableBytes:8*2**30,diskAvailableBytes:80*2**30,load1:0,oomKills:0,apiHealthy:true})
function options(transport){return {target,env,cliSession,probe,transport}}
test('B6 rejects a wrong target or inherited operating configuration before any network',()=>{
 assert.equal(typeof m.createCustomerAccountTestFunctionManager,'function')
 let calls=0
 for(const changed of [{APPWRITE_PROJECT_ID:'verygood-au'},{APPWRITE_KIDS_DATABASE_ID:'production'},{APPWRITE_CONTROL_ENDPOINT:'http://localhost/v1'},{APPWRITE_REVIEW_COUPONS_TABLE_ID:'production'},{RESEND_API_KEY:'forbidden'},{CUSTOMER_ACCOUNT_ENABLED:'true'},{APPWRITE_ADMIN_USER_IDS:'operating-admin'}]) assert.throws(()=>m.createCustomerAccountTestFunctionManager({...options(async()=>{calls++}),env:{...env,...changed}}))
 assert.equal(calls,0)
})
test('B6 existing function or missing exact runtime causes zero writes',async()=>{
 assert.equal(typeof m.createCustomerAccountTestFunctionManager,'function')
 for(const conflict of ['existing','runtime']) {
  let writes=0
  const transport=async(url,o)=>{if(o.method!=='GET')writes++;let body={};if(url.endsWith('/projects/verygood-au-account-test'))body={...project};else if(url.endsWith('/functions/runtimes'))body={runtimes:conflict==='runtime'?[{$id:'node-20'}]:[{$id:'node-22'}]};else if(url.endsWith('/functions/specifications'))body={specifications:[{slug:'s-1vcpu-1gb',cpus:1,memory:1024,enabled:true}]};else if(url.endsWith('/functions'))body={total:1,functions:[{$id:'ca-test-reservation-api'}]};return Response.json(body)}
  await assert.rejects(m.createCustomerAccountTestFunctionManager(options(transport)).create())
  assert.equal(writes,0)
 }
})
const project={$id:target.projectId,teamId:'69bf44eb000f319a38a2',serviceStatusForAccount:false,authEmailOtp:false,authUsersAuthMagicURL:false,smtpEnabled:true,oAuthProviders:[{key:'google',enabled:true}]}
test('B6 creates one blocked function, serial variables and one non-activating deployment',async()=>{
 assert.equal(typeof m.createCustomerAccountTestFunctionManager,'function')
 const writes=[]
 const transport=async(url,o)=>{
  assert.equal(o.redirect,'error')
  assert.equal(o.headers['X-Appwrite-Project'],url.includes('/projects/')?'console':target.projectId)
  const path=new URL(url).pathname.slice(3)
  if(o.method==='GET') {
   if(path.startsWith('/projects/'))return Response.json(project)
   if(path==='/functions/runtimes')return Response.json({runtimes:[{$id:'node-22'}]})
   if(path==='/functions/specifications')return Response.json({specifications:[{slug:'s-1vcpu-1gb',cpus:1,memory:1024,enabled:true}]})
   if(path==='/functions')return Response.json({total:0,functions:[]})
  }
  writes.push([path,o.body])
  if(path==='/functions') {const p=JSON.parse(o.body);assert.equal(p.runtime,'node-22');assert.equal(p.enabled,false);assert.deepEqual(p.execute,[]);assert.deepEqual(p.events,[]);assert.equal(p.schedule,'');assert.equal(p.specification,'s-1vcpu-1gb');return Response.json({$id:p.functionId,...p})}
  if(path.endsWith('/variables'))return Response.json({$id:'variable',...JSON.parse(o.body)})
  if(path.endsWith('/deployments')){assert.equal(o.body.get('activate'),'false');return Response.json({$id:'deployment-one',status:'waiting'})}
  throw Error('unexpected route')
 }
 const manager=m.createCustomerAccountTestFunctionManager(options(transport))
 await manager.create()
 await assert.rejects(manager.create())
 await manager.deploy(Buffer.from('archive'))
 await assert.rejects(manager.deploy(Buffer.from('archive')))
 assert.equal(writes.filter(([p])=>p==='/functions').length,1)
 assert.equal(writes.filter(([p])=>p.endsWith('/deployments')).length,1)
 const variables=writes.filter(([p])=>p.endsWith('/variables')).map(([,b])=>JSON.parse(b))
 assert.equal(variables.find(v=>v.key==='CUSTOMER_ACCOUNT_ENABLED').value,'false')
 assert.equal(variables.some(v=>/RESEND|SMTP|PAYMENT/.test(v.key)),false)
})
test('B6 unhealthy resources stop before any mutation',async()=>{
 assert.equal(typeof m.createCustomerAccountTestFunctionManager,'function')
 let writes=0
 const manager=m.createCustomerAccountTestFunctionManager({...options(async(_u,o)=>{if(o.method!=='GET')writes++;return Response.json(project)}),probe:async()=>({...await probe(),apiHealthy:false})})
 await assert.rejects(manager.create())
 assert.equal(writes,0)
})
