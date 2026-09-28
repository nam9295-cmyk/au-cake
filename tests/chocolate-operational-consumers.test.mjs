import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { buildCakeNotificationRows, buildBookingConfirmationPayload, buildNotificationText, buildNotificationHtml } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload } from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'

const chocolates = [
  ['almond-chocoball-80g', 'Almond Chocoball', '80g'],
  ['almond-chocoball-6pack', 'Almond Chocoball 6 Pack', '80g × 6'],
  ['almond-chocoball-black-tub-2x80g', 'Almond Chocoball Black Tub', '80g × 2'],
  ['pave-chocolate-100g', 'Pavé Chocolate', '100g'],
  ['eiffel-tower-chocolate-6', 'Eiffel Tower Chocolate', '6 pieces'],
]
function reservation(orderLines) {
  return { ...buildCakeReservation({
    customerName: 'Chocolate Buyer', customerPhone: '0412345678', customerEmail: 'buyer@example.com',
    pickupDate: '2026-09-28', pickupTime: '10:00', privacyConsent: true, orderLines,
  }, { now: new Date('2026-09-26T00:00:00Z'), reservationNumber: 'VG-C-AU-CHOC' }), $id: 'chocolate-order' }
}
for (const [productId, name, unit] of chocolates) {
  test(`${productId} actual admin/customer emails, reminder and calendar display its sale unit`, () => {
    const row = reservation([{ productId, quantity: 2 }])
    const email = buildBookingConfirmationPayload({ reservation: row, sourceType: 'cake', from: 'shop@example.com' })
    const reminder = buildCakeReminderPayload({ reservation: row, from: 'shop@example.com' })
    const outputs = [JSON.stringify(buildCakeNotificationRows(row)), buildNotificationText(row), buildNotificationHtml(row),
      email.text, email.html, reminder.text, reminder.html, sanitizeCakeCalendarEvent(row).label]
    for (const output of outputs) {
      assert.ok(output.includes(name), output)
      assert.ok(output.includes(unit), output)
      assert.doesNotMatch(output, /15cm|serves 8|Dark chocolate|Cake Size/)
    }
    assert.equal(buildCakeNotificationRows(row).some(([label]) => label === 'Size'), false)
  })
}
test('mixed operational summaries retain each chocolate and the once-per-row cake extra', () => {
  const row = reservation([{ productId: 'pave-cake', cakeSize: '6in', chocolateExtra: 'combo', quantity: 2 },
    ...chocolates.map(([productId]) => ({ productId, quantity: 1 }))])
  const email = buildBookingConfirmationPayload({ reservation: row, sourceType: 'cake', from: 'shop@example.com' })
  const reminder = buildCakeReminderPayload({ reservation: row, from: 'shop@example.com' })
  for (const output of [buildNotificationText(row), email.text, reminder.text, sanitizeCakeCalendarEvent(row).label]) {
    for (const [, name, unit] of chocolates) { assert.ok(output.includes(name), output); assert.ok(output.includes(unit), output) }
  }
  for (const output of [buildNotificationText(row), email.text, reminder.text]) {
    assert.match(output, /Chocolate Extra Set/)
    assert.match(output, /(?:A\$|AUD |\$)20(?:\.00)?/)
  }
})
