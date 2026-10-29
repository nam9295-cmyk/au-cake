import test from 'node:test';
import assert from 'node:assert/strict';
import {priceRenewalOrder,renewalLineSummary} from '../appwrite-functions/reservation-api/src/au-renewal.js';
import {RENEWAL_CARDS} from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js';
import {buildRenewalOrderData} from '../appwrite-functions/reservation-api/src/au-renewal-storage.js';
import {parseStoredOrderLines} from '../appwrite-functions/reservation-api/src/stored-order-reader.js';
const line=(n,count=0)=>({lineId:'lemon',offerId:`fresh-lemon-cupcakes-${n}`,quantity:1,chocolateIcingCount:count});
test('September 28 packs and per-piece chocolate surcharge are server calculated',()=>{
 for(const [n,price] of [[6,3600],[8,4500],[12,6500],[16,8500]]) for(const count of [0,1,n/2,n]){
  const q=priceRenewalOrder([{...line(n,count),quantity:2}]);
  assert.equal(q.totalPriceCents,2*(price+count*50));assert.equal(q.lines[0].physicalQuantity,n*2);
 }
});
test('invalid finish counts and price injection fail closed',()=>{
 for(const count of [-1,7,0.5,'2',null]) assert.throws(()=>priceRenewalOrder([line(6,count)]));
 assert.throws(()=>priceRenewalOrder([{...line(6),unitPriceCents:1}]));
 assert.throws(()=>priceRenewalOrder([{lineId:'x',offerId:'pave-cake',size:'6in',quantity:1,chocolateIcingCount:1}]));
});
test('lemon replaces cookie discovery; Renewal snapshot preserves mixed finishing',()=>{
 assert.equal(RENEWAL_CARDS.celebrate[0].id,'lemon');assert.ok(!RENEWAL_CARDS.cakes.some(c=>c.id==='cookies'));
 const doc=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Local Test',customerPhone:'0412345678',customerEmail:'local@example.com',pickupDate:'2026-10-30',pickupTime:'12:00',privacyConsent:true,requestId:'local-lemon',website:'',orderLines:[line(6,3)]},{now:new Date('2026-10-28T00:00:00Z'),reservationNumber:'LOCAL',renewalPolicy:{preordersEnabled:true}});
 const stored=parseStoredOrderLines(doc);assert.equal(stored.totalPriceCents,3750);assert.equal(stored.lines[0].productId,'fresh-lemon-cupcakes-6');
});

test('packaging threshold, coupon math, and email display retain selected lemon finishing',()=>{
 const q=priceRenewalOrder([{...line(6,3),individualPackaging:true}]);assert.equal(q.totalPriceCents,4050);
 assert.match(renewalLineSummary(q.lines[0]),/Lemon icing 3 \/ Dark chocolate 3 per box/);
 const bulk=priceRenewalOrder([{...line(12),quantity:2,individualPackaging:true}]);assert.equal(bulk.individualPackagingFeeCents,0);
 assert.equal(priceRenewalOrder([line(6,3)],{reviewCoupon:{rewardPercent:10}}).totalPriceCents,3375);
});
test('real create path stores lemon finish and enforces request idempotency locally',async()=>{
 const {createCake}=await import('../appwrite-functions/reservation-api/src/main.js');
 const {AppwriteException}=await import('./reservation-sdk.mjs');
 const input={contractVersion:'au-renewal.2026-10.v2',customerName:'Local Test',customerPhone:'0412345678',customerEmail:'local@example.com',pickupDate:'2026-10-30',pickupTime:'12:00',privacyConsent:true,requestId:'11111111-1111-4111-8111-111111111111',website:'',orderLines:[line(6,3)]};
 let saved,writes=0;
 const db={getDocument:async()=>{if(saved)return saved;throw new AppwriteException('missing',404)},listDocuments:async()=>({documents:[]}),createDocument:async({data,documentId})=>{writes++;return saved={...data,$id:documentId}}};
 const options={now:new Date('2026-10-28T00:00:00Z'),runtimeConfig:{cakeDatabaseId:'local-test',cakeReservationsId:'local-test',reviewCouponHmacSecret:Buffer.alloc(32,1).toString('base64url')},renewalPolicy:{enabled:true,preordersEnabled:true}};
 const first=await createCake(db,input,options);assert.equal(writes,1);assert.equal(parseStoredOrderLines(saved).totalPriceCents,3750);
 assert.deepEqual(await createCake(db,input,options),first);assert.equal(writes,1);
 await assert.rejects(createCake(db,{...input,orderLines:[line(6,4)]},options));assert.equal(writes,1);
});
test('notification and reminder render mixed lemon finishing from the same stored snapshot',async()=>{
 const {buildBookingConfirmationPayload}=await import('../appwrite-functions/reservation-notification/src/main.js');
 const {buildCakeReminderPayload}=await import('../appwrite-functions/booking-reminder/src/reminder-business.js');
 const row=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Local Test',customerPhone:'0412345678',customerEmail:'local@example.com',pickupDate:'2026-10-30',pickupTime:'12:00',privacyConsent:true,requestId:'local-lemon',website:'',orderLines:[line(6,3)]},{now:new Date('2026-10-28T00:00:00Z'),reservationNumber:'LOCAL',renewalPolicy:{preordersEnabled:true}});
 row.$id="local-lemon";
 for(const payload of [buildBookingConfirmationPayload({reservation:row,sourceType:'cake',from:'local@example.com'}),buildCakeReminderPayload({reservation:row,from:'local@example.com'})]){
  assert.match(payload.text,/Lemon icing 3 \/ Dark chocolate 3 per box/);assert.match(payload.text,/37.50/);
 }
});
