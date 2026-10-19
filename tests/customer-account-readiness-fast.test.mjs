import assert from 'node:assert/strict'
import test from 'node:test'
import {checkCustomerAccountReadiness} from '../appwrite-functions/reservation-api/src/customer-account-readiness.js'
import {accountEnv,metadataDb} from './fixtures/customer-account/metadata.mjs'

const publicIds=new Set(['settings','cake_pickup_openings','class_booked_dates'])
function completeList(db) {
  return async args=>{
    const rows=await db.listCollections(args)
    return {...rows,collections:rows.collections.map(c=>({
      ...c,enabled:true,documentSecurity:false,
      $permissions:publicIds.has(c.$id)?['read("any")']:['read("user:admin-a")'],
    }))}
  }
}
test('customer readiness reuses complete fresh collection inventory with five metadata requests',async()=>{
  const base=metadataDb(),called=[]
  const db={
    ...base,
    list:async(...args)=>{called.push('databases');return base.list(...args)},
    listCollections:async args=>{called.push('collections:'+args.databaseId);return completeList(base)(args)},
    getCollection:async()=>{called.push('unnecessary-getCollection');throw Error('redundant metadata GET')},
    getAttribute:async(...args)=>{called.push('owner-attribute');return base.getAttribute(...args)},
    getIndex:async(...args)=>{called.push('owner-index');return base.getIndex(...args)},
  }
  assert.deepEqual(await checkCustomerAccountReadiness(db,accountEnv),{enabled:true,ready:true})
  assert.equal(called.filter(c=>c==='databases').length,1)
  assert.equal(called.filter(c=>c.startsWith('collections:')).length,2)
  assert.equal(called.filter(c=>c==='owner-attribute').length,1)
  assert.equal(called.filter(c=>c==='owner-index').length,1)
  assert.equal(called.includes('unnecessary-getCollection'),false)
  assert.equal(called.length,5)
})
test('readiness fails closed for unsafe, absent and partial listCollections ACL metadata',async()=>{
  const original=metadataDb(),full=completeList(original)
  for(const change of [
    rows=>{rows.collections.find(c=>c.$id==='reservations').$permissions=['read("any")']},
    rows=>{rows.collections.find(c=>c.$id==='settings').$permissions=['create("users")']},
    rows=>{delete rows.collections.find(c=>c.$id==='review_coupons').$permissions},
    rows=>{delete rows.collections.find(c=>c.$id==='reservations').documentSecurity},
    rows=>{rows.collections.find(c=>c.$id==='review_invites').enabled=false},
    rows=>{rows.collections.push({...rows.collections[0]});rows.total++},
    rows=>{rows.collections=rows.collections.filter(c=>c.$id!=='settings');rows.total--},
    rows=>{rows.total++},
  ]){
    const db={...original,listCollections:async args=>{const rows=await full(args);if(args.databaseId==='cake-db')change(rows);return rows}}
    const result=await checkCustomerAccountReadiness(db,accountEnv)
    assert.equal(result.ready,false,change.toString().slice(0,80))
  }
})
test('a new metadata inventory is read on every request; an ACL downgrade blocks next request',async()=>{
  let unsafe=false
  const base=metadataDb(),full=completeList(base)
  const db={...base,listCollections:async args=>{
    const rows=await full(args)
    if(unsafe&&args.databaseId==='cake-db')rows.collections.find(c=>c.$id==='reservations').$permissions.push('read("any")')
    return rows
  }}
  assert.equal((await checkCustomerAccountReadiness(db,accountEnv)).ready,true)
  unsafe=true
  assert.equal((await checkCustomerAccountReadiness(db,accountEnv)).ready,false)
})
