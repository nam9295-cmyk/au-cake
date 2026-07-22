import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildClassNotificationRows } from '../functions/reservation-notification/src/main.js'

const base = {
  reservationNumber: 'VG-KC-AU-20260722-100000123',
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-07-25',
  classTime: '10:00',
  bookingType: 'year-1-2',
  parentName: 'Parent',
  parentPhone: '0412345678',
  parentEmail: 'parent@example.com',
  childName: 'Child',
  childAge: 7,
  schoolYear: 'Year 2',
  allergyNote: '',
  emergencyContact: 'Parent 0412345678',
  pickupPerson: 'Parent',
  parentConsent: true,
  cancellationAgreement: true,
  photoConsent: false,
  status: 'Requested',
  paymentStatus: 'Payment pending',
  depositAmount: 0,
  createdAt: '2026-07-22T00:00:00.000Z',
}

function rowMap(reservation) {
  return Object.fromEntries(buildClassNotificationRows(reservation))
}

test('Basic class notification uses approved labels, duration and authoritative cents', () => {
  const rows = rowMap({
    ...base,
    coursePlan: 'basic',
    durationMinutes: 90,
    extensionMinutes: 0,
    subtotalCents: 9900,
    discountPercent: 0,
    discountCents: 0,
    totalPriceCents: 9900,
    totalPrice: 99,
  })
  assert.equal(rows.Class, 'Basic Cake Class')
  assert.equal(rows.Plan, 'Basic')
  assert.equal(rows['Booking type'], 'Kindy–Year 2')
  assert.equal(rows['First duration'], '90 minutes')
  assert.equal(rows['First extension'], 'None')
  assert.equal(rows.Subtotal, 'AUD 99.00')
  assert.equal(rows.Discount, 'None')
  assert.equal(rows.Total, 'AUD 99.00')
  assert.equal(JSON.stringify(rows).includes('Holiday'), false)
})

test('Advanced notification identifies one Advanced 2-Tier session at AUD 159', () => {
  const rows = rowMap({
    ...base,
    coursePlan: 'advanced',
    classType: 'advanced-2-tier-cake-class',
    bookingType: 'year-1-2',
    schoolYear: 'Year 2',
    durationMinutes: 120,
    extensionMinutes: 0,
    subtotalCents: 15900,
    discountPercent: 0,
    discountCents: 0,
    totalPriceCents: 15900,
    totalPrice: 159,
  })
  assert.equal(rows.Class, 'Advanced 2-Tier Cake Class')
  assert.equal(rows.Plan, 'Advanced')
  assert.equal(rows['Booking type'], 'Year 2')
  assert.equal(rows['First duration'], '120 minutes')
  assert.equal(rows.Total, 'AUD 159.00')
})

test('Package notification includes both sessions, extensions and base-only discount audit', () => {
  const rows = rowMap({
    ...base,
    coursePlan: 'basic-advanced-package',
    durationMinutes: 120,
    extensionMinutes: 30,
    advancedClassDate: '2026-07-26',
    advancedClassTime: '13:00',
    advancedDurationMinutes: 150,
    advancedExtensionMinutes: 30,
    subtotalCents: 29800,
    discountPercent: 5,
    discountCents: 1290,
    totalPriceCents: 28510,
    totalPrice: 285.1,
  })
  assert.equal(rows.Plan, 'Basic + Advanced Package')
  assert.equal(rows['First session'], '2026-07-25 10:00')
  assert.equal(rows['First duration'], '120 minutes')
  assert.equal(rows['First extension'], '30 minutes')
  assert.equal(rows['Advanced session'], '2026-07-26 13:00')
  assert.equal(rows['Advanced duration'], '150 minutes')
  assert.equal(rows['Advanced extension'], '30 minutes')
  assert.equal(rows.Subtotal, 'AUD 298.00')
  assert.equal(rows.Discount, '5% (-AUD 12.90)')
  assert.equal(rows.Total, 'AUD 285.10')
})

test('legacy notification rows retain safe labels and duration/price fallbacks', () => {
  const rows = rowMap({ ...base, totalPrice: 99 })
  assert.equal(rows.Plan, 'Basic')
  assert.equal(rows.Class, 'Basic Cake Class')
  assert.equal(rows['First duration'], '120 minutes')
  assert.equal(rows['First extension'], 'None')
  assert.equal(rows.Subtotal, 'AUD 99.00')
  assert.equal(rows.Total, 'AUD 99.00')
})
