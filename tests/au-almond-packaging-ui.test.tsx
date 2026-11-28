import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {AuRenewalShop} from '../src/pages/AuRenewalShop'
import {CartProvider} from '../src/CartProvider'
import {AuLanguageContext} from '../src/lib/au-language'
import {inspectRenewalCart, RENEWAL_CART_KEY, renewalSelectionHref} from '../src/lib/renewal-cart'
import {CART_EVENT_PREFIX, createCustomerCartStore} from '../src/lib/customer-cart-storage'
import {ALMOND_GIFT_BOX_ID, ALMOND_SALE_START, ALMOND_SALE_END} from '../appwrite-functions/reservation-api/src/au-renewal.js'

function storage(values:Record<string,string>={}) {
  const data=new Map(Object.entries(values))
  return {get length(){return data.size}, key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
}
function render(path:string,language:'en'|'ko'='en',store=storage()) {
  Object.assign(globalThis,{window:{location:new URL(path,'https://example.test'),localStorage:store},localStorage:store})
  return renderToStaticMarkup(<AuLanguageContext.Provider value={{language,setLanguage(){}}}><CartProvider><AuRenewalShop path={path.split('?')[0]}/></CartProvider></AuLanguageContext.Provider>)
}
const product = '/chocolates/almond-chocoball'
const offerNames = ['Pouch · 80g','Triangle box · 60g','5+1 pouches · 6 × 80g','5+1 triangle boxes · 6 × 60g','Black tub · 2 × 80g pouches','Gift box · 4 × 60g triangle boxes']

test('six separate pack choices keep the specified reading order, packaging, and selected gift link', t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse(ALMOND_SALE_START)})
  const page=render(product+'?offer='+ALMOND_GIFT_BOX_ID)
  assert.deepEqual([...page.matchAll(/class="cake-detail-option[^"]*" aria-pressed="(true|false)">.*?<strong>([^<]+)<\/strong>/g)].map(m=>[m[2],m[1]]),
    offerNames.map((name,i)=>[name,i===5?'true':'false']))
  assert.match(page,/<del>AUD 50.00<\/del>AUD 40.00/)
  assert.match(page,/20% off through 6 Dec/)
  assert.match(render(product+'?almondPackaging=triangle-box'),/aria-pressed="true">[^]*?<strong>Triangle box · 60g<\/strong>/)
  t.mock.timers.setTime(Date.parse(ALMOND_SALE_END))
  const after=render(product+'?offer='+ALMOND_GIFT_BOX_ID)
  assert.doesNotMatch(after,/<del>|20% off through 6 Dec/)
  assert.match(after,/Gift box · 4 × 60g triangle boxes<\/strong><span class="au-pave-option-price">AUD 50.00/)
})

test('the selected almond cover shows a single triangle, the photographed 5+1 bundle or the front of the four-box gift set',()=>{
  for (const [offer, image] of [
    ['almond-triangle-60g','triangle'],
    ['almond-triangle-6pack','triangle-six'],
    [ALMOND_GIFT_BOX_ID,'gift-set'],
  ] as const) {
    const page=render(product+'?offer='+offer)
    const cover=page.split('class="au-pave-gallery-main"')[1].split('<button')[0]
    assert.equal([...cover.matchAll(/<img\b/g)].length,1)
    assert.equal([...cover.matchAll(new RegExp('src="/products/almond/'+image+'-480\\.webp"','g'))].length,1)
    assert.ok(cover.includes('/products/almond/'+image+'-960.webp 960w'))
    assert.doesNotMatch(page,/PHOTO COMING SOON/)
  }
})

test('retired 80g triangle drafts require review; mixed historical events keep their other lines',()=>{
  const retired={offerId:'almond-chocoball-80g',lineId:'old-triangle',almondPackaging:'triangle-box' as const,quantity:1}
  const active={offerId:'almond-chocoball-6pack',lineId:'pouches',quantity:1}
  const contents=inspectRenewalCart(JSON.stringify({version:1,lines:[retired,active]}))
  assert.deepEqual(contents.retiredAlmond,[retired])
  assert.deepEqual(contents.lines.map(l=>l.lineId),[active.lineId])
  const store=storage({[CART_EVENT_PREFIX+'guest:old'] : JSON.stringify({version:1,clock:1,id:'old',action:{type:'renewal-add',lines:[retired,active]}})})
  const cart=createCustomerCartStore({storage:store,owner:'guest',authFence:false})
  assert.deepEqual(cart.getSnapshot().almondReselectionLines,[retired])
  const href=renewalSelectionHref(retired,retired.lineId)!
  assert.match(href,/offer=almond-triangle-60g/)
  assert.match(render('/cart','en',store), /saved 80g triangle box/)
  assert.match(render(href,'en',store), /Update bag/)
  cart.mutate(cart.ticket(),{type:'renewal-replace',id:retired.lineId,lines:[{offerId:'almond-triangle-60g',lineId:'confirmed',quantity:1}]})
  assert.deepEqual(cart.getSnapshot().almondReselectionLines,[])
  assert.deepEqual(cart.getSnapshot().renewalLines.map(l=>l.offerId),[active.offerId,'almond-triangle-60g'])
})

test('an expired promotional cart shows the new regular price before submission, including after reload', t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse(ALMOND_SALE_END)})
  const line={offerId:ALMOND_GIFT_BOX_ID,lineId:'gift',quantity:2}
  function bag(added:number) {
    return render('/cart','en',storage({[CART_EVENT_PREFIX+'guest:sale']:JSON.stringify({version:1,clock:added,id:'sale',action:{type:'renewal-add',lines:[line]}})}))
  }
  assert.match(bag(Date.parse(ALMOND_SALE_START)),/regular price of AUD 50 per box/)
  assert.match(bag(Date.parse(ALMOND_SALE_START)),/AUD 100.00/)
  assert.doesNotMatch(bag(Date.parse(ALMOND_SALE_END)),/offer has ended/)
  assert.match(renewalSelectionHref(line)!,/offer=almond-triangle-gift-4x60g/)
})

test('guest import carries retired triangles once and keeps the member pack with a colliding line ID',()=>{
  const retired={offerId:'almond-chocoball-80g',lineId:'shared-id',almondPackaging:'triangle-box' as const,quantity:2}
  const store=storage({[RENEWAL_CART_KEY]:JSON.stringify({version:1,lines:[retired]})})
  const cart=createCustomerCartStore({storage:store,owner:'user:member',authFence:false})
  assert.equal(cart.getSnapshot().guestItemCount,2)
  assert.equal(cart.getSnapshot().canImportGuest,true)
  cart.mutate(cart.ticket(),{type:'renewal-add',lines:[{offerId:'almond-triangle-6pack',lineId:'shared-id',quantity:1}]})
  cart.mutate(cart.ticket(),{type:'import-guest'})
  cart.mutate(cart.ticket(),{type:'import-guest'})
  const {almondReselectionLines,renewalLines}=cart.getSnapshot()
  assert.equal(almondReselectionLines.length,1)
  assert.equal(almondReselectionLines[0].quantity,2)
  assert.notEqual(almondReselectionLines[0].lineId,renewalLines[0].lineId)
  cart.mutate(cart.ticket(),{type:'renewal-remove',id:almondReselectionLines[0].lineId})
  assert.equal(cart.getSnapshot().renewalLines[0].lineId,'shared-id')
})

test('old imports of triangle boxes remain consumed and historically removed packs stay removed',()=>{
  const triangle={lineId:'original',offerId:'almond-chocoball-80g',almondPackaging:'triangle-box' as const,quantity:1}
  const pouch={lineId:'pouch',offerId:'almond-chocoball-80g',quantity:1}
  const guestLines=[{...triangle,lineId:'imported'},pouch]
  const event=(id:string,clock:number,action:unknown)=>[CART_EVENT_PREFIX+'user:test:'+id,JSON.stringify({version:1,id,clock,action})]
  const legacy='{"version":1,"lines":[]}'
  const store=storage(Object.fromEntries([
    [RENEWAL_CART_KEY,JSON.stringify({version:1,lines:guestLines})],
    event('one',1,{type:'renewal-add',lines:[triangle]}),
    event('two',2,{type:'import-guest',legacy,renewal:guestLines,signature:JSON.stringify({legacy,renewal:guestLines})}),
    event('three',3,{type:'renewal-remove',id:'original'}),
  ]))
  const cart=createCustomerCartStore({storage:store,owner:'user:test',authFence:false})
  assert.deepEqual(cart.getSnapshot().almondReselectionLines,[])
  assert.equal(cart.getSnapshot().canImportGuest,false)
  assert.equal(cart.getSnapshot().guestAlreadyImported,true)
  assert.equal(cart.getSnapshot().renewalLines[0].quantity,1)
})
