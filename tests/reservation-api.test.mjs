import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { AppwriteException } from 'node-appwrite'
import {
  ReservationApiError,
  buildCakeReservation,
  buildClassReservation,
  isCakePickupBlocked,
  matchesLookupPhone,
  publicCakeReservation,
} from '../functions/reservation-api/src/business.js'
import { createCake, lookupCake } from '../functions/reservation-api/src/main.js'

const now = new Date('2026-07-10T00:00:00.000Z')

const cakeInput = {
  customerName: 'Jenny Cake',
  customerPhone: '+61 412 345 678',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'milk',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2026-07-11',
  pickupTime: '10:00',
  cacaoPercent: '100',
  requestNote: 'Happy birthday',
  promoCode: '',
  privacyConsent: true,
}

const classInput = {
  classDate: '2026-07-11',
  classTime: '13:00',
  bookingType: 'year-1-2',
  parentName: 'Jenny Parent',
  parentPhone: '0412 345 678',
  parentEmail: 'Jenny@Example.com',
  childName: 'Mina',
  childAge: 8,
  schoolYear: 'Year 2',
  secondChildName: '',
  secondChildAge: null,
  secondChildSchoolYear: '',
  allergyNote: 'None',
  emergencyContact: 'John 0400 000 000',
  pickupPerson: 'Jenny Parent',
  parentConsent: true,
  cancellationAgreement: true,
  privacyConsent: true,
  photoConsent: false,
}

function assertApiError(code, callback) {
  assert.throws(callback, (error) => error instanceof ReservationApiError && error.code === code)
}

test('cake API derives protected fields and cents on the server', () => {
  const reservation = buildCakeReservation(
    {
      ...cakeInput,
      quantity: 2,
      totalPrice: 1,
      totalPriceCents: 1,
      status: '픽업완료',
      paymentStatus: '입금확인',
      adminMemo: 'forged',
    },
    { now, reservationNumber: 'VG-C-AU-TEST' },
  )

  assert.equal(reservation.reservationNumber, 'VG-C-AU-TEST')
  assert.equal(reservation.customerPhone, '0412345678')
  assert.equal(reservation.status, '예약신청')
  assert.equal(reservation.paymentStatus, '입금대기')
  assert.equal(reservation.adminMemo, '')
  assert.equal(reservation.totalPrice, 150)
  assert.equal(reservation.totalPriceCents, 15000)
  assert.equal(reservation.cacaoPercent, '기본')
})

test('cake API applies the AU promo price exactly and records an audit note', () => {
  const reservation = buildCakeReservation(
    { ...cakeInput, productId: 'pound-cake', poundAddon: 'extra-chocolate', quantity: 3, promoCode: ' VERYGOODsyd ' },
    { now, reservationNumber: 'VG-C-AU-PROMO' },
  )
  assert.equal(reservation.totalPrice, 140.4)
  assert.equal(reservation.totalPriceCents, 14040)
  assert.match(reservation.requestNote, /^\[Promo verygoodSYD\] 10% discount applied: 156\.00 -> 140\.40/)
})

test('cake API rejects invalid consent, quantity, mobile and pickup time', () => {
  assertApiError('CONSENT_REQUIRED', () => buildCakeReservation({ ...cakeInput, privacyConsent: false }, { now }))
  assertApiError('INVALID_QUANTITY', () => buildCakeReservation({ ...cakeInput, quantity: 6 }, { now }))
  assertApiError('INVALID_PHONE', () => buildCakeReservation({ ...cakeInput, customerPhone: '1234' }, { now }))
  assertApiError('INVALID_PRODUCT', () => buildCakeReservation({ ...cakeInput, productId: '__proto__' }, { now }))
  assertApiError('INVALID_REQUEST', () => buildCakeReservation({ ...cakeInput, website: 'spam.example' }, { now }))
  assertApiError('INVALID_PICKUP_TIME', () => buildCakeReservation({ ...cakeInput, pickupTime: '10:15' }, { now }))
  assertApiError('PICKUP_TIME_TOO_SOON', () => buildCakeReservation({ ...cakeInput, pickupDate: '2026-07-10' }, { now }))
})

test('class API derives price and protected fields and validates the second child', () => {
  const reservation = buildClassReservation(
    {
      ...classInput,
      bookingType: '2-friends',
      secondChildName: 'Leo',
      secondChildAge: 10,
      secondChildSchoolYear: 'Year 4',
      totalPrice: 1,
      status: 'Completed',
    },
    { now, reservationNumber: 'VG-KC-AU-TEST' },
  )
  assert.equal(reservation.totalPrice, 198)
  assert.equal(reservation.status, 'Requested')
  assert.equal(reservation.parentEmail, 'jenny@example.com')
  assert.equal(reservation.photoConsent, false)

  assertApiError('INVALID_SECOND_CHILD_NAME', () => buildClassReservation({ ...classInput, bookingType: '2-friends' }, { now }))
  assertApiError('CONSENT_REQUIRED', () => buildClassReservation({ ...classInput, privacyConsent: false }, { now }))
})

test('pickup blocking honours class session windows and explicit openings', () => {
  const slots = [{ classDate: '2026-07-11', classTime: '13:00' }]
  assert.equal(isCakePickupBlocked('2026-07-11', '14:30', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-11', '15:30', slots), false)
  assert.equal(
    isCakePickupBlocked('2026-07-11', '14:30', slots, [{ pickupDate: '2026-07-11', pickupTime: '14:30' }]),
    false,
  )
})

test('lookup accepts only a matching full AU mobile number', () => {
  assert.equal(matchesLookupPhone('+61 412 345 678', '0412 345 678'), true)
  assert.equal(matchesLookupPhone('0412 345 678', '+61 412 345 678'), true)
  assert.equal(matchesLookupPhone('0412 345 678', '5678'), false)
  assert.equal(matchesLookupPhone('0412 345 678', ''), false)
  assert.equal(matchesLookupPhone('0412 345 678', '8'), false)
  assert.equal(matchesLookupPhone('0412 345 678', '0000'), false)
})

test('lookup API rejects a last-four-only request before reading reservations', async () => {
  let listCalls = 0
  const databases = {
    async listDocuments() {
      listCalls += 1
      return { documents: [] }
    },
  }
  await assert.rejects(
    () => lookupCake(databases, { reservationNumber: 'VG-C-AU-123', phone: '5678' }),
    (error) => error instanceof ReservationApiError && error.code === 'INVALID_LOOKUP',
  )
  assert.equal(listCalls, 0)
})

test('public lookup response excludes customer PII, notes and prices', () => {
  const response = publicCakeReservation({
    ...buildCakeReservation(cakeInput, { now, reservationNumber: 'VG-C-AU-PUBLIC' }),
    customerName: 'Private Name',
    customerPhone: '0412345678',
    requestNote: 'Private message',
    adminMemo: 'Private memo',
  })
  assert.equal(response.reservationNumber, 'VG-C-AU-PUBLIC')
  assert.equal('customerName' in response, false)
  assert.equal('customerPhone' in response, false)
  assert.equal('requestNote' in response, false)
  assert.equal('adminMemo' in response, false)
  assert.equal('totalPrice' in response, false)
})

test('cake creation returns the original document when the same request ID is retried', async () => {
  const requestId = 'f65f7e08-20f7-4b4a-b12a-6b42c043b268'
  const documents = new Map()
  let creates = 0
  const databases = {
    async getDocument({ documentId }) {
      const document = documents.get(documentId)
      if (!document) throw new AppwriteException('Not found', 404, 'document_not_found')
      return document
    },
    async listDocuments() {
      return { documents: [] }
    },
    async createDocument({ documentId, data }) {
      creates += 1
      const document = { $id: documentId, ...data }
      documents.set(documentId, document)
      return document
    },
  }

  const first = await createCake(databases, { ...cakeInput, requestId })
  const retry = await createCake(databases, { ...cakeInput, requestId })
  assert.equal(creates, 1)
  assert.equal(retry.id, first.id)
  assert.equal(retry.reservationNumber, first.reservationNumber)
})
