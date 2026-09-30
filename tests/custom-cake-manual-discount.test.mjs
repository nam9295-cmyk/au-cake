import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviseCustomCakeV1Quote } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'
import { parseCustomCakeLookupResponse } from '../src/lib/custom-cake-client.ts'
import { encodeCustomCakeRecord, decodeCustomCakeRecord, customCakeDocumentId } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
import { buildCustomCakeEmailPayload } from '../appwrite-functions/reservation-notification/src/custom-cake-notification.js'
const fixture = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/custom-v1.json', 'utf8'))
const base = { ...fixture.created.quote, baseCents: 20000, cakeDiscountCents: 2000, paidSmoreQuantity: 10, paidSmoreTotalCents: 3150 }
const paid = [{ ...fixture.created.paidSmoreLines[0], quantity: 10, unitPriceCents: 450, subtotalCents: 4500, discountPercent: 30, discountCents: 1350, totalCents: 3150 }]
const selector = (type, value) => ({ type, value, reason: 'Special customer discount' })
const revise = (manualDiscount, changes = {}) => reviseCustomCakeV1Quote(base, { quoteVersion: 2, designExtraCents: 2000, figurineExtraCents: 3000, paidSmoreLines: paid, manualDiscount, ...changes })
for (const [type, value, discount, final] of [['percentage', 1000, 2950, 26550], ['percentage', 2000, 5900, 23600], ['percentage', 4000, 11800, 17700], ['percentage', 1250, 3688, 25812], ['fixed', 1000, 1000, 28500], ['fixed', 3000, 3000, 26500], ['fixed', 7550, 7550, 21950]]) {
  test(`manual ${type} ${value} replaces cake promo and paid addon discounts`, () => {
    const q = revise(selector(type, value))
    assert.equal(q.knownTotalCents, final)
    assert.equal(q.finalTotalCents, final)
    assert.deepEqual(q.manualDiscount, { version: 1, type, value, reason: 'Special customer discount', basisCents: 29500, discountCents: discount, replacedAutomaticDiscountCents: 3350 })
    assert.equal(q.cakeDiscountCents, 2000)
    assert.equal(q.paidSmoreTotalCents, 3150)
  })
}
test('automatic and zero retain original automatic pricing and old quote shape', () => {
  for (const input of [undefined, null, selector('percentage', 0), selector('fixed', 0)]) {
    const q = revise(input)
    assert.equal(q.finalTotalCents, 26150)
    assert.equal(Object.hasOwn(q, 'manualDiscount'), false)
  }
})
test('manual discounts reject forged values, excessive precision, overflow, unknown fields and unsettled extras', () => {
  for (const input of [selector('percentage', -1), selector('percentage', 10001), selector('percentage', 1250.1), selector('fixed', -1), selector('fixed', 1.1), selector('fixed', 29501), selector('fixed', Number.MAX_SAFE_INTEGER + 1), selector('percentage', '4000'), selector('invalid', 30), { ...selector('fixed', 30), basisCents: 1 }, { ...selector('fixed', 30), discountCents: 1 }, { ...selector('fixed', 30), reason: '' }, { ...selector('fixed', 30), reason: 'x'.repeat(1001) }]) assert.throws(() => revise(input), { code: 'INVALID_REQUEST' })
  for (const changes of [{ designExtraCents: null }, { figurineExtraCents: null }]) assert.throws(() => revise(selector('percentage', 4000), changes), { code: 'INVALID_REQUEST' })
  assert.equal(revise(selector('percentage', 10000)).finalTotalCents, 0)
  assert.equal(revise(selector('fixed', 29500)).finalTotalCents, 0)
})
function lookup(q) {
  const v = structuredClone(fixture.lookup)
  v.status = 'quoted'; v.quote = q; v.paidSmoreLines = paid
  v.lines[1].quantity = 10
  return v
}
test('new quote reader, persistence and email agree on amounts and reason while legacy reads stay unchanged', () => {
  assert.deepEqual(parseCustomCakeLookupResponse(fixture.lookup), fixture.lookup)
  const q = revise(selector('percentage', 4000)), v = lookup(q)
  assert.deepEqual(parseCustomCakeLookupResponse(v), v)
  const snapshot = { request: fixture.request, creationResponse: fixture.created, lookupResponse: v, quoteHistory: [], transitionAudit: [] }
  assert.deepEqual(decodeCustomCakeRecord('snapshots', encodeCustomCakeRecord('snapshots', snapshot)), snapshot)
  const event = { schemaVersion: 1, eventType: 'custom-cake.quoted', requestId: fixture.request.requestId, requestNumber: v.requestNumber, quoteVersion: 2, occurredAt: '2026-09-30T00:00:00.000Z', dueAt: '2026-09-30T00:00:00.000Z', state: 'pending', snapshot: v, explanation: '' }
  const id = customCakeDocumentId('custom-cake-event-v1', `${event.requestId}/${event.eventType}/2`)
  const payload = buildCustomCakeEmailPayload({ id, event, from: 'orders@example.com' })
  assert.match(payload.text, /Subtotal before discount: AUD 295\.00/)
  assert.match(payload.text, /Special discount \(40%\): −AUD 118\.00/)
  assert.match(payload.text, /Final quote: AUD 177\.00/)
  assert.match(payload.text, /Special customer discount/)
  for (const field of ['basisCents', 'discountCents', 'replacedAutomaticDiscountCents', 'value']) {
    const bad = structuredClone(v); bad.quote.manualDiscount[field]++
    assert.throws(() => parseCustomCakeLookupResponse(bad))
    assert.throws(() => encodeCustomCakeRecord('snapshots', { ...snapshot, lookupResponse: bad }))
    assert.throws(() => buildCustomCakeEmailPayload({ id, event: { ...event, snapshot: bad }, from: 'orders@example.com' }))
  }
})

test('discount percentages do not overflow a safe integer basis and use cent half-up rounding', () => {
  const huge = { ...base, baseCents: Number.MAX_SAFE_INTEGER, cakeDiscountCents: 0, paidSmoreQuantity: 0, paidSmoreTotalCents: 0 }
  const q = reviseCustomCakeV1Quote(huge, { quoteVersion: 2, designExtraCents: 0, figurineExtraCents: 0, paidSmoreLines: [], manualDiscount: selector('percentage', 10000) })
  assert.equal(q.manualDiscount.basisCents, Number.MAX_SAFE_INTEGER)
  assert.equal(q.finalTotalCents, 0)
  assert.throws(() => revise(selector('percentage', 4000), { designExtraCents: Number.MAX_SAFE_INTEGER }), { code: 'INVALID_REQUEST' })
})

test('administrator decimal parsing is exact for money and basis points and rejects malformed precision', async () => {
  const { parseDiscountValue } = await import('../src/lib/custom-cake-ui.ts')
  assert.equal(parseDiscountValue('12.5'), 1250)
  assert.equal(parseDiscountValue('75.50'), 7550)
  assert.equal(parseDiscountValue('0'), 0)
  for (const v of ['-1', '1.001', 'NaN', '1e3', 'Infinity', '', '90071992547410']) assert.throws(() => parseDiscountValue(v))
})

test('manual cents display and edit roundtrip preserve every accepted safe integer cent', async () => {
  const { formatQuoteCents, formatDiscountValue, parseDiscountValue } = await import('../src/lib/custom-cake-ui.ts')
  const cents = 9007199254740982
  const q = { manualDiscount: { type: 'fixed', value: cents } }
  assert.equal(formatQuoteCents(q, cents), 'A$90071992547409.82')
  assert.equal(formatDiscountValue(cents), '90071992547409.82')
  assert.equal(parseDiscountValue(formatDiscountValue(cents)), cents)
})
