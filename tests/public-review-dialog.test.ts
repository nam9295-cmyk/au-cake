import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  adjacentReviewId,
  reviewDialogHref,
  reviewIdFromHash,
} from '../src/lib/public-review-dialog.js'

test('review dialog history uses one encoded public review hash without losing path or search', () => {
  assert.equal(reviewDialogHref('/reviews', '?source=home', 'review-a'), '/reviews?source=home#review=review-a')
  assert.equal(reviewIdFromHash('#review=review-a'), 'review-a')
  assert.equal(reviewIdFromHash('#review=bad%2Fid'), null)
  assert.equal(reviewIdFromHash('#other=review-a'), null)
})

test('review dialog previous and next navigation stops at collection boundaries', () => {
  const ids = ['review-a', 'review-b', 'review-c']
  assert.equal(adjacentReviewId(ids, 'review-b', -1), 'review-a')
  assert.equal(adjacentReviewId(ids, 'review-b', 1), 'review-c')
  assert.equal(adjacentReviewId(ids, 'review-a', -1), null)
  assert.equal(adjacentReviewId(ids, 'review-c', 1), null)
  assert.equal(adjacentReviewId(ids, 'missing', 1), null)
})
