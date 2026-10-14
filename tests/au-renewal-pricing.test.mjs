import test from 'node:test'
import assert from 'node:assert/strict'
const core = await import('../appwrite-functions/reservation-api/src/au-renewal.js').catch(() => ({}))
const line = (offerId, quantity = 1, options = {}) => ({ lineId: 'a', offerId, quantity, ...options })
const price = (lines, options = { localPreview: true }) => core.priceRenewalOrder(lines, options)
test('renewal contract is available separately from historical contracts', () => {
  assert.equal(typeof core.priceRenewalOrder, 'function')
})
test('confirmed cake prices and provisional sizes are separate', () => {
  for (const [offerId, size, expected] of [['pave-cake','6in',7500],['pave-cake','8in',10700],['pave-cake','10in',15900],['brownie-whole','6in',8200],['brownie-whole','8in',11500],['brownie-whole','10in',15500]]) {
    assert.equal(price([line(offerId,1,{size})]).totalPriceCents, expected)
  }
  assert.equal(price([line('brownie-loaf',2,{finish:'vanilla-fresh-cream'})]).totalPriceCents,13600)
  assert.throws(() => price([line('brownie-whole',1,{size:'8in'})],{}), /PROVISIONAL_PRICE/)
  assert.throws(() => price([line('cookie-six')]), /PRICE_UNAVAILABLE/)
})
test('brownie cupcake finish differs from gateau; packaging pools selected cupcake subtotal only', () => {
  assert.equal(price([line('brownie-cupcakes-6',1,{individualPackaging:true})]).totalPriceCents,3900)
  assert.equal(price([line('brownie-cupcakes-12',1,{finish:'vanilla-fresh-cream',individualPackaging:true})]).totalPriceCents,8400)
  const lines=[line('brownie-cupcakes-6',1,{individualPackaging:true}),{...line('brownie-cupcakes-12',1,{finish:'vanilla-fresh-cream',individualPackaging:true}),lineId:'b'}]
  assert.equal(price(lines).totalPriceCents,11400)
  assert.equal(price(lines).individualPackagingFeeCents,0)
  assert.throws(() => price([line('brownie-cupcakes-6',1,{finish:'chocolate-buttercream'})]),/INVALID_FINISH/)
  assert.equal(price([line('cupcake-half-dozen',1,{finish:'chocolate-buttercream'})]).totalPriceCents,4100)
})
test('mochi modes, explicit signature transition, physical packaging and no business cap', () => {
  assert.equal(price([line('mochi',2,{mode:'signature'})]).totalPriceCents,7000)
  assert.throws(() => price([line('mochi',1,{mode:'custom-four',counts:[1,1,1,1]})]),/SIGNATURE_CHOICE_REQUIRED/)
  assert.equal(price([line('mochi',1,{mode:'custom-four',counts:[2,2,0,0]})]).totalPriceCents,3900)
  const q = price([line('mochi',1,{mode:'quantity',counts:[2,1,1,1],individualPackaging:true})])
  assert.equal(q.totalPriceCents,4950)
  assert.equal(q.lines[0].physicalQuantity,5)
  assert.equal(price([line('mochi',1,{mode:'quantity',counts:[1,1,1,1],individualPackaging:true})]).totalPriceCents,3900)
  assert.equal(price([line('mochi',1,{mode:'quantity',counts:[200,0,0,0],individualPackaging:true})]).totalPriceCents,210000)
  assert.throws(() => price([line('mochi',2,{mode:'quantity',counts:[1,0,0,0]})]),/INVALID_QUANTITY/)
  for(const n of [-1,0.5,Infinity,NaN,Number.MAX_SAFE_INTEGER]) assert.throws(() => price([line('mochi',1,{mode:'quantity',counts:[n,0,0,0]})]))
})
test('only four cake parents qualify for separately counted five percent addons', () => {
  assert.equal(price([line('pave-cake',1,{size:'6in'}),{...line('addon-pave',1,{parentLineId:'a'}),lineId:'b'}]).totalPriceCents,8640)
  for(const offer of ['cupcake-half-dozen','brownie-cupcakes-6','smore-6']) assert.throws(() => price([line(offer),{...line('addon-pave',1,{parentLineId:'a'}),lineId:'b'}]),/INVALID_ADDON_PARENT/)
  assert.throws(() => price([line('addon-cream',1,{parentLineId:'missing'})]),/INVALID_ADDON_PARENT/)
})
test('fixed packs preserve physical units and never auto-convert quantities', () => {
  assert.equal(price([line('smore-6',2)]).totalPriceCents,5000)
  assert.equal(price([line('smore-12')]).totalPriceCents,4500)
  assert.equal(price([line('eiffel-six-plus-one')]).lines[0].physicalQuantity,36)
  assert.equal(price([line('pave-six-plus-one')]).totalPriceCents,6000)
})

test('updated document fixtures are executable confirmed or local-only contracts',async()=>{
 const {readFile}=await import('node:fs/promises')
 const fixture=JSON.parse(await readFile('docs/renewal-20261013/qa-price-fixtures-v0.7.json','utf8'))
 for(const c of fixture.renewal_contract_cases){
  const selections=[{lineId:c.id,...c.selection}]
  assert.equal(price(selections).totalPriceCents,c.total_cents,c.id)
  if(c.scope==='LOCAL_PREVIEW_ONLY')assert.throws(()=>price(selections,{}),/PROVISIONAL_PRICE/)
 }
})
test('packaging exemption is before coupons and excludes unpacked cupcakes and all other goods',()=>{
 const a=line('brownie-cupcakes-6',1,{individualPackaging:true}),b={...line('cupcake-dozen',1,{finish:'vanilla-fresh-cream',individualPackaging:true}),lineId:'b'}
 const quote=price([a,b],{localPreview:true,reviewCoupon:{rewardPercent:10}})
 assert.equal(quote.subtotalCents,10000);assert.equal(quote.individualPackagingFeeCents,0);assert.equal(quote.totalPriceCents,9000)
 const unselected=price([a,{...b,individualPackaging:false}])
 assert.equal(unselected.individualPackagingFeeCents,300)
 const mixed=price([a,{...line('mochi',1,{mode:'quantity',counts:[10,0,0,0],individualPackaging:true}),lineId:'m'}])
 assert.equal(mixed.individualPackagingFeeCents,800)
})

test('string field coercion cannot bypass provisional or preorder policy boundaries',()=>{
 for(const [key,value]of [['lineId',['a']],['offerId',['mochi']],['parentLineId',['a']],['size',['8in']],['finish',['basic']]]) {
  const base=key==='offerId'?line('mochi',1,{mode:'signature'}):line('brownie-whole',1,{size:'6in'})
  assert.throws(()=>price([{...base,[key]:value}],{}),undefined,key)
 }
})
