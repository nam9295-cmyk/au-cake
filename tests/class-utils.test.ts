import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  CLASS_SESSION_TIMES,
  buildClassConfirmationMessage,
  buildClassPaymentMessage,
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
  classTime: '10:00',
  bookingType: 'year-1-2',
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
  paymentStatus: 'Fully paid',
  totalPrice: 99,
  depositAmount: 0,
  adminMemo: 'Bring apron',
  createdAt: '2026-07-02T01:00:00.000Z',
  updatedAt: '2026-07-02T01:00:00.000Z',
}

test('class booking prices and session times match Jenny feedback', () => {
  assert.deepEqual([...CLASS_SESSION_TIMES], ['10:00', '13:00', '16:00'])
  assert.equal(getClassBookingPrice('year-1-2'), 99)
  assert.equal(getClassBookingPrice('1-child'), 109)
  assert.equal(getClassBookingPrice('2-friends'), 198)
  assert.equal(getClassDepositAmount(), 0)
})

test('class reservation number uses kids class AU prefix and date', () => {
  const number = generateClassReservationNumber(new Date('2026-07-02T01:15:00.000Z'))
  assert.match(number, /^VG-KC-AU-20260702-\d{9}$/)
})

test('payment and confirmation messages include session, child, parent, soft payment wording and safety details', () => {
  const payment = buildClassPaymentMessage(sampleReservation)
  assert.match(payment, /Jenny Parent/)
  assert.match(payment, /thank you for your booking for Mina and Leo/)
  assert.match(payment, /2026-07-10 10:00/)
  assert.match(payment, /The session is currently available\./)
  assert.match(payment, /Please use the payment details below:/)
  assert.match(payment, /Once your payment is confirmed, we will send you a final confirmation message!/)
  assert.match(payment, /BSB 012263 Account 324999682/)
  assert.match(payment, /Account name: JEONGMIN CHEON/)
  assert.match(payment, /Amount due: AUD 99\.00/)
  assert.match(payment, /favourite figure, doll, LEGO, or small toy/)
  assert.match(payment, /create their own special cake/)
  assert.match(payment, /1 Bundil Blvd, Melrose Park, Sydney/)
  assert.doesNotMatch(payment, /deposit/i)

  const confirmation = buildClassConfirmationMessage(sampleReservation)
  assert.match(confirmation, /Mina and Leo's cake class booking is confirmed/)
  assert.match(confirmation, /1 Bundil Blvd, Melrose Park, Sydney/)
  assert.match(confirmation, /Long hair should be tied back/)
  assert.match(confirmation, /allergies or dietary concerns/)
  assert.match(confirmation, /favourite figure, doll, LEGO, or small toy/)
  assert.match(confirmation, /Thank you:\)/)
})

test('class CSV exports parent child safety consent payment and admin fields', () => {
  const csv = classReservationsToCsv([sampleReservation])
  assert.match(csv, /Booking number,Created at,Class date,Class time,Booking type/)
  assert.match(csv, /Jenny Parent/)
  assert.match(csv, /Nut allergy check needed/)
  assert.match(csv, /Fully paid/)
  assert.match(csv, /Bring apron/)
})
