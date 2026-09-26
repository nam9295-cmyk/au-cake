import assert from 'node:assert/strict'
import test from 'node:test'
import { CHOCOLATE_OPTIONS_V1 } from '../appwrite-functions/reservation-api/src/chocolate-products.js'
import { addCartLine, parseCartLines, serializeCartLines, getCartEstimatedSubtotal } from '../src/lib/cart.js'
import { getCakeDetailSelectionTotal, type CakeDetailSelection } from '../src/lib/cake-detail.js'
import { parseReservationApiCapabilities } from '../src/lib/reservation-health-contract.js'
import { buildCakeReservationRequest } from '../src/lib/review-coupon-client.js'
import { getPromoPriceDisplay } from '../src/lib/review-coupon-client.js'
import { buildCakeOrderRequest, parseCakeReservationResult } from '../src/lib/review-coupon-client.js'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import type { ReservationInput } from '../src/lib/types.js'

const single: CakeDetailSelection = { ...CHOCOLATE_OPTIONS_V1, productId: 'almond-chocoball-80g', quantity: 5 }
test('single bags and six packs keep distinct identities and survive cart storage', () => {
  let lines = addCartLine([], single)
  lines = addCartLine(lines, { ...single, productId: 'almond-chocoball-6pack', quantity: 2 })
  assert.equal(lines.length, 2)
  assert.equal(getCartEstimatedSubtotal(lines), 180)
  assert.deepEqual(parseCartLines(serializeCartLines(lines)), lines)
  assert.equal(addCartLine(lines, single)[0].selection.quantity, 5)
})
test('all five sale units total AUD119 without promoting five single bags', () => {
  const ids = ['almond-chocoball-80g', 'almond-chocoball-6pack', 'almond-chocoball-black-tub-2x80g', 'pave-chocolate-100g', 'eiffel-tower-chocolate-6'] as const
  assert.deepEqual(ids.map(productId => getCakeDetailSelectionTotal({ ...single, productId, quantity: 1 })), [12, 60, 25, 12, 10])
})
test('health distinguishes an old cake backend from chocolate support', () => {
  assert.deepEqual(parseReservationApiCapabilities({ status: 'ready', capabilities: { cakeOrderLines: 1, smoreStoredOrders: 1, smoreWrites: 1, chocolateOrderLines: 1 } }), { cakeOrderLines: 1, chocolateOrderLines: 1 })
  assert.deepEqual(parseReservationApiCapabilities({ status: 'ready', capabilities: { cakeOrderLines: 1 } }), { cakeOrderLines: 1 })
})
test('single chocolate wire omits the unsupported cacao field', () => {
  const input = { ...single, customerEmail: 'a@example.com', cacaoPercent: '기본' } as ReservationInput
  assert.equal(Object.hasOwn(buildCakeReservationRequest(input), 'cacaoPercent'), false)
})
test('mixed chocolate coupon estimates discount only AUD59 of AUD119', () => {
  assert.deepEqual(getPromoPriceDisplay(119, { kind: 'review-pending', normalizedCode: 'REVIEW', discountPercent: 10 }, 5900), { finalPrice: 119, estimatedPrice: 113.1 })
})

test('real server responses and client wire round trip five chocolate SKUs and cake extras', () => {
  const common = { requestId: '11111111-1111-4111-8111-111111111111', customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com', pickupDate: '2099-07-11', pickupTime: '10:00', privacyConsent: true, requestNote: '', website: '' }
  const ids = ['almond-chocoball-80g', 'almond-chocoball-6pack', 'almond-chocoball-black-tub-2x80g', 'pave-chocolate-100g', 'eiffel-tower-chocolate-6'] as const
  const chocolates = ids.map(productId => ({ ...single, productId, quantity: 1 }))
  for (const mixed of [false, true]) {
    const orderLines = mixed ? [{ ...single, productId: 'pave-cake' as const, cakeSize: '6in' as const, chocolateExtra: 'combo' as const, quantity: 1 }, ...chocolates] : chocolates
    const request = buildCakeOrderRequest({ ...common, orderLines })
    for (const rewardPercent of [5, 10]) {
      const document = buildCakeReservation(request, { now: new Date('2026-09-26T00:00:00Z'), reviewCoupon: { id: rewardPercent === 5 ? 'manual:test' : 'review-test', rewardPercent, codeLast4: 'AB12' } })
      const result = parseCakeReservationResult(cakeReservationResponse(document))
      assert.equal(result.subtotalCents, mixed ? 21800 : 11900)
      assert.equal(result.discountBasisCents, mixed ? 15800 : 5900)
      assert.equal(result.discountCents, mixed ? rewardPercent === 5 ? 790 : 1580 : rewardPercent === 5 ? 295 : 590)
      const sixpack = result.orderLines!.find(line => line.productId === 'almond-chocoball-6pack')!
      assert.equal(sixpack.discountCents, 0)
      const forged = structuredClone(cakeReservationResponse(document))
      forged.orderLines.find((line: { productId: string }) => line.productId === 'almond-chocoball-6pack').discountPercent = rewardPercent
      assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
    }
  }
  const input = { ...common, ...single, cacaoPercent: '기본' } as ReservationInput
  const result = parseCakeReservationResult(cakeReservationResponse(buildCakeReservation(buildCakeReservationRequest(input), { now: new Date('2026-09-26T00:00:00Z') })))
  assert.equal(result.totalPriceCents, 6000)
})
