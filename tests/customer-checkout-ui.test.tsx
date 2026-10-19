import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import * as prompts from '../src/components/CheckoutAccountPrompt'
import {CustomerAccountContext,disabledCustomerAccount} from '../src/lib/customer-account-context'
import {functions} from '../src/lib/appwrite'
import {executeReservationApi} from '../src/lib/repository'
import {CartProvider} from '../src/CartProvider'
import {AuRenewalShop} from '../src/pages/AuRenewalShop'
import {saveCheckoutDraft,CUSTOMER_DRAFT_PREFIX} from '../src/lib/customer-checkout-draft'
test('checkout prompt is inert with feature OFF and lets authenticated customers explicitly order as guest',()=>{
  const Prompt=Reflect.get(prompts,'CheckoutAccountPrompt');assert.equal(typeof Prompt,'function')
  assert.equal(renderToStaticMarkup(<Prompt language="en" guest={false} onGuest={()=>{}}/>),'')
  const value={...disabledCustomerAccount,enabled:true,ready:true,state:{status:'authenticated',identity:{userId:'a',loginEmail:'login@example.test',profile:{version:1,name:'Saved Name',contactEmail:'contact@example.test',phone:'',language:'en'}}}}
  const html=renderToStaticMarkup(<CustomerAccountContext.Provider value={value as never}><Prompt language="en" guest={false} onGuest={()=>{}}/></CustomerAccountContext.Provider>)
  assert.match(html,/login@example.test/);assert.match(html,/Continue as Guest/)
})
test('member intent is outside canonical data; guest execution envelope stays byte-for-byte unchanged',async()=>{
  const original=functions.createExecution,bodies:string[]=[]
  try {
    functions.createExecution=(async args=>{bodies.push(args.body!);return {responseStatusCode:200,responseBody:'{"ok":true,"result":{}}'}}) as never
    const data={requestId:'same-request',customerEmail:'contact@example.test'}
    await executeReservationApi('create-cake',data)
    await executeReservationApi('create-cake',data,undefined,{customerAccount:'link'})
    assert.equal(bodies[0],JSON.stringify({action:'create-cake',data}))
    assert.deepEqual(JSON.parse(bodies[1]),{action:'create-cake',data,customerAccount:'link'})
    assert.equal(Object.hasOwn(data,'customerUserId'),false)
  } finally {functions.createExecution=original}
})
test('actual AU Bag restores the real fields, quote options, consent and UUID without consuming during render',()=>{
  const originalWindow=globalThis.window,originalStorage=globalThis.sessionStorage,originalLocal=globalThis.localStorage
  const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}
  const cart=JSON.stringify({version:1,lines:[{lineId:'saved-line',offerId:'pave-cake',size:'8in',quantity:1}]})
  const flowId='11111111-1111-4111-8111-111111111111'
  try {
    data.set('verygood-au-renewal-cart-v1',cart)
    globalThis.window={localStorage:storage,location:{href:`http://localhost/cart?customerResume=${flowId}`}} as never
    globalThis.sessionStorage=storage as never
    globalThis.localStorage=storage as never
    assert.equal(saveCheckoutDraft(storage,{version:1,kind:'renewal',flowId,savedAt:Date.now(),returnTo:'/cart',requestId:'22222222-2222-4222-8222-222222222222',form:{name:'Saved Name',phone:'0412345678',email:'typed@example.test',date:'2099-11-01',time:'09:00',note:'Saved note',promo:'SAVED',privacy:false},dirtyFields:['name'],checkoutContext:{},cartSnapshot:[],cartSignature:cart}).ok,true)
    const html=renderToStaticMarkup(<CartProvider><AuRenewalShop path="/cart"/></CartProvider>)
    for(const value of ['Saved Name','typed@example.test','Saved note','SAVED','2099-11-01'])assert.ok(html.includes(value),value)
    const consent=html.match(/<input(?=[^>]*name="privacy")[^>]*>/)?.[0]||''
    assert.match(consent,/type="checkbox"/);assert.match(consent,/required=""/)
    assert.doesNotMatch(consent,/checked/)
    assert.ok(data.get(CUSTOMER_DRAFT_PREFIX+flowId),'render consumed draft before effects')
  }finally{globalThis.window=originalWindow;globalThis.sessionStorage=originalStorage;globalThis.localStorage=originalLocal}
})
