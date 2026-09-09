import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const moduleUrl = new URL('../appwrite-functions/reservation-api/src/custom-cake-persistence.js', import.meta.url)
const load = async () => { try { return await import(moduleUrl) } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${name}.json`, import.meta.url)))

// SDK service boundary: staged writes are invisible until commit and contend on the
// actual document revision. No network, operational credentials or live database.
function service() {
  const docs = new Map(), txs = new Map(); let serial = 0
  const fail = code => Object.assign(new Error(String(code)), { code })
  const key = p => `${p.collectionId}/${p.documentId}`
  const view = p => p.transactionId ? txs.get(p.transactionId).view : docs
  const api = {
    docs, calls: [], uncertain: false,
    async createTransaction() { const id = `tx${++serial}`; txs.set(id, { view: structuredClone(docs), writes: new Map(), state: 'pending' }); return { $id: id } },
    async getDocument(p) { api.calls.push(['get', p]); const d = view(p).get(key(p)); if (!d) throw fail(404); return structuredClone(d.data) },
    async createDocument(p) { api.calls.push(['create', p]); if (view(p).has(key(p))) throw fail(409); return write(p) },
    async updateDocument(p) { api.calls.push(['update', p]); if (!view(p).has(key(p))) throw fail(404); return write(p) },
    async updateTransaction(p) {
      const tx = txs.get(p.transactionId)
      if (p.rollback) { tx.state = 'rolledback'; return { status: tx.state } }
      for (const [k, w] of tx.writes) if ((docs.get(k)?.revision ?? 0) !== w.base) { tx.state = 'failed'; throw fail(409) }
      for (const [k, w] of tx.writes) docs.set(k, { data: w.data, revision: w.base + 1 })
      tx.state = 'committed'
      if (api.uncertain) { api.uncertain = false; throw fail(504) }
      return { status: tx.state }
    },
  }
  function write(p) {
    assert.ok(p.transactionId, 'all mutations must use SDK transactionId')
    assert.deepEqual(p.permissions ?? [], [], 'no document public permissions')
    const tx = txs.get(p.transactionId), k = key(p)
    const base = tx.writes.get(k)?.base ?? tx.view.get(k)?.revision ?? 0
    const data = { ...tx.view.get(k)?.data, ...structuredClone(p.data), $id: p.documentId }
    tx.view.set(k, { data, revision: base }); tx.writes.set(k, { data, base }); return structuredClone(data)
  }
  return api
}

const config = { enabled: true, databaseId: 'test-db', claims: 'new_claims', snapshots: 'new_snapshots', sessions: 'new_sessions', photos: 'new_photos', quotas: 'new_quotas', outbox: 'new_outbox', commits: 'new_commits', bucketId: 'new-photos' }
const identity = { requestId: '11111111-1111-4111-8111-111111111111', wire: 'custom-cake.v1', creatorScope: 'anonymous:synthetic', fingerprint: 'a'.repeat(64) }
const receipt = () => { const f = fixture('custom-v1'); return { request: f.request, creationResponse: f.created, lookupResponse: f.lookup, quoteHistory: [], transitionAudit: [] } }

test('persistence exports default unavailable and round trips saved prices without a current catalogue', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  assert.equal(m.resolveCustomCakePersistenceConfig({}).enabled, false)
  assert.throws(() => m.createCustomCakeRepository(service(), {}), { code: 'CAPABILITY_UNAVAILABLE' })
  const f = fixture('custom-v1'); assert.ok(f.created)
  const saved = receipt(); const packed = m.encodeCustomCakeRecord('snapshots', saved)
  assert.deepEqual(m.decodeCustomCakeRecord('snapshots', packed), saved)
  for (const value of [NaN, Infinity, undefined, -0]) assert.throws(() => m.encodeCustomCakeRecord('outbox', { value }), { code: 'PERSISTENCE_INVALID_RECORD' })
  assert.throws(() => m.encodeCustomCakeRecord('outbox', { value: 'x'.repeat(65536) }), { code: 'PERSISTENCE_RECORD_TOO_LARGE' })
})

test('one shared request namespace stores original replay and rejects changed wire or creator', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  const sdk = service(), repo = m.createCustomCakeRepository(sdk, config), original = { received: true, totalCents: 15500 }
  await repo.atomic('create-1', async tx => { await tx.claimRequest(identity, original); await tx.create('snapshots', identity.requestId, receipt()); return original })
  assert.deepEqual(await repo.findReplay(identity), original)
  for (const changed of [{ wire: 'cake-order.v2' }, { creatorScope: 'other' }, { fingerprint: 'b'.repeat(64) }]) await assert.rejects(repo.findReplay({ ...identity, ...changed }), { code: 'REQUEST_ID_CONFLICT' })
  assert.equal([...sdk.docs.keys()].filter(k => k.startsWith('new_claims/')).length, 1)
})

test('SDK transaction conflicts roll back a whole receipt, concurrent claim or quote update', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  const sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  let release; const barrier = new Promise(r => { release = r }); let entered = 0
  const create = id => repo.atomic(id, async tx => { await tx.claimRequest(identity, { id }); if (++entered === 2) release(); await barrier; await tx.create('outbox', id, { state: 'pending' }); return id })
  const results = await Promise.allSettled([create('one'), create('two')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'TRANSACTION_CONFLICT')
  assert.equal([...sdk.docs.keys()].filter(k => k.startsWith('new_outbox/')).length, 1)
})

test('committed response lost in transport reconciles durable operation result without rerunning work', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  const sdk = service(), repo = m.createCustomCakeRepository(sdk, config); sdk.uncertain = true; let runs = 0
  const result = await repo.atomic('uncertain-1', async tx => { runs++; await tx.claimRequest(identity, { receipt: 1 }); return { receipt: 1 } })
  assert.deepEqual(result, { receipt: 1 }); assert.equal(runs, 1)
  assert.deepEqual(await repo.atomic('uncertain-1', () => { throw new Error('must not rerun') }), result)
})

test('photo attach and cleanup claim contend on common photo and request fence', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  const sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  await repo.atomic('seed', async tx => { await tx.create('photos', 'photo1', { state: 'staged', requestId: identity.requestId, sessionId: 's1', uploadId: 'u1', inputDigest: 'a'.repeat(64), fileId: 'f1', intentAt: '2026-09-01T00:00:00.000Z', uploadResolved: true }); return null })
  let release; const barrier = new Promise(r => { release = r }); let entered = 0
  const race = (id, state) => repo.atomic(id, async tx => { const p = await tx.get('photos', 'photo1'); assert.equal(p.state, 'staged'); if (++entered === 2) release(); await barrier; await tx.replace('photos', 'photo1', { ...p, state }); if (state === 'attached') await tx.create('snapshots', identity.requestId, receipt()); return state })
  const results = await Promise.allSettled([race('attach', 'attached'), race('cleanup', 'cleanup-claimed')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const photo = await repo.get('photos', 'photo1'); const saved = await repo.get('snapshots', identity.requestId)
  assert.equal(Boolean(saved), photo.state === 'attached')
})

test('snapshot replacement preserves immutable receipt, history and pricing while allowing appended audit', async () => {
  const m = await load(); assert.equal(typeof m.createCustomCakeRepository, 'function')
  const sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  await repo.atomic('s', async tx => { await tx.create('snapshots', identity.requestId, receipt()); return null })
  await assert.rejects(repo.atomic('bad', async tx => { const saved = await tx.get('snapshots', identity.requestId); saved.creationResponse.quote.baseCents = 0; await tx.replace('snapshots', identity.requestId, saved); return null }), { code: 'PERSISTENCE_IMMUTABLE_RECORD' })
  assert.equal((await repo.get('snapshots', identity.requestId)).creationResponse.quote.baseCents, receipt().creationResponse.quote.baseCents)
})

export { service, config }
