import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import type { PublicReview } from '../src/lib/public-reviews.js'
import type { ReviewSubmissionResult } from '../src/lib/review-page.js'

test('review domain types restrict source, reward, and rating values', () => {
  const sourceTypes: PublicReview['sourceType'][] = ['cake', 'class']
  const rewardPercents: ReviewSubmissionResult['rewardPercent'][] = [5, 10]
  const ratings: PublicReview['rating'][] = [1, 2, 3, 4, 5]

  // @ts-expect-error unsupported review source
  const invalidSource: PublicReview['sourceType'] = 'google'
  // @ts-expect-error unsupported reward percentage
  const invalidReward: ReviewSubmissionResult['rewardPercent'] = 15
  // @ts-expect-error ratings must be between 1 and 5
  const invalidRating: PublicReview['rating'] = 0

  assert.deepEqual(sourceTypes, ['cake', 'class'])
  assert.deepEqual(rewardPercents, [5, 10])
  assert.deepEqual(ratings, [1, 2, 3, 4, 5])
  assert.equal(invalidSource, 'google')
  assert.equal(invalidReward, 15)
  assert.equal(invalidRating, 0)
})
