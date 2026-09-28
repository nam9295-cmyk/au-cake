import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildCakeReservation, canonicalCakeRequestPayload, normalizeCakeOrderLines, parseStoredOrderLines, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
const now = new Date('2026-07-10T00:00:00Z')
const smore = (quantity, extra = {}) => ({ productId: 'smore-stick', quantity, ...extra })
const cake = { productId: 'pave-cake', cakeSize: '6in', quantity: 1 }
const input = (orderLines, extra = {}) => ({ customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com', pickupDate: '2099-07-11', pickupTime: '10:00', privacyConsent: true, orderLines, ...extra })
const build = (lines, options = {}, extra = {}) => buildCakeReservation(input(lines, extra), { now, cakeCatalogMode: 'required', ...options })
const code = expected => error => error.code === expected
for (const quantity of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 24, 50, 99, 100, 1000]) {
  test(`smore ${quantity}: server pricing and stored/public roundtrip`, () => {
    const doc = build([smore(quantity)])
    const percent = quantity >= 12 ? 20 : quantity >= 6 ? 10 : 0
    const discount = quantity * 450 * percent / 100
    const line = parseStoredOrderLines(doc).lines[0]
    assert.equal(line.unitPriceCents, 450)
    assert.equal(doc.quantity, quantity, 'stored quantity equals the actual first-line quantity')
    assert.equal(cakeReservationResponse(doc).quantity, quantity)
    assert.equal(publicCakeReservation(doc).quantity, quantity)
    assert.equal(line.discountPercent, percent)
    assert.equal(line.discountCents, discount)
    assert.equal(doc.totalPriceCents, quantity * 450 - discount)
    assert.equal(doc.discountPercent, 0)
    assert.equal(doc.discountBasisCents, 0)
    assert.equal(doc.discountCents, discount)
    assert.equal(cakeReservationResponse(doc).promotionKind, 'none')
    assert.equal(publicCakeReservation(doc).orderLines[0].totalPriceCents, doc.totalPriceCents)
  })
}
test('merge smore before tiering; ignore known forged pricing and neutralize irrelevant options', () => {
  const forged = { unitPriceCents: 1, subtotalCents: 1, totalPriceCents: 1, discountPercent: 99, discountCents: 9999, totalPrice: 0, price: 0, chocolateExtraCents: 999, individualPackagingFeeCents: 999, individualPackagingPieces: 999, cakeSize: 'garbage', chocolateType: 'milk', poundAddon: 'vanilla-cream', chocolateExtra: 'garbage', brownieCreamOption: 'garbage', individualPackaging: 'garbage', cupcakeFinish: 'garbage', vanillaCakeFlavor: 'garbage', vanillaCreamCount: 999 }
  const doc = build([smore(5, forged), smore(7)])
  assert.equal(doc.orderLineCount, 1)
  assert.equal(doc.totalPriceCents, 4320)
  assert.deepEqual(canonicalCakeRequestPayload(input([smore(12)])), canonicalCakeRequestPayload(input([smore(5, forged), smore(7)])))
  assert.throws(() => build([{ ...cake, unitPriceCents: 1 }]), code('INVALID_ORDER_LINE'))
  assert.throws(() => build([smore(1, { surprise: 1 })]), code('INVALID_ORDER_LINE'))
})
for (const quantity of [0, -1, 1.5, NaN, Infinity, -Infinity, '6', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  test(`smore rejects quantity ${String(quantity)} without coercion`, () => {
    assert.throws(() => build([smore(quantity)]), code('INVALID_QUANTITY'))
    assert.throws(() => buildCakeReservation({ ...input([]), orderLines: undefined, productId: 'smore-stick', quantity }), code('INVALID_ORDER_LINE'))
    const legacy = input([]); delete legacy.orderLines
    assert.throws(() => buildCakeReservation({ ...legacy, ...smore(quantity) }, { now }), code('INVALID_QUANTITY'))
  })
}
test('technical money and merged quantity overflow protection, not a business maximum', () => {
  assert.throws(() => build([smore(Number.MAX_SAFE_INTEGER)]), code('ORDER_AMOUNT_OVERFLOW'))
  assert.throws(() => normalizeCakeOrderLines([smore(Number.MAX_SAFE_INTEGER), smore(1)]), code('INVALID_QUANTITY'))
  const max = Math.floor(Number.MAX_SAFE_INTEGER / 450)
  const doc = build([smore(max)])
  assert.equal(doc.totalPriceCents, Number(BigInt(max) * 360n))
  assert.ok(parseStoredOrderLines(doc))
  assert.throws(() => build([smore(max), cake]), code('ORDER_AMOUNT_OVERFLOW'))
  assert.throws(() => build([{ ...cake, quantity: 6 }]), code('INVALID_QUANTITY'))
  assert.throws(() => build([{ ...cake, quantity: 3 }, { ...cake, quantity: 3 }]), code('INVALID_QUANTITY'))
})
for (const rewardPercent of [5, 10]) for (const quantity of [1, 5, 6, 11, 12, 24]) {
  test(`coupon ${rewardPercent}% excludes smore quantity ${quantity}`, () => {
    const reviewCoupon = { id: rewardPercent === 5 ? 'manual:test' : 'review-test', rewardPercent, codeLast4: 'TEST' }
    assert.throws(() => build([smore(quantity)], { reviewCoupon }), code('PROMO_CODE_INVALID'))
    const doc = build([smore(quantity), cake], { reviewCoupon })
    const bulk = quantity * (quantity >= 12 ? 90 : quantity >= 6 ? 45 : 0)
    assert.equal(doc.discountBasisCents, 7900)
    assert.equal(doc.discountPercent, rewardPercent)
    assert.equal(doc.discountCents, bulk + 7900 * rewardPercent / 100)
    assert.ok(parseStoredOrderLines(doc))
    assert.equal(publicCakeReservation(doc).totalPriceCents, doc.totalPriceCents)
  })
}
test('static promo stays product-scoped with bulk; promo note excludes bulk savings', () => {
  const doc = build([smore(12), { productId: 'fresh-lemon-cupcakes-6', quantity: 1 }], {}, { promoCode: 'lemoni' })
  assert.equal(doc.discountBasisCents, 3600)
  assert.equal(doc.discountCents, 1440)
  assert.match(doc.requestNote, /36\.00 -> 32\.40/)
  assert.equal(cakeReservationResponse(doc).promotionKind, 'static')
  assert.ok(parseStoredOrderLines(doc))
})
test('stored smore tampering fails closed', () => {
  const doc = build([smore(12), cake], { reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'TEST' } })
  for (const change of [{ discountPercent: 10 }, { quantity: 11 }, { unitPriceCents: 1 }, { discountCents: 540 }, { surprise: 1 }]) {
    const payload = JSON.parse(doc.orderLinesJson)
    Object.assign(payload.lines[0], change)
    assert.throws(() => parseStoredOrderLines({ ...doc, orderLinesJson: JSON.stringify(payload) }), code('INVALID_STORED_ORDER'))
  }
})
