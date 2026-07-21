import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { PRODUCTS } from '../src/lib/constants.js'
import {
  buildCakeReservationRequest,
  createReviewCouponHandoff,
  getPromoEntryState,
  getPromoPriceDisplay,
  getDemoReviewPricingAudit,
  getOptionalReservationPricingAudit,
  getReservationPricingAudit,
  normalizeReviewCouponCode,
  parseCakeReservationResult,
  promoErrorMessage,
  shouldShowPromoInput,
} from '../src/lib/review-coupon-client.js'
import type { ProductId, Reservation, ReservationInput } from '../src/lib/types.js'

const validStaticNow = new Date('2026-07-15T00:00:00.000Z')

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'reservation-1',
    reservationNumber: 'VG-C-AU-1',
    customerName: 'Customer',
    customerPhone: '0412345678',
    productId: 'pave-cake',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
    pickupDate: '2099-07-11',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 67.5,
    totalPriceCents: 6750,
    subtotalCents: 7500,
    discountPercent: 10,
    discountCents: 750,
    appliedPromoCodeLast4: '2345',
    promotionKind: 'review-reward',
    reviewCouponId: 'coupon-1',
    adminMemo: '',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  }
}

test('promo input is available for every cake product and never for class booking', () => {
  for (const productId of Object.keys(PRODUCTS) as ProductId[]) {
    assert.equal(shouldShowPromoInput('cake', productId), true, productId)
  }
  assert.equal(shouldShowPromoInput('class'), false)
})

test('review coupon input normalizes exact animal-fruit codes without inferring a reward', () => {
  assert.deepEqual(getPromoEntryState('pave-cake', '  foxkiwi7q2mk  ', validStaticNow), {
    kind: 'review-pending',
    normalizedCode: 'FOXKIWI7Q2MK',
    discountPercent: null,
  })
  assert.deepEqual(getPromoEntryState('fresh-lemon-cupcakes-6', 'CATMANGO2A3BC', validStaticNow, 10), {
    kind: 'review-pending',
    normalizedCode: 'CATMANGO2A3BC',
    discountPercent: 10,
  })
  assert.equal(getPromoEntryState('pave-cake', 'FOXKIWI7Q2MK', validStaticNow, 5).discountPercent, 5)
  assert.equal(getPromoEntryState('pave-cake', 'FOXKIWI7Q2MK', validStaticNow, 10).discountPercent, 10)
  for (const invalid of ['FOXKIWI7Q2MI', 'FOXKIWI7Q20K', 'FOXKIWI7Q2M', 'FOXKIWI7Q2MKA', 'RATKIWI7Q2MK', 'FOXORANGE7Q2MK', 'VG5-ABCD-2345']) {
    assert.equal(getPromoEntryState('pave-cake', invalid, validStaticNow).kind, 'invalid')
  }
})

test('manual JENNIE-family coupon normalizes as server-pending without lowering the payable amount', () => {
  const promo = getPromoEntryState('pave-cake', '  jennietest7  ', validStaticNow)
  assert.deepEqual(promo, {
    kind: 'review-pending',
    normalizedCode: 'JENNIETEST7',
    discountPercent: 5,
  })
  assert.deepEqual(getPromoPriceDisplay(75, promo), { finalPrice: 75, estimatedPrice: 71.25 })
  assert.equal(createReviewCouponHandoff().offer('  jennietest7  '), true)
  assert.equal(getPromoEntryState('pave-cake', 'JENNIETEST7', validStaticNow, 10).discountPercent, 5)
})

test('malformed JENNIE lookalikes fail closed while unrelated promo text keeps the existing invalid path', () => {
  for (const invalid of ['JENNIETEST', 'JENNIETEST77', 'JENNIE-TEST', 'JENNIETES!', 'JENNYTEST7']) {
    assert.equal(getPromoEntryState('pave-cake', invalid, validStaticNow).kind, 'invalid', invalid)
    assert.equal(createReviewCouponHandoff().offer(invalid), false, invalid)
  }
  assert.deepEqual(getPromoEntryState('pave-cake', ' summer-special ', validStaticNow), {
    kind: 'invalid',
    normalizedCode: 'summer-special',
    discountPercent: 0,
  })
})

test('coupon normalizers reject non-string runtime values without coercion', () => {
  for (const value of [12345, true, false, { toString: () => 'JENNIETEST7' }]) {
    assert.equal(normalizeReviewCouponCode(value as unknown as string), null)
    assert.equal(getPromoEntryState('pave-cake', value as unknown as string, validStaticNow).kind, 'empty')
    assert.equal(createReviewCouponHandoff().offer(value as unknown as string), false)
  }
})

test('static Chocolate and Lemoni campaign eligibility remains unchanged', () => {
  assert.equal(getPromoEntryState('choco-basque-cheesecake', ' Chocolate ', validStaticNow).kind, 'static-valid')
  assert.equal(getPromoEntryState('pave-cake', 'Chocolate', validStaticNow).kind, 'invalid')
  assert.equal(getPromoEntryState('fresh-lemon-cupcakes-8', 'LEMONI', validStaticNow).kind, 'static-valid')
  assert.equal(getPromoEntryState('pound-cake', 'Lemoni', validStaticNow).kind, 'invalid')
})

test('review coupon handoff is one-shot component memory with no browser persistence API', () => {
  const handoff = createReviewCouponHandoff()
  assert.equal(handoff.offer(' foxkiwi7q2mk '), true)
  assert.equal(handoff.consume(), 'FOXKIWI7Q2MK')
  assert.equal(handoff.consume(), '')
  assert.equal(handoff.offer('not-a-coupon'), false)
  assert.equal(handoff.consume(), '')
  handoff.offer('CATMANGO2A')
  handoff.clear()
  assert.equal(handoff.consume(), '')
})

test('all coupon errors use one stable non-enumerating customer message', () => {
  assert.equal(promoErrorMessage('PROMO_CODE_INVALID', 'en'), 'This promo or review reward code is invalid, unavailable, or expired.')
  assert.equal(promoErrorMessage('PROMO_CODE_ALREADY_USED', 'en'), promoErrorMessage('PROMO_CODE_INVALID', 'en'))
  assert.equal(promoErrorMessage('PROMO_CODE_RETRY_REQUIRED', 'ko'), promoErrorMessage('PROMO_CODE_INVALID', 'ko'))
  assert.equal(promoErrorMessage('PROMO_CODE_INVALID', 'ko'), '이 프로모 또는 후기 리워드 코드는 유효하지 않거나, 사용할 수 없거나, 만료되었습니다.')
  assert.equal(promoErrorMessage('OTHER', 'en'), null)
})

test('pending review coupon keeps the final amount undiscounted and estimates only a server-returned reward', () => {
  const pending = getPromoEntryState('pave-cake', 'FOXKIWI7Q2MK', validStaticNow, 5)
  assert.deepEqual(getPromoPriceDisplay(75, pending), { finalPrice: 75, estimatedPrice: 71.25 })
  assert.deepEqual(getPromoPriceDisplay(75, getPromoEntryState('pave-cake', 'FOXKIWI7Q2MK')), { finalPrice: 75, estimatedPrice: null })

  const staticPromo = getPromoEntryState('choco-basque-cheesecake', 'Chocolate', validStaticNow)
  assert.deepEqual(getPromoPriceDisplay(55, staticPromo), { finalPrice: 49.5, estimatedPrice: null })
})

test('explicit review demo reservation uses authoritative-shaped 5 and 10 percent pricing', () => {
  for (const [percent, total] of [[5, 7125], [10, 6750]] as const) {
    const code = 'FOXKIWI7Q2MK'
    assert.deepEqual(getDemoReviewPricingAudit(75, getPromoEntryState('pave-cake', code, validStaticNow, percent)), {
      subtotalCents: 7500, discountPercent: percent, discountCents: 7500 - total,
      totalPriceCents: total, appliedPromoCodeLast4: code.slice(-4),
    })
  }
  assert.equal(getDemoReviewPricingAudit(75, getPromoEntryState('pave-cake', 'FOXKIWI7I')), null)
})

test('reservation pricing and audit display use only authoritative response fields', () => {
  assert.deepEqual(getReservationPricingAudit(reservation()), {
    subtotalCents: 7500,
    discountPercent: 10,
    discountCents: 750,
    totalPriceCents: 6750,
    appliedPromoCodeLast4: '2345',
  })
  assert.equal(JSON.stringify(getReservationPricingAudit(reservation())).includes('FOXKIWI7Q2MK'), false)
})

test('legacy reservations without complete audit fields do not crash admin rendering', () => {
  assert.equal(getOptionalReservationPricingAudit({ totalPrice: 75 }), null)
  assert.equal(getOptionalReservationPricingAudit({ subtotalCents: 7500, discountPercent: 10 }), null)
  assert.deepEqual(getOptionalReservationPricingAudit(reservation()), getReservationPricingAudit(reservation()))
})

test('cake request projection sends the exact allowlisted payload and promoCode only when needed', () => {
  const contaminated = {
    customerName: 'Customer', customerPhone: '0412345678', productId: 'pave-cake', cakeSize: '15cm',
    chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0,
    partyDecorationCount: 0, quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
    requestNote: '', privacyConsent: true, requestId: '11111111-1111-4111-8111-111111111111', website: '',
    promoCode: 'FOXKIWI7Q2MK', reviewCouponCode: 'forbidden', reviewCouponId: 'private', rewardPercent: 10,
  }
  assert.deepEqual(buildCakeReservationRequest(contaminated as ReservationInput), {
    customerName: 'Customer', customerPhone: '0412345678', productId: 'pave-cake', cakeSize: '15cm',
    chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0,
    partyDecorationCount: 0, quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
    requestNote: '', privacyConsent: true, requestId: '11111111-1111-4111-8111-111111111111', website: '',
    promoCode: 'FOXKIWI7Q2MK',
  })
  assert.equal('promoCode' in buildCakeReservationRequest({ ...contaminated, promoCode: ' ' } as ReservationInput), false)
})

test('cake response parser allowlists fields and validates authoritative pricing parity', () => {
  const contaminated = { ...reservation(), ignored: 'x', reviewCouponId: 'private', promoCode: 'FOXKIWI7Q2MK' }
  const parsed = parseCakeReservationResult(contaminated)
  assert.equal(parsed.totalPrice, 67.5)
  assert.deepEqual(getReservationPricingAudit(parsed), {
    subtotalCents: 7500, discountPercent: 10, discountCents: 750, totalPriceCents: 6750, appliedPromoCodeLast4: '2345',
  })
  assert.equal('reviewCouponId' in parsed, false)
  assert.equal('promoCode' in parsed, false)
  const manual = parseCakeReservationResult({
    ...contaminated,
    promotionKind: 'manual-coupon',
    discountPercent: 5,
    discountCents: 375,
    totalPriceCents: 7125,
    totalPrice: 71.25,
  })
  assert.equal(manual.promotionKind, 'manual-coupon')
  for (const invalid of [
    { discountPercent: 7 }, { subtotalCents: -1 }, { discountCents: 751 }, { totalPriceCents: 6749 },
    { appliedPromoCodeLast4: '12 4' }, { discountPercent: 0, discountCents: 750 },
    { discountCents: 1, totalPriceCents: 7499 }, { productId: 'not-a-product' }, { status: 'bogus' },
    { paymentStatus: 'bogus' }, { promotionKind: 'none' },
    { promotionKind: 'static', discountPercent: 5, discountCents: 375, totalPriceCents: 7125, totalPrice: 71.25 },
    { productId: 'pound-cake', cakeSize: '22cm' }, { chocolateIcingCount: 99 }, { vanillaCreamCount: 99 },
    { quantity: 99 }, { pickupDate: '2099-02-30' }, { pickupTime: '25:00' }, { customerPhone: '123' },
    { createdAt: 'not-a-date' }, { updatedAt: '2026-07-10' },
  ]) assert.throws(() => parseCakeReservationResult({ ...contaminated, ...invalid }), /RESERVATION_API_INVALID_RESPONSE/)
})
