import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { encryptReviewCouponCode } from '../appwrite-functions/review-api/src/coupon-envelope.js'
import { ResendTransportError } from '../appwrite-functions/shared/resend-transport.js'
import {
  attemptReviewRewardEmail,
  buildReviewRewardEmailPayload,
} from '../appwrite-functions/review-api/src/review-reward-email.js'

const encryptionKey = Buffer.from('ERERERERERERERERERERERERERERERERERERERERERE', 'base64url')
const from = 'Verygood Chocolate <hello@verygood.example>'
const cakeOrderUrl = 'https://au.verygood-chocolate.com/'
const now = new Date('2026-08-28T02:03:04.000Z')

function coupon(overrides = {}) {
  const envelope = encryptReviewCouponCode({
    code: 'FOXKIWI7Q2MK', couponId: 'coupon-123', reviewId: 'review-123', key: encryptionKey,
  })
  return {
    $id: 'coupon-123',
    sourceReviewId: 'review-123',
    rewardPercent: 5,
    status: 'active',
    createdAt: '2026-08-28T02:03:04.000Z',
    expiresAt: '2026-09-27T14:30:00.000Z',
    ...envelope,
    ...overrides,
  }
}

function review(overrides = {}) {
  return {
    $id: 'review-123',
    sourceType: 'cake',
    sourceReservationId: 'cake-123',
    couponId: 'coupon-123',
    rewardPercent: 5,
    body: 'PRIVATE REVIEW BODY',
    rating: 1,
    photoFileId: 'PRIVATE-PHOTO',
    ...overrides,
  }
}

function reservation(sourceType = 'cake', overrides = {}) {
  return {
    $id: sourceType === 'cake' ? 'cake-123' : 'class-123',
    customerEmail: ' CUSTOMER@example.com ',
    customerName: 'Jenny <b>\nFORGED',
    parentEmail: ' PARENT@example.com ',
    parentName: 'Pat <script>bad()</script>',
    childName: 'PRIVATE CHILD NAME',
    adminMemo: 'PRIVATE ADMIN MEMO',
    allergyNote: 'PRIVATE ALLERGY DETAIL',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    $databaseId: 'PRIVATE DATABASE ID',
    ...overrides,
  }
}

function createDeliveryRepository() {
  const deliveries = new Map()
  return {
    deliveries,
    async getOrCreatePending(identity, time) {
      const existing = deliveries.get(identity.eventKey)
      if (existing) {
        return {
          kind: 'existing',
          delivery: existing,
          decision: existing.status === 'sent' ? { kind: 'already_sent' } : { kind: 'in_progress' },
        }
      }
      const created = {
        $id: `delivery-${deliveries.size + 1}`,
        ...identity,
        status: 'pending',
        attempts: 0,
        createdAt: time.toISOString(),
        updatedAt: time.toISOString(),
      }
      deliveries.set(identity.eventKey, created)
      return { kind: 'created', delivery: created }
    },
    async markAttempt(delivery, time) {
      delivery.attempts += 1
      delivery.lastAttemptAt = time.toISOString()
      return delivery
    },
    async markSent(delivery, { now: sentAt, providerMessageId }) {
      delivery.status = 'sent'
      delivery.sentAt = sentAt.toISOString()
      delivery.providerMessageId = providerMessageId
      return delivery
    },
    async markFailed(delivery) {
      delivery.status = 'failed'
      return delivery
    },
    async markUncertain(delivery) {
      delivery.status = 'uncertain'
      return delivery
    },
  }
}

test('reward email is Korean-first, uses committed coupon data, and excludes private review data', () => {
  const payload = buildReviewRewardEmailPayload({
    review: review(),
    coupon: coupon(),
    reservation: reservation(),
    couponCode: 'FOXKIWI7Q2MK',
    from,
    cakeOrderUrl,
  })

  assert.equal(payload.subject, '[Verygood] 리뷰 리워드가 도착했어요 | Your review reward is ready')
  assert.deepEqual(payload.to, ['customer@example.com'])
  assert.equal(payload.eventKey, 'review-reward-customer:review:review-123')
  assert.equal(payload.template, 'review-reward-customer')
  assert.equal(payload.templateVersion, 'review-reward-customer-v1')
  assert.match(payload.idempotencyKey, /^verygood:[a-f0-9]{64}$/)
  assert.match(payload.text, /^\[한국어\]/)
  assert.ok(payload.text.indexOf('[한국어]') < payload.text.indexOf('[English]'))
  assert.match(payload.text, /5% 할인/)
  assert.match(payload.text, /FOXKIWI7Q2MK/)
  assert.match(payload.text, /2026년 8월 28일/)
  assert.match(payload.text, /2026년 9월 28일/)
  assert.match(payload.text, /발급일로부터 30일 동안 유효/)
  assert.match(payload.text, /다음 케이크 주문에 1회 사용할 수 있습니다/)
  assert.match(payload.text, /5% off/)
  assert.match(payload.text, /28 August 2026/)
  assert.match(payload.text, /28 September 2026/)
  assert.match(payload.text, /valid for 30 days from the date it was issued/i)
  assert.match(payload.text, /once on your next cake order/i)
  assert.match(payload.text, new RegExp(cakeOrderUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(payload.html, /Jenny &lt;b&gt; FORGED/)
  assert.ok(payload.html.indexOf('소중한 후기를 남겨주셔서 감사합니다') < payload.html.indexOf('Thank you for sharing your feedback'))

  for (const forbidden of [
    'PRIVATE REVIEW BODY', 'PRIVATE-PHOTO', 'PRIVATE CHILD NAME', 'PRIVATE ADMIN MEMO',
    'PRIVATE ALLERGY DETAIL', 'PRIVATE EMERGENCY CONTACT', 'PRIVATE DATABASE ID',
    'review-123', 'coupon-123',
  ]) {
    assert.doesNotMatch(payload.text, new RegExp(forbidden))
    assert.doesNotMatch(payload.html, new RegExp(forbidden))
  }
})

test('reward payload reads class parent recipient and persisted 10 percent only', () => {
  const payload = buildReviewRewardEmailPayload({
    review: review({ sourceType: 'class', sourceReservationId: 'class-123', rewardPercent: 10 }),
    coupon: coupon({ rewardPercent: 10 }),
    reservation: reservation('class'),
    couponCode: 'FOXKIWI7Q2MK',
    from,
    cakeOrderUrl,
  })
  assert.deepEqual(payload.to, ['parent@example.com'])
  assert.match(payload.text, /10% 할인/)
  assert.match(payload.text, /10% off/)
  assert.throws(() => buildReviewRewardEmailPayload({
    review: review({ sourceType: 'class' }), coupon: coupon(), reservation: reservation('class', { parentEmail: 'bad' }),
    couponCode: 'FOXKIWI7Q2MK', from, cakeOrderUrl,
  }), /INVALID_RECIPIENT_EMAIL/)
})

test('reward delivery re-reads authoritative persisted records, decrypts the committed coupon, and claims one first send', async () => {
  const storedReview = review()
  const storedCoupon = coupon()
  const storedReservation = reservation()
  const repository = {
    async getReview(id) { assert.equal(id, 'review-123'); return storedReview },
    async getCoupon(id) { assert.equal(id, 'coupon-123'); return storedCoupon },
    async getSource(sourceType, id) { assert.equal(sourceType, 'cake'); assert.equal(id, 'cake-123'); return storedReservation },
  }
  const deliveryRepository = createDeliveryRepository()
  const payloads = []
  const transport = { async send(payload) { payloads.push(payload); return { kind: 'accepted', providerMessageId: 'resend-123' } } }
  const committed = {
    reviewId: 'review-123', couponId: 'coupon-123', recipient: 'spoof@example.com', rewardPercent: 99, couponCode: 'SPOOF',
  }

  const [first, second] = await Promise.all([
    attemptReviewRewardEmail({ repository, deliveryRepository, transport, committed, encryptionKey, from, cakeOrderUrl, now }),
    attemptReviewRewardEmail({ repository, deliveryRepository, transport, committed, encryptionKey, from, cakeOrderUrl, now }),
  ])

  assert.deepEqual([first.status, second.status].sort(), ['in_progress', 'sent'])
  assert.equal(payloads.length, 1)
  assert.deepEqual(payloads[0].to, ['customer@example.com'])
  assert.match(payloads[0].text, /FOXKIWI7Q2MK/)
  assert.match(payloads[0].text, /5% 할인/)
  assert.doesNotMatch(payloads[0].text, /SPOOF|99%|spoof@example.com/)
  assert.equal(deliveryRepository.deliveries.get('review-reward-customer:review:review-123').status, 'sent')
})

test('reward email failures, missing recipients, and coupon decryption errors never create another coupon or throw', async () => {
  const storedReview = review()
  const storedCoupon = coupon()
  const source = reservation()
  const repository = {
    async getReview() { return storedReview },
    async getCoupon() { return storedCoupon },
    async getSource() { return source },
  }
  const transport = { async send() { throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) } }
  const errors = []
  const deliveryRepository = createDeliveryRepository()
  const timeout = await attemptReviewRewardEmail({
    repository, deliveryRepository, transport, committed: { reviewId: 'review-123', couponId: 'coupon-123' },
    encryptionKey, from, cakeOrderUrl, now, error: (message) => errors.push(message),
  })
  assert.equal(timeout.status, 'uncertain')
  assert.equal(errors.join('\n').includes('FOXKIWI7Q2MK'), false)

  const missing = await attemptReviewRewardEmail({
    repository: { ...repository, async getSource() { return reservation('cake', { customerEmail: '' }) } },
    deliveryRepository: createDeliveryRepository(), transport,
    committed: { reviewId: 'review-123', couponId: 'coupon-123' }, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(missing.status, 'skipped_missing_recipient')

  const undecryptable = await attemptReviewRewardEmail({
    repository: { ...repository, async getCoupon() { return coupon({ codeAuthTag: 'A'.repeat(22) }) } },
    deliveryRepository: createDeliveryRepository(), transport,
    committed: { reviewId: 'review-123', couponId: 'coupon-123' }, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(undecryptable.status, 'skipped_coupon_unrecoverable')
})

test('reward delivery records provider and ledger failures without retrying or changing committed reward data', async () => {
  const storedReview = review()
  const storedCoupon = coupon()
  const calls = []
  const repository = {
    async getReview() { calls.push('getReview'); return storedReview },
    async getCoupon() { calls.push('getCoupon'); return storedCoupon },
    async getSource() { calls.push('getSource'); return reservation() },
    async createCoupon() { calls.push('createCoupon') },
  }
  const committed = { reviewId: 'review-123', couponId: 'coupon-123' }
  const failed = await attemptReviewRewardEmail({
    repository, deliveryRepository: createDeliveryRepository(),
    transport: { async send() { throw new ResendTransportError('failed', 'resend_http_400') } },
    committed, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(failed.status, 'failed')

  const ambiguous = await attemptReviewRewardEmail({
    repository, deliveryRepository: createDeliveryRepository(),
    transport: { async send() { throw new ResendTransportError('uncertain', 'resend_http_500') } },
    committed, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(ambiguous.status, 'uncertain')

  let sends = 0
  for (const decision of [{ kind: 'retryable' }, { kind: 'reconciliation_required' }]) {
    const existing = { $id: 'delivery-existing', status: decision.kind === 'retryable' ? 'failed' : 'uncertain' }
    const result = await attemptReviewRewardEmail({
      repository,
      deliveryRepository: {
        async getOrCreatePending() { return { kind: 'existing', delivery: existing, decision } },
      },
      transport: { async send() { sends += 1; return { kind: 'accepted', providerMessageId: 'must-not-send' } } },
      committed, encryptionKey, from, cakeOrderUrl, now,
    })
    assert.ok(['retry_deferred', 'reconciliation_required'].includes(result.status))
  }
  assert.equal(sends, 0)
  assert.deepEqual(calls.filter((name) => name === 'createCoupon'), [])
})

test('source lookup and ledger write failures are isolated after the committed review exists', async () => {
  const committed = { reviewId: 'review-123', couponId: 'coupon-123' }
  const storedReview = review()
  const storedCoupon = coupon()
  const sourceFailure = await attemptReviewRewardEmail({
    repository: {
      async getReview() { return storedReview },
      async getCoupon() { return storedCoupon },
      async getSource() { throw new Error('source offline') },
    },
    deliveryRepository: createDeliveryRepository(),
    transport: { async send() { throw new Error('must not send') } },
    committed, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(sourceFailure.status, 'skipped_source_unavailable')

  let mismatchedSourceSends = 0
  const mismatchedSource = await attemptReviewRewardEmail({
    repository: {
      async getReview() { return storedReview },
      async getCoupon() { return storedCoupon },
      async getSource() { return reservation('cake', { $id: 'cake-other', customerEmail: 'other@example.com' }) },
    },
    deliveryRepository: createDeliveryRepository(),
    transport: { async send() { mismatchedSourceSends += 1; return { kind: 'accepted', providerMessageId: 'must-not-send' } } },
    committed, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(mismatchedSource.status, 'skipped_source_unavailable')
  assert.equal(mismatchedSourceSends, 0)

  const ledgerFailure = await attemptReviewRewardEmail({
    repository: {
      async getReview() { return storedReview },
      async getCoupon() { return storedCoupon },
      async getSource() { return reservation() },
    },
    deliveryRepository: { async getOrCreatePending() { throw new Error('ledger offline') } },
    transport: { async send() { throw new Error('must not send') } },
    committed, encryptionKey, from, cakeOrderUrl, now,
  })
  assert.equal(ledgerFailure.status, 'ledger_error')
})
