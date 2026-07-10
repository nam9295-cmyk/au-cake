import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { classReservationsToCsv } from '../src/lib/class-utils.js'
import type { ClassReservation, Reservation } from '../src/lib/types.js'
import { reservationsToCsv } from '../src/lib/utils.js'

const cakeReservation: Reservation = {
  id: 'cake-1',
  reservationNumber: 'VG-C-AU-1',
  customerName: '=HYPERLINK("https://example.test")',
  customerPhone: '0412345678',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'dark',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2026-07-20',
  pickupTime: '10:00',
  cacaoPercent: '기본',
  requestNote: '\t+SUM(1,2)',
  status: '예약신청',
  paymentStatus: '입금대기',
  totalPrice: 75,
  totalPriceCents: 7500,
  adminMemo: '@IMPORTDATA("https://example.test")',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

const classReservation: ClassReservation = {
  id: 'class-1',
  reservationNumber: 'VG-KC-AU-1',
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-07-20',
  classTime: '10:00',
  bookingType: 'year-1-2',
  parentName: '-1+1',
  parentPhone: '0412345678',
  parentEmail: 'parent@example.com',
  childName: 'Mina',
  childAge: 8,
  schoolYear: 'Year 2',
  secondChildName: '',
  secondChildAge: null,
  secondChildSchoolYear: '',
  allergyNote: '=CMD()',
  emergencyContact: 'John 0400000000',
  pickupPerson: 'Jenny',
  parentConsent: true,
  cancellationAgreement: true,
  photoConsent: false,
  status: 'Requested',
  paymentStatus: 'Payment pending',
  totalPrice: 99,
  depositAmount: 0,
  adminMemo: '',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

test('cake CSV neutralises spreadsheet formulas including leading control characters', () => {
  const csv = reservationsToCsv([cakeReservation])
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/)
  assert.match(csv, /"'\t\+SUM\(1,2\)"/)
  assert.match(csv, /"'@IMPORTDATA\(""https:\/\/example\.test""\)"/)
})

test('class CSV neutralises spreadsheet formulas in customer-entered fields', () => {
  const csv = classReservationsToCsv([classReservation])
  assert.match(csv, /"'-1\+1"/)
  assert.match(csv, /"'=CMD\(\)"/)
})
