import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createAdminPhotoPreviewController,
  fetchAdminReviewPhotoBlob,
  validateAdminReviewPhotoUrl,
} from '../src/lib/admin-review-photo-preview.js'

const WEBP = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })

test('direct preview URL requires HTTPS except an explicit localhost development URL', () => {
  assert.equal(validateAdminReviewPhotoUrl('https://functions.example.test/review', false), 'https://functions.example.test/review')
  assert.equal(validateAdminReviewPhotoUrl('http://localhost:3000/review', true), 'http://localhost:3000/review')
  assert.equal(validateAdminReviewPhotoUrl('http://127.0.0.1:3000/review', true), 'http://127.0.0.1:3000/review')
  for (const [url, development] of [
    ['', false],
    ['http://functions.example.test/review', false],
    ['http://localhost:3000/review', false],
    ['javascript:alert(1)', true],
    ['https://user:pass@example.test/review', false],
  ] as const) assert.throws(() => validateAdminReviewPhotoUrl(url, development), /INVALID_REVIEW_PHOTO_URL/)
})

test('browser requests a JWT and sends only the review id with non-credentialed no-referrer fetch', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const blob = await fetchAdminReviewPhotoBlob({
    directUrl: 'https://functions.example.test/review',
    development: false,
    reviewId: 'review-1',
    account: { async createJWT() { return { jwt: 'signed-user-jwt' } } },
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), init: init || {} })
      return new Response(WEBP, { status: 200, headers: { 'content-type': 'image/webp', 'content-length': '3' } })
    },
    signal: new AbortController().signal,
  })
  assert.equal(blob.size, 3)
  assert.equal(calls.length, 1)
  const call = calls[0]
  assert.equal(call.url, 'https://functions.example.test/review')
  assert.equal(call.init.method, 'POST')
  assert.equal(call.init.credentials, 'omit')
  assert.equal(call.init.referrerPolicy, 'no-referrer')
  assert.deepEqual(JSON.parse(String(call.init.body)), { reviewId: 'review-1' })
  assert.deepEqual(call.init.headers, {
    'content-type': 'application/json',
    'x-appwrite-user-jwt': 'signed-user-jwt',
  })
})

test('browser rejects non-200, non-WebP, declared oversized, and actual oversized preview responses', async () => {
  const base = {
    directUrl: 'https://functions.example.test/review', development: false, reviewId: 'review-1',
    account: { async createJWT() { return { jwt: 'jwt' } } },
  }
  await assert.rejects(() => fetchAdminReviewPhotoBlob({ ...base, fetchFn: async () => new Response('', { status: 404 }) }), /INVALID_REVIEW_PHOTO_RESPONSE/)
  await assert.rejects(() => fetchAdminReviewPhotoBlob({ ...base, fetchFn: async () => new Response('x', { status: 200, headers: { 'content-type': 'image/png' } }) }), /INVALID_REVIEW_PHOTO_RESPONSE/)
  await assert.rejects(() => fetchAdminReviewPhotoBlob({ ...base, fetchFn: async () => new Response(WEBP, { status: 200, headers: { 'content-type': 'image/webp', 'content-length': '1500001' } }) }), /INVALID_REVIEW_PHOTO_RESPONSE/)
  const oversized = new Blob([new Uint8Array(1_500_001)], { type: 'image/webp' })
  await assert.rejects(() => fetchAdminReviewPhotoBlob({ ...base, fetchFn: async () => new Response(oversized, { status: 200, headers: { 'content-type': 'image/webp' } }) }), /INVALID_REVIEW_PHOTO_RESPONSE/)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('preview controller aborts replacement and revokes object URLs on replace, filter clear, and unmount dispose', async () => {
  const first = deferred<Blob>()
  const second = deferred<Blob>()
  const signals: AbortSignal[] = []
  const revoked: string[] = []
  let urlNumber = 0
  const controller = createAdminPhotoPreviewController({
    loadBlob: (_reviewId, signal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    },
    createObjectURL: () => `blob:private-${++urlNumber}`,
    revokeObjectURL: (url) => revoked.push(url),
  })

  const firstLoad = controller.load('review-1')
  const secondLoad = controller.load('review-2')
  assert.equal(signals[0].aborted, true)
  first.resolve(WEBP)
  assert.equal(await firstLoad, null)
  second.resolve(WEBP)
  assert.equal(await secondLoad, 'blob:private-1')
  controller.clear()
  assert.deepEqual(revoked, ['blob:private-1'])

  const third = controller.load('review-3')
  controller.dispose()
  assert.equal(signals.at(-1)?.aborted, true)
  second.resolve(WEBP)
  assert.equal(await third, null)
  assert.deepEqual(revoked, ['blob:private-1'])
})
