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
import {CustomerAccountContext,disabledCustomerAccount} from '../src/lib/customer-account-context'
import {renewalSelectionHref} from '../src/lib/renewal-cart'
test('account edit waits for restored cart before initializing the cake and attached extras',()=>{
 const store=storage({[`${RENEWAL_CART_KEY}:user:test`]:JSON.stringify({version:1,lines:[{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1},{lineId:'cream',offerId:'addon-cream',parentLineId:'cake',quantity:2}]})})
 Object.assign(globalThis,{window:{location:new URL('https://example.test/cakes/pave-chocolate-cake?edit=cake&size=6in'),localStorage:store},localStorage:store})
 const renderAccount=(state:unknown)=>renderToStaticMarkup(<CustomerAccountContext.Provider value={{...disabledCustomerAccount,enabled:true,state} as never}><AuLanguageContext.Provider value={{language:'en',setLanguage(){}}}><CartProvider><AuRenewalShop path="/cakes/pave-chocolate-cake"/></CartProvider></AuLanguageContext.Provider></CustomerAccountContext.Provider>)
 const checking=renderAccount({status:'checking'})
 assert.match(checking,/Checking your account/)
 assert.doesNotMatch(checking,/Update bag/)
 const restored=renderAccount({status:'authenticated',identity:{userId:'test',loginEmail:'test@example.test',profile:{version:1,name:'Test',phone:'',contactEmail:'',language:'en'}}})
 assert.match(restored,/AUD 88\.30/)
 assert.match(restored,/Update bag/)
})
test('historical removal, replacement, completion and clear do not resurrect Milk notices',()=>{
 for(const action of [{type:'renewal-remove',id:'old'},{type:'renewal-clear'},{type:'renewal-replace',id:'old',lines:[good]},{type:'renewal-submitted',lines:[milk]}]) {
  const store=storage({[`${CART_EVENT_PREFIX}guest:add`]:JSON.stringify({version:1,id:'add',clock:1,action:{type:'renewal-add',lines:[milk,good]}}),[`${CART_EVENT_PREFIX}guest:later`]:JSON.stringify({version:1,id:'later',clock:2,action})})
  assert.equal(readCustomerCart(store,'guest').paveReselectionLines.length,0,action.type)
 }
})
test('reselection links are provided only for cakes whose complete configuration is restored',()=>{
 assert.equal(renewalSelectionHref({lineId:'cup',offerId:'cupcake-half-dozen',quantity:2,finish:'vanilla-fresh-cream'}),null)
 assert.equal(renewalSelectionHref({lineId:'lemon',offerId:'fresh-lemon-cupcakes-6',quantity:1,chocolateIcingCount:3}),null)
})
import {replaceRenewalLines} from '../src/lib/renewal-cart'
test('successful cake edit persists attached extras and leaves the consumed edit URL',()=>{
 let lines=[{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1},{lineId:'cream',offerId:'addon-cream',quantity:2,parentLineId:'cake'}],destination=''
 const cart={ready:true,owner:'guest',renewalLines:lines,replaceRenewal(id:string,next:typeof lines){lines=replaceRenewalLines(lines,id,next) as typeof lines;cart.renewalLines=lines}}
 Object.assign(globalThis,{window:{location:{href:'https://example.test/cakes/pave-chocolate-cake?edit=cake&size=6in',search:'?edit=cake&size=6in',replace:(url:string)=>{destination=url}}}})
 const slots:unknown[]=[];let cursor=0
 const dispatcher={useContext(context:unknown){return context===AuLanguageContext?{language:'en',t:(en:string)=>en}:cart},useState(initial:unknown){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?next(slots[i]):next}]},useEffect(){},useMemo(fn:()=>unknown){return fn()},useRef(initial:unknown){return {current:initial}}}
 const internals=(React as unknown as {__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{H:unknown}}).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,previous=internals.H
 let tree:React.ReactElement
 try {
  internals.H=dispatcher;cursor=0
  tree=AuRenewalShop({path:'/cakes/pave-chocolate-cake'})
  while(typeof tree.type==='function')tree=(tree.type as (props:unknown)=>React.ReactElement)(tree.props)
 }finally{internals.H=previous}
 function find(node:unknown):{props:{onClick:()=>void}}|undefined {
  if(!node||typeof node!=='object')return
  if(Array.isArray(node)){for(const child of node){const hit=find(child);if(hit)return hit};return}
  const element=node as {type:unknown;props:{className?:string;children?:unknown;onClick:()=>void}}
  if(element.type==='button'&&element.props.className==='au-pave-order-button')return element
  return find(element.props?.children)
 }
 find(tree)!.props.onClick()
 assert.equal(destination,'/cart','the next edit must use the persisted cart identity')
 assert.equal(lines.find(line=>line.offerId==='addon-cream')?.quantity,2)
 assert.ok(lines.some(line=>line.offerId==='pave-cake'))
})
test('mini cake galleries use supplied photos and cream selection updates the lead photo',()=>{
 const first=(html:string)=>html.match(/class="au-pave-gallery-main"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1];
 assert.equal(first(render('/cakes/brownie-cheesecake?size=4in')),'/products/basque-mini-960.webp');
 assert.equal(first(render('/cakes/brownie-cheesecake?size=4in&finish=vanilla-fresh-cream')),'/products/basque-on-cream-mini-960.webp');
 assert.equal(first(render('/cakes/pave-chocolate-cake?size=4in')),'/products/pave-4inch-960.webp');
 assert.notEqual(first(render('/cakes/brownie-cheesecake?size=6in')),'/products/basque-mini-960.webp');
 assert.notEqual(first(render('/cakes/pave-chocolate-cake?size=6in')),'/products/pave-4inch-960.webp');
});
