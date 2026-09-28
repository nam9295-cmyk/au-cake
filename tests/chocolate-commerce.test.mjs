import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCakeOrderLines, canonicalCakeRequestPayload, normalizeCakeOrderV2Request } from '../appwrite-functions/reservation-api/src/cake-order-input.js'
import { priceCakeOrderLines } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import { buildCakeReservation, parseStoredOrderLines } from '../appwrite-functions/reservation-api/src/business.js'
import { createCake } from '../appwrite-functions/reservation-api/src/main.js'
import { AppwriteException } from './reservation-sdk.mjs'

const now = new Date('2026-09-26T00:00:00Z')
const coupon = { id: 'review-chocolate', codeLast4: 'AB12', rewardPercent: 10 }
const skus = ['almond-chocoball-80g', 'almond-chocoball-6pack', 'almond-chocoball-black-tub-2x80g', 'pave-chocolate-100g', 'eiffel-tower-chocolate-6']
const all = skus.map(productId => ({ productId, quantity: 1 }))
const common = { customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com', pickupDate: '2026-09-28', pickupTime: '10:00', privacyConsent: true }
const price = (lines, reviewCoupon) => priceCakeOrderLines(normalizeCakeOrderLines(lines, { cakeCatalogMode: 'required' }), '', now, reviewCoupon)
const build = (lines, reviewCoupon) => buildCakeReservation({ ...common, orderLines: lines }, { now, reservationNumber: 'VG-CHOC-TEST', reviewCoupon, cakeCatalogMode: 'required' })
const rejects = (code, fn) => assert.throws(fn, error => error.code === code)

test('five standalone sale units receive their own server prices and survive stored validation', () => {
  assert.deepEqual(price(all).lines.map(line => line.unitPriceCents), [1200, 6000, 2500, 1200, 1000])
  const saved = build(all)
  assert.deepEqual(parseStoredOrderLines(saved).lines.map(line => line.unitPriceCents), [1200, 6000, 2500, 1200, 1000])
})

test('five single bags remain distinct from a six-pack and two packs cost 120 dollars', () => {
  const singles = price([{ productId: skus[0], quantity: 5 }])
  assert.equal(singles.subtotalCents, 6000)
  assert.equal(singles.lines[0].productId, skus[0])
  assert.equal(price([{ productId: skus[1], quantity: 1 }]).subtotalCents, 6000)
  assert.equal(price([{ productId: skus[1], quantity: 2 }]).subtotalCents, 12000)
})

test('review coupon excludes the six-pack in chocolate and mixed cake orders', () => {
  const chocolates = price(all, coupon)
  assert.equal(chocolates.subtotalCents, 11900)
  assert.equal(chocolates.discountBasisCents, 5900)
  assert.equal(chocolates.discountCents, 590)
  const mixed = [{ productId: 'pave-cake', cakeSize: '6in', chocolateExtra: 'combo', quantity: 1 }, ...all]
  const result = price(mixed, coupon)
  assert.equal(result.subtotalCents, 21800)
  assert.equal(result.discountBasisCents, 15800)
  assert.equal(result.discountCents, 1580)
  assert.equal(parseStoredOrderLines(build(mixed, coupon)).lines.find(line => line.productId === skus[1]).discountCents, 0)
  assert.equal(price([{ ...mixed[0], quantity: 2 }], coupon).subtotalCents, 17800)
  rejects('PROMO_CODE_INVALID', () => price([all[1]], coupon))
})

test('manual five-percent coupons use only eligible chocolate and cake subtotals', () => {
  const manual = { ...coupon, id: 'manual:chocolate', rewardPercent: 5 }
  const chocolates = price(all, manual)
  assert.equal(chocolates.discountBasisCents, 5900)
  assert.equal(chocolates.discountCents, 295)
  assert.equal(chocolates.totalPriceCents, 11605)
  const mixed = [{ productId: 'pave-cake', cakeSize: '6in', chocolateExtra: 'combo', quantity: 1 }, ...all]
  assert.equal(price(mixed, manual).discountBasisCents, 15800)
  assert.equal(price(mixed, manual).discountCents, 790)
  assert.equal(parseStoredOrderLines(build(mixed, manual)).lines.find(line => line.productId === skus[1]).discountCents, 0)
})

test('chocolate sale-unit bounds, merged bounds, unknown IDs, options and client money are rejected', () => {
  for (const quantity of [0, 1.5, 6]) rejects('INVALID_QUANTITY', () => price([{ ...all[0], quantity }]))
  rejects('INVALID_QUANTITY', () => price([{ ...all[0], quantity: 3 }, { ...all[0], quantity: 3 }]))
  rejects('INVALID_PRODUCT', () => price([{ productId: 'unknown-chocolate', quantity: 1 }]))
  for (const options of [{ cakeSize: '6in' }, { chocolateExtra: 'combo' }, { chocolateType: 'milk' }, { individualPackaging: true }, { chocolateIcingCount: 1 }, { poundAddon: 'extra-chocolate' }]) {
    rejects('INVALID_ORDER_LINE', () => price([{ ...all[0], ...options }]))
  }
  for (const money of [{ unitPriceCents: 1 }, { totalPrice: 1 }]) {
    rejects('INVALID_ORDER_LINE', () => price([{ ...all[0], ...money }]))
    rejects('INVALID_ORDER_LINE', () => buildCakeReservation({ ...common, ...all[0], ...money }, { now }))
  }
  rejects('INVALID_ORDER_LINE', () => buildCakeReservation({ ...common, ...all[0], cacaoPercent: '70' }, { now }))
})

test('canonical replay merges equivalent chocolate inputs without promoting singles', () => {
  const one = canonicalCakeRequestPayload({ ...common, orderLines: [{ ...all[0], quantity: 2 }] })
  const split = canonicalCakeRequestPayload({ ...common, orderLines: [all[0], all[0]] })
  assert.deepEqual(one, split)
  assert.notDeepEqual(one, canonicalCakeRequestPayload({ ...common, orderLines: [{ ...all[1], quantity: 2 }] }))
})

for (const [label, quantity] of [['true', true], ['false', false], ['array', [2]], ['numeric string', '2'], ['null', null], ['fraction', 1.5], ['unsafe integer', Number.MAX_SAFE_INTEGER + 1]]) {
  test(`chocolate single and multi requests reject ${label} quantities before pricing and canonical replay`, () => {
    const line = { ...all[0], quantity }
    for (const request of [{ ...common, ...line }, { ...common, orderLines: [line] }]) {
      rejects('INVALID_QUANTITY', () => buildCakeReservation(request, { now }))
      rejects('INVALID_QUANTITY', () => canonicalCakeRequestPayload(request))
    }
  })
}

test('chocolate single and multi requests accept integer sale units while existing cake string quantity remains compatible', () => {
  for (const quantity of [1, 2, 5]) {
    const line = { ...all[0], quantity }
    for (const request of [{ ...common, ...line }, { ...common, orderLines: [line] }]) {
      assert.equal(buildCakeReservation(request, { now }).quantity, quantity)
      assert.equal(canonicalCakeRequestPayload(request).orderLines[0].quantity, quantity)
    }
  }
  const cake = { ...common, productId: 'pave-cake', cakeSize: '6in', quantity: '2' }
  assert.equal(buildCakeReservation(cake, { now }).quantity, 2)
  assert.equal(canonicalCakeRequestPayload(cake).orderLines[0].quantity, 2)
})

test('stored chocolate prices and inert options remain strictly validated', () => {
  const saved = build(all, coupon)
  for (const mutation of [{ unitPriceCents: 1199 }, { cakeSize: '6in' }, { discountCents: 1 }, { chocolateExtra: 'combo', chocolateExtraCents: 2000 }]) {
    const payload = JSON.parse(saved.orderLinesJson)
    Object.assign(payload.lines[0], mutation)
    assert.throws(() => parseStoredOrderLines({ ...saved, orderLinesJson: JSON.stringify(payload) }))
  }
  const single = build([all[0]])
  const wrongPrice = JSON.parse(single.orderLinesJson)
  Object.assign(wrongPrice.lines[0], { unitPriceCents: 1300, subtotalCents: 1300, totalPriceCents: 1300 })
  assert.throws(() => parseStoredOrderLines({ ...single, subtotalCents: 1300, totalPriceCents: 1300, totalPrice: 13, orderLinesJson: JSON.stringify(wrongPrice) }))
  const sixpack = build([all[1]])
  const wrongDiscount = JSON.parse(sixpack.orderLinesJson)
  Object.assign(wrongDiscount.lines[0], { discountPercent: 10, discountCents: 600, totalPriceCents: 5400 })
  assert.throws(() => parseStoredOrderLines({ ...sixpack, reviewCouponId: coupon.id, appliedPromoCodeLast4: coupon.codeLast4, discountPercent: 10, discountBasisCents: 6000, discountCents: 600, totalPriceCents: 5400, totalPrice: 54, orderLinesJson: JSON.stringify(wrongDiscount) }))
})

test('chocolate create retries return the first receipt and reject changed SKU identity', async () => {
  const documents = new Map()
  let creates = 0
  const databases = {
    async getDocument({ documentId }) {
      if (!documents.has(documentId)) throw new AppwriteException('Not found', 404, 'document_not_found')
      return documents.get(documentId)
    },
    async listDocuments() { return { documents: [] } },
    async createDocument({ documentId, data }) {
      creates += 1
      const document = { $id: documentId, ...data }
      documents.set(documentId, document)
      return document
    },
  }
  const runtimeConfig = { cakeDatabaseId: 'cakes', cakeReservationsId: 'reservations', reviewCouponsId: 'review_coupons', manualCouponsId: 'manual_coupons', reviewCouponHmacSecret: Buffer.alloc(32, 7), cakeCatalogMode: 'required' }
  const request = { ...common, ...all[0], quantity: 2, requestId: 'f65f7e08-20f7-4b4a-b12a-6b42c043b268' }
  const first = await createCake(databases, request, { now, runtimeConfig })
  const retry = await createCake(databases, { ...common, orderLines: [all[0], all[0]], requestId: request.requestId }, { now, runtimeConfig })
  assert.equal(creates, 1)
  assert.equal(first.totalPriceCents, 2400)
  assert.deepEqual(retry, first)
  await assert.rejects(createCake(databases, { ...request, productId: skus[1] }, { now, runtimeConfig }), error => error.code === 'REQUEST_ID_CONFLICT')
})

test('cake-order.v2 rejects chocolate even with valid cake option transport', () => {
  const options = normalizeCakeOrderLines([{ productId: 'pave-cake', cakeSize: '6in', quantity: 1 }])[0]
  delete options.productId
  delete options.quantity
  const request = { contractVersion: 'cake-order.v2', requestId: '11111111-1111-4111-8111-111111111111', customer: { customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com' }, pickup: { pickupDate: '2026-09-28', pickupTime: '10:00' }, requestNote: '', promoCode: '', privacyConsent: true, lines: [{ kind: 'cake', lineId: 'line1', parentCakeLineId: null, productId: 'pave-cake', quantity: 1, options }] }
  assert.doesNotThrow(() => normalizeCakeOrderV2Request(request))
  request.lines[0].productId = skus[0]
  rejects('INVALID_REQUEST', () => normalizeCakeOrderV2Request(request))
})
