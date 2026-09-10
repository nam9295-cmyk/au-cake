import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { createReservationNotificationHandler } from '../appwrite-functions/reservation-notification/src/main.js'
import { createCustomCakeRepository, customCakeDocumentId } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
import { customCakeSchemaTargets } from '../appwrite-functions/reservation-api/src/custom-cake-readiness.js'
import { service } from './custom-cake-persistence.test.mjs'
import { ResendTransportError } from '../appwrite-functions/shared/resend-transport.js'
const url = new URL('../appwrite-functions/reservation-notification/src/custom-cake-notification-runtime.js', import.meta.url)
const runtime = existsSync(url) ? await import(url.href) : {}
const at = new Date('2026-10-04T00:00:00.000Z')
function ready() {
  const targets = customCakeSchemaTargets({ endpoint: 'https://synthetic.invalid/v1', projectId: 'project', databaseId: 'test-db' })
  const env = { CUSTOM_CAKE_NOTIFICATIONS_ENABLED: 'true', CUSTOM_CAKE_PERSISTENCE_ENABLED: 'true', APPWRITE_CUSTOM_CAKE_DATABASE_ID: 'test-db', APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID: targets.bucket.bucketId, APPWRITE_FUNCTION_ID: 'reservation-notification', APPWRITE_FUNCTION_API_ENDPOINT: 'https://synthetic.invalid/v1', APPWRITE_FUNCTION_PROJECT_ID: 'project', RESEND_API_KEY: 'synthetic', RESEND_FROM_EMAIL: 'Cake <cake@example.invalid>' }
  const config = { enabled: true, databaseId: 'test-db', bucketId: targets.bucket.bucketId }
  env.RESEND_TO_EMAILS = 'owner@example.invalid'
  env.REVIEW_ADMIN_USER_IDS = 'admin'
  for (const c of targets.collections) { env[`APPWRITE_CUSTOM_CAKE_${c.kind.toUpperCase()}_TABLE_ID`] = c.collectionId; config[c.kind] = c.collectionId }
  const databases = service()
  databases.get = async () => ({ $id: 'test-db', enabled: true })
  databases.getCollection = async ({ collectionId }) => {
    const c = targets.collections.find(c => c.collectionId === collectionId)
    return { ...structuredClone(c), $id: c.collectionId, databaseId: 'test-db', $permissions: [], attributes: c.attributes.map(a => ({ ...a, status: 'available', array: false, default: null, ...(a.type === 'string' ? { format: '', encrypt: false } : {}) })), indexes: c.indexes.map(i => ({ ...i, status: 'available', lengths: [] })) }
  }
  const fn = { $id: 'reservation-notification', enabled: true, runtime: 'node-22', timeout: 60, execute: ['user:admin'], schedule: '* * * * *', scopes: ['functions.read', 'databases.read', 'collections.read', 'documents.read', 'documents.write', 'buckets.read'] }
  const services = { databases, storage: { getBucket: async () => ({ ...targets.bucket, $id: targets.bucket.bucketId, $permissions: [] }) }, functions: { get: async () => fn } }
  return { env, services, fn, config, req: { headers: { 'x-appwrite-trigger': 'schedule', 'x-appwrite-key': 'platform-synthetic' } } }
}
test('actual notification handler routes only enabled platform schedule to private runtime', async () => {
  let runs = 0
  const createCustomCakeRuntime = async () => ({ run: async () => { runs++; return { processed: 1 } } })
  const handler = createReservationNotificationHandler({ env: { CUSTOM_CAKE_NOTIFICATIONS_ENABLED: 'true' }, createCustomCakeRuntime })
  const res = { json: (body, status = 200) => ({ body, status }) }
  const scheduled = await handler({ req: { headers: { 'x-appwrite-trigger': 'schedule' } }, res })
  assert.equal(scheduled.body.ok, true)
  assert.equal(runs, 1)
  await handler({ req: { headers: {}, body: { trigger: 'schedule' } }, res })
  assert.equal(runs, 1)
  const disabled = createReservationNotificationHandler({ env: {}, createCustomCakeRuntime })
  assert.equal((await disabled({ req: { headers: { 'x-appwrite-trigger': 'schedule' } }, res })).body.result.status, 'disabled')
  assert.equal(runs, 1)
})
test('runtime verifies all private resources, platform key, mail config and same-function recovery readiness', async () => {
  assert.equal(typeof runtime.createCustomCakeNotificationRuntime, 'function')
  assert.ok(await runtime.createCustomCakeNotificationRuntime({ ...ready(), now: () => at }))
  const invalid = [
    x => { x.env.CUSTOM_CAKE_NOTIFICATIONS_ENABLED = 'false' }, x => { x.env.RESEND_API_KEY = '' },
    x => { x.env.RESEND_FROM_EMAIL = '' }, x => { delete x.req.headers['x-appwrite-key'] },
    x => { x.fn.schedule = '' }, x => { x.fn.$id = 'other-function' }, x => { x.fn.enabled = false },
    x => { x.fn.runtime = 'node-16.0' }, x => { x.fn.timeout = 15 }, x => { x.fn.execute = ['any'] },
    x => { x.services.databases.getCollection = async () => ({ $permissions: ['read("any")'] }) },
  ]
  for (const scope of ready().fn.scopes) invalid.push(x => { x.fn.scopes = x.fn.scopes.filter(v => v !== scope) })
  for (const change of invalid) { const input = ready(); change(input); await assert.rejects(runtime.createCustomCakeNotificationRuntime(input), /CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE/) }
})
for (const [name, execute] of [['missing', []], ['extra', ['user:admin', 'user:unrelated-customer']], ['substituted', ['user:unrelated-customer']]]) {
  test(`runtime rejects ${name} configured administrator execution principals`, async () => {
    const input = ready(); input.fn.execute = execute
    await assert.rejects(runtime.createCustomCakeNotificationRuntime(input), /CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE/)
  })
}
test('runtime matches normalized administrator sets and rejects absent or invalid allowlists', async () => {
  const input = ready()
  input.env.REVIEW_ADMIN_USER_IDS = ' second-admin, admin,admin '
  input.fn.execute = ['user:admin', 'user:second-admin']
  assert.ok(await runtime.createCustomCakeNotificationRuntime(input))
  for (const admins of [undefined, '', 'admin,bad principal']) {
    const bad = ready(); bad.env.REVIEW_ADMIN_USER_IDS = admins
    await assert.rejects(runtime.createCustomCakeNotificationRuntime(bad), /CUSTOM_CAKE_NOTIFICATION_UNAVAILABLE/)
  }
})
function eventFixture(eventType) {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url)))
  const snapshot = eventType === 'custom-cake.received' ? fixture.lookup : fixture.finalLookup
  if (eventType === 'custom-cake.quoted') snapshot.status = 'quoted'
  const value = { schemaVersion: 1, eventType, requestId: fixture.request.requestId, requestNumber: snapshot.requestNumber, quoteVersion: snapshot.quote.quoteVersion, occurredAt: at.toISOString(), state: 'pending', dueAt: at.toISOString(), snapshot, explanation: '' }
  return { id: customCakeDocumentId('custom-cake-event-v1', `${value.requestId}/${eventType}/${value.quoteVersion}`), value }
}
function scheduledHandler(input, send, instant = at) {
  return createReservationNotificationHandler({ env: input.env, now: () => instant,
    createCustomCakeRuntime: args => runtime.createCustomCakeNotificationRuntime({ ...args, services: input.services, createTransport: () => ({ send }) }),
  })
}
const response = { json: (body, status = 200) => ({ body, status }) }
for (const recipients of [undefined, 'invalid-address']) {
  test(`actual schedule isolates ${recipients === undefined ? 'missing' : 'malformed'} operator recipients from every customer event`, async () => {
    const input = ready(); input.env.RESEND_TO_EMAILS = recipients
    const repository = createCustomCakeRepository(input.services.databases, input.config)
    const events = ['custom-cake.received', 'custom-cake.quoted', 'custom-cake.confirmed'].map(eventFixture)
    await repository.atomic('seed-role-isolation', async tx => { for (const row of events) await tx.create('outbox', row.id, row.value); return { seeded: true } })
    const messages = []
    const handler = scheduledHandler(input, async payload => { messages.push(payload); return { kind: 'accepted', providerMessageId: `mail-${messages.length}` } })
    for (let n = 0; n < 6; n++) assert.equal((await handler({ req: input.req, res: response })).status, 200)
    assert.equal(messages.length, 3)
    assert.deepEqual(new Set(messages.map(m => m.template)), new Set(events.map(row => row.value.eventType)))
    assert.ok(messages.every(m => m.occurrence === 'customer'))
    for (const row of events) {
      const saved = await repository.get('outbox', row.id)
      assert.equal(saved.emailByRole.customer.emailDelivery.status, 'sent')
      assert.equal(saved.state, row.value.eventType === 'custom-cake.received' ? 'pending' : 'sent')
      assert.equal(saved.emailByRole.operator, undefined)
    }
  })
}
test('actual schedule retries an original operator payload after operator configuration becomes invalid', async () => {
  const input = ready(), repository = createCustomCakeRepository(input.services.databases, input.config)
  const row = eventFixture('custom-cake.received')
  await repository.atomic('seed-saved-operator', tx => tx.create('outbox', row.id, row.value))
  let original
  const initial = scheduledHandler(input, async payload => {
    if (payload.occurrence === 'operator') { original = structuredClone(payload); throw new ResendTransportError('uncertain', 'resend_timeout') }
    return { kind: 'accepted', providerMessageId: 'customer-mail' }
  })
  assert.equal((await initial({ req: input.req, res: response })).status, 200)
  input.env.RESEND_TO_EMAILS = 'invalid-address'
  const messages = []
  const retry = scheduledHandler(input, async payload => { messages.push(payload); return { kind: 'accepted', providerMessageId: 'operator-mail' } }, new Date(at.getTime() + 6 * 60000))
  assert.equal((await retry({ req: input.req, res: response })).status, 200)
  assert.deepEqual(messages, [original])
  assert.equal((await repository.get('outbox', row.id)).state, 'sent')
})
test('bounded schedule keeps durable continuation past inactive outbox rows and consumes saved event', async () => {
  assert.equal(typeof runtime.createCustomCakeNotificationRuntime, 'function')
  const input = ready(), repository = createCustomCakeRepository(input.services.databases, input.config)
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url)))
  const event = { schemaVersion: 1, eventType: 'custom-cake.received', requestId: fixture.request.requestId, requestNumber: fixture.lookup.requestNumber, quoteVersion: 1, occurredAt: at.toISOString(), state: 'pending', dueAt: at.toISOString(), snapshot: fixture.lookup, explanation: '' }
  const id = customCakeDocumentId('custom-cake-event-v1', `${event.requestId}/${event.eventType}/1`)
  await repository.atomic('seed-runtime', async tx => {
    for (let n = 0; n < 101; n++) await tx.create('outbox', `00000000${String(n).padStart(5, '0')}`, { state: 'manual', dueAt: at.toISOString() })
    await tx.create('outbox', id, event)
    return { seeded: true }
  })
  const messages = []
  const worker = await runtime.createCustomCakeNotificationRuntime({ ...input, now: () => at, createTransport: () => ({ send: async payload => { messages.push(payload); return { kind: 'accepted', providerMessageId: 'scheduled-mail' } } }) })
  assert.equal((await worker.run()).scanned, 100)
  assert.equal(messages.length, 0)
  const continuation = await repository.get('ratelimits', 'custom-cake-mail-cursor')
  assert.ok(continuation.cursor)
  await worker.run()
  assert.equal(messages.length, 2)
  assert.equal((await repository.get('outbox', id)).state, 'sent')
  await worker.run()
  assert.equal(messages.length, 2)
})
