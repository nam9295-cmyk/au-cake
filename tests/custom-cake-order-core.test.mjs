import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as input from '../appwrite-functions/reservation-api/src/cake-order-input.js'
import * as pricing from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import * as data from '../appwrite-functions/reservation-api/src/cake-order-data.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${name}.json`, import.meta.url)))
const canonical = fixture('canonical').cases
const custom = fixture('custom-v1')
const ordinary = fixture('cake-order-v2')
const copy = structuredClone
const normalize = value => value.contractVersion === 'custom-cake.v1'
  ? input.normalizeCustomCakeV1Request(value) : input.normalizeCakeOrderV2Request(value)
const reject = (fn, code = 'INVALID_REQUEST') => assert.throws(fn, { code })

test('new pickup boundary rejects absent and nonobject requests with the wire error', () => {
  for (const value of [null, undefined, false, 0, '', []]) {
    reject(() => input.validateNewCakeWirePickup(value, new Date('2026-09-09T00:00:00.000Z')))
    reject(() => input.normalizeCustomCakeV1Request(value))
  }
})

test('new canonical exports match both pinned JSON byte strings and HMAC domains', () => {
  assert.equal(typeof input.canonicalCustomCakeV1Request, 'function')
  assert.equal(typeof input.canonicalCakeOrderV2Request, 'function')
  for (const row of canonical) {
    const canonicalize = row.name === 'custom-cake.v1' ? input.canonicalCustomCakeV1Request : input.canonicalCakeOrderV2Request
    const digest = row.name === 'custom-cake.v1' ? input.fingerprintCustomCakeV1Request : input.fingerprintCakeOrderV2Request
    for (const request of [row.request, row.permuted]) {
      assert.equal(canonicalize(request), row.canonicalJson)
      assert.equal(digest(request, Buffer.alloc(32, 7)), row.fingerprint)
      assert.equal(digest(request, Buffer.alloc(32, 7).toString('base64url')), row.fingerprint)
    }
    for (const secret of [undefined, '', 'bad!', Buffer.alloc(31), Buffer.alloc(0)]) {
      reject(() => digest(row.request, secret), 'FUNCTION_CONFIGURATION_ERROR')
    }
    const changedId = copy(row.request)
    changedId.lines[1].lineId = 'other'
    assert.notEqual(digest(changedId, Buffer.alloc(32, 7)), row.fingerprint)
    const changedParent = copy(row.request)
    changedParent.lines.push({ ...copy(changedParent.lines[0]), lineId: 'cake_B', ...(row.name === 'custom-cake.v1' ? { photoRefs: [] } : {}) })
    const original = digest(changedParent, Buffer.alloc(32, 7))
    changedParent.lines[1].parentCakeLineId = 'cake_B'
    assert.notEqual(digest(changedParent, Buffer.alloc(32, 7)), original)
  }
})

test('contact and notes normalize; canonical replay does not consult pickup clock', () => {
  for (const row of canonical) {
    const request = copy(row.request)
    request.customer = { customerName: ' Contract Example ', customerPhone: '+61 412 345 678', customerEmail: ' CONTRACT@EXAMPLE.INVALID ' }
    request.requestNote = '  hello  '
    const result = normalize(request)
    assert.deepEqual(result.customer, row.request.customer)
    assert.equal(result.requestNote, 'hello')
    assert.equal(result.requestId, row.request.requestId)
    reject(() => input.validateNewCakeWirePickup(result, new Date('2026-10-06T00:00:00.000Z')))
    assert.doesNotThrow(() => normalize(request))
    assert.doesNotThrow(() => input.validateNewCakeWirePickup(result, new Date('2026-10-02T00:00:00.000Z')))
  }
})

test('strict request, customer, pickup and selected line fields reject injected pricing or wrong scalars', () => {
  for (const row of canonical) {
    for (const mutate of [
      r => { r.totalCents = 0 }, r => { r.customer.secret = 'x' }, r => { r.pickup.extra = true },
      r => { delete r.requestNote }, r => { r.requestNote = null }, r => { r.privacyConsent = false },
      r => { r.requestId = 'AAAAAAAA-1111-4111-8111-111111111111' }, r => { r.requestId = '11111111-1111-1111-8111-111111111111' },
      r => { r.customer.customerEmail = 'bad' }, r => { r.customer.customerPhone = '0312345678' },
      r => { r.customer.customerName = 'x' }, r => { r.pickup.pickupDate = '2026-02-30' },
      r => { r.pickup.pickupTime = '24:00' }, r => { r.lines[1].unitPriceCents = 450 },
      r => { r.lines[1].options = {} }, r => { r.lines[0].quantity = '1' },
      r => { r.lines[0].quantity = 0 }, r => { r.lines[0].quantity = 1.5 },
    ]) {
      const request = copy(row.request); mutate(request)
      reject(() => normalize(request))
    }
  }
  for (const mutate of [
    r => { r.promoCode = 1 }, r => { r.lines[0].tier = 'double' },
    r => { r.lines[0].figurineSource = 'free' }, r => { r.lines[0].designNote = null },
    r => { r.lines = [r.lines[1]] },
  ]) {
    const request = copy(custom.request); mutate(request); reject(() => normalize(request))
  }
  for (const mutate of [
    r => { delete r.promoCode }, r => { r.lines[0].options.price = 5 },
    r => { delete r.lines[0].options.cakeSize }, r => { r.lines[0].options.individualPackaging = 1 },
    r => { r.lines[0].options.chocolateIcingCount = -0 }, r => { r.lines[0].options.vanillaCreamCount = 1 },
    r => { r.lines[0].options.chocolateType = 'white' }, r => { r.lines[0].options.cakeSize = '19cm' },
    r => { r.lines[0].productId = 'vanilla-fresh-cream-cake' }, r => { r.lines[0].productId = 'smore-stick' },
    r => { r.lines[0].options.individualPackaging = true },
  ]) {
    const request = copy(ordinary.request); mutate(request); reject(() => normalize(request))
  }
})

test('line identity and parent graph are strict; photos are opaque, unique and max five across lines', () => {
  for (const row of ordinary.referenceCases) reject(() => normalize({ ...copy(ordinary.request), lines: row.lines }), row.error)
  for (const row of canonical) {
    for (const value of ['', 'bad space', 'é', 'A'.repeat(65)]) {
      const request = copy(row.request); request.lines[0].lineId = value
      reject(() => normalize(request), 'INVALID_LINE_ID')
    }
    for (const value of [null, 'missing', 'smore_A']) {
      const request = copy(row.request); request.lines[1].parentCakeLineId = value
      reject(() => normalize(request), 'INVALID_LINE_REFERENCE')
    }
    const request = copy(row.request)
    request.lines[0].quantity = 3
    request.lines.push({ ...copy(request.lines[0]), lineId: 'cake_B', ...(row.name === 'custom-cake.v1' ? { photoRefs: [] } : {}) })
    reject(() => normalize(request))
    request.lines[2].quantity = 2
    assert.deepEqual(normalize(request).lines.map(l => [l.lineId, l.quantity]), [['cake_A', 3], ['cake_B', 2], ['smore_A', 2]])
  }
  for (const refs of [['same', 'same'], ['https://example.invalid/image'], ['a','b','c','d','e','f']]) {
    const request = copy(custom.request); request.lines[0].photoRefs = refs
    reject(() => normalize(request), 'INVALID_PHOTO_REFERENCE')
  }
  const duplicateAcross = copy(custom.request)
  duplicateAcross.lines.push({ ...copy(duplicateAcross.lines[0]), lineId: 'cake_B' })
  reject(() => normalize(duplicateAcross), 'INVALID_PHOTO_REFERENCE')
})

const promotionEligibilityAt = custom.created.quote.promotionEligibilityAt
const pricedAt = ordinary.created.pricing.pricedAt
const customPrice = request => pricing.priceCustomCakeV1Request(request, { promotionEligibilityAt })

test('custom initial quote and all six base prices match the launch policy fixture amounts', () => {
  assert.equal(typeof pricing.priceCustomCakeV1Request, 'function')
  assert.deepEqual(customPrice(custom.request), { quote: custom.created.quote, paidSmoreLines: custom.created.paidSmoreLines })
  for (const row of custom.sizes) {
    const request = copy(custom.request)
    request.lines = [{ ...request.lines[0], tier: row.tier, size: row.size, quantity: row.quantity }]
    const { quote } = customPrice(request)
    for (const key of ['baseCents', 'cakeDiscountCents', 'knownTotalCents', 'giftSmoreQuantity']) assert.equal(quote[key], row[key])
  }
  const request = copy(custom.request)
  request.lines = [{ ...request.lines[0], quantity: 3 }, { ...request.lines[0], lineId: 'cake_B', size: '8in', quantity: 2, photoRefs: [] }]
  const { quote } = customPrice(request)
  assert.equal(quote.baseCents, 91500)
  assert.equal(quote.cakeDiscountCents, 0)
  assert.equal(quote.giftSmoreQuantity, 0)
})

test('Custom Cake September promo normalizes into the canonical request and prices only eligible base cents', () => {
  const receivedAt = '2026-09-13T00:00:00.000Z'
  const noCode = copy(custom.request)
  delete noCode.promoCode
  const normalizedNoCode = input.normalizeCustomCakeV1Request(noCode)
  assert.equal(normalizedNoCode.promoCode, '')

  for (const [tier, size, baseCents] of [
    ['single', '6in', 15900], ['single', '8in', 21900], ['single', '10in', 31900],
    ['double', '4in+6in', 23900], ['double', '6in+8in', 33900], ['double', '8in+10in', 45900],
  ]) {
    const request = copy(noCode)
    request.lines = [{ ...request.lines[0], tier, size, quantity: 1, photoRefs: [] }]
    const { quote } = pricing.priceCustomCakeV1Request(request, { promotionEligibilityAt: receivedAt })
    assert.equal(quote.baseCents, baseCents)
    assert.equal(quote.cakeDiscountCents, 0)
    assert.equal(quote.giftSmoreQuantity, 0)
  }

  const eligible = copy(noCode)
  eligible.promoCode = '  verygood custom  '
  const normalizedEligible = input.normalizeCustomCakeV1Request(eligible)
  assert.equal(normalizedEligible.promoCode, 'VERYGOOD CUSTOM')
  assert.equal(input.canonicalCustomCakeV1Request(eligible), input.canonicalCustomCakeV1Request({ ...eligible, promoCode: 'VeryGood Custom' }))
  assert.notEqual(input.fingerprintCustomCakeV1Request(noCode, Buffer.alloc(32, 7)), input.fingerprintCustomCakeV1Request(eligible, Buffer.alloc(32, 7)))
  const initial = pricing.priceCustomCakeV1Request(eligible, { promotionEligibilityAt: receivedAt })
  assert.equal(initial.quote.baseCents, 15900)
  assert.equal(initial.quote.cakeDiscountCents, 1590)
  assert.equal(initial.quote.paidSmoreTotalCents, 630)
  assert.equal(initial.quote.giftSmoreQuantity, 0)
  assert.equal(initial.quote.knownTotalCents, 14940)
  const revised = pricing.reviseCustomCakeV1Quote(initial.quote, { quoteVersion: 2, designExtraCents: 1000, figurineExtraCents: 800 })
  assert.equal(revised.cakeDiscountCents, 1590)
  assert.equal(revised.knownTotalCents, 16740)

  for (const [at, pickupDate, discount] of [
    ['2026-09-12T13:59:59.999Z', '2026-11-30', 0],
    ['2026-09-12T14:00:00.000Z', '2026-11-30', 1590],
    ['2026-09-30T13:59:59.999Z', '2026-11-30', 1590],
    ['2026-09-30T14:00:00.000Z', '2026-11-30', 0],
    ['2026-09-20T00:00:00.000Z', '2026-12-01', 0],
  ]) {
    const request = copy(eligible)
    request.pickup.pickupDate = pickupDate
    assert.equal(pricing.priceCustomCakeV1Request(request, { promotionEligibilityAt: at }).quote.cakeDiscountCents, discount)
  }
  const invalid = copy(noCode)
  invalid.promoCode = 'WRONGCODE'
  reject(() => pricing.priceCustomCakeV1Request(invalid, { promotionEligibilityAt: receivedAt }), 'PROMO_CODE_INVALID')
})

test('quote revisions preserve the first persisted receipt without retroactive promotion', () => {
  for (const row of custom.eventCases) {
    const request = copy(custom.request)
    request.lines = [{ ...request.lines[0], quantity: row.quantity }]
    const { quote } = pricing.priceCustomCakeV1Request(request, { promotionEligibilityAt: row.receivedAt })
    for (const key of ['baseCents', 'cakeDiscountCents', 'giftSmoreQuantity']) assert.equal(quote[key], row[key])
    const edited = pricing.reviseCustomCakeV1Quote(quote, { quoteVersion: 2, designExtraCents: 9000, figurineExtraCents: 0 })
    assert.equal(edited.promotionEligibilityAt, row.receivedAt)
    assert.equal(edited.cakeDiscountCents, row.cakeDiscountCents)
    assert.equal(edited.giftSmoreQuantity, row.giftSmoreQuantity)
  }
  for (const [at, discount] of [['2026-08-31T23:59:59.999Z', 0], ['2026-09-01T00:00:00.000Z', 0]]) {
    assert.equal(pricing.priceCustomCakeV1Request(custom.request, { promotionEligibilityAt: at }).quote.cakeDiscountCents, discount)
  }
})

test('quote revisions preserve null/zero/positive distinctions and immutable receipt bases', () => {
  assert.equal(typeof pricing.reviseCustomCakeV1Quote, 'function')
  for (const row of custom.extraCases) {
    const initial = copy(custom.created.quote)
    const quote = pricing.reviseCustomCakeV1Quote(initial, { quoteVersion: 2, designExtraCents: row.designExtraCents, figurineExtraCents: row.figurineExtraCents })
    for (const key of Object.keys(row)) assert.equal(quote[key], row[key])
    assert.deepEqual(initial, custom.created.quote)
    assert.equal(quote.quoteVersion, 2)
  }
  assert.deepEqual(pricing.reviseCustomCakeV1Quote(custom.created.quote, { quoteVersion: 2, designExtraCents: 0, figurineExtraCents: 0 }), custom.zeroExtrasQuote)
  assert.deepEqual(pricing.reviseCustomCakeV1Quote(custom.created.quote, { quoteVersion: 2, designExtraCents: 2000, figurineExtraCents: 1500 }), custom.finalLookup.quote)
})

test('new paid S’more price is 450 standalone or 315 add-on per stick at 1/6/12', () => {
  assert.equal(typeof pricing.priceCakeOrderV2Request, 'function')
  for (const row of ordinary.smoreCases) {
    const { unitPriceCents: _u, subtotalCents: _s, discountPercent: _p, discountCents: _d, totalCents: _t, ...line } = row
    for (const template of [ordinary.request, custom.request]) {
      const request = copy(template)
      request.lines = template === ordinary.request && line.kind === 'standalone-smore' ? [line] : [request.lines[0], line]
      const result = template === ordinary.request ? pricing.priceCakeOrderV2Request(request, { pricedAt }).lines : customPrice(request).paidSmoreLines
      assert.deepEqual(result.find(l => l.lineId === line.lineId), row)
    }
  }
  assert.deepEqual(pricing.priceCakeOrderV2Request(ordinary.request, { pricedAt }), ordinary.created.pricing)
  assert.deepEqual(pricing.priceCakeOrderV2Request(ordinary.request, { pricedAt, reviewCoupon: { id: 'synthetic', rewardPercent: 5, codeLast4: 'ABCD' } }), ordinary.couponExample)
  const standalone = copy(ordinary.request)
  standalone.lines = [{ kind: 'standalone-smore', lineId: 'S', productId: 'smore-stick', quantity: 12, parentCakeLineId: null }]
  reject(() => pricing.priceCakeOrderV2Request(standalone, { pricedAt, reviewCoupon: { id: 'synthetic', rewardPercent: 5, codeLast4: 'ABCD' } }), 'PROMO_CODE_INVALID')
})

test('ordinary extras stay per-line, packaging aggregate threshold and coupon remainder ties stay deterministic', () => {
  const request = copy(ordinary.request)
  const cake = request.lines[0]
  request.lines = ['B', 'A'].map(lineId => ({ ...copy(cake), lineId, productId: 'fresh-lemon-cupcakes-6', options: { ...cake.options, cakeSize: '15cm', chocolateIcingCount: 1, individualPackaging: true } }))
  const result = pricing.priceCakeOrderV2Request(request, { pricedAt, reviewCoupon: { id: 'coupon', rewardPercent: 5, codeLast4: 'ABCD' } })
  assert.equal(result.subtotalCents, 7300)
  assert.equal(result.discountCents, 365)
  assert.equal(result.individualPackagingFeeCents, 600)
  assert.equal(result.totalCents, 7535)
  assert.deepEqual(result.lines.map(l => [l.lineId, l.discountCents]), [['A', 183], ['B', 182]])
  request.lines[0].quantity = 2
  const freePackaging = pricing.priceCakeOrderV2Request(request, { pricedAt })
  assert.equal(freePackaging.subtotalCents, 10950)
  assert.equal(freePackaging.individualPackagingFeeCents, 0)
  const extras = copy(ordinary.request)
  extras.lines[0].quantity = 2
  extras.lines[0].options.chocolateExtra = 'combo'
  assert.equal(pricing.priceCakeOrderV2Request(extras, { pricedAt }).lines[0].subtotalCents, 17800)
})

test('pricing rejects unsafe cents, quantities, timestamps and caller supplied money', () => {
  for (const amount of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    reject(() => pricing.reviseCustomCakeV1Quote(custom.created.quote, { quoteVersion: 2, designExtraCents: amount, figurineExtraCents: 0 }))
  }
  reject(() => pricing.reviseCustomCakeV1Quote(custom.created.quote, { quoteVersion: 2, designExtraCents: Number.MAX_SAFE_INTEGER, figurineExtraCents: 0 }))
  for (const quoteVersion of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) reject(() => pricing.reviseCustomCakeV1Quote(custom.created.quote, { quoteVersion, designExtraCents: 0, figurineExtraCents: 0 }))
  for (const at of ['2026-02-30T00:00:00.000Z', '2026-10-02T00:00:00Z', 'not time', undefined]) {
    reject(() => pricing.priceCakeOrderV2Request(ordinary.request, { pricedAt: at }))
    reject(() => pricing.priceCustomCakeV1Request(custom.request, { promotionEligibilityAt: at }))
  }
  for (const quantity of [Number.MAX_SAFE_INTEGER, Math.floor(Number.MAX_SAFE_INTEGER / 450) + 1]) {
    const request = copy(ordinary.request); request.lines[1].quantity = quantity
    reject(() => pricing.priceCakeOrderV2Request(request, { pricedAt }))
  }
  const aggregate = copy(ordinary.request)
  aggregate.lines = ['a', 'b'].map(lineId => ({ kind: 'standalone-smore', lineId, productId: 'smore-stick', quantity: Math.floor(Number.MAX_SAFE_INTEGER / 450), parentCakeLineId: null }))
  reject(() => pricing.priceCakeOrderV2Request(aggregate, { pricedAt }))
  const forged = copy(custom.request); forged.lines[0].baseCents = 1
  reject(() => customPrice(forged))
})

test('pure initial data builders emit the exact separate creation and lookup fixture shapes', () => {
  assert.equal(typeof data.buildCustomCakeV1Data, 'function')
  assert.equal(typeof data.buildCakeOrderV2Data, 'function')
  const customResult = data.buildCustomCakeV1Data(custom.request, { now: new Date(promotionEligibilityAt), requestNumber: custom.created.requestNumber })
  assert.deepEqual(customResult.request, { ...custom.request, promoCode: '' })
  assert.deepEqual(customResult.creationResponse, custom.created)
  assert.deepEqual(customResult.lookupResponse, custom.lookup)
  const ordinaryResult = data.buildCakeOrderV2Data(ordinary.request, { now: new Date(pricedAt), reservationNumber: ordinary.created.reservationNumber })
  assert.deepEqual(ordinaryResult.request, ordinary.request)
  assert.deepEqual(ordinaryResult.creationResponse, ordinary.created)
  assert.deepEqual(ordinaryResult.lookupResponse, ordinary.lookup)
  customResult.lookupResponse.quote.quoteVersion = 2
  assert.equal(customResult.creationResponse.quote.quoteVersion, 1)
  ordinaryResult.lookupResponse.pricing.totalCents = 1
  assert.equal(ordinaryResult.creationResponse.pricing.totalCents, 8530)
  for (const now of [new Date('invalid'), new Date('2026-10-06T00:00:00.000Z')]) {
    reject(() => data.buildCustomCakeV1Data(custom.request, { now, requestNumber: 'CUSTOM-1' }))
    reject(() => data.buildCakeOrderV2Data(ordinary.request, { now, reservationNumber: 'VG-C-1' }))
  }
  reject(() => data.buildCustomCakeV1Data(custom.request, { now: new Date(promotionEligibilityAt), requestNumber: '' }))
  reject(() => data.buildCakeOrderV2Data(ordinary.request, { now: new Date(pricedAt), reservationNumber: '' }))
})

test('custom tier and size cannot coerce arrays into a valid selection; pickup validator requires a supported wire', () => {
  for (const field of ['tier', 'size']) {
    const request = copy(custom.request)
    request.lines[0][field] = [request.lines[0][field]]
    reject(() => normalize(request))
  }
  reject(() => input.validateNewCakeWirePickup({ ...ordinary.request, contractVersion: 'unknown' }, new Date(pricedAt)))
})
