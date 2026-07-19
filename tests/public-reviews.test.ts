import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildListPublicReviewsPayload,
  listPublicReviewsPage,
  parsePublicReviewsPageResult,
} from '../src/lib/public-reviews.js'
import { publicReviewDemoFixtures } from '../src/lib/public-reviews-demo.js'
import type { PublicReview } from '../src/lib/public-reviews.js'
import { getPageFromPath, pathForPage } from '../src/lib/app-routes.js'
import { getSeoConfig } from '../src/lib/seo.js'

const validReviews: PublicReview[] = [
  {
    id: 'review-a', sourceType: 'cake', rating: 5, body: 'A celebration cake.', displayName: 'Mina',
    createdAt: '2026-07-19T00:00:00.000Z', incentivised: true, hasPhoto: true,
    thumbnailUrl: 'https://cloud.appwrite.io/v1/storage/buckets/review-photos/files/photo-a/preview?project=project',
    photoUrl: 'https://cloud.appwrite.io/v1/storage/buckets/review-photos/files/photo-a/view?project=project',
  },
  {
    id: 'review-b', sourceType: 'class', rating: 4, body: 'A thoughtful class.', displayName: 'Verified class booking',
    createdAt: '2026-07-18T00:00:00.000Z', incentivised: true, hasPhoto: false, thumbnailUrl: null, photoUrl: null,
  },
]

const validPage = { reviews: validReviews, nextCursor: 'review-b', hasMore: true }

test('public review request supports exact homepage and archive cursor payloads', () => {
  assert.deepEqual(buildListPublicReviewsPayload(), { action: 'list-public-page', limit: 3 })
  assert.deepEqual(buildListPublicReviewsPayload(6, 'review-b'), { action: 'list-public-page', limit: 6, cursor: 'review-b' })
  for (const [limit, cursor] of [[0, undefined], [7, undefined], [3.5, undefined], [3, 'bad/id']] as const) {
    assert.throws(() => buildListPublicReviewsPayload(limit, cursor))
  }
})

test('public review executor returns a strict cursor page', async () => {
  const calls: unknown[] = []
  const executor = {
    async createExecution(input: unknown) {
      calls.push(input)
      return { status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: true, result: validPage }) }
    },
  }
  assert.deepEqual(
    await listPublicReviewsPage(executor, 'review-api', 'https://cloud.appwrite.io/v1', { limit: 6, cursor: 'review-b', pageOrigin: 'https://verygood.test' }),
    validPage,
  )
  assert.deepEqual(calls, [{
    functionId: 'review-api', body: JSON.stringify({ action: 'list-public-page', limit: 6, cursor: 'review-b' }), async: false,
  }])
})

test('public review parser fails closed for extra fields, malformed values, invalid dates, or untrusted URLs', () => {
  assert.deepEqual(parsePublicReviewsPageResult(validPage, 3, 'https://cloud.appwrite.io/v1', 'https://verygood.test'), validPage)
  const badReviews = [
    [{ ...validReviews[0], sourceReservationId: 'private-id' }],
    [{ ...validReviews[0], id: 'bad/id' }],
    [{ ...validReviews[0], sourceType: 'order' }],
    [{ ...validReviews[0], rating: 6 }],
    [{ ...validReviews[0], incentivised: false }],
    [{ ...validReviews[0], createdAt: 'not-a-date' }],
    [{ ...validReviews[0], thumbnailUrl: 'javascript:alert(1)' }],
    [{ ...validReviews[0], photoUrl: 'https://evil.test/photo.webp' }],
    [{ ...validReviews[1], thumbnailUrl: 'https://cloud.appwrite.io/should-not-exist' }],
    validReviews.concat(validReviews[0], validReviews[0]),
  ]
  for (const reviews of badReviews) {
    assert.throws(() => parsePublicReviewsPageResult({ reviews, nextCursor: null, hasMore: false }, 3, 'https://cloud.appwrite.io/v1', 'https://verygood.test'))
  }
})

test('public review page cursor and hasMore invariants are exact', () => {
  const invalidPages = [
    { reviews: validReviews, nextCursor: null, hasMore: true },
    { reviews: validReviews, nextCursor: 'review-a', hasMore: true },
    { reviews: validReviews, nextCursor: 'review-b', hasMore: false },
    { reviews: [], nextCursor: 'review-b', hasMore: true },
    { reviews: validReviews, nextCursor: 'bad/id', hasMore: true },
    { reviews: validReviews, nextCursor: null, hasMore: false, total: 2 },
  ]
  for (const page of invalidPages) {
    assert.throws(() => parsePublicReviewsPageResult(page, 3, 'https://cloud.appwrite.io/v1', 'https://verygood.test'))
  }
})

test('demo fixtures require explicit dev demo mode and remain realistic with one local photo', () => {
  assert.deepEqual(publicReviewDemoFixtures(false, true), [])
  assert.deepEqual(publicReviewDemoFixtures(true, false), [])
  const fixtures = publicReviewDemoFixtures(true, true)
  assert.equal(fixtures.length, 2)
  assert.deepEqual(new Set(fixtures.map((review: PublicReview) => review.sourceType)), new Set(['cake', 'class']))
  assert.equal(fixtures.every((review: PublicReview) => review.rating === 5), true)
  assert.deepEqual(fixtures.map((review: PublicReview) => review.displayName), ['Amelia', 'Ruby'])
  assert.equal(new Set(fixtures.map((review: PublicReview) => review.id)).size, 2)
  assert.equal(fixtures.filter((review: PublicReview) => review.hasPhoto && review.thumbnailUrl?.endsWith('/assets/demo-review-cake.webp') && review.photoUrl === review.thumbnailUrl).length, 1)
  assert.equal(fixtures.filter((review: PublicReview) => !review.hasPhoto && review.thumbnailUrl === null && review.photoUrl === null).length, 1)
})

test('public reviews archive has a canonical indexable route', () => {
  assert.equal(getPageFromPath('/reviews'), 'reviews')
  assert.equal(pathForPage('reviews'), '/reviews')
  const seo = getSeoConfig('/reviews')
  assert.equal(seo.noindex, undefined)
  assert.equal(seo.canonical, 'https://au.verygood-chocolate.com/reviews')
  assert.match(seo.title, /Reviews/)
})
