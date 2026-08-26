import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BookingConfirmationEmailError,
  buildBookingConfirmationStatusPayload,
  buildSendBookingConfirmationPayload,
  getBookingConfirmationStatus,
  parseBookingConfirmationExecution,
  sendBookingConfirmation,
} from '../src/lib/booking-confirmation-email.js'

const sent = {
  status: 'completed', responseStatusCode: 200,
  responseBody: JSON.stringify({ ok: true, result: { status: 'sent', sentAt: '2026-08-26T01:02:03.000Z', recipientMasked: 'a***@example.com' } }),
}

test('booking confirmation client sends only action, source type, and reservation id', () => {
  assert.deepEqual(buildSendBookingConfirmationPayload('cake', 'cake-123'), {
    action: 'send-booking-confirmation', data: { sourceType: 'cake', reservationId: 'cake-123' },
  })
  assert.deepEqual(buildBookingConfirmationStatusPayload('class', 'class-123'), {
    action: 'get-booking-confirmation-status', data: { sourceType: 'class', reservationId: 'class-123' },
  })
})

test('booking confirmation client accepts only safe delivery DTOs', async () => {
  assert.deepEqual(parseBookingConfirmationExecution(sent), {
    status: 'sent', sentAt: '2026-08-26T01:02:03.000Z', recipientMasked: 'a***@example.com',
  })
  const calls: unknown[] = []
  const executor = { async createExecution(input: unknown) { calls.push(input); return sent } }
  assert.equal((await sendBookingConfirmation(executor, 'reservation-notification', 'cake', 'cake-123')).status, 'sent')
  assert.equal((await getBookingConfirmationStatus(executor, 'reservation-notification', 'class', 'class-123')).status, 'sent')
  assert.deepEqual(calls, [
    { functionId: 'reservation-notification', body: JSON.stringify(buildSendBookingConfirmationPayload('cake', 'cake-123')), async: false },
    { functionId: 'reservation-notification', body: JSON.stringify(buildBookingConfirmationStatusPayload('class', 'class-123')), async: false },
  ])
  for (const result of [
    { status: 'sent', providerMessageId: 'private' },
    { status: 'sent', recipientMasked: 'alice@example.com' },
    { status: 'sent', recipientHash: 'f'.repeat(64) },
    { status: 'sent', sentAt: 'not-a-date' },
  ]) {
    assert.throws(() => parseBookingConfirmationExecution({ ...sent, responseBody: JSON.stringify({ ok: true, result }) }), BookingConfirmationEmailError)
  }
})

test('booking confirmation client fails closed on remote failure or malformed response', async () => {
  assert.throws(
    () => parseBookingConfirmationExecution({ status: 'completed', responseStatusCode: 200, responseBody: JSON.stringify({ ok: false, code: 'BOOKING_CONFIRMATION_UNAUTHORIZED' }) }),
    (error: unknown) => error instanceof BookingConfirmationEmailError && error.code === 'BOOKING_CONFIRMATION_UNAUTHORIZED',
  )
  await assert.rejects(
    () => sendBookingConfirmation({ async createExecution() { return { status: 'completed', responseStatusCode: 200, responseBody: '{}' } } }, 'reservation-notification', 'cake', 'cake-123'),
    BookingConfirmationEmailError,
  )
})
