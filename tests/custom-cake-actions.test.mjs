import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import * as main from '../appwrite-functions/reservation-api/src/main.js'
import { service } from './custom-cake-persistence.test.mjs'
import { customCakeSchemaTargets } from '../appwrite-functions/reservation-api/src/custom-cake-readiness.js'
import { createCustomCakeRepository } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${n}.json`, import.meta.url)))
const custom = () => { const d = fixture('custom-v1').request; d.lines[0].photoRefs = []; return d }
const admin = { 'x-appwrite-user-id': 'admin-1', 'x-appwrite-user-jwt': 'valid-admin-jwt' }
const photoWire = 'custom-cake-photo.v1'
export async function harness({ smoreWritesEnabled = true } = {}) {
  assert.equal(typeof main.createReservationHandler, 'function')
  const targets = customCakeSchemaTargets({ endpoint: 'https://synthetic.invalid/v1', projectId: 'synthetic-project', databaseId: 'test-db' })
  const env = {
    APPWRITE_FUNCTION_API_ENDPOINT: targets.endpoint, APPWRITE_FUNCTION_PROJECT_ID: targets.projectId, APPWRITE_FUNCTION_ID: 'reservation-api',
    REVIEW_COUPON_HMAC_SECRET: Buffer.alloc(32, 7).toString('base64url'), REVIEW_ADMIN_USER_IDS: 'admin-1',
    CUSTOM_CAKE_PHOTO_TOKEN_HMAC_SECRET: Buffer.alloc(32, 8).toString('base64url'), CUSTOM_CAKE_PROMOTION_STARTS_AT: '2026-09-01T00:00:00.000Z',
    CUSTOM_CAKE_RECOVERY_ENABLED: 'true', CUSTOM_CAKE_PERSISTENCE_ENABLED: 'true', CAKE_WIRE_LEGACY_NEW_SUBMISSIONS: 'compat',
    APPWRITE_CUSTOM_CAKE_DATABASE_ID: 'test-db', APPWRITE_CUSTOM_CAKE_PHOTOS_BUCKET_ID: targets.bucket.bucketId,
    ...Object.fromEntries(targets.collections.map(c => [`APPWRITE_CUSTOM_CAKE_${c.kind.toUpperCase()}_TABLE_ID`, c.collectionId])),
  }
  const sdk = service(), files = new Map()
  sdk.get = async () => ({ $id: 'test-db', enabled: true })
  sdk.getCollection = async ({ collectionId }) => {
    const c = targets.collections.find(c => c.collectionId === collectionId)
    return { ...structuredClone(c), $id: collectionId, databaseId: 'test-db', $permissions: [], attributes: c.attributes.map(a => ({ ...a, status: 'available', array: false, default: null, ...(a.type === 'string' ? { format: '', encrypt: false } : {}) })), indexes: c.indexes.map(i => ({ ...i, status: 'available', lengths: [] })) }
  }
  const storage = {
    getBucket: async () => ({ ...targets.bucket, $id: targets.bucket.bucketId, $permissions: [] }),
    createFile: async p => { const bytes = Buffer.from(await p.file.arrayBuffer()); files.set(p.fileId, bytes); return { $id: p.fileId, $permissions: [], mimeType: 'image/webp', sizeOriginal: bytes.length, chunksTotal: 1, chunksUploaded: 1 } },
    getFile: async p => { const bytes = files.get(p.fileId); if (!bytes) throw Object.assign(new Error('404'), { code: 404 }); return { $id: p.fileId, $permissions: [], mimeType: 'image/webp', sizeOriginal: bytes.length, chunksTotal: 1, chunksUploaded: 1 } },
    getFileDownload: async p => files.get(p.fileId),
    deleteFile: async p => { files.delete(p.fileId) },
  }
  const services = { databases: sdk, storage, functions: { get: async () => ({ $id: 'reservation-api', enabled: true, schedule: '*/15 * * * *' }) }, accountForJwt: jwt => ({ get: async () => { if (jwt !== 'valid-admin-jwt') throw new Error('invalid token'); return { $id: 'admin-1' } } }) }
  let time = new Date('2026-09-09T00:00:00.000Z')
  const handler = main.createReservationHandler({ env, servicesForRequest: () => services, now: () => time, smoreWritesEnabled })
  const call = async (action, data, headers = {}, bodyText) => {
    const body = data === undefined ? { action } : { action, data }
    return handler({ req: { bodyJson: body, bodyText: bodyText ?? JSON.stringify(body), headers: { 'x-appwrite-client-ip': '192.0.2.1', ...headers } }, res: { json: (body, status, headers) => ({ body, status, headers }) }, log: () => {}, error: () => {} })
  }
  const config = { enabled: true, databaseId: 'test-db', bucketId: targets.bucket.bucketId, ...Object.fromEntries(targets.collections.map(c => [c.kind, c.collectionId])) }
  return { call, handler, env, sdk, storage, files, services, repository: createCustomCakeRepository(sdk, config), clock: value => { time = new Date(value) } }
}

test('actual handler advertises only provisioned wire and maps strict errors without SDK leakage', async () => {
  const h = await harness()
  assert.deepEqual((await h.call('get-cake-wire-capabilities')).body, { ok: true, result: { contractVersion: 'cake-capabilities.v1', status: 'ready', customCakeV1: true, cakeOrderV2: true, legacyNewSubmissions: 'compat' } })
  const bad = await h.call('create-custom-cake-request', { ...custom(), price: 1 })
  assert.deepEqual(bad.body, { ok: false, contractVersion: 'custom-cake.v1', code: 'INVALID_REQUEST' }); assert.equal(bad.status, 400)
  h.storage.getBucket = async () => { throw new Error('RAW SDK credential') }
  const unavailable = await h.call('create-cake-order-v2', fixture('cake-order-v2').request)
  assert.deepEqual(unavailable.body, { ok: false, contractVersion: 'cake-order.v2', code: 'CAPABILITY_UNAVAILABLE' })
  assert.equal(unavailable.status, 503)
})

test('actual handler authenticates customer possession and verified admin through full lifecycle', async () => {
  const h = await harness(), receipt = await h.call('create-custom-cake-request', custom())
  assert.equal(receipt.status, 200)
  const n = receipt.body.result.requestNumber, b = { contractVersion: 'custom-cake.v1', requestNumber: n }
  const lookup = await h.call('get-custom-cake-request', { ...b, customerPhone: '+61 412 345 678' })
  assert.equal(lookup.status, 200); assert.equal(lookup.headers['Cache-Control'], 'no-store')
  for (const phone of ['0412345679', '5678']) assert.equal((await h.call('get-custom-cake-request', { ...b, customerPhone: phone })).body.code, 'NOT_FOUND')
  const quote = { ...b, expectedQuoteVersion: 1, designExtraCents: 2000, figurineExtraCents: 0, explanation: 'Flowers' }
  for (const headers of [{}, { ...admin, 'x-appwrite-user-jwt': 'bad' }, { 'x-appwrite-user-id': 'admin-1' }]) assert.equal((await h.call('admin-update-custom-cake-quote', quote, headers)).body.code, 'FORBIDDEN')
  assert.equal((await h.call('admin-update-custom-cake-quote', quote, admin)).body.result.quote.quoteVersion, 2)
  assert.equal((await h.call('admin-update-custom-cake-quote', quote, admin)).body.code, 'QUOTE_VERSION_CONFLICT')
  const acceptance = { ...b, quoteVersion: 2, customerConsent: true }
  assert.equal((await h.call('admin-record-custom-cake-acceptance', acceptance, admin)).status, 200)
  const confirm = { ...b, expectedQuoteVersion: 2 }
  assert.equal((await h.call('admin-confirm-custom-cake-request', confirm, admin)).body.result.status, 'confirmed')
  const terminal = { ...confirm, expectedStatus: 'confirmed' }
  assert.equal((await h.call('admin-cancel-custom-cake-request', terminal, admin)).body.result.status, 'cancelled')
  assert.equal((await h.call('admin-cancel-custom-cake-request', terminal, admin)).status, 200)
  assert.equal((await h.call('admin-record-custom-cake-acceptance', acceptance, admin)).body.code, 'QUOTE_STATE_CONFLICT')
  assert.equal((await h.call('admin-confirm-custom-cake-request', confirm, admin)).body.code, 'QUOTE_STATE_CONFLICT')
  assert.deepEqual((await h.call('create-custom-cake-request', custom())).body, receipt.body)
})

test('actual photo routes rate limit issuance and atomically attach privately uploaded images with no-store access', async () => {
  const h = await harness(), order = custom(), requestId = order.requestId
  const session = await h.call('create-custom-cake-photo-session', { contractVersion: photoWire, requestId })
  assert.equal(session.status, 200)
  const proof = { 'x-custom-cake-upload-session': session.body.result.uploadSessionId, 'x-custom-cake-upload-token': session.body.result.uploadToken }
  const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#aa5588' } }).png().toBuffer()
  const uploaded = await h.call('upload-custom-cake-photo', { contractVersion: photoWire, requestId, uploadId: 'image-1', mimeType: 'image/png', base64: image.toString('base64') }, proof)
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body))
  order.lines[0].photoRefs = [uploaded.body.result.photoRef]
  assert.equal((await h.call('create-custom-cake-request', order)).body.code, 'INVALID_PHOTO_REFERENCE')
  assert.equal((await h.repository.list('snapshots')).length, 0)
  const receipt = await h.call('create-custom-cake-request', order, proof)
  assert.equal(receipt.status, 200)
  const access = { contractVersion: photoWire, requestNumber: receipt.body.result.requestNumber, photoRef: uploaded.body.result.photoRef, authorization: { kind: 'customer', customerPhone: '0412345678' } }
  const read = await h.call('read-custom-cake-photo', access)
  assert.equal(read.status, 200); assert.equal(read.headers['Cache-Control'], 'no-store'); assert.ok(read.body.result.base64)
  const removed = await h.call('delete-custom-cake-photo', access)
  assert.equal(removed.status, 200); assert.equal(h.files.size, 0)
  assert.equal((await h.call('read-custom-cake-photo', access)).body.code, 'NOT_FOUND')
  h.clock('2027-01-01T00:00:00.000Z')
  assert.deepEqual((await h.call('create-custom-cake-request', order)).body, receipt.body)
})

test('rollback artifact and missing activation disable new capability but retain recorded read/retry', async () => {
  const h = await harness(), input = custom(), first = await h.call('create-custom-cake-request', input)
  delete h.env.CUSTOM_CAKE_PROMOTION_STARTS_AT
  assert.deepEqual((await h.call('create-custom-cake-request', input)).body, first.body)
  assert.equal((await h.call('get-custom-cake-request', { contractVersion: 'custom-cake.v1', requestNumber: first.body.result.requestNumber, customerPhone: '0412345678' })).status, 200)
  assert.equal((await h.call('create-custom-cake-request', { ...input, requestId: '22222222-2222-4222-8222-222222222222' })).body.code, 'CAPABILITY_UNAVAILABLE')
  const compat = await harness({ smoreWritesEnabled: false })
  const cap = await compat.call('get-cake-wire-capabilities'); assert.equal(cap.body.result.customCakeV1, false); assert.equal(cap.body.result.cakeOrderV2, false)
  assert.equal((await compat.call('create-cake-order-v2', fixture('cake-order-v2').request)).body.code, 'CAPABILITY_UNAVAILABLE')
})

test('photo transport permits complete 10 MiB base64 expansion and enforces issue and lookup rate controls', async () => {
  const h = await harness(), requestId = custom().requestId
  const session = await h.call('create-custom-cake-photo-session', { contractVersion: photoWire, requestId })
  const proof = { 'x-custom-cake-upload-session': session.body.result.uploadSessionId, 'x-custom-cake-upload-token': session.body.result.uploadToken }
  const upload = { contractVersion: photoWire, requestId, uploadId: 'large', mimeType: 'image/png', base64: Buffer.alloc(10485760).toString('base64') }
  assert.equal((await h.call('upload-custom-cake-photo', upload, proof)).body.code, 'PHOTO_INVALID_IMAGE')
  upload.base64 = Buffer.alloc(10485761).toString('base64')
  assert.equal((await h.call('upload-custom-cake-photo', upload, proof)).body.code, 'PHOTO_TOO_LARGE')
  for (let i = 0; i < 4; i++) assert.equal((await h.call('create-custom-cake-photo-session', { contractVersion: photoWire, requestId })).status, 200)
  assert.equal((await h.call('create-custom-cake-photo-session', { contractVersion: photoWire, requestId })).body.code, 'FORBIDDEN')
  const input = custom(), created = await h.call('create-custom-cake-request', input)
  const lookup = { contractVersion: 'custom-cake.v1', requestNumber: created.body.result.requestNumber, customerPhone: '0412345678' }
  for (let i = 0; i < 20; i++) assert.equal((await h.call('get-custom-cake-request', lookup)).status, 200)
  assert.equal((await h.call('get-custom-cake-request', lookup)).body.code, 'NOT_FOUND')
})

test('platform schedule performs durable photo recovery and persists continuation for bounded scans', async () => {
  const h = await harness(), requestId = custom().requestId
  const session = await h.call('create-custom-cake-photo-session', { contractVersion: photoWire, requestId })
  const proof = { 'x-custom-cake-upload-session': session.body.result.uploadSessionId, 'x-custom-cake-upload-token': session.body.result.uploadToken }
  const bytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#aa5588' } }).png().toBuffer()
  const upload = await h.call('upload-custom-cake-photo', { contractVersion: photoWire, requestId, uploadId: 'orphan', mimeType: 'image/png', base64: bytes.toString('base64') }, proof)
  assert.equal(upload.status, 200); h.clock('2026-09-11T00:00:00.000Z')
  const result = await h.call('anything', undefined, { 'x-appwrite-trigger': 'schedule' })
  assert.equal(result.status, 200); assert.equal(h.files.size, 0)
  assert.equal((await h.repository.get('photos', upload.body.result.photoRef)).state, 'deleted')
  assert.ok(await h.repository.get('ratelimits', 'photo-recovery-cursor'))
  h.services.functions.get = async () => ({ $id: 'reservation-api', enabled: true, schedule: '' })
  assert.equal((await h.call('get-cake-wire-capabilities')).body.result.customCakeV1, false)
  const unavailable = await h.call('anything', undefined, { 'x-appwrite-trigger': 'schedule' }); assert.equal(unavailable.status, 503)
  assert.equal((await h.call('recover-custom-cake-photos')).body.code, 'UNKNOWN_ACTION')
})
