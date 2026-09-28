import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCakeReservation, parseStoredOrderLines } from '../appwrite-functions/reservation-api/src/business.js'
import { calculateIndividualPackagingFeeCents } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import { priceCustomCakeV1Request } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import { readFileSync } from 'node:fs'

const now = new Date('2026-09-25T00:00:00Z')
const input = (orderLines) => ({
  customerName: 'Production policy regression',
  customerPhone: '0412345678',
  customerEmail: 'production-policy@example.com',
  pickupDate: '2099-09-30',
  pickupTime: '10:00',
  privacyConsent: true,
  orderLines,
})
const build = (orderLines) => buildCakeReservation(input(orderLines), { now, cakeCatalogMode: 'required' })

test('Chocolate release preserves active production S’more 450-cent unit and quantity bulk tiers', () => {
  for (const [quantity, percent, discountCents, totalCents] of [
    [1, 0, 0, 450],
    [5, 0, 0, 2250],
    [6, 10, 270, 2430],
    [11, 10, 495, 4455],
    [12, 20, 1080, 4320],
    [50, 20, 4500, 18000],
  ]) {
    const document = build([{ productId: 'smore-stick', quantity }])
    const line = parseStoredOrderLines(document).lines[0]
    assert.equal(line.unitPriceCents, 450, `quantity ${quantity}`)
    assert.equal(line.discountPercent, percent, `quantity ${quantity}`)
    assert.equal(line.discountCents, discountCents, `quantity ${quantity}`)
    assert.equal(line.totalPriceCents, totalCents, `quantity ${quantity}`)
  }
})

test('Chocolate release preserves free individual packaging at selected-product subtotal AUD 100', () => {
  assert.equal(calculateIndividualPackagingFeeCents(12, 9999), 600)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10000), 0)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10001), 0)
  const below = build([{ productId: 'cupcake-dozen', cupcakeFinish: 'basic', individualPackaging: true, quantity: 1 }])
  const above = build([{ productId: 'cupcake-dozen', cupcakeFinish: 'basic', individualPackaging: true, quantity: 2 }])
  assert.equal(below.individualPackagingFeeCents, 600)
  assert.equal(above.individualPackagingFeeCents, 0)
})

test('Chocolate release retains active Cake and Lemon pricing while accepting a Chocolate line', () => {
  const order = build([
    { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    { productId: 'fresh-lemon-cupcakes-6', quantity: 1, chocolateIcingCount: 1 },
    { productId: 'almond-chocoball-80g', quantity: 1 },
  ])
  const lines = parseStoredOrderLines(order).lines
  assert.deepEqual(lines.map((line) => line.unitPriceCents), [3100, 3650, 1200])
})

test('Custom Cake S’more add-ons keep the active 450-cent unit and 30% add-on discount', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url)))
  const request = fixture.request
  request.lines[1].quantity = 10
  const { paidSmoreLines } = priceCustomCakeV1Request(request, { promotionEligibilityAt: '2026-09-30T13:59:59.999Z' })
  assert.deepEqual(
    [paidSmoreLines[0].unitPriceCents, paidSmoreLines[0].discountPercent, paidSmoreLines[0].totalCents],
    [450, 30, 3150],
  )
})
