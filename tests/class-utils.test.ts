import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildClassConfirmationMessage,
  buildClassDepositMessage,
  classReservationsToCsv,
  generateClassReservationNumber,
  getClassBookingPrice,
  getClassDepositAmount,
} from '../src/lib/class-utils.js'
import type { ClassReservation } from '../src/lib/types.js'

const sampleReservation: ClassReservation = {
  id: 'local-1',
  reservationNumber: 'VG-KC-AU-20260702-101500123',
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-07-10',
  classTime: '10:00-11:30',
  bookingType: '2-friends',
  parentName: 'Jenny Parent',
  parentPhone: '0412 345 678',
  parentEmail: 'jenny@example.com',
  childName: 'Mina',
  childAge: 9,
  schoolYear: 'Year 4',
  secondChildName: 'Leo',
  secondChildAge: 10,
  secondChildSchoolYear: 'Year 5',
  allergyNote: 'Nut allergy check needed',
  emergencyContact: 'John 0400 000 000',
  pickupPerson: 'Jenny Parent',
  parentConsent: true,
  cancellationAgreement: true,
  photoConsent: false,
  status: 'Requested',
  paymentStatus: 'Pending deposit',
  totalPrice: 198,
  depositAmount: 50,
  adminMemo: 'Bring apron',
  createdAt: '2026-07-02T01:00:00.000Z',
  updatedAt: '2026-07-02T01:00:00.000Z',
}

test('class booking prices match AU launch pricing', () => {
  assert.equal(getClassBookingPrice('1-child'), 109)
  assert.equal(getClassBookingPrice('2-friends'), 198)
  assert.equal(getClassDepositAmount(), 50)
})

test('class reservation number uses kids class AU prefix and date', () => {
  const number = generateClassReservationNumber(new Date('2026-07-02T01:15:00.000Z'))
  assert.match(number, /^VG-KC-AU-20260702-\d{9}$/)
})

test('deposit and confirmation messages include session, child, parent, deposit and safety details', () => {
  const deposit = buildClassDepositMessage(sampleReservation)
  assert.match(deposit, /Jenny Parent/)
  assert.match(deposit, /Mina/)
  assert.match(deposit, /2026-07-10 10:00-11:30/)
  assert.match(deposit, /AUD 50\.00 deposit/)

  const confirmation = buildClassConfirmationMessage(sampleReservation)
  assert.match(confirmation, /booking is confirmed/)
  assert.match(confirmation, /Melrose Park, Sydney/)
  assert.match(confirmation, /Long hair should be tied back/)
  assert.match(confirmation, /allergies or dietary concerns/)
})

test('class CSV exports parent child safety consent payment and admin fields', () => {
  const csv = classReservationsToCsv([sampleReservation])
  assert.match(csv, /Booking number,Created at,Class date,Class time,Booking type/)
  assert.match(csv, /Jenny Parent/)
  assert.match(csv, /Nut allergy check needed/)
  assert.match(csv, /Pending deposit/)
  assert.match(csv, /Bring apron/)
})
