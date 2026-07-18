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
import { calendarLogin, listCalendarEvents, createCake, lookupCake } from '../functions/reservation-api/src/main.js'

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
  classType: 'school-holiday-private-cake-class',
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

test('class API stores both kids course types at the existing prices', () => {
  const cakeCourse = buildClassReservation(classInput, { now, reservationNumber: 'VG-KC-AU-CAKE' })
  const cupcakeCourse = buildClassReservation(
    { ...classInput, classType: 'cupcake-chocolate-class', bookingType: '1-child' },
    { now, reservationNumber: 'VG-KC-AU-CUPCAKE' },
  )

  assert.equal(cakeCourse.classType, 'school-holiday-private-cake-class')
  assert.equal(cakeCourse.totalPrice, 99)
  assert.equal(cupcakeCourse.classType, 'cupcake-chocolate-class')
  assert.equal(cupcakeCourse.totalPrice, 109)
  assertApiError('INVALID_CLASS_TYPE', () => buildClassReservation(
    { ...classInput, classType: 'unknown-class' },
    { now, reservationNumber: 'VG-KC-AU-INVALID' },
  ))
})

test('cake API prices cheesecake variants and cupcake per-piece finishes', () => {
  const chocoBasque = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', cakeSize: '22cm', poundAddon: 'extra-chocolate' },
    { now, reservationNumber: 'VG-C-AU-CHEESE-55' },
  )
  const paveBasque = buildCakeReservation(
    { ...cakeInput, productId: 'pave-choco-basque-cheesecake' },
    { now, reservationNumber: 'VG-C-AU-CHEESE-65' },
  )
  const eiffelBasque = buildCakeReservation(
    { ...cakeInput, productId: 'eiffel-tower-basque-cheesecake' },
    { now, reservationNumber: 'VG-C-AU-CHEESE-75' },
  )
  const cupcakes = buildCakeReservation(
    {
      ...cakeInput,
      productId: 'cupcake-dozen',
      poundAddon: 'extra-chocolate',
      chocolateType: 'milk',
      vanillaCreamCount: 4,
      partyDecorationCount: 3,
    },
    { now, reservationNumber: 'VG-C-AU-CUPCAKE' },
  )

  assert.equal(chocoBasque.totalPrice, 55)
  assert.equal(chocoBasque.cakeSize, '15cm')
  assert.equal(chocoBasque.poundAddon, 'none')
  assert.equal(paveBasque.totalPrice, 65)
  assert.equal(eiffelBasque.totalPrice, 75)
  assert.equal(eiffelBasque.totalPriceCents, 7500)
  assert.equal(cupcakes.poundAddon, 'none')
  assert.equal(cupcakes.chocolateType, 'dark')
  assert.equal(cupcakes.vanillaCreamCount, 4)
  assert.equal(cupcakes.partyDecorationCount, 3)
  assert.equal(cupcakes.totalPrice, 60)
  assert.equal(cupcakes.totalPriceCents, 6000)
})

test('cake API strictly validates cupcake finish counts', () => {
  for (const input of [
    { vanillaCreamCount: -1, partyDecorationCount: 0 },
    { vanillaCreamCount: 1.5, partyDecorationCount: 0 },
    { vanillaCreamCount: 13, partyDecorationCount: 0 },
    { vanillaCreamCount: 8, partyDecorationCount: 5 },
    { vanillaCreamCount: '4', partyDecorationCount: 0 },
  ]) {
    assertApiError('INVALID_CUPCAKE_FINISH_COUNT', () => buildCakeReservation(
      { ...cakeInput, productId: 'cupcake-dozen', ...input },
      { now, reservationNumber: 'VG-C-AU-CUPCAKE-INVALID' },
    ))
  }

  const legacy = buildCakeReservation(
    { ...cakeInput, productId: 'cupcake-dozen' },
    { now, reservationNumber: 'VG-C-AU-CUPCAKE-LEGACY' },
  )
  assert.equal(legacy.vanillaCreamCount, 0)
  assert.equal(legacy.partyDecorationCount, 0)
  assert.equal(legacy.totalPrice, 55)
})

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

test('cake API prices Fresh Lemon Cupcake packs, excludes promo, and enforces one pack per reservation', () => {
  const prices = {
    'fresh-lemon-cupcakes-6': 36,
    'fresh-lemon-cupcakes-8': 45,
    'fresh-lemon-cupcakes-12': 65,
    'fresh-lemon-cupcakes-16': 85,
  }

  for (const [productId, expectedPrice] of Object.entries(prices)) {
    const reservation = buildCakeReservation(
      { ...cakeInput, productId, quantity: 1, cakeSize: '22cm', poundAddon: 'extra-chocolate', promoCode: 'CHOCOLATE' },
      { now, reservationNumber: `VG-C-AU-${productId}` },
    )
    assert.equal(reservation.totalPrice, expectedPrice)
    assert.equal(reservation.totalPriceCents, expectedPrice * 100)
    assert.equal(reservation.quantity, 1)
    assert.equal(reservation.cakeSize, '15cm')
    assert.equal(reservation.poundAddon, 'none')
    assert.equal(reservation.requestNote.includes('[Promo'), false)
  }

  assertApiError('INVALID_QUANTITY', () => buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', quantity: 2 },
    { now, reservationNumber: 'VG-C-AU-LEMON-TWO-PACKS' },
  ))
})

test('cake API prices Lemon Cake chocolate icing per piece before promo', () => {
  const sixPack = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', quantity: 1, chocolateIcingCount: 3 },
    { now, reservationNumber: 'VG-C-AU-LEMON-6-3' },
  )
  const twelvePack = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-12', quantity: 1, chocolateIcingCount: 8 },
    { now, reservationNumber: 'VG-C-AU-LEMON-12-8' },
  )
  const promoted = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', quantity: 1, chocolateIcingCount: 3, promoCode: 'lemoni' },
    { now, reservationNumber: 'VG-C-AU-LEMON-6-3-PROMO' },
  )

  assert.equal(sixPack.chocolateIcingCount, 3)
  assert.equal(sixPack.totalPrice, 37.5)
  assert.equal(sixPack.totalPriceCents, 3750)
  assert.equal(twelvePack.chocolateIcingCount, 8)
  assert.equal(twelvePack.totalPrice, 69)
  assert.equal(promoted.totalPrice, 33.75)
  assert.equal(promoted.totalPriceCents, 3375)
})

test('cake API validates Lemon Cake chocolate icing count and clears it for other products', () => {
  for (const chocolateIcingCount of [-1, 1.5, 7]) {
    assertApiError('INVALID_ICING_COUNT', () => buildCakeReservation(
      { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', quantity: 1, chocolateIcingCount },
      { now, reservationNumber: `VG-C-AU-INVALID-ICING-${chocolateIcingCount}` },
    ))
  }

  const pave = buildCakeReservation(
    { ...cakeInput, productId: 'pave-cake', chocolateIcingCount: 4 },
    { now, reservationNumber: 'VG-C-AU-PAVE-NO-ICING-MIX' },
  )
  assert.equal(pave.chocolateIcingCount, 0)
  assert.equal(pave.totalPrice, 75)
})

test('cake API applies Chocolate promo only to cheesecake and records an audit note', () => {
  const chocoBasque = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', promoCode: ' ChOcOlAtE ' },
    { now, reservationNumber: 'VG-C-AU-PROMO-55' },
  )
  const paveBasque = buildCakeReservation(
    { ...cakeInput, productId: 'pave-choco-basque-cheesecake', promoCode: 'CHOCOLATE' },
    { now, reservationNumber: 'VG-C-AU-PROMO-65' },
  )
  const pound = buildCakeReservation(
    { ...cakeInput, productId: 'pound-cake', promoCode: 'chocolate' },
    { now, reservationNumber: 'VG-C-AU-PROMO-POUND' },
  )
  const retiredCode = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', promoCode: 'verygoodSYD' },
    { now, reservationNumber: 'VG-C-AU-OLD-PROMO' },
  )

  assert.equal(chocoBasque.totalPrice, 49.5)
  assert.equal(chocoBasque.totalPriceCents, 4950)
  assert.match(chocoBasque.requestNote, /^\[Promo chocolate\] 10% discount applied: 55\.00 -> 49\.50/)
  assert.equal(paveBasque.totalPrice, 58.5)
  assert.equal(pound.totalPrice, 45)
  assert.equal(pound.requestNote, 'Happy birthday')
  assert.equal(retiredCode.totalPrice, 55)
  assert.equal(retiredCode.requestNote, 'Happy birthday')
})

test('cake API applies Lemoni promo only to Fresh Lemon Cupcakes and records an audit note', () => {
  const lemon = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-8', quantity: 1, promoCode: ' LeMoNi ' },
    { now, reservationNumber: 'VG-C-AU-PROMO-LEMONI' },
  )
  const cheesecake = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', promoCode: 'lemoni' },
    { now, reservationNumber: 'VG-C-AU-LEMONI-CHEESE' },
  )

  assert.equal(lemon.totalPrice, 40.5)
  assert.equal(lemon.totalPriceCents, 4050)
  assert.match(lemon.requestNote, /^\[Promo lemoni\] 10% discount applied: 45\.00 -> 40\.50/)
  assert.equal(cheesecake.totalPrice, 55)
  assert.equal(cheesecake.requestNote, 'Happy birthday')
})

test('cake API expires Chocolate after 15 July and Lemoni after 16 July in Sydney', () => {
  const chocolateValid = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', pickupDate: '2026-07-17', promoCode: 'chocolate' },
    { now: new Date('2026-07-15T13:59:59.000Z'), reservationNumber: 'VG-C-AU-CHOCOLATE-VALID' },
  )
  const chocolateExpired = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', pickupDate: '2026-07-17', promoCode: 'chocolate' },
    { now: new Date('2026-07-15T14:00:00.000Z'), reservationNumber: 'VG-C-AU-CHOCOLATE-EXPIRED' },
  )
  const lemoniValid = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-8', quantity: 1, pickupDate: '2026-07-18', promoCode: 'lemoni' },
    { now: new Date('2026-07-16T13:59:59.000Z'), reservationNumber: 'VG-C-AU-LEMONI-VALID' },
  )
  const lemoniExpired = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-8', quantity: 1, pickupDate: '2026-07-18', promoCode: 'lemoni' },
    { now: new Date('2026-07-16T14:00:00.000Z'), reservationNumber: 'VG-C-AU-LEMONI-EXPIRED' },
  )

  assert.equal(chocolateValid.totalPrice, 49.5)
  assert.equal(chocolateExpired.totalPrice, 55)
  assert.equal(lemoniValid.totalPrice, 40.5)
  assert.equal(lemoniExpired.totalPrice, 45)
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

test('cake API applies the Sydney 20:00 next-day pickup cutoff', () => {
  const beforeEight = new Date('2026-07-10T09:59:59.000Z')
  const atEight = new Date('2026-07-10T10:00:00.000Z')

  assert.doesNotThrow(() => buildCakeReservation(
    { ...cakeInput, pickupDate: '2026-07-11', pickupTime: '10:00' },
    { now: beforeEight },
  ))
  assertApiError('PICKUP_TIME_TOO_SOON', () => buildCakeReservation(
    { ...cakeInput, pickupDate: '2026-07-11', pickupTime: '11:30' },
    { now: atEight },
  ))
  assert.doesNotThrow(() => buildCakeReservation(
    { ...cakeInput, pickupDate: '2026-07-11', pickupTime: '12:00' },
    { now: atEight },
  ))
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
  assert.equal(isCakePickupBlocked('2026-07-11', '15:00', slots), false)
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

test('calendar login rejects a wrong PIN and returns a signed token for the configured PIN', () => {
  const env = {
    CALENDAR_VIEW_PIN: '260717',
    CALENDAR_TOKEN_SECRET: 'a-calendar-test-secret-that-is-long-enough',
  }
  assertApiError('CALENDAR_UNAUTHORIZED', () => calendarLogin({ pin: '000000' }, env, now))
  const result = calendarLogin({ pin: '260717' }, env, now)
  assert.equal(typeof result.token, 'string')
  assert.ok(result.token.length > 40)
})

test('calendar API returns only sanitised events for the requested month', async () => {
  const env = {
    CALENDAR_VIEW_PIN: '260717',
    CALENDAR_TOKEN_SECRET: 'a-calendar-test-secret-that-is-long-enough',
  }
  const { token } = calendarLogin({ pin: '260717' }, env, now)
  const calls = []
  const databases = {
    async listDocuments(request) {
      calls.push(request)
      if (request.collectionId === 'reservations') {
        return { documents: [{
          $id: 'cake-1', pickupDate: '2026-07-25', pickupTime: '10:00', productId: 'pave-cake', quantity: 1,
          customerName: 'Private', customerPhone: '0412345678', status: '예약확정', adminMemo: 'Private',
        }] }
      }
      return { documents: [{
        $id: 'class-1', classDate: '2026-07-25', classTime: '11:00', parentName: 'Private', childName: 'Private',
        status: 'Requested', allergyNote: 'Private',
      }] }
    },
  }

  const result = await listCalendarEvents(databases, { token, month: '2026-07' }, env, now)
  assert.equal(calls.length, 2)
  assert.equal(result.month, '2026-07')
  assert.deepEqual(result.events.map((event) => [event.kind, event.date, event.time]), [
    ['cake', '2026-07-25', '10:00'],
    ['class', '2026-07-25', '11:00'],
  ])
  assert.equal(JSON.stringify(result).includes('Private'), false)
  assert.equal(JSON.stringify(result).includes('0412345678'), false)
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

  const futureCakeInput = {
    ...cakeInput,
    productId: 'fresh-lemon-cupcakes-6',
    chocolateIcingCount: 3,
    quantity: 1,
    pickupDate: '2099-07-11',
  }
  const first = await createCake(databases, { ...futureCakeInput, requestId })
  const retry = await createCake(databases, { ...futureCakeInput, requestId })
  assert.equal(creates, 1)
  assert.equal(first.chocolateIcingCount, 3)
  assert.equal(first.totalPriceCents, 3750)
  assert.equal(retry.id, first.id)
  assert.equal(retry.reservationNumber, first.reservationNumber)
})
