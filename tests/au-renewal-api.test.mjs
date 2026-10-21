import test from 'node:test'
import assert from 'node:assert/strict'
import {createCake} from '../appwrite-functions/reservation-api/src/main.js'
import {AppwriteException} from './reservation-sdk.mjs'
import {readFileSync} from 'node:fs'
const request={contractVersion:'au-renewal.2026-10.v2',customerName:'Test Customer',customerPhone:'0412345678',customerEmail:'test@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',requestNote:'',promoCode:'',privacyConsent:true,requestId:'11111111-1111-4111-8111-111111111111',website:'',orderLines:[{lineId:'a',offerId:'pave-cake',size:'8in',quantity:1}]}
const options={now:new Date('2026-10-20T00:00:00Z'),runtimeConfig:{cakeDatabaseId:'test',cakeReservationsId:'test',reviewCouponHmacSecret:Buffer.alloc(32,1).toString('base64url')}}
function database(){let saved;return {getDocument:async()=>{if(saved)return saved;throw new AppwriteException('missing',404)},listDocuments:async()=>({documents:[]}),createDocument:async({data,documentId})=>(saved={...data,$id:documentId})}}
test('renewal writes default closed and explicitly enabled requests retain idempotence',async()=>{
 await assert.rejects(createCake(database(),request,options),/RENEWAL_WRITES_DISABLED/)
 const db=database(),enabled={...options,renewalPolicy:{enabled:true}}
 const first=await createCake(db,request,enabled)
 assert.equal(first.totalPriceCents,10700)
 const replay=await createCake(db,request,options)
 assert.equal(replay.reservationNumber,first.reservationNumber)
 await assert.rejects(createCake(db,{...request,orderLines:[{...request.orderLines[0],size:'6in'}]},enabled))
})

test('cutover closes obsolete legacy new writes while keeping replay path first',async()=>{
 const legacy={...request};delete legacy.contractVersion;legacy.orderLines=[{productId:'pave-cake',cakeSize:'6in',quantity:1}]
 await assert.rejects(createCake(database(),legacy,{...options,renewalPolicy:{enabled:true}}),/RENEWAL_CONTRACT_REQUIRED/)
})

test('price contract cutover preserves old request fingerprints and only writes confirmed v2 prices',async()=>{
 const history=JSON.parse(readFileSync(new URL('./fixtures/au-renewal-v1-brownie-orders.json',import.meta.url),'utf8'))
 const existing=history.orders[0],original=JSON.stringify(existing)
 const replay=await createCake({getDocument:async()=>existing},history.legacyRequest,options)
 assert.equal(replay.totalPriceCents,8200)
 assert.equal(replay.contractVersion,'au-renewal.2026-10.v1')
 assert.equal(JSON.stringify(existing),original)
 await assert.rejects(createCake(database(),history.legacyRequest,{...options,renewalPolicy:{enabled:true}}),/UNSUPPORTED_CONTRACT/)
 const fresh=await createCake(database(),{...request,orderLines:[{lineId:'a',offerId:'brownie-whole',size:'8in',quantity:1}]},{...options,renewalPolicy:{enabled:true}})
 assert.equal(fresh.totalPriceCents,11700)
 assert.equal(fresh.contractVersion,'au-renewal.2026-10.v2')
})

test('server accepts approved weekend close, rejects after-hours and replays prior appointment unchanged',async()=>{
 const db=database(),input={...request,pickupDate:'2026-10-24',pickupTime:'12:00'}
 const first=await createCake(db,input,{...options,renewalPolicy:{enabled:true}})
 const original=JSON.stringify(first)
 assert.equal(first.pickupDate,'2026-10-24');assert.equal(first.pickupTime,'12:00')
 const replay=await createCake(db,input,{...options,now:new Date('2027-01-01T00:00:00Z')})
 assert.equal(JSON.stringify(replay),original)
 const extended=await createCake(database(),{...input,pickupTime:'13:00'},{...options,renewalPolicy:{enabled:true}})
 assert.equal(extended.pickupTime,'13:00')
 await assert.rejects(createCake(database(),{...input,pickupTime:'12:40'},{...options,renewalPolicy:{enabled:true}}),/PICKUP_TIME_UNAVAILABLE/)
 await assert.rejects(createCake(database(),{...input,pickupTime:'13:15'},{...options,renewalPolicy:{enabled:true}}),/PICKUP_TIME_UNAVAILABLE/)
 await assert.rejects(createCake(database(),{...input,pickupDate:'2026-10-26'},{...options,renewalPolicy:{enabled:true}}),/PICKUP_TIME_UNAVAILABLE/)
})


test('server accepts Wednesday and Friday pickup through 20:00 without changing price or replay', async () => {
 for (const pickupDate of ['2026-10-21', '2026-10-23']) {
  const db=database(),input={...request,pickupDate,pickupTime:'20:00'}
  const first=await createCake(db,input,{...options,renewalPolicy:{enabled:true}})
  assert.equal(first.pickupTime,'20:00')
  assert.equal(first.totalPriceCents,10700)
  const replay=await createCake(db,input,options)
  assert.deepEqual(replay,first)
  await assert.rejects(createCake(database(),{...input,pickupTime:'20:15'},{...options,renewalPolicy:{enabled:true}}),/PICKUP_TIME_UNAVAILABLE/)
 }
})
