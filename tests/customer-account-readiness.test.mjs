import assert from 'node:assert/strict'
import test from 'node:test'
import * as readiness from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'
import {parseAdminUserIds} from '../scripts/review-schema.mjs'
import {accountEnv,metadataDb} from './fixtures/customer-account/metadata.mjs'
import {createReservationHandler} from '../appwrite-functions/reservation-api/src/main.js'

test('disabled readiness never accesses services; health also works without coupon configuration',async()=>{
  const check=readiness.checkCustomerAccountReadiness
  assert.equal(typeof check,'function')
  assert.deepEqual(await check(new Proxy({}, {get(){throw Error('unexpected metadata')}}),{}),{enabled:false,ready:false})
  const handler=createReservationHandler({env:{},servicesForRequest:()=>{throw Error('unexpected services')}})
  const result=await handler({req:{headers:{},bodyJson:{action:'customer-account-health'}},res:{json:(body,status,headers)=>({body,status,headers})},log(){},error(){}})
  assert.equal(result.status,200);assert.deepEqual(result.body.result,{enabled:false,ready:false});assert.equal(result.headers['Cache-Control'],'no-store')
  const broken=createReservationHandler({env:{CUSTOMER_ACCOUNT_ENABLED:'true'},servicesForRequest:()=>{throw Error('private config')}})
  const failed=await broken({req:{headers:{},bodyJson:{action:'customer-account-health'}},res:{json:(body,status,headers)=>({body,status,headers})},log(){},error(){}})
  assert.equal(failed.status,200);assert.deepEqual(failed.body.result,{enabled:true,ready:false});assert.equal(failed.headers['Cache-Control'],'no-store')
})
test('ACL requires exact existing admin ID allowlist; owner schema only applies to reservations',async()=>{
  assert.equal(typeof readiness.checkCustomerAccountReadiness,'function')
  assert.deepEqual(readiness.resolveCustomerAccountResources(accountEnv).adminUserIds,parseAdminUserIds(accountEnv))
  const attributes=[]
  const db=metadataDb({getAttribute:async args=>{attributes.push(args.collectionId);return {key:'customerUserId',type:'string',size:36,required:false,array:false,status:'available'}}})
  assert.deepEqual(await readiness.checkCustomerAccountReadiness(db,accountEnv),{enabled:true,ready:true})
  assert.deepEqual(attributes,['reservations'])
  for(const permission of ['read("users")','create("any")','read("guests")','read("user:unknown-admin")','delete("team:admins")','write("user:admin-a")']) {
    const bad=metadataDb({getCollection:async()=>({enabled:true,documentSecurity:false,$permissions:[permission]})})
    assert.equal((await readiness.checkCustomerAccountReadiness(bad,accountEnv)).ready,false,permission)
  }
})
test('readiness fails closed on incomplete inventory, schema mismatch and async failures',async()=>{
  assert.equal(typeof readiness.checkCustomerAccountReadiness,'function')
  for(const env of [{...accountEnv,APPWRITE_ADMIN_USER_IDS:''},{...accountEnv,APPWRITE_KIDS_DATABASE_ID:''},{...accountEnv,MARKET:'KR'},{...accountEnv,CUSTOM_CAKE_PERSISTENCE_ENABLED:'true'}]) assert.equal((await readiness.checkCustomerAccountReadiness(metadataDb(),env)).ready,false)
  for(const overrides of [
    {getCollection:async()=>({documentSecurity:true,enabled:true,$permissions:[]})},
    {getAttribute:async()=>({key:'customerUserId',type:'string',size:100,required:false,status:'available'})},
    {getAttribute:async()=>({key:'customerUserId',type:'string',size:36,required:false,status:'processing'})},
    {getIndex:async()=>({key:'customerUser_created_idx',type:'key',attributes:['customerUserId'],status:'available'})},
    {getIndex:async()=>{throw Error('network')}}
    ,{listCollections:async()=>({collections:[{$id:'unclassified-private'}],total:1})}
    ,{listCollections:async()=>({collections:[],total:101})}
  ]) assert.equal((await readiness.checkCustomerAccountReadiness(metadataDb(overrides),accountEnv)).ready,false)
})
test('configured Custom Cake private inventory is ACL-only, even while Custom flags are OFF',async()=>{
  const env={...accountEnv,APPWRITE_CUSTOM_CAKE_DATABASE_ID:'private-custom'}
  const names=['CLAIMS','SNAPSHOTS','SESSIONS','PHOTOS','QUOTAS','OUTBOX','COMMITS','CHUNKS','HISTORIES','RATELIMITS']
  for(const key of names)env[`APPWRITE_CUSTOM_CAKE_${key}_TABLE_ID`]=key.toLowerCase()
  const attributes=[],collections=[]
  const db=metadataDb({getAttribute:async t=>{attributes.push(t.collectionId);return {key:'customerUserId',type:'string',size:36,required:false,status:'available'}},getCollection:async t=>{collections.push(t.collectionId);return {documentSecurity:false,enabled:true,$permissions:[]}}})
  assert.equal((await readiness.checkCustomerAccountReadiness(db,env)).ready,true)
  assert.deepEqual(attributes,['reservations'])
  assert.ok(names.every(key=>collections.includes(key.toLowerCase())))
})
test('unclassified project databases and public settings/calendar writes block customer activation',async()=>{
  const safe=metadataDb().getCollection
  for(const override of [
    {list:async()=>({databases:[{$id:'unknown-personal-db'}],total:1})},
    {getCollection:async t=>['settings','cake_pickup_openings','class_booked_dates'].includes(t.collectionId)?{enabled:true,documentSecurity:false,$permissions:['read("any")','update("users")']}:safe(t)},
    {getAttribute:async()=>({key:'customerUserId',type:'string',size:36,required:false,status:'available',encrypt:true})},
  ])assert.equal((await readiness.checkCustomerAccountReadiness(metadataDb(override),accountEnv)).ready,false)
  const publicRead=metadataDb({getCollection:async t=>t.collectionId==='settings'?{enabled:true,documentSecurity:false,$permissions:['read("any")']}:safe(t)})
  assert.equal((await readiness.checkCustomerAccountReadiness(publicRead,accountEnv)).ready,true)
})
