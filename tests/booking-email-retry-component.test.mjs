import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/BookingConfirmationEmailButton.tsx', import.meta.url), 'utf8')

test('booking drawer email control exposes receipt and confirmation status plus an explicit eligible retry without replacing SMS copy', () => {
  assert.match(source, /booking-received-customer/)
  assert.match(source, /booking-confirmed-customer/)
  assert.match(source, /getBookingEmailStatus/)
  assert.match(source, /retryBookingEmail/)
  assert.match(source, /Booking receipt/)
  assert.match(source, /Retry email/)
  assert.match(source, /payload_changed|recipient_changed|expired_window/)
  assert.doesNotMatch(source, /force resend/i)
  assert.doesNotMatch(source, /setInterval|setTimeout\([^)]*retry/i)
})
