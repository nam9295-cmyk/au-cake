import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCakeReservation, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { buildCakeOrderRequest, getReservationPricingAudit, parseCakeReservationResult } from '../src/lib/review-coupon-client.js'
import { getReservationByNumber, toReservation } from '../src/lib/repository.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import { readFileSync } from 'node:fs'

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

test('pricing audit accepts validated Smore bulk savings separately from promotion savings', () => {
  const cases = [
    generated(6),
    generated(12),
    generated(50),
    buildCakeReservation({ ...customer, orderLines: [
      { productId: 'smore-stick', quantity: 12 },
      { productId: 'pave-cake', cakeSize: '6in', quantity: 1 },
    ] }, { now }),
    buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
      { productId: 'smore-stick', quantity: 12 },
      { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
    ] }, { now }),
    generated(12, 10),
  ]
  for (const document of cases) {
    const reservation = parseCakeReservationResult(response(document))
    assert.deepEqual(getReservationPricingAudit(reservation), {
      subtotalCents: reservation.subtotalCents,
      discountPercent: reservation.discountPercent,
      discountCents: reservation.discountCents,
      totalPriceCents: reservation.totalPriceCents,
      appliedPromoCodeLast4: reservation.appliedPromoCodeLast4 || '',
    })
  }
})

test('pricing audit rejects forged bulk, promotion provenance, basis, and total fields', () => {
  const valid = response(generated(12, 10))
  const mutations = [
    (row: typeof valid) => { row.orderLines[0].discountPercent = 10 },
    (row: typeof valid) => { row.orderLines[0].discountCents += 1; row.orderLines[0].totalPriceCents -= 1; row.discountCents += 1; row.totalPriceCents -= 1; row.totalPrice = row.totalPriceCents / 100 },
    (row: typeof valid) => { row.discountPercent = 5 },
    (row: typeof valid) => { row.discountBasisCents += 1 },
    (row: typeof valid) => { row.appliedPromoCodeLast4 = '' },
    (row: typeof valid) => { row.totalPriceCents += 1; row.totalPrice = row.totalPriceCents / 100 },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(valid)
    mutate(forged)
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/)
  }
})

test('present malformed or removed orderLines cannot fall back to aggregate-only pricing audit', () => {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    { productId: 'smore-stick', quantity: 6 },
  ] }, { now, reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' } })
  const valid = response(document)
  assert.equal(valid.discountCents, Math.round(valid.subtotalCents * valid.discountPercent / 100))
  for (const replacement of [null, {}, 'invalid']) {
    const forged = { ...valid, orderLines: replacement }
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/)
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  }
  const removed = { ...valid }
  delete (removed as Partial<typeof valid>).orderLines
  assert.throws(() => getReservationPricingAudit(removed), /INVALID_RESPONSE/)
  assert.throws(() => parseCakeReservationResult(removed), /INVALID_RESPONSE/)
})

test('CompletePage sends a server-authoritative Smore bulk reservation through the validated pricing audit', () => {
  const reservation = parseCakeReservationResult(response(generated(12)))
  assert.doesNotThrow(() => getReservationPricingAudit(reservation))
  const completePage = readFileSync('src/pages/CompletePage.tsx', 'utf8')
  assert.match(completePage, /getReservationPricingAudit\(reservation\)/)
  assert.match(completePage, /pricingAudit\.discountCents/)
})
