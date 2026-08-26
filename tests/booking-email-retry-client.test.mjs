import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBookingEmailStatusPayload,
  buildRetryBookingEmailPayload,
  parseBookingEmailExecution,
} from '../src/lib/booking-email-retry.ts'

test('booking retry client allows only fixed email kinds and parses only the minimal safe status DTO', () => {
  assert.deepEqual(buildBookingEmailStatusPayload('cake', 'cake-123', 'booking-received-customer'), {
    action: 'get-booking-email-status',
    data: { sourceType: 'cake', reservationId: 'cake-123', emailKind: 'booking-received-customer' },
  })
  assert.deepEqual(buildRetryBookingEmailPayload('class', 'class-123', 'booking-confirmed-customer'), {
    action: 'retry-booking-email',
    data: { sourceType: 'class', reservationId: 'class-123', emailKind: 'booking-confirmed-customer' },
  })
  assert.throws(() => buildRetryBookingEmailPayload('cake', 'cake-123', 'attacker-event-key'))
  const parsed = parseBookingEmailExecution({
    status: 'completed', responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result: {
      status: 'uncertain', retry: 'eligible', lastAttemptAt: '2026-08-27T01:00:00.000Z',
      retryUntil: '2026-08-28T00:00:00.000Z', recipientMasked: 'a***@example.com', safeErrorCode: 'resend_timeout',
    } }),
  })
  assert.deepEqual(parsed, {
    status: 'uncertain', retry: 'eligible', lastAttemptAt: '2026-08-27T01:00:00.000Z',
    retryUntil: '2026-08-28T00:00:00.000Z', recipientMasked: 'a***@example.com', safeErrorCode: 'resend_timeout',
  })
  assert.throws(() => parseBookingEmailExecution({
    status: 'completed', responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true, result: { status: 'failed', retry: 'eligible', payloadHash: 'secret' } }),
  }))
})
