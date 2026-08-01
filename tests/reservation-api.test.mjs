import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { AppwriteException } from 'node-appwrite'
import {
  ReservationApiError,
  buildCakeReservation,
  buildClassReservation,
  isCakePickupBlocked,
  isSchoolPickupWindowClosed,
  matchesLookupPhone,
  parseStoredOrderLines,
  publicCakeReservation,
  serializeStoredOrderLines,
} from '../appwrite-functions/reservation-api/src/business.js'
import { calendarLogin, listCalendarEvents, createCake, createClass, lookupCake } from '../appwrite-functions/reservation-api/src/main.js'

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

function assertApiError(code, callback, status) {
  assert.throws(callback, (error) => error instanceof ReservationApiError
    && error.code === code
    && (status === undefined || error.status === status))
}

function multiCakeInput(orderLines, overrides = {}) {
  const {
    productId: _productId,
    cakeSize: _cakeSize,
    chocolateType: _chocolateType,
    poundAddon: _poundAddon,
    chocolateIcingCount: _chocolateIcingCount,
    vanillaCreamCount: _vanillaCreamCount,
    partyDecorationCount: _partyDecorationCount,
    vanillaCakeSheet: _vanillaCakeSheet,
    vanillaCakeFlavor: _vanillaCakeFlavor,
    quantity: _quantity,
    cacaoPercent: _cacaoPercent,
    ...common
  } = cakeInput
  return { ...common, orderLines, ...overrides }
}

test('class API stores both kids course types at the existing prices', () => {
  const cakeCourse = buildClassReservation(classInput, { now, reservationNumber: 'VG-KC-AU-CAKE' })
  const cupcakeCourse = buildClassReservation(
    { ...classInput, classType: 'cupcake-chocolate-class', bookingType: '1-child', schoolYear: 'Year 3' },
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

test('class API authoritatively prices basic, advanced and package extensions in cents', () => {
  const basic = buildClassReservation({ ...classInput, coursePlan: 'basic', extensionMinutes: 30 }, { now, reservationNumber: 'BASIC' })
  assert.equal(basic.durationMinutes, 120)
  assert.equal(basic.totalPriceCents, 11900)
  assert.equal(basic.totalPrice, 119)

  const advanced = buildClassReservation({
    ...classInput, coursePlan: 'advanced', classType: 'advanced-2-tier-cake-class', bookingType: '1-child',
    schoolYear: 'Year 4', extensionMinutes: 30, totalPriceCents: 1,
  }, { now, reservationNumber: 'ADVANCED' })
  assert.equal(advanced.durationMinutes, 150)
  assert.equal(advanced.totalPriceCents, 17900)

  const packageBooking = buildClassReservation({
    ...classInput, coursePlan: 'basic-advanced-package', advancedClassDate: '2026-07-12', advancedClassTime: '16:00',
    extensionMinutes: 30, advancedExtensionMinutes: 30, totalPriceCents: 1,
  }, { now, reservationNumber: 'PACKAGE' })
  assert.equal(packageBooking.durationMinutes, 120)
  assert.equal(packageBooking.advancedDurationMinutes, 150)
  assert.equal(packageBooking.subtotalCents, 29800)
  assert.equal(packageBooking.discountPercent, 5)
  assert.equal(packageBooking.discountCents, 1290)
  assert.equal(packageBooking.totalPriceCents, 28510)
  assert.equal(packageBooking.totalPrice, 285)
})

test('class API allows Basic from Kindy but keeps Advanced and packages at Year 2–6', () => {
  const kindyBasic = buildClassReservation({ ...classInput, schoolYear: 'Kindy' }, { now, reservationNumber: 'BASIC-KINDY' })
  const yearOneBasic = buildClassReservation({ ...classInput, schoolYear: 'Year 1' }, { now, reservationNumber: 'BASIC-YEAR-1' })
  assert.equal(kindyBasic.totalPriceCents, 9900)
  assert.equal(yearOneBasic.totalPriceCents, 9900)
  assertApiError('INVALID_SCHOOL_YEAR', () => buildClassReservation({
    ...classInput, coursePlan: 'advanced', classType: 'advanced-2-tier-cake-class', schoolYear: 'Kindy',
  }, { now }))
  assertApiError('INVALID_SCHOOL_YEAR', () => buildClassReservation({
    ...classInput, coursePlan: 'basic-advanced-package', schoolYear: 'Year 1',
    advancedClassDate: '2026-07-12', advancedClassTime: '16:00',
  }, { now }))
})

test('class API rejects weekdays, invalid extensions and multi-child advanced/package requests', () => {
  assertApiError('INVALID_CLASS_DATE', () => buildClassReservation({ ...classInput, classDate: '2026-07-13' }, { now }))
  assertApiError('INVALID_EXTENSION', () => buildClassReservation({ ...classInput, extensionMinutes: 15 }, { now }))
  assertApiError('INVALID_PARTY_SIZE', () => buildClassReservation({
    ...classInput, coursePlan: 'advanced', classType: 'advanced-2-tier-cake-class', bookingType: '2-friends',
    secondChildName: 'Leo', secondChildAge: 10, secondChildSchoolYear: 'Year 4',
  }, { now }))
  assertApiError('INVALID_PACKAGE_SESSION', () => buildClassReservation({
    ...classInput, coursePlan: 'basic-advanced-package', advancedClassDate: classInput.classDate, advancedClassTime: classInput.classTime,
  }, { now }))
})

test('package class creation reserves both slots in the same transaction with actual durations', async () => {
  const creates = []
  const documents = new Map()
  const databases = {
    async getDocument({ documentId }) {
      const document = documents.get(documentId)
      if (!document) throw new AppwriteException('Not found', 404, 'document_not_found')
      return document
    },
    async listDocuments() { return { documents: [] } },
    async createTransaction() { return { $id: 'tx-package' } },
    async createDocument(request) {
      creates.push(request)
      const document = { $id: request.documentId, ...request.data }
      if (request.collectionId === 'class_reservations') documents.set(request.documentId, document)
      return document
    },
    async updateTransaction() {},
  }
  await createClass(databases, {
    ...classInput, requestId: 'f65f7e08-20f7-4b4a-b12a-6b42c043b268', coursePlan: 'basic-advanced-package',
    advancedClassDate: '2026-07-12', advancedClassTime: '16:00', extensionMinutes: 30, advancedExtensionMinutes: 30,
  }, { now })
  const slotCreates = creates.filter((request) => request.collectionId === 'class_booked_dates')
  assert.equal(slotCreates.length, 2)
  assert.deepEqual(slotCreates.map((request) => request.data), [
    { classDate: '2026-07-11', classTime: '13:00', durationMinutes: 120, createdAt: now.toISOString() },
    { classDate: '2026-07-12', classTime: '16:00', durationMinutes: 150, createdAt: now.toISOString() },
  ])
  assert.ok(creates.every((request) => request.transactionId === 'tx-package'))
})

test('cake API preserves Pave CakeSize IDs and approved prices', () => {
  for (const [cakeSize, expectedPrice] of [['15cm', 75], ['19cm', 95], ['22cm', 115]]) {
    const reservation = buildCakeReservation(
      { ...cakeInput, cakeSize },
      { now, reservationNumber: `VG-C-AU-PAVE-${cakeSize}` },
    )
    assert.equal(reservation.cakeSize, cakeSize)
    assert.equal(reservation.totalPrice, expectedPrice)
    assert.equal(reservation.totalPriceCents, expectedPrice * 100)
  }
})

test('cake API persists only the approved Vanilla Fresh Cream Cake sheet and flavour choices at the size price', () => {
  for (const [cakeSize, expectedPrice] of [['15cm', 75], ['19cm', 98], ['22cm', 139]]) {
    const reservation = buildCakeReservation(
      {
        ...cakeInput,
        productId: 'vanilla-fresh-cream-cake',
        cakeSize,
        cacaoPercent: '100',
        chocolateType: 'milk',
        poundAddon: 'vanilla-cream',
        vanillaCakeSheet: 'chocolate',
        vanillaCakeFlavor: 'nutella-chocolate-chip',
        quantity: 2,
        totalPrice: 1,
        totalPriceCents: 1,
      },
      { now, reservationNumber: `VG-C-AU-VANILLA-${cakeSize}` },
    )

    assert.equal(reservation.productId, 'vanilla-fresh-cream-cake')
    assert.equal(reservation.cakeSize, cakeSize)
    assert.equal(reservation.totalPrice, expectedPrice * 2)
    assert.equal(reservation.totalPriceCents, expectedPrice * 200)
    assert.equal(reservation.cacaoPercent, '기본')
    assert.equal(reservation.chocolateType, 'dark')
    assert.equal(reservation.poundAddon, 'none')
    assert.equal(reservation.vanillaCakeSheet, 'chocolate')
    assert.equal(reservation.vanillaCakeFlavor, 'nutella-chocolate-chip')
  }

  const legacy = buildCakeReservation(
    { ...cakeInput, productId: 'vanilla-fresh-cream-cake' },
    { now, reservationNumber: 'VG-C-AU-VANILLA-LEGACY' },
  )
  assert.equal(legacy.vanillaCakeSheet, 'vanilla')
  assert.equal(legacy.vanillaCakeFlavor, 'triple-berry')
  for (const invalid of [
    { vanillaCakeSheet: 'red-velvet' },
    { vanillaCakeFlavor: 'strawberry' },
    { vanillaCakeSheet: 1 },
    { vanillaCakeFlavor: 1 },
  ]) {
    assertApiError('INVALID_VANILLA_CAKE_OPTION', () => buildCakeReservation(
      { ...cakeInput, productId: 'vanilla-fresh-cream-cake', ...invalid },
      { now, reservationNumber: 'VG-C-AU-VANILLA-INVALID' },
    ))
  }
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
    { now, reservationNumber: 'VG-C-AU-CHEESE-70' },
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
  assert.equal(eiffelBasque.totalPrice, 70)
  assert.equal(eiffelBasque.totalPriceCents, 7000)
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

test('cake API prices Fresh Lemon Cupcake packs, excludes promo, and supports multiple identical packs', () => {
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

  const twoPacks = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', quantity: 2, chocolateIcingCount: 3 },
    { now, reservationNumber: 'VG-C-AU-LEMON-TWO-PACKS' },
  )
  assert.equal(twoPacks.quantity, 2)
  assert.equal(twoPacks.chocolateIcingCount, 3)
  assert.equal(twoPacks.totalPrice, 75)
  assert.equal(twoPacks.totalPriceCents, 7500)
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

test('cake API rejects the inclusive weekday school-run pickup windows', () => {
  for (const date of ['2026-08-03', '2026-08-05', '2026-08-07']) {
    assert.equal(isSchoolPickupWindowClosed(date, '15:00'), true)
    assert.equal(isSchoolPickupWindowClosed(date, '15:30'), true)
    assertApiError('PICKUP_TIME_UNAVAILABLE', () => buildCakeReservation(
      { ...cakeInput, pickupDate: date, pickupTime: '15:00' },
      { now, reservationNumber: 'SCHOOL-RUN-SHORT' },
    ))
    assert.doesNotThrow(() => buildCakeReservation(
      { ...cakeInput, pickupDate: date, pickupTime: '16:00' },
      { now, reservationNumber: 'AFTER-SCHOOL-RUN-SHORT' },
    ))
  }

  for (const date of ['2026-08-04', '2026-08-06']) {
    for (const pickupTime of ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30']) {
      assert.equal(isSchoolPickupWindowClosed(date, pickupTime), true)
      assertApiError('PICKUP_TIME_UNAVAILABLE', () => buildCakeReservation(
        { ...cakeInput, pickupDate: date, pickupTime },
        { now, reservationNumber: 'SCHOOL-RUN-LONG' },
      ))
    }
    assert.doesNotThrow(() => buildCakeReservation(
      { ...cakeInput, pickupDate: date, pickupTime: '18:00' },
      { now, reservationNumber: 'AFTER-SCHOOL-RUN-LONG' },
    ))
  }

  assert.equal(isSchoolPickupWindowClosed('2026-08-08', '15:00'), false)
  assert.doesNotThrow(() => buildCakeReservation(
    { ...cakeInput, pickupDate: '2026-08-08', pickupTime: '15:00' },
    { now, reservationNumber: 'WEEKEND-PICKUP' },
  ))
  assert.equal(isSchoolPickupWindowClosed('2026-08-04', '15:99'), false)
  assert.equal(isSchoolPickupWindowClosed('not-a-date', '15:00'), false)
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

  assertApiError('INVALID_SECOND_CHILD_NAME', () => buildClassReservation({
    ...classInput,
    bookingType: '2-friends',
    secondChildSchoolYear: 'Year 4',
  }, { now }))
  assertApiError('CONSENT_REQUIRED', () => buildClassReservation({ ...classInput, privacyConsent: false }, { now }))
})

test('pickup blocking honours class session windows and explicit openings', () => {
  const slots = [{ classDate: '2026-07-11', classTime: '13:00' }]
  assert.equal(isCakePickupBlocked('2026-07-11', '14:30', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-11', '15:00', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-11', '15:30', slots), false)
  assert.equal(
    isCakePickupBlocked('2026-07-11', '14:30', slots, [{ pickupDate: '2026-07-11', pickupTime: '14:30' }]),
    false,
  )
})

test('server pickup blocking uses slot duration with 120-minute legacy fallback', () => {
  assert.equal(isCakePickupBlocked('2026-07-11', '11:30', [{ classDate: '2026-07-11', classTime: '10:00', durationMinutes: 90 }]), true)
  assert.equal(isCakePickupBlocked('2026-07-11', '12:00', [{ classDate: '2026-07-11', classTime: '10:00', durationMinutes: 90 }]), false)
  assert.equal(isCakePickupBlocked('2026-07-11', '12:30', [{ classDate: '2026-07-11', classTime: '10:00', durationMinutes: 150 }]), true)
  assert.equal(isCakePickupBlocked('2026-07-11', '12:00', [{ classDate: '2026-07-11', classTime: '10:00' }]), true)
})

test('pickup blocking honours a real 11:00 class outside the standard session list', () => {
  const slots = [{ classDate: '2026-07-25', classTime: '11:00' }]
  assert.equal(isCakePickupBlocked('2026-07-25', '10:30', slots), false)
  assert.equal(isCakePickupBlocked('2026-07-25', '11:00', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-25', '12:30', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-25', '13:00', slots), true)
  assert.equal(isCakePickupBlocked('2026-07-25', '13:30', slots), false)
})

test('pickup blocking ignores malformed non-standard class times', () => {
  const malformedSlots = [
    { classDate: '2026-07-25', classTime: '09:99' },
    { classDate: '2026-07-25', classTime: '25:00' },
    { classDate: '2026-07-25', classTime: ' ' },
    { classDate: '2026-07-25', classTime: 123 },
    { classDate: '2026-07-25', classTime: 0 },
    { classDate: '2026-07-25', classTime: false },
  ]
  assert.equal(isCakePickupBlocked('2026-07-25', '11:00', malformedSlots), false)
})

test('canonical full-day blocking still permits only an exact cake opening', () => {
  const slots = ['10:00', '13:00', '16:00'].map((classTime) => ({ classDate: '2026-07-25', classTime }))
  assert.equal(isCakePickupBlocked('2026-07-25', '19:00', slots), true)
  assert.equal(
    isCakePickupBlocked('2026-07-25', '19:00', slots, [{ pickupDate: '2026-07-25', pickupTime: '19:00' }]),
    false,
  )
  assert.equal(
    isCakePickupBlocked('2026-07-25', '19:30', slots, [{ pickupDate: '2026-07-25', pickupTime: '19:00' }]),
    true,
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

test('public lookup response excludes customer PII, notes and raw dollar totals', () => {
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
  assert.equal(response.totalPriceCents, 7500)
})

test('cake API preserves legacy one-line pricing and promo note while storing a versioned line', () => {
  const reservation = buildCakeReservation(
    { ...cakeInput, productId: 'choco-basque-cheesecake', promoCode: ' ChOcOlAtE ' },
    { now, reservationNumber: 'VG-C-AU-LEGACY-LINE' },
  )
  const stored = parseStoredOrderLines(reservation)

  assert.equal(reservation.productId, 'choco-basque-cheesecake')
  assert.equal(reservation.quantity, 1)
  assert.equal(reservation.subtotalCents, 5500)
  assert.equal(reservation.discountCents, 550)
  assert.equal(reservation.totalPriceCents, 4950)
  assert.equal(reservation.totalPrice, 49.5)
  assert.equal(reservation.requestNote, '[Promo chocolate] 10% discount applied: 55.00 -> 49.50\nHappy birthday')
  assert.equal(reservation.orderLineCount, 1)
  assert.equal(reservation.orderItemCount, 1)
  assert.equal(reservation.discountBasisCents, 5500)
  assert.equal(stored.version, 1)
  assert.equal(stored.lines.length, 1)
  assert.equal(stored.lines[0].unitPriceCents, 5500)
  assert.doesNotThrow(() => parseStoredOrderLines({
    ...reservation,
    totalPrice: Math.round(reservation.totalPrice),
  }))
})

test('cake API normalizes, authoritatively prices and aggregates two distinct server lines', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', cakeSize: '19cm', chocolateType: 'milk', quantity: 2 },
    { productId: 'pound-cake', poundAddon: 'extra-chocolate', chocolateType: 'milk', quantity: 1 },
  ]), { now, reservationNumber: 'VG-C-AU-MULTI-2' })
  const { lines } = parseStoredOrderLines(reservation)

  assert.deepEqual(
    [reservation.productId, reservation.cakeSize, reservation.chocolateType, reservation.quantity],
    ['pave-cake', '19cm', 'milk', 2],
  )
  assert.deepEqual(
    [reservation.subtotalCents, reservation.discountBasisCents, reservation.discountPercent, reservation.discountCents, reservation.totalPriceCents, reservation.totalPrice],
    [24200, 0, 0, 0, 24200, 242],
  )
  assert.deepEqual([reservation.orderLineCount, reservation.orderItemCount], [2, 3])
  assert.deepEqual(lines.map((line) => [line.productId, line.unitPriceCents, line.subtotalCents, line.totalPriceCents]), [
    ['pave-cake', 9500, 19000, 19000],
    ['pound-cake', 5200, 5200, 5200],
  ])
})

test('multi-line cake API rejects client line metadata, forged prices and top-level legacy line fields', () => {
  for (const forged of [
    { lineKey: 'client-key' },
    { unitPriceCents: 1 },
    { subtotalCents: 1 },
    { totalPriceCents: 1 },
    { promoCode: 'lemoni' },
    { customerName: 'Private' },
    { requestNote: 'Private' },
    { pickupDate: '2099-01-01' },
    { unknown: true },
  ]) {
    assertApiError('INVALID_ORDER_LINE', () => buildCakeReservation(multiCakeInput([
      { productId: 'pave-cake', quantity: 1, ...forged },
    ]), { now }))
  }
  for (const legacyField of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'quantity', 'cacaoPercent']) {
    assertApiError('INVALID_ORDER_LINE', () => buildCakeReservation({
      ...multiCakeInput([{ productId: 'pave-cake', quantity: 1 }]),
      [legacyField]: legacyField === 'quantity' ? 1 : 'forged',
    }, { now }))
  }
  for (const orderLines of [null, {}, [], 'lines']) {
    assertApiError('INVALID_ORDER_LINE', () => buildCakeReservation({ ...multiCakeInput([]), orderLines }, { now }))
  }
})

test('multi-line cake API merges normalized hidden-option duplicates in first-seen position', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    {
      productId: 'choco-basque-cheesecake', cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'extra-chocolate',
      chocolateIcingCount: 4, vanillaCreamCount: 4, partyDecorationCount: 4,
      vanillaCakeSheet: 'chocolate', vanillaCakeFlavor: 'nutella-chocolate-chip', quantity: 2,
    },
    { productId: 'pave-cake', cakeSize: '15cm', quantity: 1 },
    { productId: 'choco-basque-cheesecake', quantity: 3 },
  ]), { now, reservationNumber: 'VG-C-AU-MERGED' })
  const { lines } = parseStoredOrderLines(reservation)

  assert.deepEqual(lines.map((line) => [line.productId, line.quantity]), [
    ['choco-basque-cheesecake', 5],
    ['pave-cake', 1],
  ])
  assert.deepEqual(
    [lines[0].cakeSize, lines[0].chocolateType, lines[0].poundAddon, lines[0].chocolateIcingCount,
      lines[0].vanillaCreamCount, lines[0].partyDecorationCount, lines[0].vanillaCakeSheet, lines[0].vanillaCakeFlavor],
    ['15cm', 'dark', 'none', 0, 0, 0, 'vanilla', 'triple-berry'],
  )
  assert.deepEqual([reservation.orderLineCount, reservation.orderItemCount], [2, 6])
})

test('multi-line cake API rejects merged quantity overflow, non-integer quantities and unknown products', () => {
  assertApiError('INVALID_QUANTITY', () => buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', cakeSize: '15cm', quantity: 3 },
    { productId: 'pave-cake', cakeSize: '15cm', quantity: 3 },
  ]), { now }))
  for (const quantity of ['1', 0, 1.5, 6]) {
    assertApiError('INVALID_QUANTITY', () => buildCakeReservation(multiCakeInput([
      { productId: 'pave-cake', quantity },
    ]), { now }))
  }
  for (const productId of ['retired4', '__proto__']) {
    assertApiError('INVALID_PRODUCT', () => buildCakeReservation(multiCakeInput([
      { productId, quantity: 1 },
    ]), { now }))
  }
})

test('static promo discounts only eligible lines from one aggregate basis and writes one bounded audit line', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, quantity: 1 },
    { productId: 'pave-cake', cakeSize: '15cm', quantity: 1 },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 1 },
  ], { promoCode: ' LeMoNi ' }), { now, reservationNumber: 'VG-C-AU-MIXED-PROMO' })
  const { lines } = parseStoredOrderLines(reservation)

  assert.deepEqual(
    [reservation.subtotalCents, reservation.discountBasisCents, reservation.discountPercent, reservation.discountCents, reservation.totalPriceCents],
    [15650, 8150, 10, 815, 14835],
  )
  assert.deepEqual(lines.map((line) => [line.productId, line.discountPercent, line.discountCents]), [
    ['fresh-lemon-cupcakes-6', 10, 365],
    ['pave-cake', 0, 0],
    ['fresh-lemon-cupcakes-8', 10, 450],
  ])
  assert.equal(reservation.requestNote, '[Promo lemoni] 10% discount applied: 81.50 -> 73.35\nHappy birthday')
  assert.equal(reservation.requestNote.match(/\[Promo/g)?.length, 1)
})

test('aggregate discount allocation breaks equal fractional ties by canonical key, not request order', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'fresh-lemon-cupcakes-8', chocolateIcingCount: 1, quantity: 1 },
    { productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, quantity: 1 },
  ], { promoCode: '' }), {
    now,
    reservationNumber: 'VG-C-AU-TIE',
    reviewCoupon: { id: 'coupon-tie', rewardPercent: 5, codeLast4: 'Q2MK' },
  })
  const { lines } = parseStoredOrderLines(reservation)

  assert.deepEqual(lines.map((line) => [line.productId, line.discountCents]), [
    ['fresh-lemon-cupcakes-8', 227],
    ['fresh-lemon-cupcakes-6', 183],
  ])
  assert.equal(reservation.discountBasisCents, 8200)
  assert.equal(reservation.discountCents, 410)
})

test('review and manual coupon percentages apply once across every normalized line', () => {
  for (const [rewardPercent, expectedDiscount, expectedTotal] of [[5, 558, 10592], [10, 1115, 10035]]) {
    const reservation = buildCakeReservation(multiCakeInput([
      { productId: 'pave-cake', quantity: 1 },
      { productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, quantity: 1 },
    ], { promoCode: '' }), {
      now,
      reservationNumber: `VG-C-AU-REVIEW-${rewardPercent}`,
      reviewCoupon: { id: `coupon-${rewardPercent}`, rewardPercent, codeLast4: 'Q2MK' },
    })
    const { lines } = parseStoredOrderLines(reservation)
    assert.equal(reservation.discountBasisCents, 11150)
    assert.equal(reservation.discountPercent, rewardPercent)
    assert.equal(reservation.discountCents, expectedDiscount)
    assert.equal(reservation.totalPriceCents, expectedTotal)
    assert.deepEqual(lines.map((line) => line.discountPercent), [rewardPercent, rewardPercent])
    assert.equal(reservation.requestNote, 'Happy birthday')
  }
})

test('stored order line JSON contains only canonical order and authoritative price fields', () => {
  const rawPromo = ' LeMoNi '
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, quantity: 1 },
  ], { promoCode: rawPromo }), { now, reservationNumber: 'VG-C-AU-SAFE-JSON' })
  const payload = JSON.parse(reservation.orderLinesJson)
  const allowed = [
    'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount',
    'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity', 'unitPriceCents',
    'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
  ].sort()

  assert.deepEqual(Object.keys(payload).sort(), ['lines', 'version'])
  assert.deepEqual(Object.keys(payload.lines[0]).sort(), allowed)
  assert.equal(reservation.orderLinesJson.includes('Jenny Cake'), false)
  assert.equal(reservation.orderLinesJson.includes('0412345678'), false)
  assert.equal(reservation.orderLinesJson.includes('Happy birthday'), false)
  assert.equal(reservation.orderLinesJson.includes(rawPromo.trim()), false)
  assert.equal(reservation.orderLinesJson.includes('lineKey'), false)
})

test('stored order line parser fails closed on malformed, unsupported, empty, extra-key and inconsistent documents', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', quantity: 1 },
    { productId: 'pound-cake', quantity: 1 },
  ]), { now, reservationNumber: 'VG-C-AU-PARSE' })
  const parsed = JSON.parse(reservation.orderLinesJson)
  const withPayload = (payload, overrides = {}) => ({ ...reservation, ...overrides, orderLinesJson: JSON.stringify(payload) })
  const extraKey = JSON.parse(JSON.stringify(parsed))
  extraKey.lines[0].customerName = 'Private'
  const badPrice = JSON.parse(JSON.stringify(parsed))
  badPrice.lines[0].totalPriceCents -= 1

  assert.equal(parseStoredOrderLines({ reservationNumber: 'legacy' }), null)
  for (const document of [
    { ...reservation, orderLinesJson: '{' },
    withPayload({ version: 2, lines: parsed.lines }),
    withPayload({ version: 1, lines: [] }),
    withPayload(extraKey),
    withPayload(badPrice),
    { ...reservation, totalPriceCents: reservation.totalPriceCents + 1 },
    { ...reservation, orderLineCount: 99 },
    { ...reservation, orderItemCount: 99 },
    { ...reservation, productId: 'pound-cake' },
  ]) {
    assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines(document), 500)
  }
  assertApiError('INVALID_STORED_ORDER', () => publicCakeReservation({ ...reservation, orderLinesJson: '{' }), 500)
})

test('stored order parser requires aggregate and first-line projections for versioned documents', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', cakeSize: '19cm', chocolateType: 'milk', quantity: 2 },
    { productId: 'pound-cake', poundAddon: 'extra-chocolate', quantity: 1 },
  ]), { now, reservationNumber: 'VG-C-AU-REQUIRED-PROJECTIONS' })
  const requiredKeys = [
    'subtotalCents', 'discountBasisCents', 'discountPercent', 'discountCents', 'totalPriceCents', 'totalPrice',
    'orderLineCount', 'orderItemCount', 'productId', 'cakeSize', 'chocolateType', 'poundAddon',
    'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity',
  ]
  for (const key of requiredKeys) {
    const incomplete = { ...reservation }
    delete incomplete[key]
    assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines(incomplete), 500)
  }
})

test('stored order parser rejects missing, partial, or ineligible discount provenance', () => {
  const review = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', quantity: 1 },
    { productId: 'pound-cake', quantity: 1 },
  ], { promoCode: '' }), {
    now,
    reservationNumber: 'VG-C-AU-REVIEW-PROVENANCE',
    reviewCoupon: { id: 'review-proof', rewardPercent: 10, codeLast4: 'Q2MK' },
  })
  const missingProvenance = { ...review }
  delete missingProvenance.reviewCouponId
  delete missingProvenance.appliedPromoCodeLast4
  assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines(missingProvenance), 500)

  const validManual = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', quantity: 1 },
    { productId: 'pound-cake', quantity: 1 },
  ], { promoCode: '' }), {
    now,
    reservationNumber: 'VG-C-AU-MANUAL-PROVENANCE',
    reviewCoupon: { id: 'manual:coupon-proof', rewardPercent: 5, codeLast4: 'Q2MK' },
  })
  assert.doesNotThrow(() => parseStoredOrderLines(validManual))
  for (const reviewCouponId of ['manual:', 'manual:bad space', 'manual:_bad']) {
    assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines({ ...validManual, reviewCouponId }), 500)
  }
  assertApiError(
    'INVALID_STORED_ORDER',
    () => parseStoredOrderLines({ ...review, reviewCouponId: 'manual:coupon-proof' }),
    500,
  )

  const partialPayload = JSON.parse(review.orderLinesJson)
  partialPayload.lines[1].discountPercent = 0
  partialPayload.lines[1].discountCents = 0
  partialPayload.lines[1].totalPriceCents = partialPayload.lines[1].subtotalCents
  const partialReview = {
    ...review,
    orderLinesJson: JSON.stringify(partialPayload),
    discountBasisCents: partialPayload.lines[0].subtotalCents,
    discountCents: partialPayload.lines[0].discountCents,
    totalPriceCents: partialPayload.lines.reduce((sum, line) => sum + line.totalPriceCents, 0),
  }
  partialReview.totalPrice = partialReview.totalPriceCents / 100
  assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines(partialReview), 500)

  const staticOrder = buildCakeReservation(multiCakeInput([
    { productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, quantity: 1 },
    { productId: 'pave-cake', quantity: 1 },
  ], { promoCode: 'lemoni' }), { now, reservationNumber: 'VG-C-AU-STATIC-PROVENANCE' })
  const ineligiblePayload = JSON.parse(staticOrder.orderLinesJson)
  ineligiblePayload.lines[0].discountPercent = 0
  ineligiblePayload.lines[0].discountCents = 0
  ineligiblePayload.lines[0].totalPriceCents = ineligiblePayload.lines[0].subtotalCents
  ineligiblePayload.lines[1].discountPercent = 10
  ineligiblePayload.lines[1].discountCents = 750
  ineligiblePayload.lines[1].totalPriceCents = ineligiblePayload.lines[1].subtotalCents - 750
  const ineligibleStatic = {
    ...staticOrder,
    orderLinesJson: JSON.stringify(ineligiblePayload),
    discountBasisCents: 7500,
    discountCents: 750,
    totalPriceCents: ineligiblePayload.lines.reduce((sum, line) => sum + line.totalPriceCents, 0),
  }
  ineligibleStatic.totalPrice = ineligibleStatic.totalPriceCents / 100
  assertApiError('INVALID_STORED_ORDER', () => parseStoredOrderLines(ineligibleStatic), 500)
})

test('public cake projection exposes sanitized multi-lines and synthesizes sanitized legacy counts', () => {
  const reservation = buildCakeReservation(multiCakeInput([
    { productId: 'pave-cake', cakeSize: '19cm', quantity: 2 },
    { productId: 'pound-cake', poundAddon: 'vanilla-cream', quantity: 1 },
  ]), { now, reservationNumber: 'VG-C-AU-PUBLIC-MULTI' })
  const response = publicCakeReservation({
    ...reservation,
    customerName: 'Private Name', customerPhone: '0412345678', requestNote: 'Private note', adminMemo: 'Private memo',
  })

  assert.deepEqual([response.orderLineCount, response.orderItemCount], [2, 3])
  assert.deepEqual(response.orderLines.map((line) => [line.productId, line.quantity]), [['pave-cake', 2], ['pound-cake', 1]])
  assert.deepEqual(response.orderLines.map((line) => [
    line.unitPriceCents, line.subtotalCents, line.discountPercent, line.discountCents, line.totalPriceCents,
  ]), [[9500, 19000, 0, 0, 19000], [5500, 5500, 0, 0, 5500]])
  assert.deepEqual([
    response.subtotalCents, response.discountBasisCents, response.discountPercent,
    response.discountCents, response.totalPriceCents,
  ], [24500, 0, 0, 0, 24500])
  assert.equal(JSON.stringify(response.orderLines).includes('Private'), false)

  const legacy = publicCakeReservation({
    reservationNumber: 'VG-C-AU-PUBLIC-LEGACY', productId: 'pave-cake', cakeSize: '22cm', chocolateType: 'milk',
    poundAddon: 'none', quantity: 2, pickupDate: '2099-07-11', pickupTime: '10:00', status: '예약신청', paymentStatus: '입금대기',
  })
  assert.deepEqual([legacy.orderLineCount, legacy.orderItemCount], [1, 2])
  assert.equal('totalPriceCents' in legacy, false)
  assert.deepEqual(legacy.orderLines, [{
    productId: 'pave-cake', cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'none', chocolateIcingCount: 0,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 2,
  }])
})

test('versioned order line serialization enforces only the UTF-8 technical byte ceiling', () => {
  const reservation = buildCakeReservation(cakeInput, { now, reservationNumber: 'VG-C-AU-SERIALIZE' })
  const line = parseStoredOrderLines(reservation).lines[0]
  assertApiError('ORDER_TOO_LARGE', () => serializeStoredOrderLines(Array.from({ length: 500 }, () => line)), 413)
})

test('calendar login rejects a wrong PIN and returns a signed token for the configured PIN', () => {
  const env = {
    CALENDAR_VIEW_PIN: '123456',
    CALENDAR_TOKEN_SECRET: 'a-calendar-test-secret-that-is-long-enough',
  }
  assertApiError('CALENDAR_UNAUTHORIZED', () => calendarLogin({ pin: '000000' }, env, now))
  const result = calendarLogin({ pin: '123456' }, env, now)
  assert.equal(typeof result.token, 'string')
  assert.ok(result.token.length > 40)
})

test('calendar API returns only sanitised events for the requested month', async () => {
  const env = {
    CALENDAR_VIEW_PIN: '123456',
    CALENDAR_TOKEN_SECRET: 'a-calendar-test-secret-that-is-long-enough',
  }
  const { token } = calendarLogin({ pin: '123456' }, env, now)
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
      if (calls.length === 2) return { documents: [{
        $id: 'class-1', classDate: '2026-07-25', classTime: '11:00',
        advancedClassDate: '2026-08-01', advancedClassTime: '13:00', coursePlan: 'basic-advanced-package',
        durationMinutes: 90, advancedDurationMinutes: 120, extensionMinutes: 0, advancedExtensionMinutes: 0,
        subtotalCents: 25800, discountPercent: 5, discountCents: 1290, totalPriceCents: 24510,
        parentName: 'Private', childName: 'Private', status: 'Requested', allergyNote: 'Private',
      }] }
      return { documents: [{
        $id: 'class-2', classDate: '2026-06-28', classTime: '10:00',
        advancedClassDate: '2026-07-26', advancedClassTime: '13:00', coursePlan: 'basic-advanced-package',
        durationMinutes: 90, advancedDurationMinutes: 150, extensionMinutes: 0, advancedExtensionMinutes: 30,
        subtotalCents: 27800, discountPercent: 5, discountCents: 1290, totalPriceCents: 26510,
        parentName: 'Private', childName: 'Private', status: 'Requested', allergyNote: 'Private',
      }] }
    },
  }

  const result = await listCalendarEvents(databases, { token, month: '2026-07' }, env, now)
  assert.equal(calls.length, 3)
  assert.equal(result.month, '2026-07')
  assert.deepEqual(result.events.map((event) => [event.kind, event.date, event.time]), [
    ['cake', '2026-07-25', '10:00'],
    ['class', '2026-07-25', '11:00'],
    ['class', '2026-07-26', '13:00'],
  ])
  assert.equal(result.events.some((event) => event.date === '2026-08-01'), false)
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
  const runtimeConfig = {
    cakeDatabaseId: 'verygood_cake_au', kidsDatabaseId: 'verygood_cake_au',
    cakeReservationsId: 'reservations', classBookedDatesId: 'class_booked_dates',
    cakePickupOpeningsId: 'cake_pickup_openings', reviewCouponsId: 'review_coupons', manualCouponsId: 'manual_coupons',
    reviewCouponHmacSecret: Buffer.alloc(32, 7),
  }
  const first = await createCake(databases, { ...futureCakeInput, requestId }, { runtimeConfig })
  const retry = await createCake(databases, { ...futureCakeInput, requestId }, { runtimeConfig })
  assert.equal(creates, 1)
  assert.equal(first.chocolateIcingCount, 3)
  assert.equal(first.totalPriceCents, 3750)
  assert.equal(retry.id, first.id)
  assert.equal(retry.reservationNumber, first.reservationNumber)
})
