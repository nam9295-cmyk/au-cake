import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCakeReservation, canonicalCakeRequestPayload, parseStoredOrderLines, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { digestCakeRequestPayload } from '../appwrite-functions/reservation-api/src/coupon-digest.js'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/order-core-golden.json', import.meta.url)))
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

for (const entry of baseline.cases) {
  test(`order core golden: ${entry.name}`, () => assert.deepEqual(observe(entry), entry.expected))
}
