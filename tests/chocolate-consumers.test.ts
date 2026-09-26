import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildCakeReservation, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { toReservation, toPublicReservation } from '../src/lib/stored-order-reader.js'
import { formatOrderLineSummary } from '../src/lib/order-lines.js'
import { buildSmsMessage, reservationsToCsv } from '../src/lib/utils.js'
import { OrderDetailRows } from '../src/components/ProductDetailRows.js'

const selections = [
  ['almond-chocoball-80g', 'Almond Chocoball', '80g', 1200],
  ['almond-chocoball-6pack', 'Almond Chocoball 6 Pack', '80g × 6', 6000],
  ['almond-chocoball-black-tub-2x80g', 'Almond Chocoball Black Tub', '80g × 2', 2500],
  ['pave-chocolate-100g', 'Pavé Chocolate', '100g', 1200],
  ['eiffel-tower-chocolate-6', 'Eiffel Tower Chocolate', '6 pieces', 1000],
] as const
function saved(orderLines: unknown[], coupon = false) {
  return { ...buildCakeReservation({
    customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com',
    pickupDate: '2026-09-28', pickupTime: '10:00', privacyConsent: true, orderLines,
  }, { now: new Date('2026-09-26T00:00:00Z'), reservationNumber: 'VG-C-AU-CHOC',
    ...(coupon ? { reviewCoupon: { id: 'review-chocolate', codeLast4: 'AB12', rewardPercent: 10 } } : {}) }), $id: 'chocolate-order' }
}

for (const [productId, name, unit, price] of selections) {
  test(`stored ${productId} retains its sale unit in admin, lookup, CSV, SMS and detail rows`, () => {
    const document = saved([{ productId, quantity: 2 }])
    const admin = toReservation(document as never)
    const lookup = toPublicReservation(publicCakeReservation(document) as never)
    assert.equal(admin.orderLines?.[0].unitPriceCents, price)
    assert.equal(lookup.totalPriceCents, price * 2)
    const outputs = [formatOrderLineSummary(admin.orderLines![0]), buildSmsMessage(admin), reservationsToCsv([admin]),
      renderToStaticMarkup(createElement(OrderDetailRows, { reservation: admin, language: 'en' })),
      renderToStaticMarkup(createElement(OrderDetailRows, { reservation: lookup, language: 'en' }))]
    for (const output of outputs) {
      assert.ok(output.includes(name), output)
      assert.ok(output.includes(unit), output)
      assert.doesNotMatch(output, /15cm|serves 8|Dark chocolate/)
    }
    assert.doesNotMatch(outputs[3], /Cake Size|>Size</)
  })
}

test('mixed stored coupon retains cake extras and excludes the six-pack in both browser readers', () => {
  const document = saved([{ productId: 'pave-cake', cakeSize: '6in', chocolateExtra: 'combo', quantity: 2 },
    { productId: 'almond-chocoball-6pack', quantity: 1 }, { productId: 'pave-chocolate-100g', quantity: 1 }], true)
  const admin = toReservation(document as never)
  const lookup = toPublicReservation(publicCakeReservation(document) as never)
  assert.equal(admin.discountBasisCents, 19000)
  assert.equal(admin.totalPriceCents, 23100)
  assert.equal(lookup.totalPriceCents, 23100)
  for (const output of [buildSmsMessage(admin), reservationsToCsv([admin])]) {
    assert.match(output, /Almond Chocoball 6 Pack · 80g × 6/)
    assert.match(output, /Pavé Chocolate · 100g/)
    assert.match(output, /Chocolate Extra Set/)
  }
})

test('browser stored readers reject forged chocolate price, inert options and six-pack coupon', () => {
  const document = saved([{ productId: 'almond-chocoball-6pack', quantity: 1 }])
  const original = JSON.parse(document.orderLinesJson).lines[0]
  for (const change of [{ unitPriceCents: 1, subtotalCents: 1, totalPriceCents: 1 },
    { cakeSize: '6in' }, { chocolateType: 'milk' }, { chocolateExtra: 'combo', chocolateExtraCents: 2000 },
    { discountPercent: 10, discountCents: 600, totalPriceCents: 5400 }]) {
    const line = { ...original, ...change }
    const forged = { ...document, ...line, totalPrice: line.totalPriceCents / 100,
      discountBasisCents: line.discountPercent ? 6000 : 0,
      ...(line.discountPercent ? { reviewCouponId: 'review-forged', appliedPromoCodeLast4: 'AB12' } : {}),
      orderLinesJson: JSON.stringify({ version: 1, lines: [line] }) }
    assert.throws(() => toReservation(forged as never), /INVALID_STORED_ORDER/)
    const payload = { ...publicCakeReservation(document), ...line, totalPrice: line.totalPriceCents / 100,
      discountBasisCents: forged.discountBasisCents, orderLines: [line] }
    assert.throws(() => toPublicReservation(payload as never), /INVALID_RESERVATION_RESPONSE/)
  }
})
