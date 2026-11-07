import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { priceCustomCakeV1Request, getValidPromoCode } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import { priceRenewalOrder } from '../appwrite-functions/reservation-api/src/au-renewal.js'
const fixture = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/custom-v1.json', 'utf8'))
test('retired codes cannot discount a new November order while historical custom quotes remain readable', () => {
  const request = structuredClone(fixture.request)
  request.promoCode = 'VERYGOOD CUSTOM'
  request.pickup.pickupDate = '2026-11-20'
  assert.throws(() => priceCustomCakeV1Request(request, { promotionEligibilityAt: '2026-11-07T00:00:00.000Z' }), { code: 'PROMO_CODE_INVALID' })
  assert.equal(priceCustomCakeV1Request(request, { promotionEligibilityAt: '2026-09-20T00:00:00.000Z' }).quote.cakeDiscountCents, 1590)
  for (const code of ['chocolate', 'lemoni']) assert.equal(getValidPromoCode('pave-cake', code, Date.parse('2026-11-07T00:00:00Z')), null)
})
test('current review/manual rewards still discount eligible renewal cakes', () => {
  for (const rewardPercent of [5, 10]) {
    const quote = priceRenewalOrder([{ lineId: 'cake', offerId: 'pave-cake', size: '6in', quantity: 1 }], { reviewCoupon: { rewardPercent } })
    assert.equal(quote.discountCents, rewardPercent === 5 ? 375 : 750)
  }
})
