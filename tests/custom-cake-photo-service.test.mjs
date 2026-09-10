import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { service as database, config } from './custom-cake-persistence.test.mjs'
import { createCustomCakeRepository } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'

const load = async () => { try { return await import('../appwrite-functions/reservation-api/src/custom-cake-photo-service.js') } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e } }
const requestId = '11111111-1111-4111-8111-111111111111', requestNumber = 'CUSTOM-EXAMPLE-1', version = 'custom-cake-photo.v1'
const error = code => Object.assign(new Error(String(code)), { code })
const headers = s => ({ 'x-custom-cake-upload-session': s.uploadSessionId, 'x-custom-cake-upload-token': s.uploadToken })
const fixture = refs => {
  const f = JSON.parse(readFileSync(new URL('./fixtures/custom-cake-contract/custom-v1.json', import.meta.url)))
  f.request.lines[0].photoRefs = refs; f.lookup.lines[0].photoRefs = refs
  return { request: f.request, creationResponse: f.created, lookupResponse: f.lookup, quoteHistory: [], transitionAudit: [] }
}
async function setup(options = {}) {
  const m = await load(); assert.equal(typeof m.createCustomCakePhotoService, 'function')
  const sdk = database(), repository = createCustomCakeRepository(sdk, config), files = new Map()
  const h = { clock: Date.parse('2026-09-09T00:00:00.000Z'), sdk, repository, files, writes: 0, deletes: 0, failDelete: false }
  const storage = {
    async upload(fileId, bytes) { h.writes++; assert.equal((await repository.list('photos', {})).some(p => p.value.fileId === fileId && ['staging', 'cleanup-claimed'].includes(p.value.state)), true, 'durable intent precedes Storage'); files.set(fileId, Buffer.from(bytes)) },
    async read(fileId) { if (!files.has(fileId)) throw error(404); return Buffer.from(files.get(fileId)) },
    async resolveUpload(fileId) { return files.has(fileId) ? { settled: true, bytes: Buffer.from(files.get(fileId)) } : { settled: false } },
    async delete(fileId) { h.deletes++; if (h.failDelete) throw error(503); files.delete(fileId) },
  }
  const deps = { repository, storage, tokenDigestKey: Buffer.alloc(32, 17), now: () => new Date(h.clock), allowSessionIssue: async ({ context }) => context?.allowed === true,
    resolveRequestAccess: async ({ requestNumber: n, context }) => context?.verified === true && n === requestNumber ? { requestId, requestNumber } : null, ...options }
  h.service = m.createCustomCakePhotoService(deps); h.storage = storage; h.deps = deps
  h.issue = () => h.service.issueSession({ contractVersion: version, requestId }, { allowed: true })
  h.input = { contractVersion: version, requestId, uploadId: 'upload_A', mimeType: 'image/png', base64: (await sharp({ create: { width: 32, height: 16, channels: 3, background: '#5588aa' } }).png().toBuffer()).toString('base64') }
  h.upload = (s, uploadId = 'upload_A') => h.service.upload({ ...h.input, uploadId }, headers(s))
  h.attach = (s, refs, operation = 'attach') => repository.atomic(operation, async tx => { await tx.create('snapshots', requestId, fixture(refs)); await h.service.attach(tx, { requestId, requestNumber, photoRefs: refs, headers: headers(s) }); return { requestNumber } })
  h.access = ref => ({ contractVersion: version, requestNumber, photoRef: ref, authorization: { kind: 'admin' } })
  return h
}

test('sessions require abuse control, isolate repeats, expire exclusively and persist no bearer', async () => {
  const h = await setup(), a = await h.issue(), b = await h.issue()
  assert.notEqual(a.uploadToken, b.uploadToken); assert.notEqual(a.uploadSessionId, b.uploadSessionId)
  assert.equal(Buffer.from(a.uploadToken, 'base64url').length, 32); assert.equal(a.expiresAt, '2026-09-09T00:30:00.000Z')
  assert.deepEqual(a.limits, { maxPhotosPerRequest: 5, maxInputBytes: 10485760, maxDecodedPixels: 20000000, maxStoredDimension: 2560, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'], storedMimeType: 'image/webp', maxFrames: 1 })
  assert.equal(JSON.stringify([...h.sdk.docs]).includes(a.uploadToken), false)
  await assert.rejects(h.service.issueSession({ contractVersion: version, requestId }, {}), { code: 'FORBIDDEN' })
  await assert.rejects(h.service.upload(h.input, {}), { code: 'PHOTO_SESSION_INVALID' })
  await assert.rejects(h.service.upload(h.input, { ...headers(a), 'x-custom-cake-upload-token': b.uploadToken }), { code: 'PHOTO_SESSION_INVALID' })
  h.clock += 1800000
  await assert.rejects(h.upload(a), { code: 'PHOTO_SESSION_EXPIRED' })
  await assert.rejects(h.service.upload(h.input, { ...headers(a), 'x-custom-cake-upload-token': b.uploadToken }), { code: 'PHOTO_SESSION_INVALID' })
  const m = await load()
  for (const key of ['allowSessionIssue', 'resolveRequestAccess', 'tokenDigestKey']) assert.throws(() => m.createCustomCakePhotoService({ ...h.deps, [key]: undefined }), { code: 'CAPABILITY_UNAVAILABLE' })
})

test('upload idempotency uses session, bytes and MIME; concurrent quotas cap all sessions at five', async () => {
  const h = await setup(), a = await h.issue(), b = await h.issue()
  const first = await h.upload(a)
  assert.deepEqual(await h.upload(a), first); assert.equal(h.writes, 1)
  await assert.rejects(h.service.upload({ ...h.input, base64: (await sharp(Buffer.from(h.input.base64, 'base64')).flop().jpeg().toBuffer()).toString('base64'), mimeType: 'image/jpeg' }, headers(a)), { code: 'PHOTO_UPLOAD_CONFLICT' })
  const results = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => h.upload(i % 2 ? a : b, `upload_${i}`)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 4)
  for (const r of results.filter(r => r.status === 'rejected')) assert.equal(r.reason.code, 'PHOTO_LIMIT_EXCEEDED')
  assert.equal(h.files.size, 5); assert.equal((await h.repository.get('quotas', requestId)).used, 5)
  const durable = JSON.stringify([...h.sdk.docs]); assert.equal(durable.includes(h.input.base64), false); assert.equal(durable.includes(a.uploadToken), false)
})

test('attach is all-or-nothing with request, rejects duplicate refs and cross-session ownership', async () => {
  const h = await setup(), a = await h.issue(), b = await h.issue(), p = await h.upload(a), q = await h.upload(b)
  await assert.rejects(h.attach(a, [p.photoRef, q.photoRef], 'mixed'), { code: 'INVALID_PHOTO_REFERENCE' })
  assert.equal(await h.repository.get('snapshots', requestId), null); assert.equal((await h.repository.get('photos', p.photoRef)).state, 'staged')
  await assert.rejects(h.attach(a, [p.photoRef, p.photoRef], 'duplicate'), { code: 'INVALID_PHOTO_REFERENCE' })
  await h.attach(a, [p.photoRef]); assert.equal((await h.repository.get('photos', p.photoRef)).state, 'attached')
  assert.equal((await h.repository.get('sessions', a.uploadSessionId)).attachedRequestNumber, requestNumber)
})

test('read requires independent verified request access and deletion preserves immutable pricing and replay', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a)
  await h.attach(a, [p.photoRef]); const before = await h.repository.get('snapshots', requestId)
  const data = h.access(p.photoRef)
  for (const context of [{}, { uploadToken: a.uploadToken }, { customerPhone: '0412345678' }]) await assert.rejects(h.service.read(data, context), { code: 'NOT_FOUND' })
  const read = await h.service.read(data, { verified: true })
  assert.equal((await sharp(Buffer.from(read.base64, 'base64')).metadata()).format, 'webp')
  assert.deepEqual(Object.keys(read).sort(), ['contractVersion', 'photoRef', 'mimeType', 'base64', 'width', 'height', 'byteLength'].sort())
  h.failDelete = true
  assert.equal((await h.service.delete(data, { verified: true })).state, 'deletion-pending')
  await assert.rejects(h.service.read(data, { verified: true }), { code: 'NOT_FOUND' })
  h.failDelete = false
  assert.equal((await h.service.delete(data, { verified: true })).state, 'deleted')
  assert.equal((await h.service.delete(data, { verified: true })).state, 'deleted')
  assert.deepEqual(await h.repository.get('snapshots', requestId), before)
  assert.equal(h.files.size, 0)
})

test('uncertain upload stays discoverable, retries reconcile complete bytes, and expiry is checked after upload', async () => {
  const h = await setup(), a = await h.issue(), real = h.storage.upload
  h.storage.upload = async (...args) => { await real(...args); throw error(504) }
  await assert.rejects(h.upload(a), { code: 'PHOTO_STATE_CONFLICT' })
  assert.equal((await h.repository.list('photos', {}))[0].value.uploadResolved, false)
  const p = await h.upload(a); assert.equal(p.state, 'staged'); assert.equal(h.writes, 1)
  h.storage.upload = async (...args) => { await real(...args); h.clock += 1800000 }
  await assert.rejects(h.upload(a, 'expire'), { code: 'PHOTO_SESSION_EXPIRED' })
  const expired = (await h.repository.list('photos', {})).find(p => p.value.uploadId === 'expire').value
  assert.equal(expired.uploadResolved, true); assert.equal(expired.state, 'staging')
})

test('cleanup keeps pending/uncertain uploads and attached files, reclaims settled orphans after grace', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), q = await h.upload(a, 'orphan')
  await h.attach(a, [p.photoRef]); h.clock += 24 * 3600000 - 1
  await h.service.recover(); assert.equal(h.files.size, 2)
  h.clock++
  await h.service.recover(); assert.equal(h.files.size, 1)
  assert.equal((await h.repository.get('photos', p.photoRef)).state, 'attached')
  assert.equal((await h.repository.get('photos', q.photoRef)).state, 'deleted')
  const b = await h.issue(); h.storage.upload = async () => { throw error(504) }
  await assert.rejects(h.upload(b, 'unknown'), { code: 'PHOTO_STATE_CONFLICT' }); h.clock += 24 * 3600000
  await h.service.recover()
  const pending = (await h.repository.list('photos', {})).find(p => p.value.uploadId === 'unknown').value
  assert.equal(pending.state, 'cleanup-claimed'); assert.equal(pending.uploadResolved, false)
})

test('in-flight completion after cleanup claim cannot stage or attach and remains recoverable', async () => {
  const h = await setup(), a = await h.issue()
  let finish, started; const gate = new Promise(r => { finish = r }), entered = new Promise(r => { started = r }), real = h.storage.upload
  h.storage.upload = async (...args) => { started(); await gate; await real(...args) }
  const pending = h.upload(a); await entered; h.clock += 24 * 3600000
  await h.service.recover(); finish()
  await assert.rejects(pending, { code: 'PHOTO_STATE_CONFLICT' })
  await h.service.recover(); assert.equal(h.files.size, 0)
  assert.equal((await h.repository.list('photos', {}))[0].value.state, 'deleted')
})

test('real service attach and cleanup compete on shared transactional photo revision', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), m = await load()
  const cleaner = m.createCustomCakePhotoService({ ...h.deps, now: () => new Date(h.clock + 86400000) })
  let release, entered = 0; const gate = new Promise(r => { release = r }), original = h.sdk.updateDocument
  h.sdk.updateDocument = async params => {
    const result = await original(params)
    if (params.collectionId === config.photos) {
      const body = JSON.parse(JSON.parse(params.data.payloadJson).body)
      if (['attached', 'cleanup-claimed'].includes(body.state) && entered < 2) { if (++entered === 2) release(); await gate }
    }
    return result
  }
  const [attach] = await Promise.allSettled([h.attach(a, [p.photoRef]), cleaner.recover()])
  const saved = await h.repository.get('snapshots', requestId), metadata = await h.repository.get('photos', p.photoRef)
  if (attach.status === 'fulfilled') { assert.ok(saved); assert.equal(metadata.state, 'attached'); assert.equal(h.files.size, 1) }
  else { assert.equal(attach.reason.code, 'TRANSACTION_CONFLICT'); assert.equal(saved, null); assert.equal(metadata.state, 'deleted'); assert.equal(h.files.size, 0) }
  assert.equal(entered, 2)
})

test('cleanup retains on authoritative read failure or request-only attachment and retries failed deletes', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), q = await h.upload(a, 'other')
  await h.repository.atomic('inconsistent-request', async tx => { await tx.create('snapshots', requestId, fixture([p.photoRef])); return null })
  h.clock += 86400000
  const original = h.sdk.getDocument
  h.sdk.getDocument = async params => { if (params.collectionId === config.snapshots) throw error(503); return original(params) }
  assert.equal((await h.service.recover()).uncertain, 2); assert.equal(h.deletes, 0)
  h.sdk.getDocument = original; h.failDelete = true
  await h.service.recover(); assert.equal(h.files.size, 2)
  assert.equal((await h.repository.get('photos', p.photoRef)).state, 'staged')
  assert.equal((await h.repository.get('photos', q.photoRef)).state, 'cleanup-claimed')
  h.failDelete = false; await h.service.recover(); assert.equal(h.files.size, 1)
  assert.deepEqual(await h.repository.get('snapshots', requestId), fixture([p.photoRef]))
})

test('unknown commit never dispatches Storage and a later retry does not replay upload intent', async () => {
  const h = await setup(), a = await h.issue(), commit = h.sdk.updateTransaction, get = h.sdk.getDocument
  let hideMarker = false
  h.sdk.updateTransaction = async params => { const result = await commit(params); if (params.commit) { hideMarker = true; throw error(504) } return result }
  h.sdk.getDocument = async params => { if (hideMarker && params.collectionId === config.commits) throw error(503); return get(params) }
  await assert.rejects(h.upload(a), { code: 'PERSISTENCE_UNCERTAIN' }); assert.equal(h.writes, 0)
  h.sdk.updateTransaction = commit; h.sdk.getDocument = get
  await assert.rejects(h.upload(a), { code: 'PHOTO_STATE_CONFLICT' }); assert.equal(h.writes, 0)
  assert.equal((await h.repository.list('photos', {}))[0].value.uploadResolved, false)
})

test('body selectors cannot access unrelated references and a deletion during read revokes bytes', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), q = await h.upload(a, 'other')
  await h.attach(a, [p.photoRef])
  await assert.rejects(h.service.read(h.access(q.photoRef), { verified: true }), { code: 'NOT_FOUND' })
  await assert.rejects(h.service.delete(h.access(p.photoRef), {}), { code: 'NOT_FOUND' }); assert.equal(h.deletes, 0)
  const read = h.storage.read
  h.storage.read = async id => { const bytes = await read(id); await h.service.delete(h.access(p.photoRef), { verified: true }); return bytes }
  await assert.rejects(h.service.read(h.access(p.photoRef), { verified: true }), { code: 'NOT_FOUND' })
})

test('cleanup claim with inconsistent session ownership never deletes', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a)
  h.clock += 86400000; h.failDelete = true; await h.service.recover(); h.failDelete = false
  const get = h.sdk.getDocument
  h.sdk.getDocument = async params => { if (params.collectionId === config.sessions) throw error(503); return get(params) }
  await h.service.recover(); assert.equal(h.files.size, 1)
  assert.equal((await h.repository.get('photos', p.photoRef)).state, 'cleanup-claimed')
})

test('malformed upload never allocates quota; expired attach and body credentials are rejected', async () => {
  const h = await setup(), a = await h.issue()
  await assert.rejects(h.service.upload({ ...h.input, uploadToken: a.uploadToken }, headers(a)), { code: 'INVALID_REQUEST' })
  await assert.rejects(h.service.upload({ ...h.input, base64: '/9j/2Q==', mimeType: 'image/jpeg' }, headers(a)), { code: 'PHOTO_INVALID_IMAGE' })
  assert.equal(await h.repository.get('quotas', requestId), null); assert.equal(h.writes, 0)
  const p = await h.upload(a); h.clock += 1800000
  await assert.rejects(h.attach(a, [p.photoRef]), { code: 'INVALID_PHOTO_REFERENCE' })
  assert.equal(await h.repository.get('snapshots', requestId), null)
  const b = await h.issue()
  await assert.rejects(h.attach(b, [p.photoRef], 'new-session-old-file'), { code: 'INVALID_PHOTO_REFERENCE' })
  await h.repository.atomic('empty-refs', async tx => { await tx.create('snapshots', requestId, fixture([])); await h.service.attach(tx, { requestId, requestNumber, photoRefs: [] }); return null })
})

test('same upload raced concurrently dispatches one immutable file and returns one stable reference', async () => {
  const h = await setup(), a = await h.issue()
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => h.upload(a)))
  for (const r of results) if (r.status === 'rejected') assert.equal(r.reason.code, 'PHOTO_STATE_CONFLICT')
  const final = await h.upload(a)
  for (const r of results) if (r.status === 'fulfilled') assert.deepEqual(r.value, final)
  assert.equal(h.writes, 1); assert.equal((await h.repository.get('quotas', requestId)).used, 1)
})

test('deleted tombstones survive service recreation; already absent settled files finalize once across concurrent deletes', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), m = await load()
  await h.attach(a, [p.photoRef]); h.files.clear()
  const results = await Promise.all([h.service.delete(h.access(p.photoRef), { verified: true }), h.service.delete(h.access(p.photoRef), { verified: true })])
  for (const r of results) assert.ok(['deleted', 'deletion-pending'].includes(r.state))
  const recreated = m.createCustomCakePhotoService(h.deps)
  assert.equal((await recreated.delete(h.access(p.photoRef), { verified: true })).state, 'deleted')
  assert.equal((await h.repository.get('quotas', requestId)).used, 0)
  assert.deepEqual(await h.repository.get('snapshots', requestId), fixture([p.photoRef]))
})

test('orphan retry retains if clock correction makes the intent future or younger than grace', async () => {
  const h = await setup(), a = await h.issue(), p = await h.upload(a), issued = h.clock
  h.clock += 86400000; h.failDelete = true; await h.service.recover(); h.failDelete = false
  for (const clock of [issued - 1, issued + 86399999]) {
    h.clock = clock; await h.service.recover()
    assert.equal(h.files.size, 1); assert.equal((await h.repository.get('photos', p.photoRef)).state, 'cleanup-claimed')
  }
})
