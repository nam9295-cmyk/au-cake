import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReviewEmailStatusPayload,
  buildRetryReviewEmailPayload,
  parseReviewEmailExecution,
} from '../src/lib/review-email-retry.ts'

test('review retry client has fixed source identifiers and rejects raw delivery internals', () => {
  assert.deepEqual(buildReviewEmailStatusPayload({
    emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123',
  }), {
    action: 'get-review-email-status',
    data: { emailKind: 'review-invite-customer', sourceType: 'cake', reservationId: 'cake-123' },
  })
  assert.deepEqual(buildRetryReviewEmailPayload({ emailKind: 'review-reward-customer', reviewId: 'review-123' }), {
    action: 'retry-review-email', data: { emailKind: 'review-reward-customer', reviewId: 'review-123' },
  })
  assert.throws(() => buildRetryReviewEmailPayload({ emailKind: 'review-reward-customer', reviewId: 'review-123', eventKey: 'attacker' }))
  assert.deepEqual(parseReviewEmailExecution({
    status: 'completed', responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result: { status: 'failed', retry: 'eligible', safeErrorCode: 'resend_rate_limit_exceeded' } }),
  }), { status: 'failed', retry: 'eligible', safeErrorCode: 'resend_rate_limit_exceeded' })
  assert.throws(() => parseReviewEmailExecution({
    status: 'completed', responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result: { status: 'sent', retry: 'not_needed', providerMessageId: 'secret' } }),
  }))
})
