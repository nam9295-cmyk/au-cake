import assert from 'node:assert/strict'
import test from 'node:test'
import * as draftModule from '../src/lib/customer-checkout-draft'
const flowId='11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222',now=Date.parse('2026-10-17T00:00:00Z')
const draft={version:1,kind:'renewal',flowId,savedAt:now,returnTo:'/cart',requestId,form:{name:'Already typed',phone:'0412345678',email:'contact@example.test',date:'2026-10-23',time:'09:00',note:'Keep this',promo:'TEST',privacy:false},dirtyFields:['name','email'],checkoutContext:{},cartSnapshot:[{lineId:'a',offerId:'pave-cake',size:'8in',quantity:1}],cartSignature:'original-cart'}
const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k),data}}
test('OAuth draft preserves fields, consent, requestId and options; reading does not consume it',()=>{
  const save=Reflect.get(draftModule,'saveCheckoutDraft'),restore=Reflect.get(draftModule,'restoreCheckoutDraft');assert.equal(typeof save,'function')
  const storage=memory();assert.deepEqual(save(storage,draft),{ok:true})
  const restored=restore(storage,{flowId,now,cartSignature:'original-cart'})
  assert.equal(restored.status,'restored');assert.deepEqual(restored.draft,draft)
  assert.deepEqual(restore(storage,{flowId,now,cartSignature:'original-cart'}),restored)
  Reflect.get(draftModule,'clearCheckoutDraft')(storage,flowId)
  assert.equal(restore(storage,{flowId,now,cartSignature:'original-cart'}).status,'missing')
})
test('changed cart is retained and requires explicit review, without rewriting storage',()=>{
  const save=Reflect.get(draftModule,'saveCheckoutDraft'),restore=Reflect.get(draftModule,'restoreCheckoutDraft');assert.equal(typeof save,'function')
  const storage=memory();save(storage,draft);storage.setItem('actual-cart','newer-other-tab-cart')
  const result=restore(storage,{flowId,now,cartSignature:'newer-cart'})
  assert.equal(result.status,'cart-changed');assert.equal(result.draft.requestId,requestId);assert.equal(storage.getItem('actual-cart'),'newer-other-tab-cart')
})
test('draft fails closed on expiry, size, redirect, flow mismatch, prototype and storage errors',()=>{
  const save=Reflect.get(draftModule,'saveCheckoutDraft'),restore=Reflect.get(draftModule,'restoreCheckoutDraft');assert.equal(typeof save,'function')
  for(const change of [{returnTo:'//evil.test'},{returnTo:'/classes'},{flowId:'bad'},{kind:'custom'},{form:{...draft.form,note:'a'.repeat(65536)}},{form:{...draft.form,customerUserId:'forged'}},{checkoutContext:JSON.parse('{"__proto__":{"polluted":true}}')}])assert.deepEqual(save(memory(),{...draft,...change}),{ok:false})
  const storage=memory();save(storage,draft)
  assert.equal(restore(storage,{flowId,now:now+30*60*1000+1,cartSignature:'original-cart'}).status,'invalid')
  assert.equal(restore(storage,{flowId:'33333333-3333-4333-8333-333333333333',now,cartSignature:'original-cart'}).status,'missing')
  assert.deepEqual(save({setItem(){throw Error('full')},getItem(){return null},removeItem(){}},draft),{ok:false})
})
test('profile autofill only fills untouched blank contact values and never consent',()=>{
  const fill=Reflect.get(draftModule,'fillUntouchedContact');assert.equal(typeof fill,'function')
  const form={customerName:'Already typed',customerPhone:'',customerEmail:'',privacy:false}
  const profile={version:1,name:'Google Name',phone:'0412345678',contactEmail:'contact@example.test',language:'en'}
  assert.deepEqual(fill(form,['customerEmail'],profile),{customerName:'Already typed',customerPhone:'0412345678',customerEmail:'',privacy:false})
  assert.equal(form.customerPhone,'')
})
test('legacy draft retains multi-line selection, coupon reward handoff and exact cart origin separately from contact',()=>{
  const storage=memory(),legacy={...draft,kind:'legacy',returnTo:'/reserve',form:{productId:'pave-cake',quantity:2,customerName:'Typed',customerPhone:'0412345678',customerEmail:'typed@example.test',pickupDate:'2099-11-01',pickupTime:'09:00',promoCode:'FOXKIWI7Q2MK',privacy:false},dirtyFields:['customerName'],checkoutContext:{initialProductId:'pave-cake',initialSelection:{productId:'pave-cake',quantity:2},initialOrderLines:[{productId:'pave-cake',quantity:2},{productId:'smore-stick',quantity:12}],reviewRewardHandoff:{couponCode:'FOXKIWI7Q2MK',rewardPercent:10},cartOrigin:[{lineKey:'original-line',selection:{productId:'pave-cake',quantity:2}}]}}
  assert.deepEqual(Reflect.get(draftModule,'saveCheckoutDraft')(storage,legacy),{ok:true})
  const result=Reflect.get(draftModule,'restoreCheckoutDraft')(storage,{flowId,now,cartSignature:'original-cart'})
  assert.deepEqual(result.draft,legacy)
  const form=Reflect.get(draftModule,'restoreCheckoutForm')({customerName:'',privacy:false,quantity:1},result.draft)
  assert.deepEqual(form,{customerName:'Typed',privacy:false,quantity:2})
})
test('member cart signatures and drafts are owner-scoped; Guest OAuth keeps form without moving goods',()=>{
 const previous=globalThis.localStorage,storage=memory(),signature=Reflect.get(draftModule,'checkoutCartSignature'),restore=Reflect.get(draftModule,'restoreCheckoutDraft'),save=Reflect.get(draftModule,'saveCheckoutDraft')
 try{
  globalThis.localStorage=storage as never
  assert.notEqual(signature('renewal','user:G'),signature('renewal','user:H'))
  const member={...draft,cartOwner:'user:G',cartSignature:signature('renewal','user:G')}
  assert.deepEqual(save(storage,member),{ok:true})
  assert.equal(restore(storage,{flowId,now,cartSignature:member.cartSignature,cartOwner:'user:G'}).status,'restored')
  const denied=restore(storage,{flowId,now,cartSignature:signature('renewal','user:H'),cartOwner:'user:H'})
  assert.equal(denied.status,'owner-changed');assert.equal('draft'in denied,false)
  assert.ok(storage.data.has(draftModule.CUSTOMER_DRAFT_PREFIX+flowId))
  const guest={...draft,cartOwner:'guest',cartSignature:signature('renewal','guest')};save(storage,guest)
  const resumed=restore(storage,{flowId,now,cartSignature:signature('renewal','user:G'),cartOwner:'user:G'})
  assert.equal(resumed.status,'cart-changed');assert.equal(resumed.draft.requestId,draft.requestId);assert.equal(resumed.draft.form.name,'Already typed')
  assert.equal(storage.getItem('verygood-au-renewal-cart-v1:user:G'),null)
 }finally{globalThis.localStorage=previous}
})
test('OAuth callback routes saved Guest/member checkouts without consuming drafts or consulting readiness',()=>{
 const target=Reflect.get(draftModule,'checkoutCallbackTarget'),storage=memory()
 assert.equal(typeof target,'function');draftModule.saveCheckoutDraft(storage,draft as never)
 assert.equal(target(storage,flowId,now),'/cart?customerResume='+flowId)
 assert.ok(storage.getItem(draftModule.CUSTOMER_DRAFT_PREFIX+flowId))
 assert.equal(target(storage,flowId,now+30*60*1000+1),'/account')
 assert.equal(target(storage,'bad',now),'/account')
 draftModule.saveAccountReturn(storage,{flowId,savedAt:now,returnTo:'/account'})
 assert.equal(target(storage,flowId,now),'/account')
})
