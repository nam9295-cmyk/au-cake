import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildListAdminReviewsPayload,
  buildModerateReviewPayload,
  listAdminReviews,
  mergeAdminReviewPages,
  moderateAdminReview,
  moderationCompletionPlan,
  parseAdminReviewListResult,
  parseAdminReviewResult,
  type AdminReview,
} from '../src/lib/admin-reviews.js'
import { adminReviewDemoFixtures } from '../src/lib/admin-reviews-demo.js'

const pending: AdminReview = {
  id: 'review-pending',
  sourceType: 'cake',
  rating: 3,
  body: 'The finish was lovely, but pickup communication could have been clearer.',
  displayName: 'Alex',
  hasPhoto: true,
  photoPublishConsent: false,
  publishConsent: true,
  moderationStatus: 'pending',
  rewardPercent: 10,
  rewardCodeLast4: null,
  rewardStatus: 'unavailable',
  rewardExpiresAt: null,
  rewardMessageAvailable: false,
  createdAt: '2026-07-18T01:00:00.000Z',
  updatedAt: '2026-07-18T01:00:00.000Z',
}

test('admin review requests use exact bounded payloads', () => {
  assert.deepEqual(buildListAdminReviewsPayload('pending'), {
    action: 'list-admin-reviews', data: { moderationStatus: 'pending', limit: 20 },
  })
  assert.deepEqual(buildListAdminReviewsPayload('hidden', 'cursor-1'), {
    action: 'list-admin-reviews', data: { moderationStatus: 'hidden', limit: 20, cursor: 'cursor-1' },
  })
  assert.deepEqual(buildModerateReviewPayload('review-pending', 'published'), {
    action: 'moderate-review', data: { reviewId: 'review-pending', moderationStatus: 'published' },
  })
})

test('admin parser accepts only the exact private-safe DTO keys and domain values', () => {
  assert.deepEqual(parseAdminReviewResult(pending), pending)
  assert.deepEqual(parseAdminReviewListResult({ reviews: [pending], nextCursor: 'next-review' }), {
    reviews: [pending], nextCursor: 'next-review',
  })
  const forbidden = {
    ...pending,
    phone: '0400000000',
    email: 'private@example.test',
    childName: 'Private child',
    sourceReservationId: 'reservation-private',
    sourceReservationNumber: 'VG-1234',
    couponId: 'coupon-private',
    couponCode: 'FOXKIWI7Q2MK',
    couponHash: 'hash',
    couponLast4: 'BBBB',
    inviteToken: 'token',
    tokenHash: 'token-hash',
    photoFileId: 'file-private',
  }
  assert.throws(() => parseAdminReviewResult(forbidden))
  for (const invalid of [
    { ...pending, rating: 0 },
    { ...pending, rewardPercent: 7 },
    { ...pending, publishConsent: 'true' },
    { ...pending, moderationStatus: 'approved' },
    { ...pending, createdAt: 'not-a-date' },
    { ...pending, createdAt: '2026-07-18' },
    { ...pending, updatedAt: '2026-07-18T01:00:00' },
    { ...pending, id: '' },
  ]) assert.throws(() => parseAdminReviewResult(invalid))
})

test('admin repository executes exact Function payloads and fail-closes malformed envelopes', async () => {
  const calls: unknown[] = []
  const executor = {
    async createExecution(input: unknown) {
      calls.push(input)
      return {
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({
          ok: true,
          result: calls.length === 1
            ? { reviews: [pending], nextCursor: null }
            : { ...pending, moderationStatus: 'hidden' },
        }),
      }
    },
  }
  assert.deepEqual(await listAdminReviews(executor, 'review-api', 'pending'), { reviews: [pending], nextCursor: null })
  assert.equal((await moderateAdminReview(executor, 'review-api', pending.id, 'hidden')).moderationStatus, 'hidden')
  assert.deepEqual(calls, [
    { functionId: 'review-api', body: JSON.stringify(buildListAdminReviewsPayload('pending')), async: false },
    { functionId: 'review-api', body: JSON.stringify(buildModerateReviewPayload(pending.id, 'hidden')), async: false },
  ])
  await assert.rejects(
    () => listAdminReviews({
      async createExecution() {
        return {
          status: 'completed', responseStatusCode: 200,
          responseBody: JSON.stringify({ ok: true, result: { reviews: [{ ...pending, phone: 'private' }], nextCursor: null } }),
        }
      },
    }, 'review-api', 'pending'),
    /ADMIN_REVIEWS_REQUEST_FAILED/,
  )
})

test('page merge deduplicates moderation refs while preserving newest response values', () => {
  const published = { ...pending, moderationStatus: 'published' as const, updatedAt: '2026-07-19T00:00:00.000Z' }
  assert.deepEqual(mergeAdminReviewPages([pending], [published, { ...pending, id: 'review-two' }]), [published, { ...pending, id: 'review-two' }])
})

test('moderation completion is generation-bound and refetches the currently selected filter without removing its new item', async () => {
  let resolveModeration!: () => void
  const pendingModeration = new Promise<void>((resolve) => { resolveModeration = resolve })
  let generation = 4
  let selectedFilter: 'pending' | 'published' = 'pending'
  let visible = [pending]
  const startedGeneration = generation

  const completion = pendingModeration.then(() => {
    const plan = moderationCompletionPlan(startedGeneration, generation, selectedFilter)
    if (plan.applyToStartedGeneration) visible = visible.filter((review) => review.id !== pending.id)
    return plan
  })

  // A newer Published load wins while the old Pending moderation is still in flight.
  generation += 1
  selectedFilter = 'published'
  visible = [{ ...pending, moderationStatus: 'published' }]
  resolveModeration()

  assert.deepEqual(await completion, {
    applyToStartedGeneration: false,
    refetchFilter: 'published',
    refetchGeneration: 5,
  })
  assert.deepEqual(visible.map((review) => [review.id, review.moderationStatus]), [['review-pending', 'published']])
})

test('admin demo fixtures require explicit development demo mode and mirror public fixtures plus pending', () => {
  assert.deepEqual(adminReviewDemoFixtures(false, true), [])
  assert.deepEqual(adminReviewDemoFixtures(true, false), [])
  const fixtures = adminReviewDemoFixtures(true, true)
  assert.equal(fixtures.length, 3)
  assert.deepEqual(new Set(fixtures.map((review) => review.moderationStatus)), new Set(['published', 'pending']))
  assert.equal(fixtures.some((review) => review.displayName === 'Amelia' && review.rating === 5 && review.body.includes('family celebration')), true)
  assert.equal(fixtures.some((review) => review.displayName === 'Ruby' && review.rating === 5 && review.sourceType === 'class'), true)
  assert.equal(fixtures.some((review) => review.moderationStatus === 'pending' && review.hasPhoto), true)
})
