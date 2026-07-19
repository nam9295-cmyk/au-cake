import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  calculateReviewRewardPercent,
  getReviewCouponExpiresAt,
  getReviewInviteExpiresAt,
  isReviewRating,
  toPublicReview,
} from '../src/lib/reviews.js'
import type { Review, ReviewRating, ReviewRewardPercent, ReviewSourceType } from '../src/lib/types.js'

const baseReview: Review = {
  id: 'review-1',
  sourceType: 'cake',
  sourceReservationId: 'reservation-internal-id',
  sourceReservationNumber: 'VG-AU-PRIVATE-001',
  rating: 5,
  body: 'The cake was lovely.',
  photoFileId: null,
  displayName: 'Jenny',
  publishConsent: true,
  moderationStatus: 'published',
  rewardPercent: 5,
  couponId: 'coupon-internal-id',
  createdAt: '2026-07-18T02:00:00.000Z',
  updatedAt: '2026-07-18T02:00:00.000Z',
}

test('review domain types restrict source, reward, and rating values', () => {
  const sourceTypes: ReviewSourceType[] = ['cake', 'class']
  const rewardPercents: ReviewRewardPercent[] = [5, 10]
  const ratings: ReviewRating[] = [1, 2, 3, 4, 5]

  // @ts-expect-error unsupported review source
  const invalidSource: ReviewSourceType = 'google'
  // @ts-expect-error unsupported reward percentage
  const invalidReward: ReviewRewardPercent = 15
  // @ts-expect-error ratings must be between 1 and 5
  const invalidRating: ReviewRating = 0

  assert.deepEqual(sourceTypes, ['cake', 'class'])
  assert.deepEqual(rewardPercents, [5, 10])
  assert.deepEqual(ratings, [1, 2, 3, 4, 5])
  assert.equal(invalidSource, 'google')
  assert.equal(invalidReward, 15)
  assert.equal(invalidRating, 0)
})

test('review without a valid photo receives a 5 percent reward', () => {
  assert.equal(calculateReviewRewardPercent({ photoFileId: null }), 5)
  assert.equal(calculateReviewRewardPercent({ photoFileId: '' }), 5)
  assert.equal(calculateReviewRewardPercent({ photoFileId: '   ' }), 5)
})

test('review with a valid photo receives a 10 percent reward', () => {
  assert.equal(calculateReviewRewardPercent({ photoFileId: 'photo-file-1' }), 10)
})

test('one-star and five-star review fixtures receive the same reward for the same photo state', () => {
  const oneStarReview: Review = { ...baseReview, rating: 1, photoFileId: 'photo-file-1' }
  const fiveStarReview: Review = { ...baseReview, rating: 5, photoFileId: 'photo-file-1' }

  assert.equal(calculateReviewRewardPercent({ photoFileId: oneStarReview.photoFileId }), 10)
  assert.equal(calculateReviewRewardPercent({ photoFileId: fiveStarReview.photoFileId }), 10)
})

test('runtime review rating guard accepts only integer ratings from 1 through 5', () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(isReviewRating(rating), true)
  for (const rating of [0, 6, 1.5, '5', null, undefined, Number.NaN]) {
    assert.equal(isReviewRating(rating), false)
  }
})

test('invite expiry adds 30 Australia/Sydney calendar days across daylight saving', () => {
  const createdAt = new Date('2026-09-30T14:30:00.000Z') // 2026-10-01 00:30 in Sydney

  assert.equal(getReviewInviteExpiresAt(createdAt).toISOString(), '2026-10-30T13:30:00.000Z')
})

test('coupon expiry adds 60 Australia/Sydney calendar days across daylight saving', () => {
  const createdAt = new Date('2026-09-30T14:30:00.000Z') // 2026-10-01 00:30 in Sydney

  assert.equal(getReviewCouponExpiresAt(createdAt).toISOString(), '2026-11-29T13:30:00.000Z')
})

test('invite expiry shifts a nonexistent Sydney 02:30 forward by the DST gap', () => {
  const createdAt = new Date('2026-09-03T16:30:00.000Z') // 2026-09-04 02:30 in Sydney

  assert.equal(getReviewInviteExpiresAt(createdAt).toISOString(), '2026-10-03T16:30:00.000Z') // 2026-10-04 03:30
})

test('invite expiry chooses the earlier instant for an ambiguous Sydney 02:30', () => {
  const createdAt = new Date('2026-03-05T15:30:00.000Z') // 2026-03-06 02:30 in Sydney

  assert.equal(getReviewInviteExpiresAt(createdAt).toISOString(), '2026-04-04T15:30:00.000Z') // first 2026-04-05 02:30
})

test('review expiry functions reject Invalid Date explicitly', () => {
  const invalidDate = new Date(Number.NaN)
  const expected = { name: 'RangeError', message: 'Review expiry date must be valid' }

  assert.throws(() => getReviewInviteExpiresAt(invalidDate), expected)
  assert.throws(() => getReviewCouponExpiresAt(invalidDate), expected)
})

test('public review DTO allowlists display fields and removes references and PII', () => {
  const internalRow = {
    ...baseReview,
    customerPhone: '0412 345 678',
    parentEmail: 'parent@example.com',
    childName: 'Private Child',
  }
  const publicReview = toPublicReview(internalRow)

  assert.deepEqual(publicReview, {
    id: 'review-1',
    sourceType: 'cake',
    rating: 5,
    body: 'The cake was lovely.',
    displayName: 'Jenny',
    photoUrl: null,
    createdAt: '2026-07-18T02:00:00.000Z',
    incentivised: true,
  })
  assert.equal('sourceReservationId' in publicReview, false)
  assert.equal('sourceReservationNumber' in publicReview, false)
  assert.equal('customerPhone' in publicReview, false)
  assert.equal('parentEmail' in publicReview, false)
  assert.equal('childName' in publicReview, false)
})

test('public review DTO uses verified source fallback when display name is blank', () => {
  assert.equal(toPublicReview({ ...baseReview, displayName: '   ' }).displayName, 'Verified cake order')
  assert.equal(
    toPublicReview({ ...baseReview, sourceType: 'class', displayName: null }).displayName,
    'Verified class booking',
  )
})

function assertReviewNotPublicError(action: () => unknown): void {
  assert.throws(action, (error: unknown) => {
    assert.equal(error instanceof Error, true)
    assert.equal((error as Error & { code?: string }).code, 'REVIEW_NOT_PUBLIC')
    assert.equal((error as Error).message, 'Review requires publish consent and published moderation status')
    return true
  })
}

test('public review DTO rejects a review without publish consent', () => {
  assertReviewNotPublicError(() => toPublicReview({ ...baseReview, publishConsent: false }))
})

test('public review DTO rejects a pending review', () => {
  assertReviewNotPublicError(() => toPublicReview({ ...baseReview, moderationStatus: 'pending' }))
})

test('public review DTO rejects a hidden review', () => {
  assertReviewNotPublicError(() => toPublicReview({ ...baseReview, moderationStatus: 'hidden' }))
})
