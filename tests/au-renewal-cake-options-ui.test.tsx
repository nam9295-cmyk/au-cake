import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {AuRenewalShop} from '../src/pages/AuRenewalShop'
import {CartProvider} from '../src/CartProvider'
import {AuLanguageContext} from '../src/lib/au-language'
import {inspectRenewalCart, RENEWAL_CART_KEY, addRenewalLines} from '../src/lib/renewal-cart'
import {readCustomerCart, CART_EVENT_PREFIX} from '../src/lib/customer-cart-storage'
const milk={lineId:'old',offerId:'pave-cake',size:'8in',quantity:1,chocolateType:'milk'}
const good={lineId:'good',offerId:'brownie-whole',size:'6in',quantity:1}
function storage(values:Record<string,string>={}) {
 const data=new Map(Object.entries(values))
 return {get length(){return data.size}, key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
}
function render(path:string,language:'en'|'ko'='en',lines:unknown[]=[]) {
 const store=storage({[RENEWAL_CART_KEY]:JSON.stringify({version:1,lines})})
 Object.assign(globalThis,{window:{location:new URL(path,'https://example.test'),localStorage:store},localStorage:store})
 return renderToStaticMarkup(<AuLanguageContext.Provider value={{language,setLanguage(){}}}><CartProvider><AuRenewalShop path={path.split('?')[0]}/></CartProvider></AuLanguageContext.Provider>)
}
for(const language of ['en','ko'] as const) test(`whole cakes start mini, expose exclusive decorations and correct totals (${language})`,()=>{
 for(const [path,total] of [['/cakes/pave-chocolate-cake','45.00'],['/cakes/brownie-cheesecake','49.00']]) {
  const html=render(path,language)
  assert.ok(html.includes(`AUD ${total}`))
  assert.match(html,language==='en'?/Mini 4 inch/:/미니 4인치/)
  assert.doesNotMatch(html, />Milk<|>밀크</)
 }
 const pave=render('/cakes/pave-chocolate-cake?size=6in&finish=fresh-strawberries&quantity=2',language)
 assert.match(pave,/AUD 186\.00/)
 const brownie=render('/cakes/brownie-cheesecake?size=8in&finish=vanilla-fresh-cream-strawberries&quantity=2',language)
 assert.match(brownie,/AUD 314\.00/)
 assert.match(brownie,/AUD 40\.00/)
 assert.doesNotMatch(brownie,/>vanilla-fresh-cream-strawberries</)
})
test('retired Milk keeps other local and account items and requires explicit reselection',()=>{
 const raw=JSON.stringify({version:1,lines:[milk,good]})
 const inspection=inspectRenewalCart(raw)
 assert.deepEqual(inspection.lines.map(l=>l.lineId),['good'])
 assert.equal(inspection.retiredPave.length,1)
 for(const owner of ['guest','user:test'] as const) {
  const store=storage({[owner==='guest'?RENEWAL_CART_KEY:`${RENEWAL_CART_KEY}:${owner}`]:raw})
  assert.equal(readCustomerCart(store,owner).renewalLines.length,1)
  assert.equal(readCustomerCart(store,owner).paveReselectionLines.length,1)
  const eventStore=storage({[`${CART_EVENT_PREFIX}${owner}:old-event`]:JSON.stringify({version:1,id:'old-event',clock:1,action:{type:'renewal-add',lines:[milk,good]}})})
  assert.equal(readCustomerCart(eventStore,owner).renewalLines.length,1)
  assert.equal(readCustomerCart(eventStore,owner).paveReselectionLines.length,1)
 }
 const html=render('/cart','en',[milk,good])
 assert.match(html,/Milk.*no longer|no longer.*Milk/)
 assert.match(html,/Brownie Basque/)
 assert.match(html,/Re-select|Choose again/)
 const detail=render('/cakes/pave-chocolate-cake?size=8in&chocolateType=milk')
 assert.match(detail,/Choose Dark/)
 assert.match(detail,/<button[^>]*disabled[^>]*>Add to bag/)
})
test('different whole cake sizes and finishes remain separate cart lines',()=>{
 const lines=addRenewalLines([],[{...good,lineId:'a',size:'4in',finish:'basic'},{...good,lineId:'b',size:'4in',finish:'vanilla-fresh-cream-strawberries'},{...good,lineId:'c',size:'8in',finish:'vanilla-fresh-cream-strawberries'}])
 assert.equal(lines.length,3)
})
test('cart edit restores the complete cake selection rather than mini defaults',()=>{
 const html=render('/cakes/brownie-cheesecake?edit=good','en',[{...good,size:'10in',quantity:2,finish:'vanilla-fresh-cream-strawberries'}])
 assert.match(html,/AUD 456\.00/)
 assert.match(html,/Update bag/)
})
import {ProductDetailRows} from '../src/components/ProductDetailRows'
import {CustomerOrderDetail} from '../src/components/CustomerOrderDetail'
import {priceRenewalOrder} from '../appwrite-functions/reservation-api/src/au-renewal.js'
test('lookup displays v3 topping names and historical Milk; account reorder asks to reselect Milk',()=>{
 const newLine=priceRenewalOrder([{...good,size:'4in',finish:'vanilla-fresh-cream-strawberries'}]).lines[0]
 const oldLine=priceRenewalOrder([milk],{contractVersion:'au-renewal.2026-10.v2'}).lines[0]
 for(const [line,expected] of [[newLine,/Vanilla Fresh Cream \+ Strawberries/],[oldLine,/Milk/]] as const) {
  const html=renderToStaticMarkup(<dl><ProductDetailRows reservation={line as never} language="en"/></dl>)
  assert.match(html,expected)
  assert.doesNotMatch(html,/>vanilla-fresh-cream-strawberries</)
 }
 const detail={reservationNumber:'OLD',pickupDate:'2026-11-20',pickupTime:'09:00',status:'예약신청',paymentStatus:'미입금',totalPriceCents:10700,contact:{name:'Test',phone:'0412345678',email:'test@example.test'},requestNote:'',view:{format:'renewal',orderLines:[oldLine]}}
 const html=renderToStaticMarkup(<CustomerOrderDetail detail={detail as never} language="en" onClose={()=>{}}/>)
 assert.match(html,/Milk chocolate Pavé is no longer available/)
 assert.match(html,/chocolateType=milk/)
})
