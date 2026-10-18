// Local contract verification only. No credentials, network, provisioning or activation.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createCake} from '../appwrite-functions/reservation-api/src/main.js'
import {buildCakeReservation,canonicalCakeRequestPayload,hashReviewCouponCode} from '../appwrite-functions/reservation-api/src/business.js'
import {digestCakeRequestPayload} from '../appwrite-functions/reservation-api/src/coupon-digest.js'
import {AppwriteException} from './reservation-sdk.mjs'
const read=name=>readFileSync(new URL('../docs/'+name,import.meta.url))
const manifest=JSON.parse(read('customer-account-b7-execution-manifest-v2.json'))
const previous=read('customer-account-b7-execution-manifest.json')
const now=new Date('2026-10-18T00:00:00Z'),secret=Buffer.alloc(32,7)
const runtimeConfig={cakeDatabaseId:'ca_test_cake_au',cakeReservationsId:'reservations',reviewCouponsId:'review_coupons',manualCouponsId:'manual_coupons',reviewCouponHmacSecret:secret}
const options={now,runtimeConfig,renewalPolicy:{enabled:true,preordersEnabled:false}}
const codes={manual:'JENNIETEST7',review:'FOXKIWI7Q2MK'} // Synthetic local-only codes, never used remotely.
function request(f,i){
 const c=manifest.contactFixtures[f.actor==='guest'?'G':f.actor]
 return {contractVersion:f.contractVersion,requestId:f.requestId||`b710000${i+1}-0000-4000-8000-000000000001`,customerName:c.name,customerPhone:c.phone,customerEmail:c.email,
 pickupDate:f.pickupDate,pickupTime:f.pickupTime,privacyConsent:true,requestNote:'',website:'',promoCode:codes[f.couponFixture]||'',
 orderLines:[{lineId:'b7-line',offerId:f.productId,quantity:f.quantity,...(f.productId==='pave-cake'?{size:'6in',chocolateType:'dark'}:{})}]}
}
function database(couponKind){
 const rows=new Map(),stats={creates:0,claims:0,commits:0}
 let coupon=couponKind?{$id:`local-${couponKind}`,codeHash:hashReviewCouponCode(codes[couponKind],secret),codeLast4:codes[couponKind].slice(-4),scope:'cake',rewardPercent:couponKind==='manual'?5:10,status:'active',expiresAt:'2026-11-17T00:00:00Z'}:null
 let pending=null
 const collection=couponKind==='manual'?'manual_coupons':'review_coupons'
 const check=a=>{assert.equal(a.databaseId,'ca_test_cake_au');assert.ok(['reservations',collection].includes(a.collectionId))}
 return {rows,stats,get coupon(){return coupon},
 async getDocument(a){check(a);const row=a.collectionId==='reservations'?rows.get(a.documentId):coupon;if(!row)throw new AppwriteException('absent synthetic row',404);return structuredClone(row)},
 async listDocuments(a){check(a);if(a.collectionId==='reservations')return {documents:[]};return {documents:coupon?[structuredClone(coupon)]:[]}},
 async createTransaction(){assert.equal(pending,null);pending={rows:new Map(rows),coupon:structuredClone(coupon)};return {$id:'tx'}},
 async createDocument(a){check(a);stats.creates++;const dest=a.transactionId?pending.rows:rows;assert.equal(dest.has(a.documentId),false);const row={$id:a.documentId,...a.data};dest.set(a.documentId,row);return structuredClone(row)},
 async updateDocument(a){check(a);assert.equal(a.collectionId,collection);assert.equal(a.transactionId,'tx');assert.equal(a.documentId,coupon.$id);stats.claims++;pending.coupon={...pending.coupon,...a.data};return structuredClone(pending.coupon)},
 async updateTransaction(a){assert.equal(a.transactionId,'tx');if(a.commit){stats.commits++;rows.clear();for(const [k,v] of pending.rows)rows.set(k,v);coupon=pending.coupon}pending=null;return {$id:'tx'}}}
}

test('v2 preserves prior approval and limits while selecting six Renewal v2 requests',()=>{
 assert.equal(createHash('sha256').update(previous).digest('hex'),'f71da5a2f768e9789086548d9af5c12c06b25e2f4480d5762daf1c781af27a43')
 assert.equal(manifest.executionApproved,false)
 const old=JSON.parse(previous)
 for(const key of ['target','actors','window','requiredBeforeOpen','proposedTemporaryState','proposedWrites','couponFixtures','fixedBusinessPolicies','stopConditions','restoreState','newGuardVariableNames','allowedBusinessActions','limitsAreNotProviderHardCaps','contactFixtures','releaseBlocker'])assert.deepEqual(manifest[key],old[key],key)
 assert.equal(manifest.orders.length,6)
 for(const [i,f] of manifest.orders.entries()){
  assert.equal(f.format,'renewal');assert.equal(f.contractVersion,'au-renewal.2026-10.v2')
  for(const key of ['actor','expectedOwnerUid','productId','quantity','pickupDate','pickupTime','couponFixture','requestId','requestIdSource'])assert.deepEqual(f[key],old.orders[i][key],key)
 }
})
const totals=[7500,1200,7125,1080,7500,1200]
for(const [i,f] of manifest.orders.entries())test(`v2 fixture ${i+1} ${f.actor}: create, snapshot owner and exact retry`,async()=>{
 const db=database(f.couponFixture),input=request(f,i),opts={...options,verifiedCustomerUserId:f.expectedOwnerUid||undefined}
 const result=await createCake(db,input,opts)
 assert.equal(result.contractVersion,'au-renewal.2026-10.v2');assert.equal(result.totalPriceCents,totals[i])
 assert.equal(db.rows.get(input.requestId).customerUserId,f.expectedOwnerUid||undefined)
 assert.deepEqual(await createCake(db,input,opts),result)
 assert.equal(db.rows.size,1);assert.equal(db.stats.creates,1);assert.equal(db.stats.claims,f.couponFixture?1:0)
 if(f.couponFixture){assert.equal(db.coupon.status,'redeemed');assert.equal(db.coupon.redeemedReservationId,input.requestId);assert.equal(db.stats.commits,1)}
 if(!f.expectedOwnerUid){await createCake(db,input,{...options,verifiedCustomerUserId:manifest.actors.G.uid});assert.equal(db.rows.get(input.requestId).customerUserId,undefined)}
 else await assert.rejects(createCake(db,input,{...options,verifiedCustomerUserId:f.actor==='G'?manifest.actors.H.uid:manifest.actors.G.uid}),e=>e.code==='REQUEST_ID_CONFLICT'&&e.status===409)
 await assert.rejects(createCake(db,{...input,requestNote:'changed'},opts),e=>e.code==='REQUEST_ID_CONFLICT'&&e.status===409)
})
for(const kind of ['manual','review'])for(const productId of ['pave-cake','pave-chocolate-100g'])test(`cake scope ${kind} coupon accepts ordinary ${productId}, consumes once`,async()=>{
 const f={...manifest.orders[2],productId,couponFixture:kind},input=request(f,2),db=database(kind)
 const r=await createCake(db,input,options)
 const expected=productId==='pave-cake'?(kind==='manual'?7125:6750):(kind==='manual'?1140:1080)
 assert.equal(r.totalPriceCents,expected)
 assert.equal(r.discountBasisCents,productId==='pave-cake'?7500:1200)
 await createCake(db,input,options)
 assert.equal(db.stats.claims,1);assert.equal(db.stats.commits,1)
 await assert.rejects(createCake(db,{...input,requestId:'b7999999-0000-4000-8000-000000000099'},options),e=>e.code==='PROMO_CODE_INVALID')
 assert.equal(db.rows.size,1);assert.equal(db.stats.claims,1)
})
const legacy={requestId:'b7888888-0000-4000-8000-000000000088',customerName:'B7 TEST ONLY G',customerPhone:'0400000001',customerEmail:'b7-g@example.invalid',productId:'pave-cake',cakeSize:'6in',chocolateType:'dark',quantity:1,pickupDate:'2026-10-23',pickupTime:'10:00',privacyConsent:true,promoCode:'',requestNote:''}
test('legacy new order stays 409 before any write with Renewal fixed ON',async()=>{
 const db=database();await assert.rejects(createCake(db,legacy,options),e=>e.code==='RENEWAL_CONTRACT_REQUIRED'&&e.status===409)
 assert.equal(db.rows.size,0);assert.deepEqual(db.stats,{creates:0,claims:0,commits:0})
})
test('historical legacy fingerprint replay succeeds unchanged with Renewal fixed ON; never links guest',async()=>{
 const db=database(),row={$id:legacy.requestId,...buildCakeReservation(legacy,{now,reservationNumber:'VG-C-AU-LOCAL-LEGACY'}),requestFingerprint:digestCakeRequestPayload(canonicalCakeRequestPayload(legacy),secret)}
 db.rows.set(row.$id,structuredClone(row))
 const r=await createCake(db,legacy,{...options,verifiedCustomerUserId:manifest.actors.G.uid})
 assert.equal(r.reservationNumber,row.reservationNumber);assert.equal(r.totalPriceCents,row.totalPriceCents)
 assert.deepEqual(db.rows.get(row.$id),row);assert.deepEqual(db.stats,{creates:0,claims:0,commits:0})
 await assert.rejects(createCake(db,{...legacy,requestNote:'different'},options),e=>e.code==='REQUEST_ID_CONFLICT'&&e.status===409)
})
