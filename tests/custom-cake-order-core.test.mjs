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
    r => { r.promoCode = '' }, r => { r.lines[0].tier = 'double' },
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
