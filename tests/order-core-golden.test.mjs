import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCakeReservation, canonicalCakeRequestPayload, parseStoredOrderLines, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { digestCakeRequestPayload } from '../appwrite-functions/reservation-api/src/coupon-digest.js'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/order-core-golden.json', import.meta.url)))
const SUPERSEDED_PRICING_GOLDENS = new Set([
  'smore-1',
  'smore-5',
  'smore-6',
  'smore-11',
  'smore-12',
  'smore-50',
  'static-coupon',
  'review-5-mixed',
  'review-10-mixed',
])
const capture = fn => {
  try { return { value: JSON.parse(JSON.stringify(fn())) } }
  catch (error) { return { error: { name: error.name, message: error.message, code: error.code, status: error.status } } }
}

export function observe(entry) {
  const options = { ...entry.options, now: new Date(entry.options.now) }
  const canonical = entry.input ? capture(() => canonicalCakeRequestPayload(entry.input)) : null
  const built = entry.input ? capture(() => buildCakeReservation(entry.input, options)) : null
  const document = entry.document || built?.value
  return JSON.parse(JSON.stringify({
    canonical,
    canonicalJson: canonical?.value ? JSON.stringify(canonical.value) : null,
    requestFingerprint: canonical?.value ? digestCakeRequestPayload(canonical.value, Buffer.alloc(32, 7)) : null,
    built,
    parsedStored: document ? capture(() => parseStoredOrderLines(document)) : null,
    createdResponse: document ? capture(() => cakeReservationResponse(document)) : null,
    lookupResponse: document ? capture(() => publicCakeReservation(document)) : null,
  }))
}

for (const entry of baseline.cases.filter(entry => !SUPERSEDED_PRICING_GOLDENS.has(entry.name))) {
  test(`order core golden: ${entry.name}`, () => assert.deepEqual(observe(entry), entry.expected))
}

test('current pricing supersedes the Stage 0 S’more and Lemon Cake goldens', () => {
  const byName = new Map(baseline.cases.map(entry => [entry.name, entry]))
  for (const name of ['smore-1', 'smore-5', 'smore-6', 'smore-11', 'smore-12', 'review-5-mixed', 'review-10-mixed']) {
    const observed = observe(byName.get(name))
    assert.equal(observed.canonical.error?.code, 'INVALID_QUANTITY', name)
    assert.equal(observed.built.error?.code, 'INVALID_QUANTITY', name)
  }

  const smore50 = observe(byName.get('smore-50'))
  assert.equal(smore50.built.value.totalPriceCents, 13500)
  assert.equal(smore50.built.value.orderItemCount, 50)
  assert.equal(smore50.parsedStored.value.lines[0].unitPriceCents, 270)

  const lemon6 = observe(byName.get('static-coupon'))
  assert.equal(lemon6.built.value.subtotalCents, 3500)
  assert.equal(lemon6.built.value.totalPriceCents, 3150)
})
