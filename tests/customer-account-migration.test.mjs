import assert from 'node:assert/strict'
import test from 'node:test'
import * as migration from '../scripts/migrate-customer-account-schema.mjs'
import * as schema from '../scripts/customer-account-schema.mjs'
import {accountEnv,metadataDb,ownerAttribute,ownerIndex} from './fixtures/customer-account/metadata.mjs'

test('migration defaults to read only; only missing reservations owner and index can be added',async()=>{
  assert.equal(typeof migration.runCustomerAccountMigration,'function')
  let attribute,index;const calls=[]
  const missing=()=>{throw Object.assign(Error('missing'),{code:404})}
  const client=metadataDb({getAttribute:async()=>attribute||missing(),getIndex:async()=>index||missing(),
    createStringAttribute:async args=>{calls.push(args);attribute=ownerAttribute},createIndex:async args=>{calls.push(args);index=ownerIndex}})
  const dry=await migration.runCustomerAccountMigration({env:accountEnv,client})
  assert.equal(dry.mode,'dry-run');assert.equal(dry.changes.length,2);assert.deepEqual(calls,[])
  assert.equal(dry.ready,false)
  const apply=await migration.runCustomerAccountMigration({env:accountEnv,apply:true,client,sleep:async()=>{}})
  assert.equal(apply.mode,'apply');assert.equal(calls.length,2)
  assert.equal(apply.ready,true)
  assert.deepEqual([...new Set(calls.map(c=>`${c.databaseId}/${c.collectionId}`))],['cake-db/reservations'])
  assert.equal(calls[0].required,false);assert.equal(calls[0].size,36)
  assert.deepEqual(calls[1].attributes,['customerUserId','$createdAt'])
  await migration.runCustomerAccountMigration({env:accountEnv,apply:true,client})
  assert.equal(calls.length,2)
})
test('migration refuses unsafe target, ACLs, conflicting definitions, unknown version, redirects and polling failure',async()=>{
  assert.equal(typeof migration.runCustomerAccountMigration,'function')
  for(const change of [{CUSTOMER_ACCOUNT_MIGRATION_MARKET:'KR'},{APPWRITE_ENDPOINT:'http://appwrite.test/v1'},{APPWRITE_ENDPOINT:'https://user:pass@appwrite.test/v1'},{APPWRITE_ENDPOINT:'https://appwrite.test/v1?q=1'},{APPWRITE_CAKE_DATABASE_ID:''}]) await assert.rejects(migration.runCustomerAccountMigration({env:{...accountEnv,...change},client:metadataDb()}))
  for(const overrides of [{getVersion:async()=>({version:'1.9.0'})},{getCollection:async()=>({documentSecurity:false,$permissions:['read("users")']})},{getAttribute:async()=>({...ownerAttribute,size:40})}]) await assert.rejects(migration.runCustomerAccountMigration({env:accountEnv,client:metadataDb(overrides)}))
  let polls=0
  const client=metadataDb({getAttribute:async()=>{polls++;if(polls===1)throw Object.assign(Error(),{code:404});return {...ownerAttribute,status:'processing'}},createStringAttribute:async()=>{}})
  await assert.rejects(migration.runCustomerAccountMigration({env:accountEnv,client,apply:true,sleep:async()=>{}}),/TIMEOUT/)
  assert.equal(polls,31)
})
test('HTTP dry-run uses only GET and rejects redirects; setup cannot combine customer accounts and direct writes',async()=>{
  assert.equal(typeof schema.customerAccountSetupDefinitions,'function')
  assert.throws(()=>schema.customerAccountSetupDefinitions({...accountEnv,APPWRITE_ADMIN_USER_IDS:''}))
  assert.throws(()=>schema.customerAccountSetupDefinitions({...accountEnv,APPWRITE_RESERVATION_WRITE_MODE:'direct'}))
  assert.deepEqual(schema.customerAccountSetupDefinitions({...accountEnv,CUSTOMER_ACCOUNT_ENABLED:'false'}),{attributes:[],indexes:[]})
  const requests=[],fixtures=metadataDb()
  const transport=async(url,options)=>{
    requests.push({url,...options})
    const pathname=new URL(url).pathname
    const parts=pathname.split('/')
    let body
    if(pathname.endsWith('/health/version'))body={version:'1.8.1'}
    else if(pathname==='/v1/databases')body=await fixtures.list()
    else if(pathname.endsWith('/collections'))body=await fixtures.listCollections({databaseId:parts[3]})
    else if(pathname.includes('/attributes/'))body=ownerAttribute
    else if(pathname.includes('/indexes/'))body=ownerIndex
    else if(pathname.includes('/collections/'))body=await fixtures.getCollection({databaseId:parts[3],collectionId:parts[5]})
    else body={$id:parts.at(-1)}
    return new Response(JSON.stringify(body),{status:200})
  }
  await migration.runCustomerAccountMigration({env:accountEnv,client:migration.createCustomerMigrationClient(accountEnv,transport)})
  assert.ok(requests.length>5)
  assert.ok(requests.every(r=>r.method==='GET'&&r.redirect==='error'))
})
test('dry-run distinguishes processing from available schema and refuses broad public collection writes',async()=>{
  const ready=await migration.runCustomerAccountMigration({env:accountEnv,client:metadataDb()})
  assert.equal(ready.ready,true)
  const pending=await migration.runCustomerAccountMigration({env:accountEnv,client:metadataDb({getAttribute:async()=>({...ownerAttribute,status:'processing'})})})
  assert.equal(pending.ready,false)
  const safe=metadataDb().getCollection
  await assert.rejects(migration.runCustomerAccountMigration({env:accountEnv,client:metadataDb({getCollection:async t=>t.collectionId==='settings'?{enabled:true,documentSecurity:false,$permissions:['create("users")']}:safe(t)})}))
})
