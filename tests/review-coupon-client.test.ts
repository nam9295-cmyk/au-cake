import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { PRODUCTS } from '../src/lib/constants.js'
import {
  buildCakeOrderRequest,
  buildCakeReservationRequest,
  createReviewCouponHandoff,
  getPromoEntryState,
  getPromoPriceDisplay,
  getDemoReviewPricingAudit,
  getOptionalReservationPricingAudit,
  getReservationPricingAudit,
  normalizeReviewCouponCode,
  parseCakeOrderResult,
  parseCakeReservationResult,
  parseReservationApiCapabilities,
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
    customerEmail: overrides.customerEmail ?? 'customer@example.com',
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

test('cake request projection sends the exact allowlisted payload including Vanilla Fresh Cream Cake sheet and flavour', () => {
  const contaminated = {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: ' Customer@Example.com ', productId: 'vanilla-fresh-cream-cake', cakeSize: '15cm',
    chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0,
    partyDecorationCount: 0, vanillaCakeSheet: 'chocolate', vanillaCakeFlavor: 'nutella-chocolate-chip', quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
    requestNote: '', privacyConsent: true, requestId: '11111111-1111-4111-8111-111111111111', website: '',
    promoCode: 'FOXKIWI7Q2MK', reviewCouponCode: 'forbidden', reviewCouponId: 'private', rewardPercent: 10,
  }
  assert.deepEqual(buildCakeReservationRequest(contaminated as ReservationInput), {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: 'customer@example.com', productId: 'vanilla-fresh-cream-cake', cakeSize: '15cm',
    chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0,
    partyDecorationCount: 0, vanillaCakeSheet: 'chocolate', vanillaCakeFlavor: 'plain', quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
    requestNote: '', privacyConsent: true, requestId: '11111111-1111-4111-8111-111111111111', website: '',
    promoCode: 'FOXKIWI7Q2MK',
  })
  assert.equal('promoCode' in buildCakeReservationRequest({ ...contaminated, promoCode: ' ' } as ReservationInput), false)
})


test('new strawberry reservations send only the current product, size, and quantity choices', () => {
  const contaminated = {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: ' Customer@Example.com ',
    productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', quantity: 2,
    chocolateType: 'dark', poundAddon: 'vanilla-cream', chocolateIcingCount: 9, vanillaCreamCount: 8,
    partyDecorationCount: 7, vanillaCakeSheet: 'chocolate', vanillaCakeFlavor: 'nutella-chocolate-chip',
    vanillaCakePointColor: 'pink', individualPackaging: true, cacaoPercent: '100',
    pickupDate: '2099-07-11', pickupTime: '10:00', requestNote: 'Please confirm', privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111', website: '', promoCode: ' FOXKIWI7Q2MK ',
  }
  assert.deepEqual(buildCakeReservationRequest(contaminated as ReservationInput), {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: 'customer@example.com',
    productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', quantity: 2,
    pickupDate: '2099-07-11', pickupTime: '10:00', requestNote: 'Please confirm', privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111', website: '', promoCode: 'FOXKIWI7Q2MK',
  })
})

test('Chocolate Extra request projection is frontend-ready while Reservation API pricing remains a pending integration boundary', () => {
  const pave = {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: ' Customer@Example.com ',
    productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla',
    vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 2, pickupDate: '2099-07-11', pickupTime: '10:00',
    cacaoPercent: '기본', requestNote: '', privacyConsent: true, requestId: '11111111-1111-4111-8111-111111111111', website: '',
    chocolateExtra: 'combo',
  }
  const projected = buildCakeReservationRequest(pave as ReservationInput)
  assert.equal(projected.chocolateExtra, 'combo')

  const strawberry = buildCakeReservationRequest({
    ...pave,
    productId: 'fresh-strawberry-vanilla-cream-cake',
    cakeSize: '8in',
    chocolateExtra: 'combo',
  } as ReservationInput)
  assert.equal(Object.hasOwn(strawberry, 'chocolateExtra'), false)

  const order = buildCakeOrderRequest({
    customerName: pave.customerName, customerPhone: pave.customerPhone, customerEmail: pave.customerEmail,
    pickupDate: pave.pickupDate, pickupTime: pave.pickupTime, requestNote: '', privacyConsent: true,
    requestId: pave.requestId, website: '',
    orderLines: [
      { ...pave },
      { ...pave, chocolateExtra: 'none', quantity: 1 },
    ],
  } as never)
  assert.deepEqual(order.orderLines.map((line) => line.chocolateExtra), ['combo', 'none'])
})

test('multi-line Strawberry orders project only the new contract fields', () => {
  const strawberryLine = {
    productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in',
    chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 2,
  }
  const request = buildCakeOrderRequest({
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: ' Customer@Example.com ',
    pickupDate: '2099-07-11', pickupTime: '10:00', requestNote: '', privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111', website: '',
    orderLines: [
      strawberryLine,
      { ...strawberryLine, productId: 'pave-cake', cakeSize: '6in', quantity: 1 },
    ],
  } as never)
  assert.deepEqual(request.orderLines[0], {
    productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', quantity: 2,
  })
})
test('reservation API capability parser enables multi-line orders only for exact numeric capability one', () => {
  assert.deepEqual(parseReservationApiCapabilities({ status: 'ready', capabilities: { cakeOrderLines: 1 } }), {
    cakeOrderLines: 1,
  })
  for (const invalid of [
    null,
    {},
    { status: 'ready' },
    { status: 'ready', capabilities: { cakeOrderLines: 1 }, unexpected: true },
    { status: 'ready', capabilities: { cakeOrderLines: 1, unexpected: true } },
    { status: 'warming', capabilities: { cakeOrderLines: 1 } },
    { status: 'ready', capabilities: { cakeOrderLines: '1' } },
    { status: 'ready', capabilities: { cakeOrderLines: true } },
    { status: 'ready', capabilities: { cakeOrderLines: 0 } },
  ]) assert.throws(() => parseReservationApiCapabilities(invalid), /RESERVATION_API_INVALID_RESPONSE/)

  let getterRead = false
  const capabilityAccessor = { status: 'ready', capabilities: { cakeOrderLines: 1 } }
  Object.defineProperty(capabilityAccessor, 'status', { enumerable: true, get: () => { getterRead = true; return 'ready' } })
  assert.throws(() => parseReservationApiCapabilities(capabilityAccessor), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(getterRead, false)
  assert.throws(() => parseReservationApiCapabilities(Object.create({ status: 'ready', capabilities: { cakeOrderLines: 1 } })), /RESERVATION_API_INVALID_RESPONSE/)
  const inheritedCapability = { status: 'ready', capabilities: Object.create({ cakeOrderLines: 1 }) }
  assert.throws(() => parseReservationApiCapabilities(inheritedCapability), /RESERVATION_API_INVALID_RESPONSE/)

  let proxyGetCalls = 0
  const capabilityProxy = new Proxy({ cakeOrderLines: 0 }, {
    get(target, key, receiver) {
      proxyGetCalls += 1
      if (key === 'cakeOrderLines') return 1
      return Reflect.get(target, key, receiver)
    },
  })
  const responseProxy = new Proxy({ status: 'warming', capabilities: capabilityProxy }, {
    get(target, key, receiver) {
      proxyGetCalls += 1
      if (key === 'status') return 'ready'
      return Reflect.get(target, key, receiver)
    },
  })
  assert.throws(() => parseReservationApiCapabilities(responseProxy), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(proxyGetCalls, 0)
})

test('multi-line request projection requires a UUID and strips all cart metadata and per-line private fields', () => {
  const contaminated = {
    customerName: 'Customer',
    customerPhone: '0412345678',
    customerEmail: ' Customer@Example.com ',
    pickupDate: '2099-07-11',
    pickupTime: '10:00',
    requestNote: 'Please confirm',
    promoCode: ' FOXKIWI7Q2MK ',
    privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111',
    website: '',
    orderLines: [
      {
        productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 2,
        lineKey: 'private-key', unitPriceCents: 1, customerName: 'Private', promoCode: 'forged', cacaoPercent: '100',
      },
      {
        productId: 'brownie-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 1,
        totalPriceCents: 1, pickupDate: 'private', requestNote: 'private',
      },
    ],
    price: 1,
  }
  assert.deepEqual(buildCakeOrderRequest(contaminated as never), {
    customerName: 'Customer', customerPhone: '0412345678', customerEmail: 'customer@example.com', pickupDate: '2099-07-11', pickupTime: '10:00',
    requestNote: 'Please confirm', promoCode: 'FOXKIWI7Q2MK', privacyConsent: true,
    requestId: '11111111-1111-4111-8111-111111111111', website: '',
    orderLines: [
      {
        productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none',
        chocolateExtra: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 2,
      },
      {
        productId: 'brownie-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
        chocolateExtra: 'none',
        cupcakeFinish: 'basic',
        chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
        vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity: 1,
      },
    ],
  })

  const withoutOwnPromo = { ...contaminated } as Record<string, unknown>
  delete withoutOwnPromo.promoCode
  Object.defineProperty(Object.prototype, 'promoCode', { value: 'FOXKIWI7Q2MK', configurable: true })
  try {
    const projected = buildCakeOrderRequest(withoutOwnPromo as never)
    assert.equal(Object.hasOwn(projected, 'promoCode'), false)
  } finally {
    delete (Object.prototype as { promoCode?: string }).promoCode
  }

  for (const requestId of ['', 'not-a-uuid', '11111111-1111-1111-1111-111111111111']) {
    assert.throws(() => buildCakeOrderRequest({ ...contaminated, requestId } as never), /INVALID_REQUEST_ID/)
  }
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, requestId: { toString: () => contaminated.requestId } } as never), /INVALID_REQUEST_ID/)
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [contaminated.orderLines[0]] } as never), /INVALID_ORDER_LINES/)
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: Array(2) } as never), /INVALID_ORDER_LINES/)
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [contaminated.orderLines[0], null] } as never), /INVALID_ORDER_LINES/)
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [{}, {}] } as never), /INVALID_ORDER_LINES/)
  for (const missingField of [
    'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount',
    'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'individualPackaging', 'quantity',
  ]) {
    const missing = { ...contaminated.orderLines[0] } as Record<string, unknown>
    delete missing[missingField]
    assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [missing, contaminated.orderLines[1]] } as never), /INVALID_ORDER_LINES/)
    const undefinedField = { ...contaminated.orderLines[0], [missingField]: undefined }
    assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [undefinedField, contaminated.orderLines[1]] } as never), /INVALID_ORDER_LINES/)
  }
  let getterRead = false
  const accessorLine = { ...contaminated.orderLines[0] }
  Object.defineProperty(accessorLine, 'quantity', { enumerable: true, get: () => { getterRead = true; return 2 } })
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [accessorLine, contaminated.orderLines[1]] } as never), /INVALID_ORDER_LINES/)
  assert.equal(getterRead, false)

  let arrayGetterReads = 0
  const accessorLines: unknown[] = []
  Object.defineProperty(accessorLines, 0, { enumerable: true, get: () => { arrayGetterReads += 1; return contaminated.orderLines[0] } })
  Object.defineProperty(accessorLines, 1, { enumerable: true, get: () => { arrayGetterReads += 1; return contaminated.orderLines[1] } })
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: accessorLines } as never), /INVALID_ORDER_LINES/)
  assert.equal(arrayGetterReads, 0)

  let requestMapCalls = 0
  const ownMapLines = [...contaminated.orderLines]
  Object.defineProperty(ownMapLines, 'map', { value: (...args: unknown[]) => { requestMapCalls += 1; return Array.prototype.map.apply(ownMapLines, args as never) } })
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: ownMapLines } as never), /INVALID_ORDER_LINES/)
  assert.equal(requestMapCalls, 0)

  const customPrototypeLines = [...contaminated.orderLines]
  Object.setPrototypeOf(customPrototypeLines, Object.create(Array.prototype))
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: customPrototypeLines } as never), /INVALID_ORDER_LINES/)

  getterRead = false
  const accessorRequest = { ...contaminated }
  Object.defineProperty(accessorRequest, 'customerName', { enumerable: true, get: () => { getterRead = true; return 'Customer' } })
  assert.throws(() => buildCakeOrderRequest(accessorRequest as never), /INVALID_ORDER_REQUEST/)
  assert.equal(getterRead, false)

  let proxyGetCalls = 0
  const proxyRequest = new Proxy({ ...contaminated, customerName: 1 }, {
    get(target, key, receiver) {
      proxyGetCalls += 1
      if (key === 'customerName') return 'Customer'
      return Reflect.get(target, key, receiver)
    },
  })
  assert.throws(() => buildCakeOrderRequest(proxyRequest as never), /INVALID_ORDER_REQUEST/)
  assert.equal(proxyGetCalls, 0)
  const proxyLine = new Proxy({ ...contaminated.orderLines[0], quantity: 0 }, {
    get(target, key, receiver) {
      proxyGetCalls += 1
      if (key === 'quantity') return 2
      return Reflect.get(target, key, receiver)
    },
  })
  assert.throws(() => buildCakeOrderRequest({ ...contaminated, orderLines: [proxyLine, contaminated.orderLines[1]] } as never), /INVALID_ORDER_LINES/)
  assert.equal(proxyGetCalls, 0)

  const inheritedRequest = Object.assign(Object.create({ customerName: 'Customer' }), contaminated) as Record<string, unknown>
  delete inheritedRequest.customerName
  assert.throws(() => buildCakeOrderRequest(inheritedRequest as never), /INVALID_ORDER_REQUEST/)

  assert.throws(() => buildCakeOrderRequest({
    ...contaminated,
    orderLines: [contaminated.orderLines[0], { ...contaminated.orderLines[0] }],
  } as never), /INVALID_ORDER_LINES/)
  assert.throws(() => buildCakeOrderRequest({
    ...contaminated,
    orderLines: [
      { ...contaminated.orderLines[0], productId: 'fresh-lemon-cupcakes-4', chocolateType: 'dark' },
      contaminated.orderLines[1],
    ],
  } as never), /INVALID_ORDER_LINES/)
})

function multiOrderResponse(overrides: Record<string, unknown> = {}) {
  const orderLines = [
    {
      productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 0,
      vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
      quantity: 2, unitPriceCents: 7900, subtotalCents: 15800, discountPercent: 0, discountCents: 0, totalPriceCents: 15800,
    },
    {
      productId: 'choco-basque-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 0,
      vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
      quantity: 1, unitPriceCents: 5500, subtotalCents: 5500, discountPercent: 0, discountCents: 0, totalPriceCents: 5500,
    },
  ]
  return {
    ...reservation({
      productId: 'pave-cake', quantity: 2, chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      cupcakeFinish: 'basic',
      vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
      totalPrice: 213, totalPriceCents: 21300, subtotalCents: 21300,
      discountPercent: 0, discountCents: 0, appliedPromoCodeLast4: undefined, promotionKind: 'none',
    }),
    orderLines,
    orderLineCount: 2,
    orderItemCount: 3,
    discountBasisCents: 0,
    privateFingerprint: 'forbidden',
    ...overrides,
  }
}

test('multi-line response parser allowlists authoritative lines and validates every aggregate', () => {
  const parsed = parseCakeOrderResult(multiOrderResponse())
  assert.equal(parsed.orderLines.length, 2)
  assert.equal(parsed.orderLineCount, 2)
  assert.equal(parsed.orderItemCount, 3)
  assert.equal(parsed.totalPriceCents, 21300)
  assert.equal('privateFingerprint' in parsed, false)
  assert.equal('reviewCouponId' in parsed, false)

  const base = multiOrderResponse()
  const rows = base.orderLines as Array<Record<string, unknown>>
  for (const invalid of [
    { orderLineCount: 1 },
    { orderItemCount: 99 },
    { discountBasisCents: 1 },
    { orderLines: [{ ...rows[0], private: true }, rows[1]] },
    { orderLines: [rows[0], { ...rows[1], totalPriceCents: 5499 }] },
    { orderLines: [{ ...rows[0], unitPriceCents: 1, subtotalCents: 2, totalPriceCents: 2 }, rows[1]], subtotalCents: 5502, totalPriceCents: 5502, totalPrice: 55.02 },
    { subtotalCents: Number.MAX_SAFE_INTEGER + 1 },
    { totalPrice: 205.004 },
    { productId: 'pound-cake' },
  ]) assert.throws(() => parseCakeOrderResult({ ...base, ...invalid }), /RESERVATION_API_INVALID_RESPONSE/, JSON.stringify(invalid))

  const customPrototypeLine = Object.assign(Object.create({ custom: true }), rows[0])
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: [customPrototypeLine, rows[1]] }), /RESERVATION_API_INVALID_RESPONSE/)
  let getterRead = false
  const accessorLine = { ...rows[0] }
  Object.defineProperty(accessorLine, 'quantity', { enumerable: true, get: () => { getterRead = true; return 2 } })
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: [accessorLine, rows[1]] }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(getterRead, false)

  let responseProxyGets = 0
  const responseProxy = new Proxy({ ...base, subtotalCents: 1 }, {
    get(target, key, receiver) {
      responseProxyGets += 1
      if (key === 'subtotalCents') return 21300
      return Reflect.get(target, key, receiver)
    },
  })
  assert.throws(() => parseCakeOrderResult(responseProxy), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(responseProxyGets, 0)
  const responseLineProxy = new Proxy({ ...rows[0], quantity: 0 }, {
    get(target, key, receiver) {
      responseProxyGets += 1
      if (key === 'quantity') return 2
      return Reflect.get(target, key, receiver)
    },
  })
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: [responseLineProxy, rows[1]] }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(responseProxyGets, 0)

  let responseArrayGetterReads = 0
  const accessorOrderLines: unknown[] = []
  Object.defineProperty(accessorOrderLines, 0, { enumerable: true, get: () => { responseArrayGetterReads += 1; return rows[0] } })
  Object.defineProperty(accessorOrderLines, 1, { enumerable: true, get: () => { responseArrayGetterReads += 1; return rows[1] } })
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: accessorOrderLines }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(responseArrayGetterReads, 0)

  responseArrayGetterReads = 0
  const inheritedOrderLines = [rows[0]] as unknown[]
  inheritedOrderLines.length = 2
  const inheritedArrayPrototype = Object.create(Array.prototype)
  Object.defineProperty(inheritedArrayPrototype, 1, { enumerable: true, get: () => { responseArrayGetterReads += 1; return rows[1] } })
  Object.setPrototypeOf(inheritedOrderLines, inheritedArrayPrototype)
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: inheritedOrderLines }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(responseArrayGetterReads, 0)

  let responseMapCalls = 0
  const ownMapOrderLines = [...rows]
  Object.defineProperty(ownMapOrderLines, 'map', { value: (...args: unknown[]) => { responseMapCalls += 1; return Array.prototype.map.apply(ownMapOrderLines, args as never) } })
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: ownMapOrderLines }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.equal(responseMapCalls, 0)

  const customPrototypeOrderLines = [...rows]
  Object.setPrototypeOf(customPrototypeOrderLines, Object.create(Array.prototype))
  assert.throws(() => parseCakeOrderResult({ ...base, orderLines: customPrototypeOrderLines }), /RESERVATION_API_INVALID_RESPONSE/)

  const retired = {
    ...rows[0], productId: 'fresh-lemon-cupcakes-4', chocolateType: 'dark', quantity: 1,
    unitPriceCents: 2400, subtotalCents: 2400, totalPriceCents: 2400,
  }
  assert.throws(() => parseCakeOrderResult({
    ...base, ...retired, orderLines: [retired, rows[1]], orderItemCount: 2,
    subtotalCents: 7900, totalPriceCents: 7900, totalPrice: 79,
  }), /RESERVATION_API_INVALID_RESPONSE/)
})

test('single-line response parser keeps authoritative individual packaging outside discounts', () => {
  const line = {
    productId: 'cupcake-half-dozen' as const, cakeSize: '15cm' as const, chocolateType: 'dark' as const, poundAddon: 'none' as const, cupcakeFinish: 'basic' as const,
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink',
    individualPackaging: true, quantity: 1, unitPriceCents: 3100, subtotalCents: 3100,
    discountPercent: 0, discountCents: 0, individualPackagingPieces: 6,
    individualPackagingFeeCents: 300, totalPriceCents: 3400,
  }
  const parsed = parseCakeReservationResult({
    ...reservation({
      ...line,
      totalPrice: 34,
      subtotalCents: 3100,
      totalPriceCents: 3400,
      individualPackagingPieces: 6,
      individualPackagingFeeCents: 300,
      appliedPromoCodeLast4: undefined,
      promotionKind: 'none',
    } as Partial<Reservation>),
    orderLines: [line],
    orderLineCount: 1,
    orderItemCount: 1,
    discountBasisCents: 0,
  })

  assert.equal(parsed.individualPackaging, true)
  assert.equal(parsed.individualPackagingPieces, 6)
  assert.equal(parsed.individualPackagingFeeCents, 300)
  assert.equal(parsed.totalPriceCents, 3400)
})

test('multi-line response accepts exact cents represented by authoritative division', () => {
  const pound = {
    productId: 'pound-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 0,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
    quantity: 1, unitPriceCents: 4500, subtotalCents: 4500, discountPercent: 5, discountCents: 225, totalPriceCents: 4275,
  }
  const lemon = {
    productId: 'fresh-lemon-cupcakes-6', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 2,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
    quantity: 1, unitPriceCents: 3700, subtotalCents: 3700, discountPercent: 5, discountCents: 185, totalPriceCents: 3515,
  }
  const parsed = parseCakeOrderResult(multiOrderResponse({
    ...pound, orderLines: [pound, lemon], orderItemCount: 2,
    subtotalCents: 8200, discountBasisCents: 8200, discountPercent: 5, discountCents: 410,
    totalPriceCents: 7790, totalPrice: 77.9, appliedPromoCodeLast4: 'Q2MK', promotionKind: 'review-reward',
  }))
  assert.equal(parsed.totalPriceCents, 7790)
  assert.equal(parsed.totalPrice, 77.9)
})

test('multi-line response rejects duplicate canonical lines and shifted discount allocation', () => {
  const base = multiOrderResponse()
  const rows = base.orderLines as Array<Record<string, unknown>>
  assert.throws(() => parseCakeOrderResult({
    ...base,
    orderLines: [rows[0], { ...rows[0] }],
    orderItemCount: 4,
    subtotalCents: 30000,
    totalPriceCents: 30000,
    totalPrice: 300,
  }), /RESERVATION_API_INVALID_RESPONSE/)

  for (const hiddenVanillaOption of [
    { vanillaCakeSheet: 'chocolate' },
    { vanillaCakeFlavor: 'nutella-chocolate-chip' },
  ]) assert.throws(() => parseCakeOrderResult({
    ...base,
    orderLines: [rows[0], { ...rows[0], ...hiddenVanillaOption }],
    orderItemCount: 4,
    subtotalCents: 30000,
    totalPriceCents: 30000,
    totalPrice: 300,
  }), /RESERVATION_API_INVALID_RESPONSE/)

  const shifted = [
    { ...rows[0], discountPercent: 5, discountCents: 789, totalPriceCents: 15011 },
    { ...rows[1], discountPercent: 5, discountCents: 276, totalPriceCents: 5224 },
  ]
  assert.throws(() => parseCakeOrderResult({
    ...base,
    totalPrice: 202.35,
    totalPriceCents: 20235,
    discountPercent: 5,
    discountCents: 1065,
    appliedPromoCodeLast4: 'Q2MK',
    promotionKind: 'review-reward',
    orderLines: shifted,
    discountBasisCents: 21300,
  }), /RESERVATION_API_INVALID_RESPONSE/)
})

test('multi-line response validates static discount against eligible basis rather than whole subtotal', () => {
  const lemon = {
    productId: 'fresh-lemon-cupcakes-6', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 0,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
    quantity: 1, unitPriceCents: 3600, subtotalCents: 3600, discountPercent: 10, discountCents: 360, totalPriceCents: 3240,
  }
  const pave = {
    productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic', chocolateIcingCount: 0,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry',
    quantity: 1, unitPriceCents: 7900, subtotalCents: 7900, discountPercent: 0, discountCents: 0, totalPriceCents: 7900,
  }
  const parsed = parseCakeOrderResult(multiOrderResponse({
    productId: lemon.productId,
    quantity: 1,
    totalPrice: 111.4,
    totalPriceCents: 11140,
    subtotalCents: 11500,
    discountPercent: 10,
    discountCents: 360,
    appliedPromoCodeLast4: 'MONI',
    promotionKind: 'static',
    orderLines: [lemon, pave],
    orderItemCount: 2,
    discountBasisCents: 3600,
  }))
  assert.equal(parsed.discountCents, 360)
  assert.equal(parsed.discountBasisCents, 3600)
  assert.throws(() => parseCakeOrderResult({
    ...multiOrderResponse({
      productId: lemon.productId,
      quantity: 1,
      totalPrice: 111.4,
      totalPriceCents: 11140,
      subtotalCents: 11500,
      discountPercent: 10,
      discountCents: 360,
      appliedPromoCodeLast4: 'ABCD',
      promotionKind: 'static',
      orderLines: [lemon, pave],
      orderItemCount: 2,
      discountBasisCents: 3600,
    }),
  }), /RESERVATION_API_INVALID_RESPONSE/)
  assert.throws(() => parseCakeOrderResult({
    ...multiOrderResponse({
      productId: lemon.productId,
      quantity: 1,
      totalPrice: 111.4,
      totalPriceCents: 11140,
      subtotalCents: 11500,
      discountPercent: 10,
      discountCents: 360,
      appliedPromoCodeLast4: 'Q2MK',
      promotionKind: 'review-reward',
      orderLines: [lemon, pave],
      orderItemCount: 2,
      discountBasisCents: 3600,
    }),
  }), /RESERVATION_API_INVALID_RESPONSE/)
})

test('cake response parser allowlists fields and validates authoritative pricing parity', () => {
  const contaminated = { ...reservation(), customerEmail: 'customer@example.com', ignored: 'x', reviewCouponId: 'private', promoCode: 'FOXKIWI7Q2MK' }
  const parsed = parseCakeReservationResult(contaminated)
  assert.equal(parsed.totalPrice, 67.5)
  assert.equal((parsed as unknown as { customerEmail: string }).customerEmail, 'customer@example.com')
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

test('legacy cake response without customerEmail remains readable as an empty value', () => {
  const legacyPayload = reservation()
  delete legacyPayload.customerEmail
  const legacy = parseCakeReservationResult(legacyPayload)
  assert.equal((legacy as unknown as { customerEmail: string }).customerEmail, '')
})
