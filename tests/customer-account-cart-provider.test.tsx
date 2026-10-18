import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {CartProvider,useCart} from '../src/CartProvider'
import {CustomerAccountContext,disabledCustomerAccount} from '../src/lib/customer-account-context'
import type {CustomerAuthState} from '../src/lib/customer-account-types'
const cake={lineId:'pave',offerId:'pave-cake',size:'6in',quantity:1} as const
const chocolate={lineId:'choc',offerId:'pave-chocolate-100g',quantity:1} as const
function identity(userId:string){return {userId,loginEmail:userId+'@example.test',profile:{version:1 as const,name:'',phone:'',contactEmail:'',language:'en' as const}}}
test('actual CartProvider G/add/logout/H/add/logout/G preserves independent bags and refresh',()=>{
 const previous=globalThis.window,data=new Map<string,string>(),storage={get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
 globalThis.window={localStorage:storage} as never
 let captured:ReturnType<typeof useCart>
 function Probe(){captured=useCart();return <output>{captured.itemCount}</output>}
 const render=(state:CustomerAuthState)=>renderToStaticMarkup(<CustomerAccountContext.Provider value={{...disabledCustomerAccount,enabled:true,state}}><CartProvider><Probe/></CartProvider></CustomerAccountContext.Provider>)
 try{
  render({status:'authenticated',identity:identity('G')});captured!.addRenewal([cake])
  assert.match(render({status:'guest'}),/>0</)
  assert.match(render({status:'authenticated',identity:identity('H')}),/>0</);captured!.addRenewal([chocolate])
  assert.match(render({status:'guest'}),/>0</)
  assert.match(render({status:'authenticated',identity:identity('G')}),/>1</);assert.equal(captured!.renewalLines[0].offerId,'pave-cake')
  render({status:'checking',previousIdentity:identity('G')});assert.equal(captured!.itemCount,0);assert.equal(captured!.ready,false)
  captured!.addRenewal([chocolate]);assert.match(render({status:'authenticated',identity:identity('G')}),/>1</)
  assert.match(render({status:'unavailable'}),/>0</)
  assert.match(render({status:'authenticated',identity:identity('H')}),/>1</);assert.equal(captured!.renewalLines[0].offerId,'pave-chocolate-100g')
 }finally{globalThis.window=previous}
})
test('actual AU Bag offers explicit Guest import to members without silently copying products',async()=>{
 const {AuRenewalShop}=await import('../src/pages/AuRenewalShop'),previous=globalThis.window
 const data=new Map([['verygood-au-renewal-cart-v1',JSON.stringify({version:1,lines:[cake]})]])
 globalThis.window={localStorage:{get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}} as never
 try{
  const html=renderToStaticMarkup(<CustomerAccountContext.Provider value={{...disabledCustomerAccount,enabled:true,state:{status:'authenticated',identity:identity('G')}}}><CartProvider><AuRenewalShop path="/cart"/></CartProvider></CustomerAccountContext.Provider>)
  assert.match(html,/Import guest bag/);assert.match(html,/Your bag is empty/)
  assert.equal(data.size,1)
 }finally{globalThis.window=previous}
})
