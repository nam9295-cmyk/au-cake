import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as api from '../appwrite-functions/reservation-api/src/main.js'
import * as calendar from '../appwrite-functions/reservation-api/src/calendar-access.js'
const fixture = JSON.parse(readFileSync('tests/fixtures/custom-cake-contract/custom-v1.json', 'utf8'))
const at = new Date('2026-09-30T00:00:00.000Z')
const env = { CALENDAR_VIEW_PIN: '123456', CALENDAR_TOKEN_SECRET: 'calendar-production-test-secret-at-least-32', CUSTOM_CAKE_PERSISTENCE_ENABLED: 'true' }
const token = api.calendarLogin({ pin: '123456' }, env, at).token
const snapshot = () => {
  const request = structuredClone(fixture.request), lookupResponse = structuredClone(fixture.lookup)
  request.requestNote = '<script>alert(1)</script> Additional request only'
  request.lines[0].designNote = '[Flavour: Triple Berry]\n\nBlue ribbon\nGold piping'
  lookupResponse.lines = structuredClone(request.lines)
  return { request, lookupResponse, creationResponse: fixture.created, quoteHistory: [{ secret: 'private audit' }], transitionAudit: [{ secret: 'private transition' }] }
}
const eventId = 'custom-cake:CUSTOM-EXAMPLE-1'
function repository(value = snapshot()) {
  const calls = []
  return { calls, async list(kind, query) { calls.push([kind, query]); return [{ id: fixture.request.requestId, value }] } }
}
async function detail(input, repo, now = at) {
  assert.equal(typeof api.getCalendarProductionDetail, 'function')
  return api.getCalendarProductionDetail({}, input, env, now, repo)
}
test('monthly custom cake label includes flavour without either request, PII, photo or history', () => {
  const event = calendar.sanitizeCustomCakeCalendarEvent(snapshot().lookupResponse)
  assert.equal(event.label, 'Custom Cake · Single 6in · Triple Berry ×1')
  assert.deepEqual(event.customCake, { tier: 'single', size: '6in', quantity: 1, flavour: 'Triple Berry' })
  for (const text of ['Blue ribbon', 'Gold piping', 'Additional request', '0412345678', 'contract@example.invalid', 'photo', 'audit']) assert.equal(JSON.stringify(event).includes(text), false)
})
test('PIN-issued production detail projects only approved fields and reads additional request from original request', async () => {
  const value = snapshot()
  value.lookupResponse.requestNote = 'Wrong location must never win'
  const result = await detail({ token, eventId }, repository(value))
  assert.deepEqual(result, { id: eventId, pickupDate: '2026-10-05', pickupTime: '12:00', status: 'Requested', lines: [{ tier: 'single', size: '6in', quantity: 1, flavour: 'Triple Berry', designRequest: 'Blue ribbon\nGold piping', figurineSource: 'shop' }], additionalRequest: '<script>alert(1)</script> Additional request only' })
  for (const text of ['0412345678', 'contract@example.invalid', 'Contract Example', 'photo_refs', 'photoRef', 'photo_1', 'quoteHistory', 'transitionAudit', 'private audit', 'Wrong location']) assert.equal(JSON.stringify(result).includes(text), false)
})
test('invalid, expired, tampered and absent calendar tokens fail before any repository read', async () => {
  for (const [badToken, now] of [[undefined, at], ['', at], ['wrong', at], [token + 'x', at], [token, new Date('2026-10-31T00:00:00.000Z')]]) {
    const repo = repository()
    await assert.rejects(detail({ token: badToken, eventId }, repo, now), { code: 'CALENDAR_UNAUTHORIZED' })
    assert.equal(repo.calls.length, 0)
  }
})
test('legacy notes are never inferred and exact prefix is stripped only when present', async () => {
  for (const [note, flavour, designRequest] of [['Blue ribbon Oreo', null, 'Blue ribbon Oreo'], ['prefix [Flavour: Oreo]\nBlue', null, 'prefix [Flavour: Oreo]\nBlue'], ['[Flavour: Oreo]\n\nBlue', 'Oreo', 'Blue'], ['[Flavour: Biscoff]', 'Biscoff', ''], ['[Flavour: Nutella]\r\n\r\nGold', 'Nutella', 'Gold']]) {
    const value = snapshot(); value.request.lines[0].designNote = note; value.lookupResponse.lines = structuredClone(value.request.lines)
    const result = await detail({ token, eventId }, repository(value))
    assert.equal(result.lines[0].flavour, flavour)
    assert.equal(result.lines[0].designRequest, designRequest)
  }
})
test('every figurine enum and every custom line survives production projection', async () => {
  const value = snapshot()
  value.request.lines = ['none', 'customer', 'shop'].map((figurineSource, i) => ({ ...value.request.lines[0], lineId: `cake_${i}`, figurineSource }))
  value.lookupResponse.lines = structuredClone(value.request.lines)
  const result = await detail({ token, eventId }, repository(value))
  assert.deepEqual(result.lines.map(l => l.figurineSource), ['none', 'customer', 'shop'])
})
test('detail rejects missing, duplicate, unrelated or malformed identities and cannot write', async () => {
  for (const eventId of ['cake:private', 'custom-cake:', 'custom-cake:../secret']) await assert.rejects(detail({ token, eventId }, repository()))
  for (const rows of [[], [{ value: { ...snapshot(), request: { contractVersion: 'cake-order.v2' } } }], [{ value: snapshot() }, { value: snapshot() }]]) {
    await assert.rejects(detail({ token, eventId }, { list: async () => rows }), { code: 'NOT_FOUND' })
  }
  await assert.rejects(detail({ token, eventId, customerEmail: 'injected' }, repository()))
})

test('production detail client rejects extra PII fields, invalid enums, malformed dates and private line metadata', async () => {
  const { parseCalendarProductionDetail } = await import('../src/lib/calendar-production.ts')
  const value = await detail({ token, eventId }, repository())
  assert.deepEqual(parseCalendarProductionDetail(value), value)
  for (const change of [v => { v.customerEmail = 'private@example.com' }, v => { v.lines[0].photoRef = 'private' }, v => { v.pickupDate = '2026-02-30' }, v => { v.pickupTime = '25:00' }, v => { v.status = 'unknown' }, v => { v.lines[0].quantity = 0 }, v => { v.lines[0].figurineSource = 'unknown' }, v => { v.lines[0].flavour = '<script>'.repeat(10) }, v => { v.additionalRequest = 'x'.repeat(1001) }]) {
    const bad = structuredClone(value); change(bad)
    assert.throws(() => parseCalendarProductionDetail(bad), { message: 'RESERVATION_API_INVALID_RESPONSE' })
  }
})
