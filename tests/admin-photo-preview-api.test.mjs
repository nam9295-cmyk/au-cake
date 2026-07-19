import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createAdminPhotoPreviewDependencies,
  createAdminPhotoPreviewHandler,
  parseFrontendOrigins,
} from '../functions/review-api/src/admin-photo-preview.js'

const REVIEW_ID = 'review-private'
const JWT = 'header.payload.signature'
const ORIGIN = 'https://admin.example.test'
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46])

function request(overrides = {}) {
  return {
    method: 'POST',
    headers: { origin: ORIGIN, 'x-appwrite-user-jwt': JWT },
    bodyText: JSON.stringify({ reviewId: REVIEW_ID }),
    bodyJson: { reviewId: REVIEW_ID },
    ...overrides,
  }
}

function dependencies(overrides = {}) {
  return {
    authenticateJwt: async () => ({ $id: 'admin-1' }),
    getReview: async () => ({ $id: REVIEW_ID, photoFileId: 'private-file-current' }),
    getFilePreview: async () => WEBP,
    ...overrides,
  }
}

const env = {
  REVIEW_FRONTEND_ORIGINS: `${ORIGIN},https://second.example.test`,
  REVIEW_ADMIN_USER_IDS: 'admin-1,admin-2',
}

test('frontend CORS allowlist is exact, deduplicated, HTTPS-only, and never wildcard', () => {
  assert.deepEqual(parseFrontendOrigins(`${ORIGIN}, ${ORIGIN},https://second.example.test`), [ORIGIN, 'https://second.example.test'])
  for (const value of ['', '*', 'https://*.example.test', 'http://admin.example.test', 'https://user:pass@example.test/path']) {
    assert.throws(() => parseFrontendOrigins(value), /FUNCTION_CONFIGURATION_ERROR/)
  }
})

test('OPTIONS returns exact allowlisted CORS headers while denied origins receive no CORS reflection', async () => {
  const handler = createAdminPhotoPreviewHandler(dependencies(), env)
  const allowed = await handler(request({ method: 'OPTIONS', bodyText: '', bodyJson: undefined }))
  assert.equal(allowed.status, 204)
  assert.deepEqual(allowed.headers, {
    'access-control-allow-origin': ORIGIN,
    vary: 'Origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-appwrite-user-jwt',
    'access-control-max-age': '600',
  })
  const denied = await handler(request({ method: 'OPTIONS', headers: { origin: 'https://evil.example.test' }, bodyText: '', bodyJson: undefined }))
  assert.equal(denied.status, 403)
  assert.equal(Object.hasOwn(denied.headers, 'access-control-allow-origin'), false)
})

test('invalid JWT and authenticated non-admin fail generically before review or Storage lookup', async () => {
  let reviewReads = 0
  const invalidJwt = createAdminPhotoPreviewHandler(dependencies({
    authenticateJwt: async () => { throw new Error('bad signature') },
    getReview: async () => { reviewReads += 1 },
  }), env)
  assert.deepEqual(await invalidJwt(request()), {
    status: 403,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    json: { ok: false, code: 'PHOTO_PREVIEW_UNAVAILABLE' },
  })
  const nonAdmin = createAdminPhotoPreviewHandler(dependencies({
    authenticateJwt: async () => ({ $id: 'ordinary-user' }),
    getReview: async () => { reviewReads += 1 },
  }), env)
  assert.equal((await nonAdmin(request())).status, 403)
  assert.equal(reviewReads, 0)
})

test('missing review or missing/stale current photo association returns one generic not-found response', async () => {
  for (const review of [null, { $id: REVIEW_ID }, { $id: REVIEW_ID, photoFileId: '' }]) {
    let previews = 0
    const handler = createAdminPhotoPreviewHandler(dependencies({
      getReview: async () => review,
      getFilePreview: async () => { previews += 1; return WEBP },
    }), env)
    const result = await handler(request())
    assert.equal(result.status, 404)
    assert.deepEqual(result.json, { ok: false, code: 'PHOTO_PREVIEW_UNAVAILABLE' })
    assert.equal(previews, 0)
  }
  const stale = createAdminPhotoPreviewHandler(dependencies({
    getFilePreview: async () => { const error = new Error('gone'); error.code = 404; throw error },
  }), env)
  assert.equal((await stale(request())).status, 404)
})

test('request accepts only a bounded exact review-id body and exact JWT header shape', async () => {
  const handler = createAdminPhotoPreviewHandler(dependencies(), env)
  for (const bad of [
    request({ bodyText: JSON.stringify({ reviewId: REVIEW_ID, fileId: 'forbidden' }), bodyJson: { reviewId: REVIEW_ID, fileId: 'forbidden' } }),
    request({ bodyText: JSON.stringify({ reviewId: '../bad' }), bodyJson: { reviewId: '../bad' } }),
    request({ bodyText: 'x'.repeat(1025), bodyJson: undefined }),
    request({ headers: { origin: ORIGIN, 'x-appwrite-user-jwt': '' } }),
    request({ method: 'GET' }),
  ]) assert.equal((await handler(bad)).status, 400)
})

test('adapter cryptographically validates JWT through a JWT-scoped Appwrite Account client and uses current server associations', async () => {
  const clientCalls = []
  class FakeClient {
    setEndpoint(value) { clientCalls.push(['endpoint', value]); return this }
    setProject(value) { clientCalls.push(['project', value]); return this }
    setJWT(value) { clientCalls.push(['jwt', value]); return this }
  }
  class FakeAccount {
    constructor(client) { clientCalls.push(['account', client instanceof FakeClient]) }
    async get() { clientCalls.push(['get']); return { $id: 'admin-1' } }
  }
  const repository = { async getReview(id) { return { $id: id, photoFileId: 'server-file' } } }
  const storage = {
    async getFilePreview(input) {
      clientCalls.push(['preview', input])
      return WEBP
    },
  }
  const adapter = createAdminPhotoPreviewDependencies({
    endpoint: 'https://appwrite.example.test/v1',
    projectId: 'project-1',
    bucketId: 'review-photos',
    repository,
    storage,
    ClientClass: FakeClient,
    AccountClass: FakeAccount,
  })
  assert.deepEqual(await adapter.authenticateJwt(JWT), { $id: 'admin-1' })
  assert.equal((await adapter.getReview(REVIEW_ID)).photoFileId, 'server-file')
  assert.equal(await adapter.getFilePreview('server-file'), WEBP)
  assert.deepEqual(clientCalls, [
    ['endpoint', 'https://appwrite.example.test/v1'], ['project', 'project-1'], ['jwt', JWT], ['account', true], ['get'],
    ['preview', { bucketId: 'review-photos', fileId: 'server-file', output: 'webp' }],
  ])
})

test('successful handler returns private WebP binary with exact security and CORS headers', async () => {
  const calls = []
  const handler = createAdminPhotoPreviewHandler(dependencies({
    authenticateJwt: async (jwt) => { calls.push(['jwt', jwt]); return { $id: 'admin-1' } },
    getReview: async (id) => { calls.push(['review', id]); return { $id: id, photoFileId: 'private-file-current' } },
    getFilePreview: async (fileId) => { calls.push(['preview', fileId]); return WEBP },
  }), env)
  const result = await handler(request())
  assert.equal(result.status, 200)
  assert.equal(result.binary, WEBP)
  assert.deepEqual(result.headers, {
    'access-control-allow-origin': ORIGIN,
    vary: 'Origin',
    'content-type': 'image/webp',
    'content-length': String(WEBP.byteLength),
    'cache-control': 'private, no-store, max-age=0',
    pragma: 'no-cache',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'referrer-policy': 'no-referrer',
  })
  assert.deepEqual(calls, [['jwt', JWT], ['review', REVIEW_ID], ['preview', 'private-file-current']])
  assert.equal(JSON.stringify(result).includes('private-file-current'), false)
})
