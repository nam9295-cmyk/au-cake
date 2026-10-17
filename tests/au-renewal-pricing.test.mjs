import test from 'node:test'
import assert from 'node:assert/strict'
const core = await import('../appwrite-functions/reservation-api/src/au-renewal.js').catch(() => ({}))
const line = (offerId, quantity = 1, options = {}) => ({ lineId: 'a', offerId, quantity, ...options })
const price = (lines, options = { localPreview: true }) => core.priceRenewalOrder(lines, options)
test('renewal contract is available separately from historical contracts', () => {
  assert.equal(typeof core.priceRenewalOrder, 'function')
})
test('all whole cake sizes use confirmed prices outside local preview', () => {
  for (const [offerId, size, expected] of [['pave-cake','6in',7500],['pave-cake','8in',10700],['pave-cake','10in',15900],['brownie-whole','6in',8200],['brownie-whole','8in',11700],['brownie-whole','10in',16800]]) {
    const quote = price([line(offerId,1,{size})],{})
    assert.equal(quote.totalPriceCents, expected)
    assert.equal(quote.lines[0].priceStatus,'confirmed')
    if(offerId==='brownie-whole') assert.equal(price([line(offerId,2,{size,finish:'vanilla-fresh-cream'})],{}).totalPriceCents,2*(expected+1000))
  }
  assert.equal(price([line('brownie-loaf',2,{finish:'vanilla-fresh-cream'})]).totalPriceCents,13600)
  assert.throws(() => price([line('brownie-cupcakes-6')],{}), /PROVISIONAL_PRICE/)
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
const flavours = (values = {}) => ({strawberry:0,green_grape:0,mandarin:0,banana:0,butter_redbean:0,nama_chocolate:0,...values})
const mochi = (id, mode, values, quantity=1, individualPackaging=false) => ({lineId:id,offerId:'mochi',mode,flavourCounts:flavours(values),quantity,individualPackaging})
test('six-flavour gift boxes and singles keep compositions and charge only selected physical packaging',()=>{
 for(const [values,expected] of [[{nama_chocolate:4},3200],[{strawberry:4},4000],[{strawberry:1,green_grape:1,banana:1,nama_chocolate:1},3650],[{mandarin:2,butter_redbean:2},3500]]){
  const q=price([mochi('a','gift-four',values)],{})
  assert.equal(q.totalPriceCents,expected);assert.equal(q.lines[0].giftBoxCount,1);assert.equal(q.lines[0].physicalQuantity,4);assert.equal(q.individualPackagingFeeCents,0)
 }
 const mixed=price([mochi('a','gift-four',{strawberry:1,green_grape:1,banana:1,nama_chocolate:1},2),mochi('b','gift-four',{mandarin:2,butter_redbean:2}),mochi('c','singles',{nama_chocolate:3},1,true)],{})
 assert.equal(mixed.policyVersion,'au-renewal.2026-10.v2');assert.equal(mixed.totalPriceCents,13350)
 assert.deepEqual(mixed.lines.map(l=>l.giftBoxCount),[2,1,0]);assert.deepEqual(mixed.lines.map(l=>l.physicalQuantity),[8,4,3])
 assert.deepEqual(mixed.lines[0].flavourTotals,[2,2,0,2,0,2]);assert.equal(mixed.individualPackagingFeeCents,150)
 for(const n of [4,8,200]){
  const q=price([mochi('a','singles',{strawberry:n},1,true)],{})
  assert.equal(q.totalPriceCents,n*1050);assert.equal(q.lines[0].giftBoxCount,0);assert.equal(q.individualPackagingFeeCents,n*50)
 }
})
test('mochi rejects legacy modes, invalid counts, packaging combinations, overflow and client prices',()=>{
 for(const mode of ['signature','custom-four','quantity'])assert.throws(()=>price([line('mochi',1,{mode,counts:[1,1,1,1]})]))
 for(const n of [0,3,5])assert.throws(()=>price([mochi('a','gift-four',{strawberry:n})]))
 assert.throws(()=>price([mochi('a','singles',{})]))
 assert.throws(()=>price([mochi('a','singles',{strawberry:1},2)]),/INVALID_QUANTITY/)
 assert.throws(()=>price([mochi('a','gift-four',{strawberry:4},1,true)]),/INVALID_PACKAGING/)
 for(const n of [-1,0.5,Infinity,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>price([mochi('a','singles',{strawberry:n})]))
 for(const extra of [{unknown:1},{strawberry:'1'}])assert.throws(()=>price([mochi('a','singles',extra)]))
 for(const key of ['price','total','giftBoxCount','packagingFee'])assert.throws(()=>price([{...mochi('a','gift-four',{strawberry:4}),[key]:0}]))
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
  else assert.equal(price(selections,{}).totalPriceCents,c.total_cents,c.id)
 }
})
test('packaging exemption is before coupons and excludes unpacked cupcakes and all other goods',()=>{
 const a=line('brownie-cupcakes-6',1,{individualPackaging:true}),b={...line('cupcake-dozen',1,{finish:'vanilla-fresh-cream',individualPackaging:true}),lineId:'b'}
 const quote=price([a,b],{localPreview:true,reviewCoupon:{rewardPercent:10}})
 assert.equal(quote.subtotalCents,10000);assert.equal(quote.individualPackagingFeeCents,0);assert.equal(quote.totalPriceCents,9000)
 const unselected=price([a,{...b,individualPackaging:false}])
 assert.equal(unselected.individualPackagingFeeCents,300)
 const mixed=price([a,mochi('m','singles',{strawberry:10},1,true)])
 assert.equal(mixed.individualPackagingFeeCents,800)
})

test('string field coercion cannot bypass provisional or preorder policy boundaries',()=>{
 for(const [key,value]of [['lineId',['a']],['offerId',['mochi']],['parentLineId',['a']],['size',['8in']],['finish',['basic']]]) {
  const base=key==='offerId'?mochi('a','gift-four',{strawberry:4}):line('brownie-whole',1,{size:'6in'})
  assert.throws(()=>price([{...base,[key]:value}],{}),undefined,key)
 }
})

test('deployed almond snapshots retain exact prices, names and contents but cannot be ordered anew',async()=>{
 const {readFile}=await import('node:fs/promises')
 const old=JSON.parse(await readFile('tests/fixtures/au-renewal-amande-quote.json','utf8'))
 assert.deepEqual(core.priceRenewalOrder(old.lines.map(l=>l.selection),{storedOnly:true}),old)
 assert.throws(()=>price(old.lines.map(l=>l.selection)),/INVALID_MOCHI_COUNTS/)
 assert.match(core.renewalLineSummary(old.lines[0]),/Each box:.*Amande Chocolat ×1/)
 assert.doesNotMatch(core.renewalLineSummary(old.lines[0]),/Banana/)
})
test('stored almond document remains readable without mutating its facts',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {readRenewalDocument}=await import('../appwrite-functions/reservation-api/src/au-renewal-reader.js')
 const q=JSON.parse(await readFile('tests/fixtures/au-renewal-amande-quote.json','utf8'))
 const row={...q,productId:q.lines[0].productId,quantity:q.lines[0].quantity,orderLineCount:q.lines.length,orderLinesJson:JSON.stringify({version:2,policyVersion:q.policyVersion,lines:q.lines,discountPercent:q.discountPercent})}
 const before=JSON.stringify(row);assert.deepEqual(readRenewalDocument(row),q);assert.equal(JSON.stringify(row),before)
})
