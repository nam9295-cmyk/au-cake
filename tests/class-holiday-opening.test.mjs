import test from 'node:test'
import assert from 'node:assert/strict'
import { isSpringClassBookingDateAllowed, buildClassReservation } from '../appwrite-functions/reservation-api/src/business.js'

const now = new Date('2026-09-15T00:00:00Z')
test('holiday booking accepts all 17 days and three courses at all three session times', () => {
  const input = { bookingType: 'year-1-2', parentName: 'Test Parent', parentPhone: '0412345678', parentEmail: 'test@example.com', childName: 'Test Child', childAge: 8, schoolYear: 'Year 2', emergencyContact: 'Parent', pickupPerson: 'Parent', parentConsent: true, cancellationAgreement: true, privacyConsent: true, photoConsent: false }
  for (let day = 0; day < 17; day++) {
    const classDate = new Date(Date.UTC(2026, 8, 26 + day)).toISOString().slice(0, 10)
    assert.equal(isSpringClassBookingDateAllowed(classDate, now), true, classDate)
    for (const classType of ['school-holiday-private-cake-class', 'cupcake-chocolate-class', 'advanced-2-tier-cake-class']) {
      for (const classTime of ['10:00', '13:00', '16:00']) {
        const result = buildClassReservation({ ...input, classDate, classTime, classType, coursePlan: classType === 'advanced-2-tier-cake-class' ? 'advanced' : 'basic' }, { now })
        assert.equal(result.classDate, classDate)
        assert.equal(result.classType, classType)
        assert.equal(result.classTime, classTime)
      }
    }
  }
})
test('holiday booking rejects dates outside the window and closes at Sydney midnight', () => {
  for (const date of ['2026-09-25', '2026-10-13', '2027-09-26', 'invalid']) assert.equal(isSpringClassBookingDateAllowed(date, now), false)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-12', new Date('2026-10-12T12:59:59Z')), true)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-12', new Date('2026-10-12T13:00:00Z')), false)
})
