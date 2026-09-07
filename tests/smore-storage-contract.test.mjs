import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCakeReservation, parseStoredOrderLines } from '../appwrite-functions/reservation-api/src/business.js'

for (const [quantity, expectedCents] of [[1, 450], [5, 2250], [6, 2430], [11, 4455], [12, 4320], [20, 7200], [50, 18000], [100, 36000]]) {
  test(`approved price boundary ${quantity} sticks is exactly ${expectedCents} cents`, () => {
    const document = buildCakeReservation({
      customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'customer@example.com',
      pickupDate: '2099-07-11', pickupTime: '12:00', privacyConsent: true,
      totalPrice: 0.01, subtotal: 1, discount: 99,
      orderLines: [{ productId: 'smore-stick', quantity, unitPrice: 0.01, totalPriceCents: 1, discountPercent: 99 }],
    }, { now: new Date('2099-07-01T00:00:00.000Z') })
    assert.equal(document.quantity, quantity)
    assert.equal(document.orderItemCount, quantity)
    assert.equal(document.totalPriceCents, expectedCents)
    assert.equal(parseStoredOrderLines(document).lines[0].totalPriceCents, expectedCents)
  })
}

test('Smore stored first-line projection preserves the actual stick quantity, not a dummy 1', () => {
  const document = buildCakeReservation({
    customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'customer@example.com',
    pickupDate: '2099-07-11', pickupTime: '12:00', privacyConsent: true,
    orderLines: [{ productId: 'smore-stick', quantity: 50 }],
  }, { now: new Date('2099-07-01T00:00:00.000Z') })
  assert.equal(document.quantity, 50)
  assert.equal(document.quantity, parseStoredOrderLines(document).lines[0].quantity)
  assert.equal(document.orderItemCount, 50)
  for (const forged of [{ quantity: 1 }, { quantity: '50' }, { orderItemCount: 1 }]) {
    assert.throws(() => parseStoredOrderLines({ ...document, ...forged }), /INVALID_STORED_ORDER/)
  }
})

test('normal cake quantity five remains accepted and six rejected', () => {
  const input = { customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'customer@example.com',
    pickupDate: '2099-07-11', pickupTime: '12:00', privacyConsent: true }
  const options = { now: new Date('2099-07-01T00:00:00.000Z') }
  const order = quantity => ({ ...input, orderLines: [{ productId: 'pave-cake', quantity }] })
  assert.equal(buildCakeReservation(order(5), options).quantity, 5)
  assert.throws(() => buildCakeReservation(order(6), options), /INVALID_QUANTITY/)
})
