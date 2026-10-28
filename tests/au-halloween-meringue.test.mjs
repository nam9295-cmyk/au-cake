import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js';
import { priceRenewalOrder } from '../appwrite-functions/reservation-api/src/au-renewal.js';
import { validateRenewalPickup, renewalPickupSlots } from '../appwrite-functions/reservation-api/src/au-renewal-pickup.js';
import { buildRenewalOrderData } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js';
import { parseStoredOrderLines } from '../appwrite-functions/reservation-api/src/stored-order-reader.js';
const lines = [{lineId:'meringue',offerId:'halloween-meringue-3',quantity:1}];
const now = new Date('2026-10-26T00:00:00Z');
const policy = {preordersEnabled:true};
test('four seasonal pack prices and physical quantities; cookie coupon policy preserved',()=>{
 for(const [pieces,price] of [[3,1200],[6,2300],[12,4500],[24,8500]]) {
  const quote=priceRenewalOrder([{...lines[0],offerId:`halloween-meringue-${pieces}`,quantity:2}]);
  assert.equal(quote.totalPriceCents,price*2);assert.equal(quote.lines[0].physicalQuantity,pieces*2);
 }
});
test('seasonal card discoverable and visibility closes at Sydney final pickup minus 24 hours',()=>{
 assert.equal(catalog.renewalCardForPath('/cakes/halloween-meringue')?.id,'halloween-meringue');
 assert.equal(catalog.halloweenMeringueAvailable(new Date('2026-10-31T02:00:00Z')),true);
 assert.equal(catalog.halloweenMeringueAvailable(new Date('2026-10-31T02:00:00.001Z')),false);
});
test('Wed Fri Sat Sun only, final Sunday inclusive and later dates rejected',()=>{
 for(const date of ['2026-10-28','2026-10-30','2026-10-31','2026-11-01']) assert.ok(renewalPickupSlots(lines,date,now,policy).length);
 for(const date of ['2026-10-29','2026-11-02','2026-11-04']) assert.deepEqual(renewalPickupSlots(lines,date,now,policy),[]);
 assert.throws(()=>validateRenewalPickup(lines,'2026-11-04','10:00',now,policy),/SEASONAL_PRODUCT_ENDED/);
});
test('24 hours exact, expired and mixed carts; closures preserved',()=>{
 assert.doesNotThrow(()=>validateRenewalPickup(lines,'2026-11-01','13:00',new Date('2026-10-31T02:00:00Z'),policy));
 assert.throws(()=>validateRenewalPickup(lines,'2026-11-01','13:00',new Date('2026-10-31T02:00:00.001Z'),policy));
 const mixed=[...lines,{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1}];
 assert.deepEqual(renewalPickupSlots(mixed,'2026-11-04',now,policy),[]);
 assert.deepEqual(renewalPickupSlots(lines,'2026-10-30',now,{...policy,closedDates:['2026-10-30']}),[]);
 assert.throws(()=>validateRenewalPickup(lines,'2026-10-30','10:00',new Date('2026-10-29T23:00:01Z'),policy),/PICKUP_TIME_TOO_SOON/);
});
test('real writer rejects after season; snapshot reader stays valid independently of clock',()=>{
 const request={contractVersion:'au-renewal.2026-10.v2',customerName:'Test Meringue',customerPhone:'0412345678',customerEmail:'synthetic@example.com',pickupDate:'2026-11-01',pickupTime:'13:00',privacyConsent:true,requestId:'seasonal-test',website:'',orderLines:lines};
 const doc=buildRenewalOrderData(request,{now,reservationNumber:'LOCAL',renewalPolicy:policy});
 assert.equal(parseStoredOrderLines(doc).totalPriceCents,1200);
 assert.throws(()=>buildRenewalOrderData(request,{now:new Date('2026-11-02T00:00:00Z'),reservationNumber:'LOCAL',renewalPolicy:policy}),/SEASONAL_PRODUCT_ENDED/);
 assert.equal(parseStoredOrderLines(doc).lines[0].productId,'halloween-meringue-3');
});

test('static seasonal detail has dated price offers and an explicit final pickup, without permanent home promotion',async()=>{
 const {renewalSeoPages}=await import('../appwrite-functions/reservation-api/src/au-renewal-seo.js');
 const pages=renewalSeoPages('https://example.test');
 const page=pages['/cakes/halloween-meringue'];
 assert.ok(page,'direct product URL must exist in compiled Pages output');
 assert.match(page.fallbackHtml,/1 November 2026/);
 const product=page.structuredData.find(s=>s['@type']==='Product');
 assert.deepEqual(product.offers.map(o=>o.price),['12.00','23.00','45.00','85.00']);
 assert.ok(product.offers.every(o=>o.validThrough==='2026-10-31T13:00:00+11:00'));
 assert.doesNotMatch(pages['/'].fallbackHtml,/halloween-meringue/);
});

test('create API enforces seasonal expiry with zero writes and preserves an existing request retry after expiry',async()=>{
 const {createCake}=await import('../appwrite-functions/reservation-api/src/main.js');
 const {AppwriteException}=await import('./reservation-sdk.mjs');
 const input={contractVersion:'au-renewal.2026-10.v2',customerName:'Test Meringue',customerPhone:'0412345678',customerEmail:'synthetic@example.com',pickupDate:'2026-11-01',pickupTime:'13:00',privacyConsent:true,requestId:'11111111-1111-4111-8111-111111111111',website:'',orderLines:lines};
 let saved, writes=0;
 const db={getDocument:async()=>{if(saved)return saved;throw new AppwriteException('missing',404)},listDocuments:async()=>({documents:[]}),createDocument:async({data,documentId})=>{writes++;return saved={...data,$id:documentId}}};
 const options={now,runtimeConfig:{cakeDatabaseId:'local-test',cakeReservationsId:'local-test',reviewCouponHmacSecret:Buffer.alloc(32,1).toString('base64url')},renewalPolicy:{enabled:true,...policy}};
 const late={...options,now:new Date('2026-11-02T00:00:00Z')};
 await assert.rejects(createCake(db,input,late),/SEASONAL_PRODUCT_ENDED/);assert.equal(writes,0);
 const first=await createCake(db,input,options);assert.equal(writes,1);
 assert.deepEqual(await createCake(db,input,late),first);assert.equal(writes,1);
 await assert.rejects(createCake(db,{...input,orderLines:[{...lines[0],quantity:2}]},late));assert.equal(writes,1);
});
test('seasonal cookie packs do not change eligible cake coupon amounts',()=>{
 for(const rewardPercent of [5,10]) {
  assert.throws(()=>priceRenewalOrder(lines,{reviewCoupon:{rewardPercent}}),/PROMO_CODE_INVALID/);
  const quote=priceRenewalOrder([...lines,{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1}],{reviewCoupon:{rewardPercent}});
  assert.equal(quote.discountBasisCents,7500);
  assert.equal(quote.lines.find(l=>l.productId==='halloween-meringue-3').discountCents,0);
  assert.equal(quote.totalPriceCents,8700-7500*rewardPercent/100);
 }
});
