import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ReviewInviteApiError,
  buildReviewInviteEmailStatusPayload,
  buildSendReviewInviteEmailPayload,
  copyReviewInviteRequest,
  getReviewInviteEmailStatus,
  parseReviewInviteCopyExecution,
  parseReviewInviteEmailExecution,
  sendReviewInviteEmail,
} from '../src/lib/review-repository.js'

const sent = {
  status: 'completed',
  responseStatusCode: 200,
  responseBody: JSON.stringify({
    ok: true,
    result: { status: 'sent', sentAt: '2026-08-26T01:02:03.000Z', recipientMasked: 'j***@example.com' },
  }),
}

test('review invite email client sends only the action, source type, and reservation id', () => {
  assert.deepEqual(buildSendReviewInviteEmailPayload('cake', 'cake-123'), {
    action: 'send-review-invite-email', data: { sourceType: 'cake', sourceReservationId: 'cake-123' },
  })
  assert.deepEqual(buildReviewInviteEmailStatusPayload('class', 'class-123'), {
    action: 'get-review-invite-email-status', data: { sourceType: 'class', sourceReservationId: 'class-123' },
  })
})

test('review invite email client accepts only minimal safe delivery DTOs', async () => {
  assert.deepEqual(parseReviewInviteEmailExecution(sent), {
    status: 'sent', sentAt: '2026-08-26T01:02:03.000Z', recipientMasked: 'j***@example.com',
  })
  const calls: unknown[] = []
  const executor = { async createExecution(input: unknown) { calls.push(input); return sent } }
  assert.equal((await sendReviewInviteEmail(executor, 'review-api', 'cake', 'cake-123')).status, 'sent')
  assert.equal((await getReviewInviteEmailStatus(executor, 'review-api', 'class', 'class-123')).status, 'sent')
  assert.deepEqual(calls, [
    { functionId: 'review-api', body: JSON.stringify(buildSendReviewInviteEmailPayload('cake', 'cake-123')), async: false },
    { functionId: 'review-api', body: JSON.stringify(buildReviewInviteEmailStatusPayload('class', 'class-123')), async: false },
  ])
  for (const result of [
    { status: 'sent', providerMessageId: 'private' },
    { status: 'sent', recipientMasked: 'jenny@example.com' },
    { status: 'sent', sentAt: 'not-a-date' },
    { status: 'not_sent', recipientAvailable: 'yes' },
  ]) {
    assert.throws(() => parseReviewInviteEmailExecution({ ...sent, responseBody: JSON.stringify({ ok: true, result }) }), ReviewInviteApiError)
  }
})

test('review request copy response returns only the clipboard message', async () => {
  const response = {
    status: 'completed', responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result: { message: '[한국어]\nhttps://au.verygood-chocolate.com/review#secret', private: 'drop' } }),
  }
  assert.throws(() => parseReviewInviteCopyExecution(response), ReviewInviteApiError)
  const safe = {
    ...response,
    responseBody: JSON.stringify({ ok: true, result: { message: '[한국어]\nhttps://au.verygood-chocolate.com/review#secret' } }),
  }
  assert.deepEqual(parseReviewInviteCopyExecution(safe), { message: '[한국어]\nhttps://au.verygood-chocolate.com/review#secret' })
  const executor = { async createExecution() { return safe } }
  assert.match((await copyReviewInviteRequest(executor, 'review-api', 'cake', 'cake-123')).message, /review#secret/)
})

test('review invite email client fails closed on errors and malformed results', async () => {
  assert.throws(
    () => parseReviewInviteEmailExecution({ status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: false, code: 'REVIEW_INVITE_EMAIL_MISSING' }) }),
    (error: unknown) => error instanceof ReviewInviteApiError && error.code === 'REVIEW_INVITE_EMAIL_MISSING',
  )
  await assert.rejects(
    () => sendReviewInviteEmail({ async createExecution() { return { status: 'completed', responseStatusCode: 200, responseBody: '{}' } } }, 'review-api', 'cake', 'cake-123'),
    ReviewInviteApiError,
  )
})
