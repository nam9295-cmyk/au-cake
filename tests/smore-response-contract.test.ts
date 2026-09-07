import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCakeReservation, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { buildCakeOrderRequest, parseCakeReservationResult } from '../src/lib/review-coupon-client.js'
import { getReservationByNumber, toReservation } from '../src/lib/repository.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'

const now = new Date('2026-09-07T00:00:00.000Z')
const customer = { customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com', pickupDate: '2026-09-12', pickupTime: '10:00', privacyConsent: true, requestNote: '', website: '' }
function generated(quantity: number, reward?: 5 | 10) {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'smore-stick', quantity },
    ...(reward ? [{ productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 }] : []),
  ] }, { now, ...(reward ? { reviewCoupon: { id: reward === 5 ? 'manual:test' : 'review-test', rewardPercent: reward, codeLast4: 'ABCD' } } : {}) })
  return document
}
function response(document: ReturnType<typeof generated>) {
  return cakeReservationResponse(document)
}
async function lookup(row: unknown, number: string) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify([row]) } })
  try { return await getReservationByNumber(number, customer.customerPhone) }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete (globalThis as { localStorage?: Storage }).localStorage
  }
}
for (const quantity of [1, 5, 6, 11, 12, 50, 100, 1000000, Math.floor(Number.MAX_SAFE_INTEGER / 450)]) {
  test(`actual backend smore quantity ${quantity} survives create/admin/lookup with deterministic bulk`, async () => {
    const document = generated(quantity)
    assert.equal(document.quantity, quantity)
    assert.equal(document.orderItemCount, quantity)
    assert.equal(JSON.parse(document.orderLinesJson).lines[0].quantity, quantity)
    const result = response(document)
    const rate = quantity >= 12 ? 20 : quantity >= 6 ? 10 : 0
    assert.equal(result.orderLines[0].discountPercent, rate)
    const created = parseCakeReservationResult(result)
    const admin = toReservation({ ...document, $id: 'test' } as never)
    assert.equal(created.quantity, quantity)
    assert.equal(admin.quantity, quantity)
    const updated = buildAdminReservationUpdate(admin, { status: '픽업완료' })
    assert.equal(updated.quantity, quantity)
    assert.equal(toReservation({ ...document, ...updated, $id: 'test' } as never).quantity, quantity)
    assert.equal(created.discountPercent, 0)
    assert.equal(created.discountBasisCents, 0)
    assert.equal(created.discountCents, quantity * (450 * rate / 100))
    assert.equal((await lookup({ ...admin, ...publicCakeReservation(document) }, document.reservationNumber))?.quantity, quantity)
  })
}
for (const reward of [5, 10] as const) {
  for (const quantity of [1, 6, 12]) {
    test(`mixed ${quantity} smore + ${reward}% coupon preserves isolated promotion basis`, async () => {
      const document = generated(quantity, reward)
      const result = response(document)
      const created = parseCakeReservationResult(result)
      const admin = toReservation({ ...document, $id: 'test' } as never)
      assert.equal(created.discountBasisCents, result.orderLines[1].subtotalCents)
      assert.equal(created.discountCents, result.orderLines.reduce((sum: number, line: { discountCents: number }) => sum + line.discountCents, 0))
      assert.equal((await lookup({ ...admin, ...publicCakeReservation(document) }, document.reservationNumber))?.discountCents, created.discountCents)
      assert.doesNotThrow(() => buildCakeOrderRequest({ ...customer, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', orderLines: result.orderLines.map((line: object) => ({ ...line, individualPackaging: false })) } as never))
    })
  }
}
test('create/admin/lookup reject balanced forged bulk discounts and promo inclusion', async () => {
  for (const reward of [undefined, 5, 10] as const) {
    const document = generated(12, reward)
    for (const delta of [-1, 1]) {
      const forged = response(document)
      forged.orderLines[0].discountCents += delta
      forged.orderLines[0].totalPriceCents -= delta
      forged.discountCents += delta
      forged.totalPriceCents -= delta
      forged.totalPrice = forged.totalPriceCents / 100
      assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
      assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
      await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
    }
  }
})
test('smore bulk is never reclassified as a coupon, even when both rates are 10%', async () => {
  const document = generated(6, 10)
  const base = response(document)
  const mutations = [
    (row: typeof base) => { row.discountBasisCents += row.orderLines[0].subtotalCents },
    (row: typeof base) => { row.orderLines[0].discountPercent = 5 },
    (row: typeof base) => { row.discountPercent = 20 },
    (row: typeof base) => { row.totalPriceCents += 1; row.totalPrice = row.totalPriceCents / 100 },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(base)
    mutate(forged)
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
    assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
    await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
  }
})
test('smore-only forged coupon provenance is rejected by all readers', async () => {
  const document = generated(1)
  const forged = response(document)
  forged.promotionKind = 'review-reward'
  forged.appliedPromoCodeLast4 = 'ABCD'
  forged.discountPercent = 10
  forged.discountBasisCents = forged.subtotalCents
  forged.discountCents = 45
  forged.totalPriceCents -= 45
  forged.totalPrice = forged.totalPriceCents / 100
  forged.orderLines[0].discountPercent = 10
  forged.orderLines[0].discountCents = 45
  forged.orderLines[0].totalPriceCents -= 45
  assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, reviewCouponId: 'review-test', orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
  await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
})
test('admin rejects inconsistent smore stored quantities including the discarded sentinel', () => {
  const document = generated(12)
  for (const quantity of [0, 1, 2, '12', null]) {
    assert.throws(() => toReservation({ ...document, quantity, $id: 'test' } as never), /INVALID_STORED_ORDER|INVALID_RESERVATION_RESPONSE/)
  }
})
test('normal product quantities remain capped and unsafe smore amounts rejected', () => {
  const result = response(generated(12, 10))
  for (const quantity of [6, Number.MAX_SAFE_INTEGER]) {
    const forged = structuredClone(result)
    forged.orderLines[1].quantity = quantity
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  }
  const forged = structuredClone(result)
  forged.orderLines[0].quantity = Number.MAX_SAFE_INTEGER
  assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
})
