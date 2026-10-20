import test from 'node:test'
import assert from 'node:assert/strict'
import {createReservationHandler} from '../appwrite-functions/reservation-api/src/main.js'

const env={REVIEW_ADMIN_USER_IDS:'admin-1',APPWRITE_ADMIN_USER_IDS:'admin-1'}
const user=(id='customer-1')=>({$id:id,$createdAt:'2026-10-19T10:00:00.000Z',name:'Google name',email:`${id}@example.test`,status:true,password:'PRIVATE_HASH',sessions:[{secret:'PRIVATE_SESSION'}],prefs:{unrelated:'PRIVATE_PREF',verygoodAuCustomer:{version:1,name:'Saved name',contactEmail:'orders@example.test',phone:'0412345678',language:'en'}}})
async function call({headers={'x-appwrite-user-id':'admin-1','x-appwrite-user-jwt':'valid'},identity={$id:'admin-1',status:true},data={},extra={},rows=[user('admin-1'),user()],settings=env,fail=false}={}) {
  const calls=[],logs=[]
  const handler=createReservationHandler({env:settings,servicesForRequest:()=>({
    accountForJwt:async token=>({get:async()=>{if(token!=='valid')throw Error('PRIVATE_AUTH_FAILURE');return identity}}),
    users:{list:async input=>{calls.push(input);if(fail)throw Error('PRIVATE_KEY_OR_USER');return {users:rows,total:rows.length}}},
  })})
  const response=await handler({req:{headers,bodyJson:{action:'list-admin-members',data,...extra}},res:{json:(body,status,headers)=>({body,status,headers})},log:m=>logs.push(m),error:m=>logs.push(m)})
  return {...response,calls,logs}
}
test('verified allowlisted admin receives an explicit safe member projection without readiness/DB reads',async()=>{
  const r=await call();assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'no-store')
  assert.equal(r.body.result.total,2);assert.equal(r.body.result.nextCursor,null)
  assert.deepEqual(r.body.result.members[1],{id:'customer-1',name:'Saved name',loginEmail:'customer-1@example.test',contactEmail:'orders@example.test',phone:'0412345678',joinedAt:'2026-10-19T10:00:00.000Z',status:'active',role:'customer'})
  assert.equal(r.body.result.members[0].role,'admin')
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_|password|sessions|unrelated|verygoodAuCustomer/)
})
test('guest, expired/blocked identity, ordinary member and spoofed admin ID cannot read users',async()=>{
  for(const [options,status] of [
    [{headers:{}},401],[{headers:{'x-appwrite-user-id':'admin-1','x-appwrite-user-jwt':'expired'}},401],
    [{identity:{$id:'admin-1',status:false}},401],
    [{headers:{'x-appwrite-user-id':'customer-1','x-appwrite-user-jwt':'valid'},identity:{$id:'customer-1',status:true}},403],
    [{identity:{$id:'customer-1',status:true}},401],
  ]){const r=await call(options);assert.equal(r.status,status);assert.equal(r.calls.length,0);assert.equal(r.headers['Cache-Control'],'no-store')}
})
test('missing or inconsistent admin configuration fails closed without granting new administrators',async()=>{
  for(const settings of [{},{REVIEW_ADMIN_USER_IDS:'admin-1',APPWRITE_ADMIN_USER_IDS:'customer-1'}]){
    const r=await call({settings});assert.equal(r.status,503);assert.equal(r.calls.length,0)
  }
})
test('a narrower DB admin allowlist works with existing additional review administrators',async()=>{
  const settings={REVIEW_ADMIN_USER_IDS:'admin-1,review-only',APPWRITE_ADMIN_USER_IDS:'admin-1'}
  const r=await call({settings,rows:[user('admin-1'),user('review-only'),user()]})
  assert.equal(r.status,200)
  assert.equal(r.body.result.total,3)
  assert.equal(r.body.result.members[0].role,'admin')
  assert.equal(r.body.result.members[1].role,'customer')
})
test('review-only administrators cannot read members when absent from the DB admin allowlist',async()=>{
  const r=await call({
    settings:{REVIEW_ADMIN_USER_IDS:'admin-1,review-only',APPWRITE_ADMIN_USER_IDS:'admin-1'},
    headers:{'x-appwrite-user-id':'review-only','x-appwrite-user-jwt':'valid'},
    identity:{$id:'review-only',status:true},
  })
  assert.equal(r.status,403)
  assert.equal(r.calls.length,0)
})
test('server bounds queries and rejects arbitrary identities, scopes, fields and cursors',async()=>{
  for(const data of [{userId:'admin-1'},{limit:1000},{cursor:'../all'},{search:'a'.repeat(101)},{search:'bad\nquery'},{projectId:'other'}]){
    const r=await call({data});assert.equal(r.status,400);assert.equal(r.calls.length,0)
  }
  const invalid=await call({extra:{customerUserId:'admin-1'}});assert.equal(invalid.status,400)
  const r=await call({data:{search:' example.test ',cursor:'previous'}});assert.equal(r.status,200)
  assert.equal(r.calls[0].search,'example.test');assert.equal(r.calls[0].total,true)
  const queries=r.calls[0].queries.map(JSON.parse)
  assert.ok(queries.some(q=>q.method==='limit'&&q.values[0]===26))
  assert.ok(queries.some(q=>q.method==='cursorAfter'&&q.values[0]==='previous'))
})
test('bounded pagination, account fallbacks, blocked status and preference isolation',async()=>{
  const rows=Array.from({length:26},(_,i)=>user(`member-${i}`));rows[0]={...rows[0],status:false,prefs:{verygoodAuCustomer:{version:99,name:'DO NOT TRUST',phone:'not-phone'}}}
  const r=await call({rows});assert.equal(r.status,200);assert.equal(r.body.result.members.length,25);assert.equal(r.body.result.nextCursor,'member-24')
  assert.equal(r.body.result.members[0].name,'Google name');assert.equal(r.body.result.members[0].contactEmail,rows[0].email);assert.equal(r.body.result.members[0].phone,'');assert.equal(r.body.result.members[0].status,'blocked')
})
test('missing users.read scope and upstream failures return sanitized unavailable responses',async()=>{
  const r=await call({fail:true});assert.equal(r.status,503);assert.equal(r.body.code,'ADMIN_MEMBERS_UNAVAILABLE')
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_/)
})
