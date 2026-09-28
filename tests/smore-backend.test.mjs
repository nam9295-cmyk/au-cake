import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildCakeReservation, normalizeCakeOrderLines, parseStoredOrderLines, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
const now = new Date('2026-07-10T00:00:00Z')
const smore = (quantity, extra = {}) => ({ productId: 'smore-stick', quantity, ...extra })
const cake = { productId: 'pave-cake', cakeSize: '6in', quantity: 1 }
const input = (orderLines, extra = {}) => ({ customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com', pickupDate: '2099-07-11', pickupTime: '10:00', privacyConsent: true, orderLines, ...extra })
const build = (lines, options = {}, extra = {}) => buildCakeReservation(input(lines, extra), { now, cakeCatalogMode: 'required', ...options })
const code = expected => error => error.code === expected

test('standalone S’more uses only the published set quantities and fixed prices', () => {
  for (const [quantity, unitPriceCents, totalPriceCents] of [
    [10, 350, 3500],
    [25, 300, 7500],
    [50, 270, 13500],
  ]) {
    const document = build([smore(quantity)])
    const line = parseStoredOrderLines(document).lines[0]
    assert.deepEqual(
      [line.quantity, line.unitPriceCents, line.discountPercent, line.discountCents, line.totalPriceCents],
      [quantity, unitPriceCents, 0, 0, totalPriceCents],
    )
  }

  for (const quantity of [1, 6, 11, 12, 24, 26, 49, 51]) {
    assert.throws(() => build([smore(quantity)]), code('INVALID_QUANTITY'))
  }
})

test('reservation pricing charges individual packaging above AUD 100', () => {
  const document = build([{ productId: 'cupcake-dozen', cupcakeFinish: 'basic', individualPackaging: true, quantity: 2 }])
  assert.equal(document.individualPackagingPieces, 24)
  assert.equal(document.individualPackagingFeeCents, 1200)
  assert.equal(document.totalPriceCents, 12200)
})

test('current Lemon and Gâteau Cupcake packs use fixed prices and free whole-box finishing choices', () => {
  for (const [productId, priceCents] of [
    ['fresh-lemon-cupcakes-6', 3500],
    ['fresh-lemon-cupcakes-12', 6500],
    ['fresh-lemon-cupcakes-24', 12000],
    ['fresh-lemon-cupcakes-48', 22500],
  ]) {
    for (const chocolateIcingCount of [0, Number(productId.split('-').at(-1)) / 2, Number(productId.split('-').at(-1))]) {
      const document = build([{ productId, chocolateIcingCount, quantity: 1 }])
      assert.equal(document.totalPriceCents, priceCents)
      assert.equal(parseStoredOrderLines(document).lines[0].chocolateIcingCount, chocolateIcingCount)
    }
    assert.throws(() => build([{ productId, chocolateIcingCount: 1, quantity: 1 }]), code('INVALID_ICING_COUNT'))
  }

  for (const [productId, prices] of [
    ['cupcake-half-dozen', [3000, 3500, 4000]],
    ['cupcake-dozen', [5500, 6400, 7300]],
    ['cupcake-twenty-four', [10500, 12300, 14000]],
    ['cupcake-forty-eight', [19500, 23000, 26500]],
  ]) {
    for (const [finish, priceCents] of [['basic', prices[0]], ['vanilla-fresh-cream', prices[1]], ['chocolate-buttercream', prices[2]]]) {
      const document = build([{ productId, cupcakeFinish: finish, quantity: 1 }])
      assert.equal(document.totalPriceCents, priceCents)
    }
  }
})

for (const [quantity, unitPriceCents] of [[10, 350], [25, 300], [50, 270]]) {
  test(`smore ${quantity}: server pricing and stored/public roundtrip`, () => {
    const doc = build([smore(quantity)])
    const line = parseStoredOrderLines(doc).lines[0]
    assert.equal(line.unitPriceCents, unitPriceCents)
    assert.equal(doc.quantity, quantity, 'stored quantity equals the actual first-line quantity')
    assert.equal(cakeReservationResponse(doc).quantity, quantity)
    assert.equal(publicCakeReservation(doc).quantity, quantity)
    assert.equal(line.discountPercent, 0)
    assert.equal(line.discountCents, 0)
    assert.equal(doc.totalPriceCents, quantity * unitPriceCents)
    assert.equal(doc.discountPercent, 0)
    assert.equal(doc.discountBasisCents, 0)
    assert.equal(doc.discountCents, 0)
    assert.equal(cakeReservationResponse(doc).promotionKind, 'none')
    assert.equal(publicCakeReservation(doc).orderLines[0].totalPriceCents, doc.totalPriceCents)
  })
}
test('S’more ignores forged pricing and neutralizes irrelevant options', () => {
  const forged = { unitPriceCents: 1, subtotalCents: 1, totalPriceCents: 1, discountPercent: 99, discountCents: 9999, totalPrice: 0, price: 0, chocolateExtraCents: 999, individualPackagingFeeCents: 999, individualPackagingPieces: 999, cakeSize: 'garbage', chocolateType: 'milk', poundAddon: 'vanilla-cream', chocolateExtra: 'garbage', brownieCreamOption: 'garbage', individualPackaging: 'garbage', cupcakeFinish: 'garbage', vanillaCakeFlavor: 'garbage', vanillaCreamCount: 999 }
  const doc = build([smore(10, forged)])
  assert.equal(doc.orderLineCount, 1)
  assert.equal(doc.totalPriceCents, 3500)
  assert.throws(() => build([{ ...cake, unitPriceCents: 1 }]), code('INVALID_ORDER_LINE'))
  assert.throws(() => build([smore(1, { surprise: 1 })]), code('INVALID_ORDER_LINE'))
})
for (const quantity of [0, -1, 1, 6, 11, 12, 24, 26, 49, 51, 1.5, NaN, Infinity, -Infinity, '6', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  test(`smore rejects quantity ${String(quantity)} without coercion`, () => {
    assert.throws(() => build([smore(quantity)]), code('INVALID_QUANTITY'))
    assert.throws(() => buildCakeReservation({ ...input([]), orderLines: undefined, productId: 'smore-stick', quantity }), code('INVALID_ORDER_LINE'))
    const legacy = input([]); delete legacy.orderLines
    assert.throws(() => buildCakeReservation({ ...legacy, ...smore(quantity) }, { now }), code('INVALID_QUANTITY'))
  })
}
test('S’more set quantities cannot be merged into an unpublished quantity', () => {
  assert.throws(() => normalizeCakeOrderLines([smore(10), smore(25)]), code('INVALID_QUANTITY'))
  assert.throws(() => build([{ ...cake, quantity: 6 }]), code('INVALID_QUANTITY'))
  assert.throws(() => build([{ ...cake, quantity: 3 }, { ...cake, quantity: 3 }]), code('INVALID_QUANTITY'))
})
for (const rewardPercent of [5, 10]) for (const quantity of [10, 25, 50]) {
  test(`coupon ${rewardPercent}% excludes smore quantity ${quantity}`, () => {
    const reviewCoupon = { id: rewardPercent === 5 ? 'manual:test' : 'review-test', rewardPercent, codeLast4: 'TEST' }
    assert.throws(() => build([smore(quantity)], { reviewCoupon }), code('PROMO_CODE_INVALID'))
    const doc = build([smore(quantity), cake], { reviewCoupon })
    assert.equal(doc.discountBasisCents, 7900)
    assert.equal(doc.discountPercent, rewardPercent)
    assert.equal(doc.discountCents, 7900 * rewardPercent / 100)
    assert.ok(parseStoredOrderLines(doc))
    assert.equal(publicCakeReservation(doc).totalPriceCents, doc.totalPriceCents)
  })
}
test('static promo stays product-scoped with bulk; promo note excludes bulk savings', () => {
  const doc = build([smore(10), { productId: 'fresh-lemon-cupcakes-6', quantity: 1 }], {}, { promoCode: 'lemoni' })
  assert.equal(doc.discountBasisCents, 3500)
  assert.equal(doc.discountCents, 350)
  assert.match(doc.requestNote, /35\.00 -> 31\.50/)
  assert.equal(cakeReservationResponse(doc).promotionKind, 'static')
  assert.ok(parseStoredOrderLines(doc))
})
test('stored smore tampering fails closed', () => {
  const doc = build([smore(10), cake], { reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'TEST' } })
  for (const change of [{ discountPercent: 10 }, { quantity: 11 }, { unitPriceCents: 1 }, { discountCents: 1 }, { surprise: 1 }]) {
    const payload = JSON.parse(doc.orderLinesJson)
    Object.assign(payload.lines[0], change)
    assert.throws(() => parseStoredOrderLines({ ...doc, orderLinesJson: JSON.stringify(payload) }), code('INVALID_STORED_ORDER'))
  }
})
