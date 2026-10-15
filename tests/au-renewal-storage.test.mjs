import test from 'node:test'
import assert from 'node:assert/strict'
import {parseStoredOrderLines} from '../appwrite-functions/reservation-api/src/stored-order-reader.js'
import {readFileSync} from 'node:fs'
import {parseRenewalProjection,renewalReservationProjection} from '../appwrite-functions/reservation-api/src/au-renewal-reader.js'
const storage=await import('../appwrite-functions/reservation-api/src/au-renewal-storage.js').catch(()=>({}))
export const request={contractVersion:'au-renewal.2026-10.v2',customerName:'Test Customer',customerPhone:'0412345678',customerEmail:'test@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',requestNote:'',promoCode:'',privacyConsent:true,requestId:'renewal-test',website:'',orderLines:[{lineId:'a',offerId:'pave-cake',size:'8in',quantity:1}]}
test('new snapshot round-trips through the existing server reader without changing legacy version',()=>{
 assert.equal(typeof storage.buildRenewalOrderData,'function')
 const doc=storage.buildRenewalOrderData(request,{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'TEST'})
 const stored=parseStoredOrderLines(doc)
 assert.equal(stored.lines[0].selection.size,'8in')
 assert.equal(stored.lines[0].totalPriceCents,10700)
 assert.equal(stored.lines[0].policyVersion,request.contractVersion)
 assert.equal(JSON.parse(doc.orderLinesJson).version,2)
 const corrupt=JSON.parse(doc.orderLinesJson);corrupt.lines[0].totalPriceCents=1
 assert.throws(()=>parseStoredOrderLines({...doc,orderLinesJson:JSON.stringify(corrupt)}))
})
test('writer rejects client quote fields, unknown versions and provisional orders',()=>{
 const options={now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'TEST'}
 assert.throws(()=>storage.buildRenewalOrderData({...request,totalPriceCents:1},options))
 assert.throws(()=>storage.buildRenewalOrderData({...request,contractVersion:'future'},options))
 assert.throws(()=>storage.buildRenewalOrderData({...request,orderLines:[{lineId:'a',offerId:'brownie-cupcakes-6',quantity:1}]},options),/PROVISIONAL_PRICE/)
})
test('confirmed brownie prices are stored under v2 while frozen v1 orders keep their prices and sizes',()=>{
 const history=JSON.parse(readFileSync(new URL('./fixtures/au-renewal-v1-brownie-orders.json',import.meta.url),'utf8'))
 for(const [index,size] of ['6in','8in','10in'].entries()){
  const document=history.orders[index],original=JSON.stringify(document)
  const old=parseStoredOrderLines(document)
  assert.equal(old.totalPriceCents,[8200,11500,15500][index])
  assert.equal(old.lines[0].selection.size,size)
  assert.equal(old.policyVersion,'au-renewal.2026-10.v1')
  assert.equal(parseRenewalProjection(renewalReservationProjection(document)).totalPriceCents,[8200,11500,15500][index])
  assert.equal(JSON.stringify(document),original)
  const fresh=storage.buildRenewalOrderData({...request,orderLines:[{lineId:'a',offerId:'brownie-whole',size,quantity:1}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'TEST'})
  assert.equal(fresh.totalPriceCents,[8200,11700,16800][index])
  assert.equal(parseStoredOrderLines(fresh).policyVersion,'au-renewal.2026-10.v2')
 }
 const tampered=structuredClone(history.orders[1]),payload=JSON.parse(tampered.orderLinesJson)
 payload.policyVersion='au-renewal.2026-10.v2'
 tampered.orderLinesJson=JSON.stringify(payload)
 assert.throws(()=>parseStoredOrderLines(tampered),/INVALID_STORED_ORDER/)
})
