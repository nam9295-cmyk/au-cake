import test from 'node:test'
import assert from 'node:assert/strict'
import {saveCheckoutForRefresh,restoreCheckoutDraft} from '../src/lib/customer-checkout-draft'
test('menu upgrade refresh retains contact, options, coupon and original requestId for safe retry',()=>{
 const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}
 const draft={version:1 as const,kind:'renewal' as const,cartOwner:'guest' as const,flowId:'11111111-1111-4111-8111-111111111111',savedAt:Date.now(),returnTo:'/cart' as const,requestId:'22222222-2222-4222-8222-222222222222',form:{name:'Original Customer',phone:'0412345678',email:'test@example.test',date:'2026-11-20',time:'09:00',note:'Keep this',promo:'VALIDCOUPON',privacy:true},dirtyFields:['name'],checkoutContext:{},cartSnapshot:[{lineId:'cake',offerId:'pave-cake',size:'6in',finish:'fresh-strawberries',quantity:2}],cartSignature:'same-cart'}
 assert.equal(saveCheckoutForRefresh(storage,draft,'https://example.test/cart?test=1'),'/cart?test=1&customerResume=11111111-1111-4111-8111-111111111111')
 const restored=restoreCheckoutDraft(storage,{flowId:draft.flowId,now:draft.savedAt,cartSignature:'same-cart',cartOwner:'guest'})
 assert.equal(restored.status,'restored')
 assert.ok('draft' in restored)
 assert.deepEqual(restored.draft,draft)
 assert.equal(saveCheckoutForRefresh({...storage,setItem(){throw Error('full')}},draft,'https://example.test/cart'),null)
})
