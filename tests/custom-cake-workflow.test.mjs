import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { service, config } from './custom-cake-persistence.test.mjs'
import { createCustomCakeRepository } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'

const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-workflow.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }
const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${n}.json`, import.meta.url)))
const data = () => { const v = fixture('custom-v1').request; v.lines[0].photoRefs = []; return v }
const admin = { adminId: 'admin-1' }
const base = (requestNumber, expectedQuoteVersion = 1) => ({ contractVersion: 'custom-cake.v1', requestNumber, expectedQuoteVersion })
async function setup() {
  const m = await load(); assert.equal(typeof m.createCustomCakeWorkflow, 'function')
  const sdk = service(), repository = createCustomCakeRepository(sdk, config)
  let time = new Date('2026-09-13T00:00:00.000Z')
  const workflow = m.createCustomCakeWorkflow({ repository, fingerprintKey: Buffer.alloc(32, 7), now: () => time, smoreWritesEnabled: true, assertLegacyAbsent: async () => {}, photos: { attach: async () => {} }, coupons: { resolve: async () => null } })
  return { sdk, repository, workflow, clock: value => { time = new Date(value) } }
}

test('workflow creates one immutable receipt/event and replays before clock or photo validation', async () => {
  const h = await setup(), input = data(), created = await h.workflow.create(input, {})
  assert.equal(created.status, 'requested'); assert.equal(created.quote.giftSmoreQuantity, 0)
  h.clock('2027-01-01T00:00:00.000Z')
  assert.deepEqual(await h.workflow.create(input, {}), created)
  await assert.rejects(h.workflow.create({ ...input, requestNote: 'changed' }, {}), { code: 'REQUEST_ID_CONFLICT' })
  const events = await h.repository.list('outbox'); assert.equal(events.length, 1)
  assert.equal(events[0].value.eventType, 'custom-cake.received')
  assert.equal(events[0].value.snapshot.status, 'requested')
})

test('same request ID with a different Custom Cake promo code is not an idempotent replay', async () => {
  const h = await setup(), request = data()
  const first = await h.workflow.create(request, {})
  assert.equal(first.quote.cakeDiscountCents, 0)
  const changedPromo = { ...request, promoCode: 'VERYGOOD CUSTOM' }
  await assert.rejects(h.workflow.create(changedPromo, {}), { code: 'REQUEST_ID_CONFLICT' })
})

test('quote revisions preserve stale agreement; confirmation requires explicit latest final agreement', async () => {
  const h = await setup(), created = await h.workflow.create(data(), {}), n = created.requestNumber
  await assert.rejects(h.workflow.mutate('confirm', base(n), admin), { code: 'QUOTE_STATE_CONFLICT' })
  const update = (v, extra) => h.workflow.mutate('quote', { ...base(n, v), designExtraCents: extra, figurineExtraCents: 0, explanation: 'Agreed design' }, admin)
  await update(1, null)
  await assert.rejects(h.workflow.mutate('confirm', base(n, 2), admin), { code: 'QUOTE_NOT_FINAL' })
  await update(2, 2000)
  await assert.rejects(h.workflow.mutate('confirm', base(n, 3), admin), { code: 'QUOTE_ACCEPTANCE_REQUIRED' })
  const accept = v => h.workflow.mutate('accept', { contractVersion: 'custom-cake.v1', requestNumber: n, quoteVersion: v, customerConsent: true }, admin)
  const a = await accept(3); assert.equal(a.acceptance.acceptedAt, '2026-09-13T00:00:00.000Z')
  assert.deepEqual(await accept(3), a)
  const revised = await update(3, 3000)
  assert.equal(revised.acceptance.acceptedQuoteVersion, 3)
  await assert.rejects(h.workflow.mutate('confirm', base(n, 4), admin), { code: 'QUOTE_VERSION_CONFLICT' })
  await accept(4)
  const confirmed = await h.workflow.mutate('confirm', base(n, 4), admin)
  assert.equal(confirmed.status, 'confirmed'); assert.equal(confirmed.acceptanceHistory.length, 2)
  assert.deepEqual(await h.workflow.mutate('confirm', base(n, 4), admin), confirmed)
  assert.deepEqual(await accept(4), confirmed)
  const complete = { ...base(n, 4), expectedStatus: 'confirmed' }
  const completed = await h.workflow.mutate('complete', complete, admin)
  assert.deepEqual(await h.workflow.mutate('complete', complete, admin), completed)
  await assert.rejects(accept(4), { code: 'QUOTE_STATE_CONFLICT' })
  await assert.rejects(h.workflow.mutate('confirm', base(n, 4), admin), { code: 'QUOTE_STATE_CONFLICT' })
  await assert.rejects(h.workflow.mutate('cancel', complete, admin), { code: 'QUOTE_STATE_CONFLICT' })
  const events = await h.repository.list('outbox')
  assert.equal(events.length, 5); assert.equal(events.filter(e => e.value.eventType === 'custom-cake.confirmed').length, 1)
  assert.equal(events.find(e => e.value.eventType === 'custom-cake.received').value.snapshot.quote.quoteVersion, 1)
  assert.deepEqual(await h.workflow.create(data(), {}), created)
})

test('admin boundary and strict mutation validation precede reads and state/version CAS', async () => {
  const h = await setup(), c = await h.workflow.create(data(), {}), n = c.requestNumber
  await assert.rejects(h.workflow.mutate('quote', null, {}), { code: 'FORBIDDEN' })
  await assert.rejects(h.workflow.mutate('quote', { ...base(n), designExtraCents: -1, figurineExtraCents: 0, explanation: '' }, admin), { code: 'INVALID_REQUEST' })
  await assert.rejects(h.workflow.mutate('cancel', { ...base(n, 2), expectedStatus: 'quoted' }, admin), { code: 'QUOTE_STATE_CONFLICT' })
  await assert.rejects(h.workflow.mutate('cancel', { ...base(n, 2), expectedStatus: 'requested' }, admin), { code: 'QUOTE_VERSION_CONFLICT' })
  await h.workflow.mutate('cancel', { ...base(n), expectedStatus: 'requested' }, admin)
  await assert.rejects(h.workflow.mutate('cancel', { ...base(n), expectedStatus: 'quoted' }, admin), { code: 'QUOTE_STATE_CONFLICT' })
  await assert.rejects(h.workflow.mutate('confirm', base(n, 99), admin), { code: 'QUOTE_STATE_CONFLICT' })
})

test('simultaneous wire domains compete on one request claim and uncertain commit replays once', async () => {
  const h = await setup(), custom = data(), ordinary = fixture('cake-order-v2').request
  const result = await Promise.allSettled([h.workflow.create(custom, {}), h.workflow.create(ordinary, {})])
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(result.find(r => r.status === 'rejected').reason.code, 'REQUEST_ID_CONFLICT')
  assert.equal((await h.repository.list('snapshots')).length, 1)
  const h2 = await setup(); h2.sdk.uncertain = true
  const saved = await h2.workflow.create(custom, {})
  assert.deepEqual(await h2.workflow.create(custom, {}), saved)
})
