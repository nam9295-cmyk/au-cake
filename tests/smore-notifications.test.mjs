import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildCakeNotificationRows, buildBookingDeliveryPayload, buildBookingConfirmationPayload } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload } from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'

test('server-generated Smore-only and coupon-mixed orders survive all existing email stored readers', () => {
  for (const mixed of [false, true]) {
    const document = {
      $id: 'smore-generated-fixture',
      ...buildCakeReservation({
        customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'customer@example.com',
        pickupDate: '2099-07-11', pickupTime: '12:00', privacyConsent: true,
        orderLines: [{ productId: 'smore-stick', quantity: 50 }, ...(mixed ? [{ productId: 'pound-cake', quantity: 1 }] : [])],
      }, {
        now: new Date('2099-07-01T00:00:00.000Z'), reservationNumber: 'VG-C-AU-GENERATED',
        ...(mixed ? { reviewCoupon: { id: 'test-coupon', rewardPercent: 10, codeLast4: 'ABCD' } } : {}),
      }),
      status: '예약확정',
    }
    const payloads = [
      buildBookingDeliveryPayload({ reservation: document, from, role: 'operator', operatorRecipients: ['operator@example.com'] }),
      buildBookingDeliveryPayload({ reservation: document, from, role: 'customer' }),
      buildBookingConfirmationPayload({ reservation: document, from, sourceType: 'cake' }),
      buildCakeReminderPayload({ reservation: document, from }),
    ]
    for (const payload of payloads) {
      assert.match(payload.text, /S'more Stick/)
      assert.match(payload.text, /50/)
      assert.match(payload.text, /AUD 180\.00/)
      assert.match(payload.text, /20% bulk discount/)
    }
    assert.match(sanitizeCakeCalendarEvent(document).label, /S'more Stick ×50/)
  }
})

const reservation = {
  $id: 'smore-fixture', reservationNumber: 'VG-C-AU-SMORE',
  customerName: 'Test Customer', customerPhone: '0400000000', customerEmail: 'customer@example.com',
  productId: 'smore-stick', quantity: 100, cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
  pickupDate: '2099-07-11', pickupTime: '12:00', status: '예약확정', paymentStatus: '입금대기',
  totalPriceCents: 36000, totalPrice: 360, discountPercent: 20, discountCents: 9000,
  createdAt: '2099-07-01T00:00:00.000Z', requestNote: '',
}
const from = 'Bookings <bookings@example.com>'

test('Smore operator rows show full stick quantity, bulk audit and no cake options', () => {
  const rows = Object.fromEntries(buildCakeNotificationRows(reservation))
  assert.equal(rows.Product, "S'more Stick")
  assert.match(rows.Quantity, /^100/)
  assert.equal(rows['Bulk discount'], '20% bulk discount')
  assert.equal(rows['Line total'], 'AUD 360.00')
  for (const option of ['Size', 'Chocolate', 'Finish', 'Icing mix']) assert.equal(option in rows, false)
})

test('Smore existing operator/customer receipt and confirmation templates retain quantity and pricing', () => {
  const payloads = [
    buildBookingDeliveryPayload({ reservation, from, role: 'operator', operatorRecipients: ['operator@example.com'] }),
    buildBookingDeliveryPayload({ reservation, from, role: 'customer' }),
    buildBookingConfirmationPayload({ reservation, from, sourceType: 'cake' }),
  ]
  for (const payload of payloads) {
    assert.match(payload.text, /S'more Stick/)
    assert.match(payload.text, /100/)
    assert.match(payload.text, /AUD 360\.00/)
    assert.match(payload.text, /20% bulk discount/)
    assert.doesNotMatch(payload.text, /6" \| serves 8/)
  }
  assert.deepEqual(payloads[0].to, ['operator@example.com'])
  assert.deepEqual(payloads[1].to, ['customer@example.com'])
})

test('Smore reminder does not cap 100 sticks at 99 or show cake size', () => {
  const payload = buildCakeReminderPayload({ reservation, from })
  assert.match(payload.text, /S'more Stick × 100/)
  assert.match(payload.text, /AUD 360\.00/)
  assert.match(payload.text, /20% bulk discount/)
  assert.doesNotMatch(payload.text, /serves 8/)
})

test('calendar Smore label has no meaningless Basic finish', () => {
  assert.equal(sanitizeCakeCalendarEvent(reservation).label, "S'more Stick ×100")
})
