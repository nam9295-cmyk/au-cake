import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {CartProvider,useCart} from '../src/CartProvider'
import {GuestCartImport} from '../src/components/GuestCartImport'
import {CustomerAccountContext,disabledCustomerAccount} from '../src/lib/customer-account-context'
import * as choice from '../src/lib/customer-cart-storage'

function memory(){const data=new Map<string,string>();return {data,get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}}
const identity=(userId:string)=>({userId,loginEmail:'login@example.test',profile:{version:1 as const,name:'',phone:'',contactEmail:'',language:'en' as const}})
function harness(run:(h:{render:(user:string|null,language?:'en'|'ko',enabled?:boolean)=>string;storage:ReturnType<typeof memory>;session:ReturnType<typeof memory>;cart:()=>ReturnType<typeof useCart>})=>void){
 const oldWindow=globalThis.window,oldSession=globalThis.sessionStorage,storage=memory(),session=memory()
 storage.setItem('verygood-au-renewal-cart-v1',JSON.stringify({version:1,lines:[{lineId:'guest-pave',offerId:'pave-chocolate-100g',quantity:2}]}))
 globalThis.window={localStorage:storage} as never;globalThis.sessionStorage=session as never
 let current:ReturnType<typeof useCart>
 function Probe(){current=useCart();return null}
 const render=(user:string|null,language:'en'|'ko'='en',enabled=true)=>renderToStaticMarkup(<CustomerAccountContext.Provider value={{...disabledCustomerAccount,enabled,state:user?{status:'authenticated',identity:identity(user)}:{status:'guest'}}}><CartProvider><Probe/><GuestCartImport language={language}/></CartProvider></CustomerAccountContext.Provider>)
 try{run({render,storage,session,cart:()=>current})}finally{globalThis.window=oldWindow;globalThis.sessionStorage=oldSession}
}
test('Guest bag offers optional sign-in without a blocking popup or moving goods; flag OFF stays inert',()=>harness(h=>{
 const before=[...h.storage.data]
 assert.match(h.render(null),/Sign in to save your details for your next order/)
 assert.match(h.render(null,'ko'),/다음 주문에 정보를 자동입력/)
 assert.doesNotMatch(h.render(null),/role="dialog"|Import guest bag/)
 assert.equal(h.render(null,'en',false),'');assert.deepEqual([...h.storage.data],before)
}))
test('verified member sees Guest quantity and two explicit choices before any import',()=>harness(h=>{
 const before=[...h.storage.data],html=h.render('G')
 assert.match(html,/2 items/);assert.match(html,/Import guest bag/);assert.match(html,/Use my account bag/)
 assert.match(h.render('G','ko'),/상품 2개/);assert.match(h.render('G','ko'),/회원 장바구니만 보기/)
 assert.equal(h.cart().itemCount,0);assert.equal(h.cart().guestItemCount,2)
 assert.deepEqual([...h.storage.data],before)
 h.cart().importGuest();h.render('G');assert.equal(h.cart().itemCount,2)
 h.cart().importGuest();h.render('G');assert.equal(h.cart().itemCount,2)
 h.render('H');assert.equal(h.cart().itemCount,0)
 h.render(null);assert.equal(h.cart().itemCount,2)
}))
test('declining keeps Guest goods, survives refresh, stays scoped to G and can be reviewed again',()=>harness(h=>{
 const decline=Reflect.get(choice,'declineGuestImport'),declined=Reflect.get(choice,'hasDeclinedGuestImport')
 assert.equal(typeof decline,'function');assert.equal(typeof declined,'function')
 h.render('G');const signature=h.cart().guestSignature,before=[...h.storage.data]
 decline(h.session,'user:G',signature)
 assert.equal(declined(h.session,'user:G',signature),true);assert.equal(declined(h.session,'user:H',signature),false)
 const html=h.render('G');assert.match(html,/Review guest items/);assert.doesNotMatch(html,/Use my account bag/)
 assert.match(h.render('H'),/Use my account bag/);assert.deepEqual([...h.storage.data],before)
 assert.equal(declined(h.session,'user:G',signature+'changed'),false)
 assert.equal(declined({getItem(){throw Error('blocked')}},'user:G',signature),false)
 assert.doesNotThrow(()=>decline({setItem(){throw Error('blocked')}},'user:G',signature))
}))
