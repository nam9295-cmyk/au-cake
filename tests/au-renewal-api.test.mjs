import test from 'node:test'
import assert from 'node:assert/strict'
import {createCake} from '../appwrite-functions/reservation-api/src/main.js'
import {priceRenewalOrder} from '../appwrite-functions/reservation-api/src/au-renewal.js'
import {canonicalRenewalRequest} from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
import {digestCakeRequestPayload} from '../appwrite-functions/reservation-api/src/coupon-digest.js'
import {AppwriteException} from './reservation-sdk.mjs'
import {readFileSync} from 'node:fs'
const request={contractVersion:'au-renewal.2026-11.v3',customerName:'Test Customer',customerPhone:'0412345678',customerEmail:'test@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',requestNote:'',promoCode:'',privacyConsent:true,requestId:'11111111-1111-4111-8111-111111111111',website:'',orderLines:[{lineId:'a',offerId:'pave-cake',size:'8in',quantity:1}]}
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

test('cached checkout prompts a refresh only for a new retired 80g triangle selection', async () => {
 const triangle = { lineId: 'a', offerId: 'almond-chocoball-80g', almondPackaging: 'triangle-box', quantity: 1 }
 const input = { ...request, orderLines: [triangle] }
 const enabled = { ...options, renewalPolicy: { enabled: true }, chocolateWritesEnabled: true }
 await assert.rejects(createCake(database(), input, enabled), { code: 'UNSUPPORTED_CONTRACT', status: 409 })
 for (const malformed of [{ ...triangle, almondPackaging: 'box' }, { ...triangle, offerId: 'almond-chocoball-black-tub-2x80g' }]) {
   await assert.rejects(createCake(database(), { ...request, orderLines: [malformed] }, enabled), { code: 'INVALID_PACKAGING' })
 }

 const { lines, version, policyVersion, ...totals } = priceRenewalOrder([triangle], { storedOnly: true })
 const saved = { ...totals, customerPhone: request.customerPhone, reservationNumber: 'prior-almond', productId: triangle.offerId,
   quantity: 1, orderLineCount: 1, orderLinesJson: JSON.stringify({ version, policyVersion, lines, discountPercent: 0 }),
   requestFingerprint: digestCakeRequestPayload(canonicalRenewalRequest(input, { allowHistorical: true }), options.runtimeConfig.reviewCouponHmacSecret) }
 const replay = await createCake({ getDocument: async () => saved }, input, enabled)
 assert.equal(replay.reservationNumber, saved.reservationNumber)
 assert.equal(replay.orderLines[0].selection.almondPackaging, 'triangle-box')
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
 assert.equal(fresh.contractVersion,'au-renewal.2026-11.v3')
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

test('almond gift box checkout acknowledges the server price and replays its original receipt after expiry', async () => {
 const offerId = 'almond-triangle-gift-4x60g'
 const db = database()
 const input = { ...request, pickupDate: '2026-12-11', orderLines: [{ lineId: 'gift', offerId, quantity: 2 }], expectedAlmondGiftBoxPriceCents: 4000 }
 const sale = { ...options, renewalPolicy: { enabled: true }, chocolateWritesEnabled: true, now: new Date('2026-12-06T12:59:59Z') }
 const ended = { ...sale, now: new Date('2026-12-06T13:00:00Z') }
 await assert.rejects(createCake(db, input, { ...sale, chocolateWritesEnabled: false }), /CHOCOLATE_WRITES_DISABLED/)
 const receipt = await createCake(db, input, sale)
 assert.equal(receipt.totalPriceCents, 8000)
 assert.deepEqual(await createCake(db, input, ended), receipt)
 assert.deepEqual(await createCake(db, { ...input, expectedAlmondGiftBoxPriceCents: 5000 }, ended), receipt)
 await assert.rejects(createCake(db, { ...input, orderLines: [{ ...input.orderLines[0], quantity: 1 }] }, ended), /REQUEST_ID_CONFLICT/)
 for (const price of [4000, undefined, 1]) {
   await assert.rejects(createCake(database(), { ...input, expectedAlmondGiftBoxPriceCents: price }, ended), /ALMOND_PRICE_CHANGED/)
 }
 const regular = await createCake(database(), { ...input, expectedAlmondGiftBoxPriceCents: 5000 }, ended)
 assert.equal(regular.totalPriceCents, 10000)
})
