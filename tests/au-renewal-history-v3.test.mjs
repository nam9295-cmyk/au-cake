import test from 'node:test'
import assert from 'node:assert/strict'
import { priceRenewalOrder } from '../appwrite-functions/reservation-api/src/au-renewal.js'
import { readRenewalDocument } from '../appwrite-functions/reservation-api/src/au-renewal-reader.js'
import { canonicalRenewalRequest } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
const v1='au-renewal.2026-10.v1', v2='au-renewal.2026-10.v2'
function document(q) {
 const {lines,version,policyVersion,...totals}=q
 return {...totals,productId:lines[0].productId,quantity:lines[0].quantity,orderLineCount:lines.length,orderLinesJson:JSON.stringify({version,policyVersion,lines,discountPercent:q.discountPercent})}
}
test('historical cream prices and Milk survive exact stored validation and projections', () => {
 for(const [contractVersion,size,total] of [[v2,'8in',12700],[v2,'10in',17800],[v1,'8in',12500]]) {
  const q=priceRenewalOrder([{lineId:'b',offerId:'brownie-whole',quantity:1,size,finish:'vanilla-fresh-cream'}],{contractVersion,localPreview:true,storedOnly:true})
  assert.equal(q.totalPriceCents,total)
  assert.deepEqual(readRenewalDocument(document(q)),q)
 }
 for(const contractVersion of [v1,v2]) {
  const selection={lineId:'p',offerId:'pave-cake',quantity:1,size:'6in',chocolateType:'milk'}
  const q=priceRenewalOrder([selection],{contractVersion,storedOnly:true})
  assert.equal(readRenewalDocument(document(q)).lines[0].selection.chocolateType,'milk')
  const input={contractVersion,customerName:'Test Customer',customerPhone:'0412345678',customerEmail:'test@example.com',pickupDate:'2026-11-20',pickupTime:'09:00',requestNote:'',promoCode:'',privacyConsent:true,orderLines:[selection]}
  assert.equal(canonicalRenewalRequest(input,{allowHistorical:true}).orderLines[0].chocolateType,'milk')
  assert.throws(()=>canonicalRenewalRequest(input))
 }
})
test('historical versions cannot forge mini sizes or new decorations, even in stored-only mode', () => {
 for(const contractVersion of [v1,v2]) for(const [offerId,size,finish] of [['pave-cake','4in','basic'],['pave-cake','6in','fresh-strawberries'],['brownie-whole','4in','basic'],['brownie-whole','8in','vanilla-fresh-cream-strawberries']]) {
  assert.throws(()=>priceRenewalOrder([{lineId:'x',offerId,size,finish,quantity:1}],{contractVersion,storedOnly:true,localPreview:true}))
 }
 const q=priceRenewalOrder([{lineId:'x',offerId:'brownie-whole',size:'8in',finish:'vanilla-fresh-cream-strawberries',quantity:1}])
 const doc=document(q), payload=JSON.parse(doc.orderLinesJson)
 payload.policyVersion=v2;doc.orderLinesJson=JSON.stringify(payload)
 assert.throws(()=>readRenewalDocument(doc),{code:'INVALID_STORED_ORDER'})
})
test('v2 Milk and cream retries return the stored response before the new-contract gate', async () => {
 const { createCake } = await import('../appwrite-functions/reservation-api/src/main.js')
 const { digestCakeRequestPayload } = await import('../appwrite-functions/reservation-api/src/coupon-digest.js')
 const secret=Buffer.alloc(32,1).toString('base64url')
 for(const selection of [{lineId:'p',offerId:'pave-cake',size:'8in',chocolateType:'milk',quantity:1},{lineId:'b',offerId:'brownie-whole',size:'10in',finish:'vanilla-fresh-cream',quantity:1}]) {
  const input={contractVersion:v2,requestId:'11111111-1111-4111-8111-111111111111',customerName:'Test Customer',customerPhone:'0412345678',customerEmail:'test@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',requestNote:'',promoCode:'',privacyConsent:true,orderLines:[selection]}
  const q=priceRenewalOrder([selection],{contractVersion:v2})
  const doc={...document(q),...input,reservationNumber:'OLD-TEST',requestFingerprint:digestCakeRequestPayload(canonicalRenewalRequest(input,{allowHistorical:true}),secret),cakeSize:selection.size,chocolateType:selection.chocolateType||'dark'}
  const db={getDocument:async()=>doc,createDocument:async()=>{throw Error('duplicate write')}}
  const response=await createCake(db,input,{now:new Date('2026-11-07T00:00:00Z'),runtimeConfig:{cakeDatabaseId:'test',cakeReservationsId:'test',reviewCouponHmacSecret:secret}})
  assert.equal(response.totalPriceCents,selection.offerId==='pave-cake'?10700:17800)
  assert.equal(response.contractVersion,v2)
 }
})
