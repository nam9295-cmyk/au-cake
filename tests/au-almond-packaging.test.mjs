import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALMOND_GIFT_BOX_ID, priceRenewalOrder, renewalLineSummary,
} from '../appwrite-functions/reservation-api/src/au-renewal.js'
import { RENEWAL_CARDS } from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { readRenewalDocument } from '../appwrite-functions/reservation-api/src/au-renewal-reader.js'

const single = { lineId: 'a', offerId: 'almond-chocoball-80g', quantity: 1 }
const gift = { ...single, offerId: ALMOND_GIFT_BOX_ID }
const before = new Date('2026-11-29T12:59:59.999Z')
const starts = new Date('2026-11-29T13:00:00Z')
const last = new Date('2026-12-06T12:59:59.999Z')
const ends = new Date('2026-12-06T13:00:00Z')

test('six packages are ordered in pairs with the correct weight, price and contents', () => {
  const card = RENEWAL_CARDS.chocolates.find(card => card.id === 'almond')
  assert.deepEqual(card.offers, ['almond-chocoball-80g', 'almond-triangle-60g', 'almond-chocoball-6pack',
    'almond-triangle-6pack', 'almond-chocoball-black-tub-2x80g', ALMOND_GIFT_BOX_ID])
  const selections = card.offers.map((offerId, i) => ({ ...single, lineId: 'line' + i, offerId }))
  const { lines } = priceRenewalOrder(selections, { now: ends })
  assert.deepEqual(lines.map(l => l.unitPriceCents), [1200, 1200, 6000, 6000, 2500, 5000])
  assert.deepEqual(lines.map(l => l.physicalQuantity), [1, 1, 6, 6, 2, 4])
  for (const l of lines) {
    const triangle = l.productId.startsWith('almond-triangle')
    assert.match(renewalLineSummary(l), triangle ? /Triangle Box.*60g/ : /80g.*Pouch|Pouches.*80g/)
    assert.throws(() => priceRenewalOrder([{ ...l.selection, almondPackaging: 'triangle-box' }]), /INVALID_PACKAGING/)
  }
})

test('legacy snapshots retain 80g triangles and pack selections with no packaging field', () => {
  for (const selection of [single, { ...single, almondPackaging: 'triangle-box' },
    { ...single, almondPackaging: 'pouch' }, { ...single, offerId: 'almond-chocoball-6pack' }]) {
    const quote = priceRenewalOrder([selection], { storedOnly: true })
    const { lines, version, policyVersion, ...totals } = quote
    const doc = { ...totals, productId: selection.offerId, quantity: 1, orderLineCount: 1,
      orderLinesJson: JSON.stringify({ lines, version, policyVersion, discountPercent: 0 }) }
    const [stored] = readRenewalDocument(doc).lines
    assert.deepEqual(stored, lines[0])
    assert.equal(stored.selection.almondPackaging, selection.almondPackaging)
    assert.match(stored.productName, /80g/)
  }
})

test('sale applies by Sydney order time only; coupons can discount eligible items in a mixed basket', () => {
  for (const [now, price] of [[before, 5000], [starts, 4000], [last, 4000], [ends, 5000]]) {
    const quote = priceRenewalOrder([{ ...gift, quantity: 2 }], { now })
    assert.equal(quote.totalPriceCents, price * 2)
  }
  const reviewCoupon = { rewardPercent: 10 }
  const selections = [gift, { ...single, lineId: 'b' }]
  assert.equal(priceRenewalOrder(selections, { now: starts, reviewCoupon }).totalPriceCents, 5080)
  assert.equal(priceRenewalOrder(selections, { now: ends, reviewCoupon }).totalPriceCents, 5580)
  assert.throws(() => priceRenewalOrder([gift], { now: starts, reviewCoupon }), /PROMO_CODE_INVALID/)
})
