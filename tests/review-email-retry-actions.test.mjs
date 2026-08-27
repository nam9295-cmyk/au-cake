import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getReviewEmailStatus,
  retryReviewEmail,
} from '../appwrite-functions/review-api/src/review-email-retry-actions.js'
import { getReviewInviteLifecycle, hashSecret, recoverReviewInviteToken } from '../appwrite-functions/review-api/src/business.js'
import { encryptReviewInviteToken } from '../appwrite-functions/review-api/src/invite-token-envelope.js'
import { buildReviewInviteEmailPayload } from '../appwrite-functions/review-api/src/review-invite-email.js'
import { encryptReviewCouponCode } from '../appwrite-functions/review-api/src/coupon-envelope.js'
import { buildReviewRewardEmailPayload } from '../appwrite-functions/review-api/src/review-reward-email.js'

const NOW = new Date('2026-08-27T01:00:00.000Z')
const TOKEN_KEY = Buffer.from('IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI', 'base64url')
const COUPON_KEY = Buffer.from('ERERERERERERERERERERERERERERERERERERERERERE', 'base64url')
const FROM = 'Verygood Chocolate <hello@verygood.example>'
const ORIGIN = 'https://au.verygood-chocolate.com'

function activeInvite() {
  const token = 'A'.repeat(43)
  return {
    $id: 'invite-123', sourceType: 'cake', sourceReservationId: 'cake-123',
    tokenHash: hashSecret(token),
    ...encryptReviewInviteToken({ token, inviteId: 'invite-123', sourceType: 'cake', sourceReservationId: 'cake-123', key: TOKEN_KEY }),
    expiresAt: '2026-09-20T01:00:00.000Z',
  }
}

function payload(overrides = {}) {
  return {
    eventKey: 'review-invite-customer:cake:cake-123', sourceType: 'cake', sourceId: 'cake-123', template: 'review-invite-customer',
    recipientHash: 'a'.repeat(64), payloadHash: 'b'.repeat(64), idempotencyKey: 'verygood:review-invite',
    from: 'Verygood <hello@example.com>', to: ['customer@example.com'], replyTo: null,
    subject: 'Review', text: 'Review', html: '<p>Review</p>', templateVersion: 'review-invite-customer-v1',
    ...overrides,
  }
}

test('review retry actions reject invalid action state before a provider call', async () => {
  const result = await getReviewEmailStatus({
    repository: {},
    deliveryRepository: { async getByEventKey() { return null } },
    retryClaimRepository: { async getByEventKey() { return null } },
    request: { emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123' },
    tokenEncryptionKey: TOKEN_KEY,
    now: NOW,
    rebuildPayload: async () => ({ kind: 'ready', payload: payload() }),
  })
  assert.deepEqual(result, { status: 'not_sent', retry: 'not_needed', recipientMasked: 'c***@example.com' })

  let calls = 0
  const retry = await retryReviewEmail({
    repository: {},
    deliveryRepository: { async getByEventKey() { return null } },
    retryClaimRepository: { async getByEventKey() { return null } },
    transport: { async send() { calls += 1; return { kind: 'accepted', providerMessageId: 'resend-1' } } },
    request: { emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123' },
    tokenEncryptionKey: TOKEN_KEY,
    now: NOW,
    rebuildPayload: async () => ({ kind: 'ready', payload: payload() }),
  })
  assert.deepEqual(retry, { status: 'not_sent', retry: 'not_needed' })
  assert.equal(calls, 0)
})

test('safe retry has one winning claim, reuses the original idempotency key, and never changes a reward coupon', async () => {
  const delivery = {
    $id: 'delivery-1', ...payload(), status: 'uncertain', attempts: 1,
    firstAttemptAt: '2026-08-27T00:00:00.000Z', lastAttemptAt: '2026-08-27T00:00:00.000Z',
  }
  let sends = 0
  const result = await retryReviewEmail({
    repository: {},
    deliveryRepository: {
      async getByEventKey() { return delivery },
      async markAttempt(row, now) { row.attempts += 1; row.lastAttemptAt = now.toISOString(); return row },
      async markSent(row, { now, providerMessageId }) { Object.assign(row, { status: 'sent', sentAt: now.toISOString(), providerMessageId }); return row },
    },
    retryClaimRepository: {
      async getByEventKey() { return null },
      async getOrCreateClaim(identity) { return { kind: 'created', claim: { $id: 'claim-1', ...identity } } },
      async markCompleted() {},
    },
    transport: { async send(current) { sends += 1; assert.equal(current.idempotencyKey, 'verygood:review-invite'); return { kind: 'accepted', providerMessageId: 'resend-1' } } },
    request: { emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123' },
    tokenEncryptionKey: TOKEN_KEY,
    now: NOW,
    rebuildPayload: async () => ({ kind: 'ready', payload: payload() }),
  })
  assert.deepEqual(result, { status: 'sent', retry: 'not_needed', sentAt: NOW.toISOString(), recipientMasked: 'c***@example.com' })
  assert.equal(sends, 1)
  assert.equal(delivery.attempts, 2)
  assert.equal(delivery.firstAttemptAt, '2026-08-27T00:00:00.000Z')
})

test('review invite retry rebuilds the same encrypted link without rotating its token', async () => {
  const invite = activeInvite()
  const source = { $id: 'cake-123', reservationNumber: 'VG-C-123', status: '픽업완료', customerName: 'Stored', customerEmail: 'customer@example.com' }
  const firstPayload = buildReviewInviteEmailPayload({ reservation: source, sourceType: 'cake', token: 'A'.repeat(43), from: FROM, reviewOrigin: ORIGIN })
  const delivery = { $id: 'delivery-1', ...firstPayload, status: 'uncertain', attempts: 1, firstAttemptAt: '2026-08-27T00:00:00.000Z' }
  const sends = []
  const repository = {
    async getSource() { return source }, async findInviteBySource() { return invite }, async findReviewBySource() { return null },
  }
  assert.equal(recoverReviewInviteToken(invite, 'cake', 'cake-123', TOKEN_KEY), 'A'.repeat(43))
  assert.equal((await getReviewInviteLifecycle(repository, { sourceType: 'cake', sourceReservationId: 'cake-123' }, { now: NOW, tokenEncryptionKey: TOKEN_KEY })).state, 'active')
  const result = await retryReviewEmail({
    repository,
    deliveryRepository: {
      async getByEventKey() { return delivery },
      async markAttempt(row, now) { row.attempts += 1; row.lastAttemptAt = now.toISOString(); return row },
      async markSent(row, { now, providerMessageId }) { Object.assign(row, { status: 'sent', sentAt: now.toISOString(), providerMessageId }); return row },
    },
    retryClaimRepository: {
      async getByEventKey() { return null }, async getOrCreateClaim(identity) { return { kind: 'created', claim: { $id: 'claim-1', ...identity } } }, async markCompleted() {},
    },
    transport: { async send(value) { sends.push(value); return { kind: 'accepted', providerMessageId: 'resend-1' } } },
    request: { emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123', eventKey: 'spoofed' },
    tokenEncryptionKey: TOKEN_KEY, from: FROM, reviewOrigin: ORIGIN, now: NOW,
  })
  assert.equal(result.status, 'sent')
  assert.equal(sends.length, 1)
  assert.equal(sends[0].eventKey, firstPayload.eventKey)
  assert.match(sends[0].text, /review#A{43}/)
  assert.equal(invite.tokenHash, hashSecret('A'.repeat(43)))
  assert.equal(delivery.attempts, 2)
})

test('review reward retry decrypts and reuses the committed coupon without a new coupon issue', async () => {
  const review = { $id: 'review-123', sourceType: 'cake', sourceReservationId: 'cake-123', couponId: 'coupon-123', rewardPercent: 10 }
  const coupon = {
    $id: 'coupon-123', sourceReviewId: 'review-123', rewardPercent: 10, status: 'active',
    createdAt: '2026-08-27T00:00:00.000Z', expiresAt: '2026-09-26T14:00:00.000Z',
    ...encryptReviewCouponCode({ code: 'FOXKIWI7Q2MK', couponId: 'coupon-123', reviewId: 'review-123', key: COUPON_KEY }),
  }
  const source = { $id: 'cake-123', customerName: 'Stored', customerEmail: 'customer@example.com' }
  const firstPayload = buildReviewRewardEmailPayload({
    review, coupon, reservation: source, couponCode: 'FOXKIWI7Q2MK', from: FROM, cakeOrderUrl: `${ORIGIN}/`,
  })
  const delivery = { $id: 'delivery-1', ...firstPayload, status: 'failed', attempts: 1, firstAttemptAt: '2026-08-27T00:00:00.000Z', lastErrorCode: 'resend_rate_limit_exceeded' }
  let couponCreates = 0
  const sends = []
  const result = await retryReviewEmail({
    repository: {
      async getReview(id) { assert.equal(id, 'review-123'); return review },
      async getCoupon(id) { assert.equal(id, 'coupon-123'); return coupon },
      async getSource(type, id) { assert.equal(type, 'cake'); assert.equal(id, 'cake-123'); return source },
      async createCoupon() { couponCreates += 1 },
    },
    deliveryRepository: {
      async getByEventKey() { return delivery },
      async markAttempt(row, now) { row.attempts += 1; row.lastAttemptAt = now.toISOString(); return row },
      async markSent(row, { now, providerMessageId }) { Object.assign(row, { status: 'sent', sentAt: now.toISOString(), providerMessageId }); return row },
    },
    retryClaimRepository: {
      async getByEventKey() { return null }, async getOrCreateClaim(identity) { return { kind: 'created', claim: { $id: 'claim-1', ...identity } } }, async markCompleted() {},
    },
    transport: { async send(value) { sends.push(value); return { kind: 'accepted', providerMessageId: 'resend-1' } } },
    request: { emailKind: 'review-reward-customer', reviewId: 'review-123', couponCode: 'spoofed' },
    encryptionKey: COUPON_KEY, from: FROM, cakeOrderUrl: `${ORIGIN}/`, now: NOW,
  })
  assert.equal(result.status, 'sent')
  assert.equal(sends.length, 1)
  assert.match(sends[0].text, /FOXKIWI7Q2MK/)
  assert.equal(couponCreates, 0)
  assert.equal(coupon.expiresAt, '2026-09-26T14:00:00.000Z')
  assert.equal(review.rewardPercent, 10)
})
