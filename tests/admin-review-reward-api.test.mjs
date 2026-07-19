import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  ReviewApiError,
  copyReviewRewardMessage,
  listAdminReviews,
  moderateReview,
} from '../functions/review-api/src/business.js'
import {
  handleReviewRequest,
  safeActionForLog,
} from '../functions/review-api/src/main.js'
import { digestReviewCouponCode } from '../functions/review-api/src/coupon-digest.js'
import { encryptReviewCouponCode } from '../functions/review-api/src/coupon-envelope.js'

const now = new Date('2026-07-19T00:00:00.000Z')
const expiresAt = '2026-09-17T00:00:00.000Z'
const code = 'FOXKIWI7Q2MK'
const hmacSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const hmacKey = Buffer.from(hmacSecret, 'base64url')
const encryptionKey = Buffer.from('ERERERERERERERERERERERERERERERERERERERERERE', 'base64url')
const wrongEncryptionKey = Buffer.from('IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI', 'base64url')
const review = {
  $id: 'review-reward-1',
  sourceType: 'cake',
  rating: 5,
  body: 'Wonderful cake',
  displayName: 'Amelia',
  hasPhoto: false,
  photoPublishConsent: false,
  publishConsent: true,
  moderationStatus: 'pending',
  rewardPercent: 10,
  couponId: 'coupon-reward-1',
  createdAt: '2026-07-18T01:00:00.000Z',
  updatedAt: '2026-07-18T01:00:00.000Z',
}

function makeCoupon(overrides = {}) {
  const envelope = encryptReviewCouponCode({
    code,
    couponId: review.couponId,
    reviewId: review.$id,
    key: encryptionKey,
    iv: Buffer.alloc(12, 7),
  })
  return {
    $id: review.couponId,
    sourceReviewId: review.$id,
    rewardPercent: review.rewardPercent,
    status: 'active',
    expiresAt,
    codeLast4: code.slice(-4),
    codeHash: digestReviewCouponCode(code, hmacKey),
    ...envelope,
    ...overrides,
  }
}

function makeRepository({ reviewValue = review, couponValue = makeCoupon(), updatePatch = {} } = {}) {
  const calls = []
  return {
    calls,
    async listReviews(options) { calls.push(['listReviews', options]); return reviewValue ? [reviewValue] : [] },
    async getReview(id) { calls.push(['getReview', id]); return reviewValue },
    async getCoupon(id) {
      calls.push(['getCoupon', id])
      if (couponValue instanceof Error) throw couponValue
      return couponValue
    },
    async updateReview(id, data) {
      calls.push(['updateReview', id, data])
      return { ...reviewValue, ...data, ...updatePatch, $id: id }
    },
  }
}

const unavailableSummary = {
  rewardCodeLast4: null,
  rewardStatus: 'unavailable',
  rewardExpiresAt: null,
  rewardMessageAvailable: false,
}

function assertUnavailable(error) {
  return error instanceof ReviewApiError && error.code === 'REVIEW_REWARD_UNAVAILABLE' && error.status === 404
}

test('admin list derives an exact safe active reward summary from the linked coupon', async () => {
  const repository = makeRepository()
  const page = await listAdminReviews(repository, { moderationStatus: 'pending', limit: 20, now })
  assert.deepEqual(page, {
    reviews: [{
      id: review.$id,
      sourceType: 'cake',
      rating: 5,
      body: 'Wonderful cake',
      displayName: 'Amelia',
      hasPhoto: false,
      photoPublishConsent: false,
      publishConsent: true,
      moderationStatus: 'pending',
      rewardPercent: 10,
      rewardCodeLast4: 'Q2MK',
      rewardStatus: 'active',
      rewardExpiresAt: expiresAt,
      rewardMessageAvailable: true,
      createdAt: '2026-07-18T01:00:00.000Z',
      updatedAt: '2026-07-18T01:00:00.000Z',
    }],
    nextCursor: null,
  })
  const serialized = JSON.stringify(page)
  for (const forbidden of [review.couponId, code, makeCoupon().codeHash, makeCoupon().codeCiphertext, 'sourceReviewId']) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
  assert.deepEqual(repository.calls.map(([name]) => name), ['listReviews', 'getCoupon'])
})

test('admin summary derives expiry and persisted terminal states without making messages available', async () => {
  const cases = [
    [{ status: 'active', expiresAt: now.toISOString() }, 'expired'],
    [{ status: 'expired' }, 'expired'],
    [{ status: 'redeemed' }, 'redeemed'],
    [{ status: 'revoked' }, 'revoked'],
  ]
  for (const [couponPatch, expectedStatus] of cases) {
    const page = await listAdminReviews(makeRepository({ couponValue: makeCoupon(couponPatch) }), { limit: 20, now })
    assert.deepEqual(page.reviews[0], {
      ...page.reviews[0],
      rewardCodeLast4: 'Q2MK',
      rewardStatus: expectedStatus,
      rewardExpiresAt: couponPatch.expiresAt || expiresAt,
      rewardMessageAvailable: false,
    })
  }
})

test('missing, unreadable, mismatched, or malformed linked coupons collapse to one unavailable summary', async () => {
  const variants = [
    null,
    new Error('private repository failure'),
    makeCoupon({ $id: 'coupon-other' }),
    makeCoupon({ sourceReviewId: 'review-other' }),
    makeCoupon({ rewardPercent: 5 }),
    makeCoupon({ status: 'pending' }),
    makeCoupon({ expiresAt: 'not-a-date' }),
    makeCoupon({ codeLast4: 'bad!' }),
  ]
  for (const couponValue of variants) {
    const page = await listAdminReviews(makeRepository({ couponValue }), { limit: 20, now })
    assert.deepEqual({
      rewardCodeLast4: page.reviews[0].rewardCodeLast4,
      rewardStatus: page.reviews[0].rewardStatus,
      rewardExpiresAt: page.reviews[0].rewardExpiresAt,
      rewardMessageAvailable: page.reviews[0].rewardMessageAvailable,
    }, unavailableSummary)
  }

  const malformedLink = makeRepository({ reviewValue: { ...review, couponId: 'bad/id' } })
  const page = await listAdminReviews(malformedLink, { limit: 20, now })
  assert.deepEqual({
    rewardCodeLast4: page.reviews[0].rewardCodeLast4,
    rewardStatus: page.reviews[0].rewardStatus,
    rewardExpiresAt: page.reviews[0].rewardExpiresAt,
    rewardMessageAvailable: page.reviews[0].rewardMessageAvailable,
  }, unavailableSummary)
  assert.equal(malformedLink.calls.some(([name]) => name === 'getCoupon'), false)
})

test('admin summary fails closed to unavailable when the recovery envelope is incomplete or malformed', async () => {
  for (const patch of [
    { codeCiphertext: null },
    { codeIv: null },
    { codeAuthTag: null },
    { codeEncryptionVersion: null },
    { codeEncryptionVersion: 2 },
    { codeCiphertext: 'not+base64url' },
    { codeIv: 'short' },
    { codeAuthTag: 'short' },
  ]) {
    const page = await listAdminReviews(makeRepository({ couponValue: makeCoupon(patch) }), { limit: 20, now })
    assert.deepEqual({
      rewardCodeLast4: page.reviews[0].rewardCodeLast4,
      rewardStatus: page.reviews[0].rewardStatus,
      rewardExpiresAt: page.reviews[0].rewardExpiresAt,
      rewardMessageAvailable: page.reviews[0].rewardMessageAvailable,
    }, unavailableSummary)
  }
})

test('moderation response refetches the linked coupon and returns the same safe reward summary', async () => {
  const repository = makeRepository()
  const updated = await moderateReview(repository, review.$id, 'hidden', { now })
  assert.equal(updated.moderationStatus, 'hidden')
  assert.deepEqual({
    rewardCodeLast4: updated.rewardCodeLast4,
    rewardStatus: updated.rewardStatus,
    rewardExpiresAt: updated.rewardExpiresAt,
    rewardMessageAvailable: updated.rewardMessageAvailable,
  }, {
    rewardCodeLast4: 'Q2MK',
    rewardStatus: 'active',
    rewardExpiresAt: expiresAt,
    rewardMessageAvailable: true,
  })
  assert.deepEqual(repository.calls.map(([name]) => name), ['getReview', 'updateReview', 'getCoupon'])
})

test('secure admin copy decrypts, independently verifies, and returns exactly one English message', async () => {
  const result = await copyReviewRewardMessage(makeRepository(), review.$id, {
    now,
    hmacSecret,
    encryptionKey,
  })
  assert.deepEqual(result, {
    message: 'Thank you for sharing your review with Very Good Chocolate.\nYour 10% cake reward code is FOXKIWI7Q2MK.\nIt can be used once on your next cake order until 17 September 2026.',
  })
  assert.deepEqual(Object.keys(result), ['message'])
})

test('secure admin copy requires distinct valid keys before any repository read', async () => {
  for (const options of [
    { encryptionKey },
    { hmacSecret },
    { hmacSecret, encryptionKey: hmacKey },
  ]) {
    const repository = makeRepository()
    await assert.rejects(
      () => copyReviewRewardMessage(repository, review.$id, { now, ...options }),
      (error) => error instanceof ReviewApiError && error.code === 'FUNCTION_CONFIGURATION_ERROR' && error.status === 500,
    )
    assert.deepEqual(repository.calls, [])
  }
})

test('secure admin copy exposes one stable unavailable result for ids, linkage, state, tamper, hashes, suffixes, and wrong keys', async () => {
  const scenarios = [
    [makeRepository(), 'bad/id', { hmacSecret, encryptionKey }],
    [makeRepository({ reviewValue: null }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ reviewValue: { ...review, couponId: 'bad/id' } }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: null }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ $id: 'coupon-other' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ sourceReviewId: 'review-other' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ rewardPercent: 5 }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ status: 'redeemed' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ status: 'revoked' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ expiresAt: now.toISOString() }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ codeCiphertext: 'tampered' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ codeHash: '0'.repeat(64) }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository({ couponValue: makeCoupon({ codeLast4: 'AAAA' }) }), review.$id, { hmacSecret, encryptionKey }],
    [makeRepository(), review.$id, { hmacSecret, encryptionKey: wrongEncryptionKey }],
    [makeRepository(), review.$id, { hmacSecret: Buffer.alloc(32, 3), encryptionKey }],
  ]
  for (const [repository, reviewId, options] of scenarios) {
    await assert.rejects(() => copyReviewRewardMessage(repository, reviewId, { now, ...options }), assertUnavailable)
  }
  assert.deepEqual(scenarios[0][0].calls, [], 'invalid ids must fail before repository access')
})

test('copy action is admin-only, guard-first, exact-routed with both keys, and allowlisted for safe logs', async () => {
  const calls = []
  const services = {
    async copyReward(_repository, reviewId, options) {
      calls.push([reviewId, options.hmacSecret, options.encryptionKey])
      return { message: 'safe' }
    },
  }
  const body = { action: 'copy-review-reward-message', data: { reviewId: review.$id } }
  await assert.rejects(
    () => handleReviewRequest(body, {}, { REVIEW_ADMIN_USER_IDS: 'admin-1' }, services, {}, undefined, { hmacSecret, encryptionKey }),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ADMIN_UNAUTHORIZED',
  )
  assert.deepEqual(calls, [])
  assert.deepEqual(await handleReviewRequest(
    body,
    { 'x-appwrite-user-id': 'admin-1' },
    { REVIEW_ADMIN_USER_IDS: 'admin-1' },
    services,
    {},
    undefined,
    { hmacSecret, encryptionKey },
  ), { message: 'safe' })
  assert.deepEqual(calls, [[review.$id, hmacSecret, encryptionKey]])
  assert.equal(safeActionForLog('copy-review-reward-message'), 'copy-review-reward-message')
})
