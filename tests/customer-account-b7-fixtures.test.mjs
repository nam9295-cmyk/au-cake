import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=await import('../scripts/customer-account-b7-contract.mjs')
const manifest=JSON.parse(readFileSync(new URL('../docs/customer-account-b7-execution-manifest-v2.json',import.meta.url)))
function inputs(){return manifest.orders.map((o,i)=>{const c=manifest.contactFixtures[o.actor==='guest'?'G':o.actor];return {action:'create-cake',...(o.expectedOwnerUid?{customerAccount:'link'}:{}),data:{contractVersion:'au-renewal.2026-10.v2',requestId:o.requestId||`b700000${i+1}-0000-4000-8000-000000000001`,customerName:c.name,customerPhone:c.phone,customerEmail:c.email,pickupDate:o.pickupDate,pickupTime:o.pickupTime,privacyConsent:true,website:'',requestNote:'',promoCode:o.couponFixture==='manual'?'JENNIETEST7':o.couponFixture==='review'?'FOXKIWI7Q2MK':'',orderLines:[{lineId:`line-${i}`,offerId:o.productId,quantity:1,...o.lineOptions}]}}})}
test('freeze six exact approved bodies, reject arbitrary SKU, owner, contact, IDs or extra rows',()=>{
 assert.equal(typeof api.freezeB7Fixtures,'function')
 const frozen=JSON.parse(api.freezeB7Fixtures(inputs()))
 assert.equal(frozen.requestIds.length,6);assert.ok(frozen.createBodies.includes(JSON.stringify(inputs()[0])))
 for(const mutate of [x=>x.pop(),x=>x.push(x[0]),x=>{x[1].data.requestId=x[0].data.requestId},x=>{x[0].data.customerEmail='external@example.com'},x=>{x[0].data.orderLines[0].offerId='mochi'},x=>{x[0].data.orderLines[0].quantity=2},x=>{x[2].data.requestId='b7000009-0000-4000-8000-000000000009'},x=>{x[0].data.customerUserId='attacker'}]){const bodies=inputs();mutate(bodies);assert.throws(()=>api.freezeB7Fixtures(bodies))}
})
test('native draft projection preserves UUID and exact original wire order; freeze does not rewrite bytes',async()=>{
 const {nativeCheckoutWireBody}=await import('../tools/customer-account-b7/native-checkout.mjs')
 const bodies=inputs(),d=bodies[0].data
 const wire=nativeCheckoutWireBody({version:1,kind:'renewal',requestId:d.requestId,form:{name:d.customerName,phone:d.customerPhone,email:d.customerEmail,date:d.pickupDate,time:d.pickupTime,note:'',promo:'',privacy:true},cartSnapshot:d.orderLines})
 const expected=JSON.stringify({action:'create-cake',data:{contractVersion:d.contractVersion,customerName:d.customerName,customerPhone:d.customerPhone,customerEmail:d.customerEmail,pickupDate:d.pickupDate,pickupTime:d.pickupTime,requestNote:'',promoCode:'',privacyConsent:true,website:'',requestId:d.requestId,orderLines:d.orderLines},customerAccount:'link'})
 assert.equal(wire,expected)
 bodies[0]=JSON.parse(wire);const frozen=JSON.parse(api.freezeB7Fixtures(bodies));assert.equal(frozen.createBodies[0],wire);assert.equal(frozen.requestIds[0],d.requestId)
})
