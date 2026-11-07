import test from 'node:test'
import assert from 'node:assert/strict'
import { RENEWAL_CONTRACT, priceRenewalOrder, normalizeRenewalLines } from '../appwrite-functions/reservation-api/src/au-renewal.js'
const quote = (offerId, size, finish, quantity = 1, options) => priceRenewalOrder([{lineId:'cake',offerId,size,finish,quantity}], options)
for (const [size, base, strawberry] of [['4in',4500,5500],['6in',7500,9300],['8in',10700,13700],['10in',15900,20400]]) {
  test(`v3 pave ${size} basic and strawberries`, () => {
    assert.equal(quote('pave-cake',size,'basic').totalPriceCents,base)
    assert.equal(quote('pave-cake',size,'fresh-strawberries').totalPriceCents,strawberry)
    assert.equal(quote('pave-cake',size,'basic').policyVersion,'au-renewal.2026-11.v3')
  })
}
for (const [size, base, cream, combo] of [['4in',4900,5400,6400],['6in',8200,9200,10700],['8in',11700,13200,15700],['10in',16800,18800,22800]]) {
  test(`v3 basque ${size} exclusive decorations`, () => {
    for (const [finish,total] of [['basic',base],['vanilla-fresh-cream',cream],['vanilla-fresh-cream-strawberries',combo]]) assert.equal(quote('brownie-whole',size,finish).totalPriceCents,total)
  })
}
test('quantity multiplies the complete decoration price once', () => {
 assert.equal(quote('pave-cake','6in','fresh-strawberries',2).totalPriceCents,18600)
 assert.equal(quote('brownie-whole','8in','vanilla-fresh-cream-strawberries',2).totalPriceCents,31400)
})
test('new pave is dark only and whole cake options never leak to other products', () => {
 assert.equal(normalizeRenewalLines([{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1}])[0].chocolateType,'dark')
 assert.throws(()=>priceRenewalOrder([{lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1,chocolateType:'milk'}]),{code:'INVALID_CHOCOLATE_TYPE'})
 for (const [offerId,size,finish] of [['pave-cake','6in','vanilla-fresh-cream'],['brownie-whole','6in','fresh-strawberries'],['brownie-loaf',undefined,'fresh-strawberries'],['brownie-loaf','4in','basic']]) assert.throws(()=>quote(offerId,size,finish))
 assert.equal(priceRenewalOrder([{lineId:'loaf',offerId:'brownie-loaf',quantity:1,finish:'vanilla-fresh-cream'}]).totalPriceCents,6800)
 assert.ok(RENEWAL_CONTRACT.endsWith('v3'))
})
