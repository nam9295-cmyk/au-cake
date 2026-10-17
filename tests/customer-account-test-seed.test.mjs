import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {buildRenewalOrderData} from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
import {checkCustomerAccountReadiness} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'
const seed=await import('../scripts/seed-customer-account-test-project.mjs').catch(()=>({}))
const input=()=>({target:{endpoint:'https://api.verygood-chocolate.com/v1',projectId:'verygood-au-account-test',resources:{databaseIds:['ca_test_cake_au','ca_test_kids_au'],functionIds:[]}},adminUserIds:['ca-test-admin-m-20261017'],runId:'20261017-b2'})
const build=()=>{assert.equal(typeof seed.buildCustomerAccountTestSeedPlan,'function');return seed.buildCustomerAccountTestSeedPlan(input())}

test('seed is an offline create-only plan of two databases and exactly twelve classified collections',()=>{
  const p=build()
  assert.equal(p.network,false);assert.equal(p.mode,'offline-dry-run')
  assert.deepEqual(p.creates.databases.map(d=>d.databaseId),['ca_test_cake_au','ca_test_kids_au'])
  assert.deepEqual(p.creates.collections.map(c=>`${c.databaseId}/${c.collectionId}`).sort(),[
    'ca_test_cake_au/reservations','ca_test_cake_au/settings','ca_test_cake_au/cake_pickup_openings','ca_test_cake_au/review_invites','ca_test_cake_au/reviews','ca_test_cake_au/review_coupons','ca_test_cake_au/manual_coupons','ca_test_cake_au/review_photo_cleanup','ca_test_cake_au/email_deliveries','ca_test_cake_au/email_delivery_retry_claims','ca_test_kids_au/class_reservations','ca_test_kids_au/class_booked_dates'].sort())
  assert.deepEqual(Object.keys(p.creates).sort(),['collections','databases'])
  assert.equal(p.env.CUSTOMER_ACCOUNT_ENABLED,'false');assert.equal(p.env.VITE_CUSTOMER_ACCOUNT_ENABLED,'false')
  assert.equal(p.env.APPWRITE_ADMIN_USER_IDS,'ca-test-admin-m-20261017');assert.equal(p.env.REVIEW_ADMIN_USER_IDS,'ca-test-admin-m-20261017')
})
test('all collection ACLs exclude customer grants; function-only ledgers stay closed',()=>{
  const p=build()
  for(const c of p.creates.collections){
    assert.equal(c.documentSecurity,false);assert.equal(c.enabled,true)
    const publicRead=['settings','cake_pickup_openings','class_booked_dates'].includes(c.collectionId)
    for(const permission of c.permissions) assert.ok(permission.includes('user:ca-test-admin-m-20261017')||publicRead&&permission==='read("any")')
    if(['review_invites','email_deliveries','email_delivery_retry_claims'].includes(c.collectionId)) assert.deepEqual(c.permissions,[])
  }
  const reservations=p.creates.collections.find(c=>c.collectionId==='reservations')
  assert.deepEqual(reservations.permissions,['create("user:ca-test-admin-m-20261017")','read("user:ca-test-admin-m-20261017")','update("user:ca-test-admin-m-20261017")','delete("user:ca-test-admin-m-20261017")'])
})
test('baseline accepts the real Renewal cake/chocolate storage contract and preserves request fingerprint fields',()=>{
  const p=build(), c=p.creates.collections.find(c=>c.collectionId==='reservations')
  for(const orderLines of [[{lineId:'cake',offerId:'pave-cake',size:'8in',quantity:1}],[{lineId:'choc',offerId:'almond-chocoball-80g',quantity:1}]]){
    const document=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'CA Test',customerPhone:'0491570006',customerEmail:'ca@example.invalid',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,website:'',orderLines},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'CA-TEST'})
    for(const [key,value] of Object.entries(document)){
      const attribute=c.attributes.find(a=>a.key===key)
      assert.ok(attribute,`missing ${key}`)
      if(attribute.type==='integer') assert.ok(Number.isSafeInteger(value),key)
      if(attribute.type==='string') assert.ok(typeof value==='string'&&value.length<=attribute.size,key)
      if(attribute.type==='enum') assert.ok(attribute.elements.includes(value),key)
    }
    for(const a of c.attributes.filter(a=>a.required)) assert.ok(Object.hasOwn(document,a.key),`required ${a.key}`)
  }
  assert.equal(c.attributes.find(a=>a.key==='requestFingerprint').size,64)
  assert.ok(!c.attributes.some(a=>a.key==='requestId')) // requestId is the document ID.
  assert.ok(c.indexes.some(i=>i.key==='status_pickupDate_idx'))
})
test('ownership migration is reservations-only and remains separate from the baseline with flags OFF',async()=>{
  const p=build(), collections=p.creates.collections
  assert.ok(collections.every(c=>!c.attributes.some(a=>a.key==='customerUserId')))
  assert.deepEqual(p.migration.target,{databaseId:'ca_test_cake_au',collectionId:'reservations'})
  assert.deepEqual(p.migration.attribute,{key:'customerUserId',type:'string',size:36,required:false})
  assert.deepEqual(p.migration.index,{key:'customerUser_created_idx',type:'key',attributes:['customerUserId','$createdAt'],orders:['ASC','DESC']})
  const missing=()=>{throw Object.assign(Error('missing'),{code:404})}
  const client={list:async()=>({databases:p.creates.databases.map(d=>({$id:d.databaseId})),total:2}),listCollections:async({databaseId})=>{const values=collections.filter(c=>c.databaseId===databaseId).map(c=>({$id:c.collectionId}));return {collections:values,total:values.length}},getCollection:async({databaseId,collectionId})=>{const c=collections.find(c=>c.databaseId===databaseId&&c.collectionId===collectionId);return {...c,$id:c.collectionId,$permissions:c.permissions}},getAttribute:async()=>missing(),getIndex:async()=>missing()}
  const env={...p.env,CUSTOMER_ACCOUNT_ENABLED:'true'} // In-memory readiness probe only.
  assert.deepEqual(await checkCustomerAccountReadiness(client,env),{enabled:true,ready:false})
  client.getAttribute=async()=>({...p.migration.attribute,status:'available'})
  client.getIndex=async()=>({...p.migration.index,status:'available'})
  assert.deepEqual(await checkCustomerAccountReadiness(client,env),{enabled:true,ready:true})
})
test('only synthetic nonpayment settings are seeded; account/order ownership must come from later real auth/API tests',()=>{
  const p=build()
  assert.equal(p.fixtures.length,1)
  const f=p.fixtures[0]
  assert.equal(f.databaseId,'ca_test_cake_au');assert.equal(f.collectionId,'settings')
  assert.equal(f.documentId,'ca-settings-20261017-b2')
  assert.equal(f.data.bankAccount,'TEST ONLY - DO NOT PAY')
  assert.equal(f.data.price,45)
  assert.ok(!JSON.stringify(p).includes('APPWRITE_API_KEY'))
  assert.ok(!JSON.stringify(p).includes('APPWRITE_CUSTOM_CAKE'))
})
test('mixed resources, unapproved admin UIDs and invalid run IDs fail before planning',()=>{
  assert.equal(typeof seed.buildCustomerAccountTestSeedPlan,'function')
  for(const change of [{target:{...input().target,projectId:'verygood-au'}},{adminUserIds:[]},{adminUserIds:['existing-production-admin']},{runId:'../../production'},{target:{...input().target,resources:{databaseIds:['ca_test_cake_au'],functionIds:[]}}}]) assert.throws(()=>seed.buildCustomerAccountTestSeedPlan({...input(),...change}))
})
test('CLI requires explicit inputs, ignores inherited operating env and rejects apply without network or secrets',()=>{
  const script=fileURLToPath(new URL('../scripts/seed-customer-account-test-project.mjs',import.meta.url))
  const env={...process.env,APPWRITE_ENDPOINT:'https://production.invalid/v1',APPWRITE_PROJECT_ID:'verygood-au',APPWRITE_API_KEY:'do-not-print',APPWRITE_ADMIN_USER_IDS:'operating-admin'}
  const run=(args)=>spawnSync(process.execPath,[script,...args],{env,encoding:'utf8'})
  const args=['--endpoint','https://api.verygood-chocolate.com/v1','--project-id','verygood-au-account-test','--admin-user-id','ca-test-admin-m-20261017','--run-id','20261017-b2']
  const good=run(args)
  assert.equal(good.status,0,good.stderr)
  assert.equal(JSON.parse(good.stdout).target.projectId,'verygood-au-account-test')
  for(const values of [[],[...args,'--apply'],[...args,'--project-id','verygood-au']]){
    const bad=run(values);assert.notEqual(bad.status,0)
    assert.ok(!bad.stdout.includes('do-not-print'));assert.ok(!bad.stderr.includes('do-not-print'))
  }
})
