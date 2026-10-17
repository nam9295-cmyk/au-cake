import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import * as api from '../appwrite-functions/reservation-api/src/customer-orders.js'
import {createReservationHandler} from '../appwrite-functions/reservation-api/src/main.js'
import {AppwriteException} from './reservation-sdk.mjs'
import {accountEnv,metadataDb} from './fixtures/customer-account/metadata.mjs'
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/customer-account/orders.json',import.meta.url),'utf8'))
function dbFor(rows=fixtures) {
  const calls=[]
  return {...metadataDb(),calls,
    getDocument:async({documentId})=>{const row=rows.find(d=>d.$id===documentId);if(!row)throw new AppwriteException('missing',404);return row},
    listDocuments:async args=>{
      calls.push(args);const qs=args.queries.map(JSON.parse),eq=qs.find(q=>q.method==='equal'),after=qs.find(q=>q.method==='cursorAfter'),limit=qs.find(q=>q.method==='limit')?.values[0]||25
      assert.equal(eq.attribute,'customerUserId');assert.deepEqual(eq.values,['customer-a'])
      assert.ok(qs.some(q=>q.method==='orderDesc'&&q.attribute==='$createdAt'))
      let list=rows.filter(r=>r.customerUserId===eq.values[0]).sort((a,b)=>b.$createdAt.localeCompare(a.$createdAt)||a.$id.localeCompare(b.$id))
      if(after)list=list.slice(list.findIndex(d=>d.$id===after.values[0])+1)
      return {documents:list.slice(0,limit)}
    },
  }
}
async function call({action='customer-orders',data={},db=dbFor(),user='customer-a',jwt='valid',env=accountEnv}={}) {
  const handler=createReservationHandler({env,servicesForRequest:()=>({databases:db,accountForJwt:async token=>({get:async()=>{if(token!=='valid')throw Error('expired');return {$id:user,status:true}}})})})
  return handler({req:{headers:{'x-appwrite-user-id':user,'x-appwrite-user-jwt':jwt},bodyJson:{action,data}},res:{json:(body,status,headers)=>({body,status,headers})},log(){},error(){}})
}
test('own list filters server-side, reads only reservations and returns stored prices with no-store',async()=>{
  const db=dbFor(),result=await call({db})
  assert.equal(result.status,200,JSON.stringify(result))
  assert.deepEqual(result.body.result.orders.map(o=>o.id),['a-renewal','a-legacy'])
  assert.deepEqual(result.body.result.orders.map(o=>o.totalPriceCents),[8200,6500])
  assert.equal(result.headers['Cache-Control'],'no-store')
  assert.ok(db.calls.every(c=>c.databaseId==='cake-db'&&c.collectionId==='reservations'))
  assert.equal(JSON.stringify(result).includes('customerUserId'),false)
})
test('foreign, missing, guest details and foreign cursor have identical not-found envelopes',async()=>{
  const responses=[]
  for(const id of ['b-legacy','missing','guest']) responses.push(await call({action:'customer-order',data:{id}}))
  responses.push(await call({data:{cursor:'b-legacy'}}))
  for(const response of responses) {
    assert.equal(response.status,404);assert.equal(response.body.code,'CUSTOMER_ORDER_NOT_FOUND');assert.equal(response.headers['Cache-Control'],'no-store')
    assert.deepEqual(response.body,responses[0].body)
  }
})
test('read boundaries reject caller user/query/source, bad limits and lost authentication',async()=>{
  for(const data of [{userId:'customer-b'},{query:'any'},{source:'class'},{collectionId:'reservations'},{limit:26},{limit:0},{cursor:'../secret'}]) assert.equal((await call({data})).status,400,JSON.stringify(data))
  assert.equal((await call({jwt:'expired'})).status,401)
  assert.equal((await call({user:''})).status,401)
  assert.equal((await call({env:{...accountEnv,CUSTOMER_ACCOUNT_ENABLED:'false'}})).status,503)
})
test('26 same-timestamp orders paginate once each with a bounded SDK document cursor',async()=>{
  assert.equal(typeof api.listCustomerOrders,'function')
  const rows=Array.from({length:26},(_,i)=>({...fixtures[1],$id:`order-${String(i).padStart(2,'0')}`})),db=dbFor(rows)
  const first=await call({db});assert.equal(first.body.result.orders.length,25);assert.equal(first.body.result.nextCursor,'order-24')
  const second=await call({db,data:{cursor:first.body.result.nextCursor}})
  assert.deepEqual(second.body.result.orders.map(o=>o.id),['order-25']);assert.equal(second.body.result.nextCursor,null)
})
test('detail validates stored readers and explicitly excludes nested coupon/admin/owner/fingerprint fields',async()=>{
  for(const id of ['a-renewal','a-legacy']) {
    const result=await call({action:'customer-order',data:{id}})
    assert.equal(result.status,200,JSON.stringify(result));const json=JSON.stringify(result.body.result)
    for(const key of ['customerUserId','reviewCouponId','adminMemo','requestFingerprint','codeCiphertext','appliedPromoCodeLast4'])assert.equal(json.includes(key),false,key)
  }
  const corrupt={...fixtures[0],orderLinesJson:'{"version":2,"lines":[]}'}
  const response=await call({db:dbFor([corrupt]),action:'customer-order',data:{id:'a-renewal'}})
  assert.equal(response.status,503);assert.equal(response.body.code,'CUSTOMER_ORDERS_UNAVAILABLE')
})
test('guest/same-email and approved-unlinked records stay absent for a reused account ID',async()=>{
  const retained=fixtures.map(row=>({...row,customerEmail:'same-email@example.test',customerUserId:null}))
  const result=await call({db:dbFor(retained)})
  assert.equal(result.status,200);assert.deepEqual(result.body.result,{orders:[],nextCursor:null})
  assert.equal((await call({db:dbFor(retained),action:'customer-order',data:{id:'a-legacy'}})).status,404)
})
