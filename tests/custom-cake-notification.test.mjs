import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import * as policy from '../appwrite-functions/shared/email-delivery.js'
import { createCustomCakeRepository, customCakeDocumentId } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
import { service, config } from './custom-cake-persistence.test.mjs'
import { ResendTransportError, createResendTransport } from '../appwrite-functions/shared/resend-transport.js'
const moduleUrl = new URL('../appwrite-functions/reservation-notification/src/custom-cake-notification.js', import.meta.url)
const notification = existsSync(moduleUrl) ? await import(moduleUrl.href) : {}
const fixtures = name => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${name}.json`, import.meta.url)))
const now = new Date('2026-10-03T00:00:00.000Z')
const mail = { from: 'Cake <cake@example.invalid>', replyTo: null, operatorRecipients: ['owner@example.invalid'] }
const eventId = event => customCakeDocumentId('custom-cake-event-v1', `${event.requestId}/${event.eventType}/${event.quoteVersion}`)
function event(type = 'custom-cake.received', version) {
  const f = fixtures(type.startsWith('cake-order') ? 'cake-order-v2' : 'custom-v1')
  const snapshot = type === 'custom-cake.confirmed' || type === 'custom-cake.quoted' ? f.finalLookup : f.lookup
  if (type === 'custom-cake.quoted') { snapshot.status = 'quoted'; snapshot.acceptance = null; snapshot.acceptanceHistory = []; snapshot.quote.quoteVersion = version || 2 }
  return { schemaVersion: 1, eventType: type, requestId: f.request.requestId, requestNumber: snapshot.requestNumber || snapshot.reservationNumber, quoteVersion: snapshot.quote?.quoteVersion || 0, occurredAt: now.toISOString(), state: 'pending', dueAt: now.toISOString(), snapshot, explanation: type === 'custom-cake.quoted' ? '<script>explanation</script>' : '' }
}
test('new private identity policy is opt-in and does not widen old template validation', () => {
  assert.equal(policy.CUSTOM_CAKE_EMAIL_IDENTITY_POLICY, 'custom-cake-events.v1')
  const identity = { sourceType: 'custom-cake', sourceId: eventId(event('custom-cake.quoted')), template: 'custom-cake.quoted', occurrence: 'customer' }
  assert.throws(() => policy.buildEmailDeliveryEventKey(identity), { code: 'INVALID_EMAIL_DELIVERY_EVENT' })
  assert.match(policy.buildEmailDeliveryEventKey(identity, { identityPolicy: policy.CUSTOM_CAKE_EMAIL_IDENTITY_POLICY }), /^custom-cake.quoted:/)
  for (const bad of [{ template: 'custom-cake.completed' }, { sourceType: 'cake' }, { occurrence: 'extra' }]) assert.throws(() => policy.buildEmailDeliveryEventKey({ ...identity, ...bad }, { identityPolicy: policy.CUSTOM_CAKE_EMAIL_IDENTITY_POLICY }))
  assert.equal(policy.EMAIL_DELIVERY_TEMPLATES.length, 6)
})
async function setup(events = [event()]) {
  assert.equal(typeof notification.createCustomCakeNotificationDispatcher, 'function')
  const sdk = service(), repository = createCustomCakeRepository(sdk, config)
  for (const value of events) await repository.atomic(`seed/${eventId(value)}`, tx => tx.create('outbox', eventId(value), value))
  return { sdk, repository, dispatch: notification.createCustomCakeNotificationDispatcher({ repository, ...mail }) }
}
test('four saved variants deliver once; quote versions are separate provider identities', async () => {
  const events = [event(), event('custom-cake.quoted', 2), event('custom-cake.quoted', 3), event('custom-cake.confirmed'), event('cake-order-v2.received')]
  const { dispatch, repository } = await setup(events)
  const sent = []
  const transport = createResendTransport({ apiKey: 'synthetic', post: async (url, body, headers) => { sent.push({ url, body, headers }); return { id: `mail-${sent.length}` } } })
  for (const value of events) {
    assert.equal((await dispatch.deliver(eventId(value), { transport, now })).status, 'sent')
    assert.equal((await dispatch.deliver(eventId(value), { transport, now })).status, 'already_sent')
    const saved = await repository.get('outbox', eventId(value))
    assert.deepEqual(saved.snapshot, value.snapshot)
    assert.equal(saved.state, 'sent')
    assert.equal(saved.emailByRole.customer.emailDelivery.attempts, 1)
    assert.equal(saved.emailByRole.customer.emailPayload.payloadHash, policy.payloadHashForEmail(saved.emailByRole.customer.emailPayload, { identityPolicy: policy.CUSTOM_CAKE_EMAIL_IDENTITY_POLICY }))
  }
  assert.equal(new Set(sent.map(v => v.headers['Idempotency-Key'])).size, 7)
  assert.ok(sent[2].body.html.includes('&lt;script&gt;explanation&lt;/script&gt;'))
  assert.ok(!JSON.stringify(sent).includes('photo_A'))
  assert.ok(!JSON.stringify(sent).includes('uploadToken'))
  assert.match(sent[0].body.text, /not.*confirmed/i)
})
test('same event workers fence sends and preserve original payload across failed retry and config changes', async () => {
  const value = event('custom-cake.quoted')
  const { repository, dispatch } = await setup([value])
  let calls = 0
  const payloads = []
  const transport = { send: async payload => { calls++; payloads.push(structuredClone(payload)); throw new ResendTransportError('uncertain', 'resend_timeout') } }
  await Promise.allSettled([dispatch.deliver(eventId(value), { transport, now }), dispatch.deliver(eventId(value), { transport, now })])
  assert.equal(calls, 1)
  const retry = notification.createCustomCakeNotificationDispatcher({ repository, from: 'Changed <changed@example.invalid>', replyTo: null })
  const later = new Date(now.getTime() + 6 * 60000)
  const accepted = { send: async payload => { calls++; payloads.push(structuredClone(payload)); return { kind: 'accepted', providerMessageId: 'accepted-on-retry' } } }
  await Promise.allSettled([retry.deliver(eventId(value), { transport: accepted, now: later }), retry.deliver(eventId(value), { transport: accepted, now: later })])
  assert.equal(calls, 2)
  assert.deepEqual(payloads[1], payloads[0])
  const saved = await repository.get('outbox', eventId(value))
  assert.equal(saved.emailByRole.customer.emailRetryClaim.status, 'sent')
  assert.equal(saved.emailByRole.customer.emailDelivery.firstAttemptAt, now.toISOString())
  assert.equal(saved.emailByRole.customer.emailDelivery.attempts, 2)
})
test('response loss reconciles durable attempt; expired retry and unknown events never send', async () => {
  const { dispatch, sdk, repository } = await setup([event('custom-cake.quoted')])
  const id = eventId(event('custom-cake.quoted'))
  let calls = 0
  sdk.uncertain = true
  const transport = { send: async () => { calls++; throw new ResendTransportError('uncertain', 'resend_timeout') } }
  await dispatch.deliver(id, { transport, now })
  assert.equal(calls, 1)
  const result = await dispatch.deliver(id, { transport, now: new Date(now.getTime() + 23 * 3600000) })
  assert.equal(result.retry, 'expired_window')
  assert.equal(calls, 1)
  assert.equal((await repository.get('outbox', id)).state, 'manual')
  for (const type of ['custom-cake.accepted', 'custom-cake.completed', 'custom-cake.cancelled']) {
    const value = { ...event(), eventType: type }
    await repository.atomic(`bad/${type}`, tx => tx.create('outbox', eventId(value), value))
    await assert.rejects(dispatch.deliver(eventId(value), { transport, now }), /INVALID_CUSTOM_CAKE_EMAIL_EVENT/)
  }
  assert.equal(calls, 1)
})
test('received operator and customer identities retry independently without suppressing either receipt', async () => {
  const { repository } = await setup()
  const dispatch = notification.createCustomCakeNotificationDispatcher({ repository, ...mail, operatorRecipients: ['OWNER@example.invalid', 'second@example.invalid', 'owner@example.invalid'] })
  const value = event(), id = eventId(value), messages = []
  const transport = { send: async payload => { messages.push(payload); if (payload.occurrence === 'operator') throw new ResendTransportError('failed', 'resend_rate_limit_exceeded'); return { kind: 'accepted', providerMessageId: 'customer-receipt' } } }
  await dispatch.deliver(id, { transport, now })
  assert.equal(messages.length, 2)
  assert.notEqual(messages[0].idempotencyKey, messages[1].idempotencyKey)
  let saved = await repository.get('outbox', id)
  assert.equal(saved.emailByRole.customer.emailDelivery.status, 'sent')
  assert.equal(saved.emailByRole.operator.emailDelivery.status, 'failed')
  assert.equal(saved.state, 'pending')
  await dispatch.deliver(id, { now: new Date(now.getTime() + 6 * 60000), transport: { send: async payload => { messages.push(payload); return { kind: 'accepted', providerMessageId: 'operator-receipt' } } } })
  assert.equal(messages.length, 3)
  assert.deepEqual(messages[2].to, ['owner@example.invalid', 'second@example.invalid'])
  saved = await repository.get('outbox', id)
  assert.equal(saved.emailByRole.customer.emailDelivery.attempts, 1)
  assert.equal(saved.emailByRole.operator.emailDelivery.attempts, 2)
  assert.equal(saved.state, 'sent')
})
test('received operator receipts include contact and immutable custom order selections without exposing photos', () => {
  const value = event()
  value.snapshot.lines[0].designNote = '<Blue & gold>'
  const id = eventId(value)
  const operator = notification.buildCustomCakeEmailPayload({ id, event: value, ...mail, role: 'operator' })
  const customer = notification.buildCustomCakeEmailPayload({ id, event: value, ...mail, role: 'customer' })
  assert.match(operator.text, /Contact phone: 0412345678/)
  assert.match(operator.text, /Contact email: contract@example\.invalid/)
  assert.match(operator.text, /Custom Cake cake_A: single 6in × 1; design: <Blue & gold>; figurine: shop/)
  assert.match(operator.text, /Paid S’more smore_A: × 2; add-on to cake_A; AUD 6\.30/)
  assert.doesNotMatch(operator.text, /Gift S.more/)
  assert.match(operator.html, /design: &lt;Blue &amp; gold&gt;/)
  assert.doesNotMatch(operator.text, /photo_A|photo_B|uploadToken/)
  assert.doesNotMatch(operator.html, /photo_A|photo_B|uploadToken/)
  assert.doesNotMatch(customer.text, /Contact phone:|Contact email:|Custom Cake cake_A:/)
})
test('received operator receipts include ordinary v2 selections and paid S’more association', () => {
  const value = event('cake-order-v2.received'), id = eventId(value)
  const operator = notification.buildCustomCakeEmailPayload({ id, event: value, ...mail, role: 'operator' })
  assert.match(operator.text, /Cake cake_A: pave-cake × 1; paid AUD 79\.00/)
  assert.match(operator.text, /Selections: Cake size=6in; Chocolate type=dark;/)
  assert.match(operator.text, /Vanilla cake flavor=triple-berry;/)
  assert.match(operator.text, /Individual packaging=no/)
  assert.match(operator.text, /Paid S’more smore_A: × 2; add-on to cake_A; AUD 6\.30/)
})
test('missing operator configuration keeps the durable event pending and resumes only the missing role', async () => {
  const { repository } = await setup()
  const id = eventId(event()), messages = []
  const transport = { send: async payload => { messages.push(payload); return { kind: 'accepted', providerMessageId: `mail-${messages.length}` } } }
  const missing = notification.createCustomCakeNotificationDispatcher({ repository, from: mail.from })
  assert.equal((await missing.deliver(id, { now, transport })).status, 'configuration_error')
  assert.equal((await repository.get('outbox', id)).state, 'pending')
  const repaired = notification.createCustomCakeNotificationDispatcher({ repository, ...mail })
  assert.equal((await repaired.deliver(id, { now, transport })).status, 'sent')
  assert.equal(messages.length, 2)
  assert.deepEqual(messages.map(m => m.occurrence), ['customer', 'operator'])
})
