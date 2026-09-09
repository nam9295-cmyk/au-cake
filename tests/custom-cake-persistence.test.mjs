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
    async listDocuments(p) {
      let documents = [...docs.entries()].filter(([k]) => k.startsWith(`${p.collectionId}/`)).map(([, v]) => v.data)
      for (const query of p.queries.map(JSON.parse)) if (query.method === 'equal') documents = documents.filter(d => query.values.includes(d[query.attribute]))
      return { documents: structuredClone(documents), total: documents.length }
    },
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

const config = { enabled: true, databaseId: 'test-db', claims: 'new_claims', snapshots: 'new_snapshots', sessions: 'new_sessions', photos: 'new_photos', quotas: 'new_quotas', outbox: 'new_outbox', commits: 'new_commits', chunks: 'new_chunks', histories: 'new_histories', ratelimits: 'new_ratelimits', bucketId: 'new-photos' }
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
  assert.equal(m.decodeCustomCakeRecord('outbox', m.encodeCustomCakeRecord('outbox', { value: 'x'.repeat(65536) })).value.length, 65536)
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

test('unresolved commit fails closed; JSON cannot silently erase holes or typed metadata', async () => {
  const m = await load(), sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  sdk.updateTransaction = async () => { throw Object.assign(new Error('timeout'), { code: 504 }) }
  await assert.rejects(repo.atomic('lost', async tx => { await tx.claimRequest(identity, { receipt: 1 }); return true }), { code: 'PERSISTENCE_UNCERTAIN' })
  assert.equal(await repo.findReplay(identity), null)
  assert.throws(() => m.encodeCustomCakeRecord('outbox', { holes: Array(1) }), { code: 'PERSISTENCE_INVALID_RECORD' })
})

test('durable metadata rejects raw tokens and invalid photo/quota states; snapshot discovery is indexed', async () => {
  const m = await load()
  for (const [kind, value] of [
    ['sessions', { requestId: identity.requestId, token: 'secret' }],
    ['photos', { state: 'public' }], ['quotas', { used: 6 }],
  ]) assert.throws(() => m.encodeCustomCakeRecord(kind, value), { code: kind === 'sessions' ? 'PERSISTENCE_SENSITIVE_RECORD' : 'PERSISTENCE_INVALID_RECORD' })
  const packed = m.encodeCustomCakeRecord('snapshots', receipt())
  assert.equal(packed.lookupKey, 'CUSTOM-EXAMPLE-1')
  assert.equal(packed.state, 'requested')
})

test('legal large Unicode requests roundtrip through chunks; audit history appends without rewriting previous events', async () => {
  const m = await load(), sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  const saved = receipt(), selections = [['single', '6in'], ['single', '8in'], ['single', '10in'], ['double', '4in+6in'], ['double', '6in+8in'], ['double', '8in+10in']]
  saved.request.lines = selections.flatMap(([tier, size], i) => Array.from({ length: 5 }, (_, n) => ({ ...saved.request.lines[0], lineId: `line_${i}_${n}`, tier, size, photoRefs: [], designNote: '한'.repeat(1000) })))
  saved.lookupResponse.lines = structuredClone(saved.request.lines)
  assert.ok(Buffer.byteLength(JSON.stringify(saved)) > 180000)
  await repo.atomic('large', async tx => { await tx.create('snapshots', identity.requestId, saved); return saved.creationResponse })
  assert.deepEqual(await repo.get('snapshots', identity.requestId), saved)
  for (const row of sdk.docs.values()) assert.ok(Buffer.byteLength(row.data.payloadJson) <= 65535)
  for (let n = 0; n < 2; n++) await repo.atomic(`history-${n}`, async tx => { const value = await tx.get('snapshots', identity.requestId); value.quoteHistory.push({ quoteVersion: n + 1, explanation: '한'.repeat(1000) }); await tx.replace('snapshots', identity.requestId, value); return null })
  assert.equal((await repo.get('snapshots', identity.requestId)).quoteHistory.length, 2)
  assert.equal([...sdk.docs.keys()].filter(k => k.startsWith('new_histories/')).length, 2)
  assert.ok(sdk.calls.filter(([verb, p]) => verb === 'update' && p.collectionId === 'new_histories').length === 0)
  const discovered = await repo.list('snapshots', { lookupKey: 'CUSTOM-EXAMPLE-1' })
  assert.equal(discovered[0].value.quoteHistory.length, 2)
  await assert.rejects(repo.atomic('rewrite-history', async tx => {
    const history = [...sdk.docs.entries()].find(([k]) => k.startsWith('new_histories/'))
    const id = history[0].split('/')[1], event = await tx.get('histories', id)
    await tx.replace('histories', id, { ...event, value: { changed: true } }); return null
  }), { code: 'PERSISTENCE_IMMUTABLE_RECORD' })
})

test('concurrent quota increments share one durable fence and session expiry is immutable', async () => {
  const m = await load(), sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  await repo.atomic('quota', async tx => {
    await tx.create('quotas', identity.requestId, { requestId: identity.requestId, used: 4 })
    await tx.create('sessions', 'session1', { requestId: identity.requestId, tokenDigest: 'a'.repeat(64), issuedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-01T00:30:00.000Z' }); return null
  })
  let release; const barrier = new Promise(r => { release = r }); let entered = 0
  const reserve = id => repo.atomic(id, async tx => { const q = await tx.get('quotas', identity.requestId); if (++entered === 2) release(); await barrier; await tx.replace('quotas', identity.requestId, { ...q, used: q.used + 1 }); return true })
  const result = await Promise.allSettled([reserve('upload1'), reserve('upload2')])
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await repo.get('quotas', identity.requestId)).used, 5)
  await assert.rejects(repo.atomic('extend-session', async tx => { const s = await tx.get('sessions', 'session1'); s.expiresAt = '2026-09-01T01:00:00.000Z'; await tx.replace('sessions', 'session1', s); return null }), { code: 'PERSISTENCE_IMMUTABLE_RECORD' })
})

test('concurrent quote/status/audit writes have one winner and preserve the original creation receipt', async () => {
  const m = await load(), sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  await repo.atomic('snapshot', async tx => { await tx.create('snapshots', identity.requestId, receipt()); return null })
  let release; const barrier = new Promise(r => { release = r }); let entered = 0
  const mutate = (id, status) => repo.atomic(id, async tx => {
    const s = await tx.get('snapshots', identity.requestId)
    if (++entered === 2) release(); await barrier
    s.lookupResponse.status = status
    s.transitionAudit.push({ action: id, source: 'requested', target: status, quoteVersion: 1, adminId: 'admin1', at: '2026-09-01T00:00:00.000Z' })
    await tx.replace('snapshots', identity.requestId, s); await tx.create('outbox', id, { state: 'pending' }); return s.lookupResponse
  })
  const result = await Promise.allSettled([mutate('quote', 'quoted'), mutate('cancel', 'cancelled')])
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1)
  const saved = await repo.get('snapshots', identity.requestId)
  assert.equal(saved.transitionAudit.length, 1); assert.equal(saved.transitionAudit[0].target, saved.lookupResponse.status)
  assert.deepEqual(saved.creationResponse, receipt().creationResponse)
  assert.equal([...sdk.docs.keys()].filter(k => k.startsWith('new_outbox/')).length, 1)
})

test('saved quote and v2 totals are validated without reconstructing prices from the current catalogue', async () => {
  const m = await load()
  const saved = receipt(); saved.lookupResponse.quote.knownTotalCents++
  assert.throws(() => m.encodeCustomCakeRecord('snapshots', saved), { code: 'PERSISTENCE_INVALID_RECORD' })
  const f = fixture('cake-order-v2'), ordinary = { request: f.request, creationResponse: f.created, lookupResponse: f.lookup, quoteHistory: [], transitionAudit: [] }
  assert.deepEqual(m.decodeCustomCakeRecord('snapshots', m.encodeCustomCakeRecord('snapshots', ordinary)), ordinary)
  ordinary.lookupResponse.pricing.totalCents = -1
  assert.throws(() => m.encodeCustomCakeRecord('snapshots', ordinary), { code: 'PERSISTENCE_INVALID_RECORD' })
})

test('durable operation markers and snapshots reject upload secrets, image bytes and raw coupon codes', async () => {
  const m = await load(), sdk = service(), repo = m.createCustomCakeRepository(sdk, config)
  for (const result of [{ uploadToken: 'synthetic' }, { nested: { base64: 'AAAA' } }, { token: 'synthetic' }, { promoCode: 'SECRET-COUPON' }]) {
    await assert.rejects(repo.atomic(`sensitive-${Object.keys(result)[0]}`, async () => result), { code: 'PERSISTENCE_SENSITIVE_RECORD' })
  }
  assert.equal(sdk.docs.size, 0)
  const f = fixture('cake-order-v2'), value = { request: { ...f.request, promoCode: 'SECRET-COUPON' }, creationResponse: f.created, lookupResponse: f.lookup, quoteHistory: [], transitionAudit: [] }
  assert.throws(() => m.encodeCustomCakeRecord('snapshots', value), { code: 'PERSISTENCE_SENSITIVE_RECORD' })
})
