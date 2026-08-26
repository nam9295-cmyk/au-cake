import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { ReviewApiError } from '../appwrite-functions/review-api/src/business.js'
import { handleReviewRequest, safeActionForLog } from '../appwrite-functions/review-api/src/main.js'

const body = {
  action: 'send-review-invite-email',
  data: {
    sourceType: 'cake',
    sourceReservationId: 'cake-123',
    customerEmail: 'spoof@example.com',
    token: 'spoof-token',
  },
}

test('review invite email actions require the exact review administrator before invoking any source service', async () => {
  let calls = 0
  const services = {
    async sendInviteEmail(input) { calls += 1; return { status: 'sent', input } },
    async copyInviteRequest() { calls += 1; return { message: 'copy' } },
    async getInviteEmailStatus() { calls += 1; return { status: 'not_sent' } },
  }
  const env = { REVIEW_ADMIN_USER_IDS: 'admin-1' }
  for (const headers of [{}, { 'x-appwrite-user-id': 'not-admin' }]) {
    await assert.rejects(
      () => handleReviewRequest(body, headers, env, services, { private: true }),
      (error) => error instanceof ReviewApiError && error.code === 'REVIEW_ADMIN_UNAUTHORIZED',
    )
  }
  assert.equal(calls, 0)

  const result = await handleReviewRequest(body, { 'x-appwrite-user-id': 'admin-1' }, env, services, { private: true }, undefined, {
    tokenEncryptionKey: Buffer.alloc(32, 1),
    deliveryRepository: { private: true },
    transport: { private: true },
    reviewOrigin: 'https://au.verygood-chocolate.com',
  })
  assert.equal(result.status, 'sent')
  assert.equal(calls, 1)
  assert.equal(result.input.createdByUserId, 'admin-1')
  assert.equal(result.input.request.customerEmail, 'spoof@example.com')
  assert.equal(result.input.request.token, 'spoof-token')
})

test('review invite actions are allowlisted for logs and stay distinct from public review routes', () => {
  assert.equal(safeActionForLog('send-review-invite-email'), 'send-review-invite-email')
  assert.equal(safeActionForLog('copy-review-invite-request'), 'copy-review-invite-request')
  assert.equal(safeActionForLog('get-review-invite-email-status'), 'get-review-invite-email-status')
  assert.equal(safeActionForLog('send-review-invite-email\nprivate@example.com'), 'unknown')
})
