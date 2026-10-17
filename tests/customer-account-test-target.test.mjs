import assert from 'node:assert/strict'
import test from 'node:test'
const guard = await import('../scripts/customer-account-test-target.mjs').catch(() => ({}))
const valid = () => ({ endpoint: 'https://api.verygood-chocolate.com/v1', projectId: 'verygood-au-account-test', resources: { databaseIds: ['ca_test_cake_au', 'ca_test_kids_au'], functionIds: ['ca-test-reservation-api'] } })
const credential = () => ({ endpoint: valid().endpoint, projectId: valid().projectId, keyId: 'test-metadata-key', consoleVerified: true, issuedAt: '2026-10-17T00:00:00Z', expiresAt: '2026-10-18T00:00:00Z', scopes: ['databases.read','collections.read','attributes.read','indexes.read'] })
const now = new Date('2026-10-17T01:00:00Z')

test('exact test pair is required; operating project and URL variants cannot reach the operation', () => {
  assert.equal(typeof guard.withCustomerAccountTestTarget, 'function')
  let writes = 0
  for (const projectId of ['verygood-au', 'verygood-main', '69cb27ef002b63e77c53', '69db3ae20026cdc0c7fe', '', 'other-test']) {
    assert.throws(() => guard.withCustomerAccountTestTarget({ ...valid(), projectId }, () => { writes++ }))
  }
  for (const endpoint of ['http://api.verygood-chocolate.com/v1', 'https://api.verygood-chocolate.com/v1/', 'https://api.verygood-chocolate.com:443/v1', 'https://api.verygood-chocolate.com/v1?x=1', 'https://user@api.verygood-chocolate.com/v1', 'https://evil.invalid/v1', valid().endpoint+'#x']) {
    assert.throws(() => guard.withCustomerAccountTestTarget({ ...valid(), endpoint }, () => { writes++ }))
  }
  assert.equal(writes, 0)
})
test('mixed database/function IDs are rejected before any operation', () => {
  assert.equal(typeof guard.withCustomerAccountTestTarget, 'function')
  let calls = 0
  for (const resources of [{databaseIds:['ca_test_cake_au','verygood_cake_au'],functionIds:[]}, {databaseIds:['ca_test_kids_au'],functionIds:['reservation-api']}, {databaseIds:[],functionIds:['ca-test-review-api']}, {databaseIds:['ca_test_cake_au','ca_test_cake_au'],functionIds:[]}]) {
    assert.throws(() => guard.withCustomerAccountTestTarget({...valid(),resources}, () => calls++))
  }
  assert.equal(calls, 0)
})
test('guard returns an immutable copy and collection IDs are bound to their database', () => {
  assert.equal(typeof guard.assertCustomerAccountTestResource, 'function')
  const input=valid(), safe=guard.assertCustomerAccountTestTarget(input)
  input.resources.databaseIds[0]='verygood_cake_au'
  assert.equal(safe.resources.databaseIds[0], 'ca_test_cake_au')
  assert.ok(Object.isFrozen(safe.resources.databaseIds))
  assert.doesNotThrow(() => guard.assertCustomerAccountTestResource(safe,{databaseId:'ca_test_cake_au',collectionId:'reservations'}))
  for(const resource of [{databaseId:'ca_test_kids_au',collectionId:'reservations'}, {databaseId:'ca_test_cake_au',collectionId:'custom_cake_snapshots'}, {databaseId:'ca_test_cake_au/../verygood-au'}, {functionId:'reservation-api'}]) assert.throws(() => guard.assertCustomerAccountTestResource(safe,resource))
})
test('unknown key provenance, foreign project, expanded scopes and expired keys fail closed', () => {
  assert.equal(typeof guard.assertCustomerAccountTestCredential, 'function')
  const check=c=>guard.assertCustomerAccountTestCredential(c,'metadata',now)
  assert.doesNotThrow(()=>check(credential()))
  for(const change of [{consoleVerified:false},{projectId:'verygood-au'},{keyId:''},{expiresAt:null},{expiresAt:'2026-10-17T00:30:00Z'},{issuedAt:'2026-10-18T00:00:00Z'},{expiresAt:'2026-11-17T00:00:00Z'},{scopes:['databases.read','collections.read','attributes.read','indexes.read','users.write']},{scopes:[]}]) assert.throws(()=>check({...credential(),...change}))
})
test('metadata transport refuses unsafe targets/key provenance before networking and never follows redirects', async () => {
  assert.equal(typeof guard.createCustomerAccountTestMetadataTransport, 'function')
  const requests=[]
  const transport=async(url,options)=>{requests.push({url,options});return new Response('{}')}
  for(const target of [{...valid(),projectId:'verygood-au'}, {...valid(),resources:{databaseIds:['verygood_cake_au'],functionIds:[]}}]) assert.throws(()=>guard.createCustomerAccountTestMetadataTransport({target,credential:credential(),secret:'synthetic-key',clock:()=>now,transport}))
  assert.throws(()=>guard.createCustomerAccountTestMetadataTransport({target:valid(),credential:{...credential(),consoleVerified:false},secret:'synthetic-key',clock:()=>now,transport}))
  assert.equal(requests.length,0)
  const safe=guard.createCustomerAccountTestMetadataTransport({target:valid(),credential:credential(),secret:'synthetic-key',clock:()=>now,transport})
  await assert.rejects(safe(valid().endpoint+'/databases',{method:'POST'}))
  await assert.rejects(safe(valid().endpoint+'/databases/verygood_cake_au',{method:'GET'}))
  await assert.rejects(safe(valid().endpoint+'/account',{method:'GET'}))
  await assert.rejects(safe(valid().endpoint+'/databases/ca_test_cake_au/collections/reservations/documents',{method:'GET'}))
  assert.equal(requests.length,0)
  for(const headers of [{'X-Appwrite-Project':'verygood-au'},new Headers({'x-appwrite-project':'verygood-main'}),{'X-Appwrite-Key':'unknown-key'}]) await assert.rejects(safe(valid().endpoint+'/databases/ca_test_cake_au/collections/reservations',{method:'GET',headers}))
  assert.equal(requests.length,0)
  await safe(valid().endpoint+'/databases/ca_test_cake_au/collections/reservations',{method:'GET',headers:{'X-Appwrite-Project':'verygood-au-account-test'},redirect:'follow'})
  assert.equal(requests.length,1)
  assert.equal(requests[0].options.headers['X-Appwrite-Project'],'verygood-au-account-test')
  assert.equal(requests[0].options.redirect,'error')
  const redirect=guard.createCustomerAccountTestMetadataTransport({target:valid(),credential:credential(),secret:'synthetic-key',clock:()=>now,transport:async()=>new Response('',{status:302,headers:{location:'https://evil.invalid'}})})
  await assert.rejects(redirect(valid().endpoint+'/health/version',{method:'GET'}))
})
test('public version probe omits API key so Appwrite 1.8.1 application roles need no added public scope',async()=>{
 const calls=[]
 const transport=async(url,options)=>{calls.push({url,options});return options.headers['X-Appwrite-Key']&&url.endsWith('/health/version')?new Response('{}',{status:401}):new Response('{"version":"1.8.1"}')}
 const safe=guard.createCustomerAccountTestMetadataTransport({target:valid(),credential:credential(),secret:'synthetic-key',clock:()=>now,transport})
 assert.equal((await safe(valid().endpoint+'/health/version',{method:'GET'})).status,200)
 assert.equal(calls[0].options.headers['X-Appwrite-Key'],undefined)
 await safe(valid().endpoint+'/databases',{method:'GET'});assert.equal(calls[1].options.headers['X-Appwrite-Key'],'synthetic-key')
})
