import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildListPublicReviewsPayload,
  listPublicReviews,
  parsePublicReviewsResult,
} from '../src/lib/public-reviews.js'
import { publicReviewDemoFixtures } from '../src/lib/public-reviews-demo.js'
import type { PublicReview } from '../src/lib/public-reviews.js'

const validReviews = [
  { sourceType: 'cake', rating: 5, body: 'A celebration cake.', displayName: 'Mina', createdAt: '2026-07-19T00:00:00.000Z', incentivised: true, hasPhoto: false, photoUrl: null },
  { sourceType: 'class', rating: 4, body: 'A thoughtful class.', displayName: 'Verified class booking', createdAt: '2026-07-18T00:00:00.000Z', incentivised: true, hasPhoto: false, photoUrl: null },
]

test('public review request uses the exact public payload and returns strict DTOs', async () => {
  assert.deepEqual(buildListPublicReviewsPayload(), { action: 'list-public', limit: 3 })
  const calls: unknown[] = []
  const executor = { async createExecution(input: unknown) { calls.push(input); return { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: validReviews }) } } }
  assert.deepEqual(await listPublicReviews(executor, 'review-api', 'https://cloud.appwrite.io/v1', 'https://verygood.test'), validReviews)
  assert.deepEqual(calls, [{ functionId: 'review-api', body: JSON.stringify({ action: 'list-public', limit: 3 }), async: false }])
})

test('public review parser fails closed for extra fields, malformed values, invalid dates, or untrusted URLs', () => {
  assert.deepEqual(parsePublicReviewsResult(validReviews, 'https://cloud.appwrite.io/v1', 'https://verygood.test'), validReviews)
  const badValues = [
    [...validReviews, { ...validReviews[0], id: 'private-id' }],
    [{ ...validReviews[0], sourceType: 'order' }],
    [{ ...validReviews[0], rating: 6 }],
    [{ ...validReviews[0], incentivised: false }],
    [{ ...validReviews[0], createdAt: 'not-a-date' }],
    [{ ...validReviews[0], hasPhoto: true, photoUrl: 'javascript:alert(1)' }],
    [{ ...validReviews[0], hasPhoto: true, photoUrl: 'https://evil.test/photo.webp' }],
    validReviews.concat(validReviews[0], validReviews[0]),
  ]
  for (const value of badValues) assert.throws(() => parsePublicReviewsResult(value, 'https://cloud.appwrite.io/v1', 'https://verygood.test'))
})

test('demo fixtures require explicit dev demo mode and contain two five-star reviews with distinct realistic names and one local photo', () => {
  assert.deepEqual(publicReviewDemoFixtures(false, true), [])
  assert.deepEqual(publicReviewDemoFixtures(true, false), [])
  const fixtures = publicReviewDemoFixtures(true, true)
  assert.equal(fixtures.length, 2)
  assert.deepEqual(new Set(fixtures.map((review: PublicReview) => review.sourceType)), new Set(['cake', 'class']))
  assert.equal(fixtures.every((review: PublicReview) => review.rating === 5), true)
  assert.deepEqual(fixtures.map((review: PublicReview) => review.displayName), ['Amelia', 'Ruby'])
  assert.equal(new Set(fixtures.map((review: PublicReview) => review.displayName)).size, 2)
  assert.equal(fixtures.filter((review: PublicReview) => review.hasPhoto && review.photoUrl === '/demo-review-cake.webp').length, 1)
  assert.equal(fixtures.filter((review: PublicReview) => !review.hasPhoto && review.photoUrl === null).length, 1)
})
