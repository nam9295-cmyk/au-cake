import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {managementFixture,now,G} from './fixtures/customer-account/google-only-management.mjs'
import {GOOGLE_TEST_TARGET,createGoogleOnlyTestManager} from '../scripts/customer-account-google-test.mjs'
const contract=await import('../tools/customer-account-cart-manual/contract.mjs').catch(()=>({}))
const build=await import('../scripts/build-customer-account-cart-manual.mjs').catch(()=>({}))
const control=await import('../scripts/customer-account-cart-manual.mjs').catch(()=>({}))
const mode={enabled:true,mode:'manual-cart',runId:'manual-cart-local-test',startedAt:now}
test('manual cart mode has no deadline; exact origin/shape and CLOSED still gate authentication',()=>{
 assert.equal(typeof contract.assertManualCartMode,'function')
 assert.deepEqual(contract.assertManualCartMode(mode,{origin:GOOGLE_TEST_TARGET.origin,now:now+24*3600000}),mode)
 for(const bad of [{...mode,enabled:false},{...mode,endsAt:now+900000},{...mode,mode:'google-only'}])assert.throws(()=>contract.assertManualCartMode(bad,{now}))
 assert.throws(()=>contract.assertManualCartMode(mode,{origin:'https://verygood-chocolate.com',now}))
})
test('manual auth permits existing G/H and logout only, never prefs/email/orders',async()=>{
 assert.equal(typeof contract.createManualCartAuth,'function');let signedOut=0,google=0
 const base={restore:async()=>({userId:G}),startGoogle:async()=>{google++},signOut:async()=>{signedOut++},saveProfile:async()=>{throw Error('should not reach')}}
 const auth=contract.createManualCartAuth({base,readMode:async()=>mode,origin:()=>GOOGLE_TEST_TARGET.origin,clock:()=>now})
 assert.equal((await auth.restore()).userId,G);await auth.startGoogle({});await auth.signOut();assert.equal(google,1);assert.equal(signedOut,1)
 await assert.rejects(auth.sendEmail());await assert.rejects(auth.verifyEmail());await assert.rejects(auth.saveProfile())
 base.restore=async()=>({userId:'unknown'});await assert.rejects(auth.restore())
})
test('browser transport refuses every Function/DB/prefs-write request before sending',async()=>{
 assert.equal(typeof contract.createManualCartFetch,'function');const sent=[]
 const fetch=contract.createManualCartFetch({origin:GOOGLE_TEST_TARGET.origin,transport:async(url,o)=>{sent.push([url,o?.method]);return new Response('{}')}})
 for(const path of ['/functions/ca-test-reservation-api/executions','/databases/ca_test_cake_au/collections/reservations/documents','/account/prefs'])await assert.rejects(fetch(GOOGLE_TEST_TARGET.endpoint+path,{method:'POST'}))
 await assert.rejects(fetch(GOOGLE_TEST_TARGET.endpoint+'/account',{headers:{'X-Appwrite-Project':'verygood-au'}}))
 await assert.rejects(fetch('https://other.invalid/v1/account'));assert.equal(sent.length,0)
 await fetch(GOOGLE_TEST_TARGET.endpoint+'/account',{method:'GET',headers:{'X-Appwrite-Project':'verygood-au-account-test'}});await fetch(GOOGLE_TEST_TARGET.endpoint+'/account/sessions/current',{method:'DELETE',headers:{'X-Appwrite-Project':'verygood-au-account-test'}})
 assert.equal(sent.length,2)
})
test('manual monitor remains open after 15 minutes and emergency-closes real policy drift',async()=>{
 assert.equal(typeof control.manualCartEmergencyReason,'function')
 const state={accountEnabled:true,sessions:{G:[],H:[],M:[]}}
 assert.equal(control.manualCartEmergencyReason(state,{phase:'open',accountOn:true},now+3600000),null)
 assert.equal(control.manualCartEmergencyReason({...state,accountEnabled:false},{phase:'open',accountOn:true},now).code,'ACCOUNT_STATE_MISMATCH')
 const unauthorized={...state,sessions:{'ca-test-admin-m-20261017':[{userId:'ca-test-admin-m-20261017',provider:'google',createdAt:new Date(now).toISOString()}]}}
 assert.equal(control.manualCartEmergencyReason(unauthorized,{phase:'opening',openingAt:now,startedAt:now},now).code,'SESSION_USER_NOT_ALLOWED')
})
test('manual probe resamples OFF metadata captured across the opening to open journal transition',async()=>{
 assert.equal(typeof control.probeManualCartState,'function')
 const opening={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'opening',openingAt:now,accountOn:false}
 let journal=opening,calls=0
 const result=await control.probeManualCartState({readJournal:async()=>journal,clock:()=>now+1000,inspect:async()=>{
  calls++
  if(calls===1){journal={...opening,phase:'open',accountOn:true};return {accountEnabled:false,sessions:{}}}
  return {accountEnabled:true,sessions:{}}
 }})
 assert.equal(result.reason,null);assert.equal(result.samples,2);assert.equal(calls,2)
})
test('manual probe still closes stable state drift and unapproved sessions without resampling',async()=>{
 assert.equal(typeof control.probeManualCartState,'function')
 const open={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'open',accountOn:true}
 let calls=0
 const probe=state=>control.probeManualCartState({readJournal:async()=>open,clock:()=>now+1000,inspect:async()=>{calls++;return state}})
 assert.equal((await probe({accountEnabled:false,sessions:{}})).reason.code,'ACCOUNT_STATE_MISMATCH');assert.equal(calls,1)
 const bad={accountEnabled:false,sessions:{unknown:[{userId:'unknown',provider:'google',createdAt:new Date(now+500).toISOString()}]}}
 assert.equal((await probe(bad)).reason.code,'SESSION_USER_NOT_ALLOWED');assert.equal(calls,2)
})
test('manual probe allows at most one coherent resample and never retries a network error',async()=>{
 assert.equal(typeof control.probeManualCartState,'function')
 let journal={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'opening',openingAt:now,accountOn:false},calls=0
 const result=await control.probeManualCartState({readJournal:async()=>journal,clock:()=>now+1000,inspect:async()=>{
  calls++;journal={...journal,phase:calls===1?'open':'prepared',accountOn:calls===1};return {accountEnabled:calls===1,sessions:{}}
 }})
 assert.equal(result.reason.code,'JOURNAL_INVALID');assert.equal(calls,2)
 calls=0
 await assert.rejects(control.probeManualCartState({readJournal:async()=>journal,inspect:async()=>{calls++;throw Error('synthetic network failure')}}))
 assert.equal(calls,1)
})
test('manual probe closes when the fresh sample still disagrees after an activation transition',async()=>{
 let journal={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'opening',openingAt:now,accountOn:false},calls=0
 const result=await control.probeManualCartState({readJournal:async()=>journal,clock:()=>now+1000,inspect:async()=>{
  calls++;journal={...journal,phase:'open',accountOn:true};return {accountEnabled:false,sessions:{}}
 }})
 assert.equal(result.reason.code,'ACCOUNT_STATE_MISMATCH');assert.equal(calls,2)
})
test('manual probe never hides an unauthorized session during an activation transition',async()=>{
 let journal={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'opening',openingAt:now,accountOn:false},calls=0
 const result=await control.probeManualCartState({readJournal:async()=>journal,clock:()=>now+1000,inspect:async()=>{
  calls++;journal={...journal,phase:'open',accountOn:true};return {accountEnabled:false,sessions:{unknown:[{userId:'unknown',provider:'google',createdAt:new Date(now+500).toISOString()}]}}
 }})
 assert.equal(result.reason.code,'SESSION_USER_NOT_ALLOWED');assert.equal(calls,1)
})
test('manual probe preserves the eight second activation allowance without an open-ended grace period',async()=>{
 const journal={kind:'MANUAL_CART',runId:mode.runId,startedAt:now,phase:'opening',openingAt:now,accountOn:false}
 let calls=0
 const result=await control.probeManualCartState({readJournal:async()=>journal,clock:()=>now+8001,inspect:async()=>{calls++;return {accountEnabled:true,sessions:{}}}})
 assert.equal(result.reason.code,'ACCOUNT_STATE_MISMATCH');assert.equal(calls,1)
})
test('manual Pages budget is exactly OPEN10/CLOSED11, never a repeat OPEN or third deployment',async()=>{
 assert.equal(typeof build.createManualCartPages,'function')
 const dir=await mkdtemp(join(tmpdir(),'manual-cart-pages-')),artifactDirectory=join(dir,'artifact');await mkdir(artifactDirectory)
 try{
  let uploads=0;const p=build.createManualCartPages({directory:dir,artifactDirectory,wranglerPath:'/synthetic/wrangler.mjs',run:async()=>{uploads++}})
  const proof={kind:'MANUAL_CART',startAuthorized:true,runId:mode.runId,startedAt:now,priorPagesUsed:9,openSlot:10,closedSlot:11}
  await assert.rejects(p.open({...proof,priorPagesUsed:7}));assert.equal(uploads,0)
  await p.open(proof);await assert.rejects(p.open(proof));await p.closed(proof);await p.closed(proof)
  assert.equal(uploads,2);assert.equal(JSON.parse(await readFile(join(dir,'closed-site/test-mode.json'))).enabled,false)
  assert.ok(!/<script\b/.test(await readFile(join(dir,'closed-site/cart.html'),'utf8')))
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('manual activation validates fresh approval and fixed target; OFF works without read prerequisites',async()=>{
 assert.equal(typeof control.createManualCartManager,'function');const h=managementFixture()
 const m=control.createManualCartManager({target:GOOGLE_TEST_TARGET,cliSession:{endpoint:GOOGLE_TEST_TARGET.endpoint,cookie:'synthetic-owner'},transport:h.transport,clock:()=>now})
 await assert.rejects(m.open({kind:'GOOGLE_ONLY'}));assert.equal(h.writes.length,0)
 const proof={kind:'MANUAL_CART',startAuthorized:true,runId:mode.runId,startedAt:now,httpsVerified:true,monitorVerified:true,pagesUsed:10,closedReserved:true}
 await m.open(proof);assert.equal(h.project.serviceStatusForAccount,true)
 await m.stop();assert.equal(h.project.serviceStatusForAccount,false)
 assert.ok(h.writes.every(x=>x.path==='/projects/verygood-au-account-test/service'))
})
test('compiled manual artifact reuses real CartProvider/Bag, has product images and no submit transport',async()=>{
 assert.equal(typeof build.buildManualCartSite,'function')
 const dir=await mkdtemp(join(tmpdir(),'manual-cart-artifact-'))
 try{
  const a=await build.buildManualCartSite({directory:dir})
  assert.ok(a.inputs.some(p=>p.endsWith('/src/CartProvider.tsx')));assert.ok(a.inputs.some(p=>p.endsWith('/src/pages/AuRenewalShop.tsx')))
  assert.ok(!a.inputs.some(p=>p.endsWith('/src/lib/renewal-client.ts')||p.endsWith('/src/lib/repository.ts')))
  assert.equal(await readFile(join(a.stage,'src/CartProvider.tsx'),'utf8'),await readFile('src/CartProvider.tsx','utf8'))
  for(const path of ['cart.html','account.html','cakes/pave-chocolate-cake.html','chocolates/pave-chocolate.html','products/pave-chocolate-cake-sydney.webp'])assert.ok((await readFile(join(a.directory,path))).length)
  assert.equal(JSON.parse(await readFile(join(a.directory,'test-mode.json'))).enabled,false)
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('manual recovery performs exact Account OFF before CLOSED upload and verifies without Function calls',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('UNEXPECTED_REAL_NETWORK')})
 const directory=await mkdtemp(join(tmpdir(),'manual-cart-recovery-')),h=managementFixture(),cookie={endpoint:GOOGLE_TEST_TARGET.endpoint,cookie:'synthetic-owner'}
 try{
  const state=await createGoogleOnlyTestManager({target:GOOGLE_TEST_TARGET,cliSession:cookie,transport:h.transport}).inspect()
  const artifactDirectory=join(directory,'artifact');await mkdir(artifactDirectory)
  const proof={kind:'MANUAL_CART',startAuthorized:true,runId:mode.runId,startedAt:now,priorPagesUsed:9,openSlot:10,closedSlot:11}
  const config={kind:'MANUAL_CART',startAuthorized:true,runId:mode.runId,startedAt:now,directory,artifactDirectory,wranglerPath:'/synthetic/wrangler.mjs',cliSessionPath:join(directory,'cli.json'),baselinePath:join(directory,'baseline.json'),approvalProofPath:join(directory,'proof.json')}
  for(const [name,data] of [['cli.json',cookie],['baseline.json',{state,functionExecutionsUsed:8,pagesUsed:9}],['proof.json',proof],['config.json',config]])await writeFile(join(directory,name),JSON.stringify(data),{mode:0o600})
  await writeFile(join(directory,'pages-10.claim'),mode.runId,{mode:0o600});h.project.serviceStatusForAccount=true
  let closed=false,uploads=0
  const transport=async(url,o)=>{
   if(url===GOOGLE_TEST_TARGET.endpoint+'/account')return new Response('{"type":"general_service_disabled"}',{status:h.project.serviceStatusForAccount?401:403})
   if(url===GOOGLE_TEST_TARGET.origin+'/test-mode.json')return new Response(JSON.stringify({enabled:!closed}))
   if(url===GOOGLE_TEST_TARGET.origin+'/')return new Response(closed?'<h1>Test CLOSED</h1>':'<script>open</script>')
   return h.transport(url,o)
  }
  const result=await control.closeManualCart(join(directory,'config.json'),undefined,{transport,runPages:async()=>{assert.equal(h.project.serviceStatusForAccount,false);closed=true;uploads++}})
  assert.equal(result.verified,true);assert.equal(uploads,1);assert.equal(h.project.serviceStatusForAccount,false)
  assert.ok(h.writes.every(w=>w.path==='/projects/verygood-au-account-test/service'))
 }finally{await rm(directory,{recursive:true,force:true})}
})
