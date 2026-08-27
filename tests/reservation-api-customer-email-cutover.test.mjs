import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { AppwriteException } from 'node-appwrite'
import {
  ReservationApiError,
  buildCakeReservation,
  buildClassReservation,
  canonicalCakeRequestPayload,
  resolveCakeCustomerEmailMode,
} from '../appwrite-functions/reservation-api/src/business.js'
import { digestCakeRequestPayload } from '../appwrite-functions/reservation-api/src/coupon-digest.js'
import { cakeReservationResponse, createCake, resolveReservationConfig } from '../appwrite-functions/reservation-api/src/main.js'
import { buildDryRunPlan, resolveDeployConfig } from '../scripts/reservation-api-deploy-config.mjs'

const now = new Date('2026-07-10T00:00:00.000Z')
const hmacSecret = Buffer.alloc(32, 7)

const cakeInput = {
  customerName: 'Jenny Cake',
  customerPhone: '+61 412 345 678',
  customerEmail: ' Jenny.Cake@Example.COM ',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'milk',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2099-07-11',
  pickupTime: '10:00',
  requestNote: 'Happy birthday',
  promoCode: '',
  privacyConsent: true,
}

const classInput = {
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-10-03',
  classTime: '13:00',
  bookingType: 'year-1-2',
  parentName: 'Jenny Parent',
  parentPhone: '0412 345 678',
  parentEmail: 'jenny@example.com',
  childName: 'Mina',
  childAge: 8,
  schoolYear: 'Year 2',
  allergyNote: 'None',
  emergencyContact: 'John 0400 000 000',
  pickupPerson: 'Jenny Parent',
  parentConsent: true,
  cancellationAgreement: true,
  privacyConsent: true,
  photoConsent: false,
}

const deployEnv = {
  APPWRITE_ENDPOINT: 'https://appwrite.example.com/v1',
  APPWRITE_PROJECT_ID: 'project_au',
  APPWRITE_API_KEY: 'operator-secret',
  APPWRITE_CAKE_DATABASE_ID: 'cake_db',
  APPWRITE_KIDS_DATABASE_ID: 'kids_db',
  APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations',
  APPWRITE_SETTINGS_TABLE_ID: 'settings',
  APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
  APPWRITE_KIDS_BOOKED_DATES_TABLE_ID: 'class_booked_dates',
  APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID: 'cake_pickup_openings',
  APPWRITE_REVIEW_COUPONS_TABLE_ID: 'review_coupons',
  APPWRITE_MANUAL_COUPONS_TABLE_ID: 'manual_coupons',
  REVIEW_COUPON_HMAC_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CALENDAR_VIEW_PIN: '123456',
  CALENDAR_TOKEN_SECRET: 'a-calendar-secret-that-is-at-least-32-characters',
}

function runtimeConfig(cakeCustomerEmailMode) {
  return {
    cakeDatabaseId: 'verygood_cake_au',
    kidsDatabaseId: 'verygood_cake_au',
    cakeReservationsId: 'reservations',
    settingsId: 'settings',
    classReservationsId: 'class_reservations',
    classBookedDatesId: 'class_booked_dates',
    cakePickupOpeningsId: 'cake_pickup_openings',
    reviewCouponsId: 'review_coupons',
    manualCouponsId: 'manual_coupons',
    reviewCouponHmacSecret: hmacSecret,
    cakeCustomerEmailMode,
  }
}

function legacyCakeInput(overrides = {}) {
  const { customerEmail: _customerEmail, ...legacy } = cakeInput
  return { ...legacy, requestId: randomUUID(), ...overrides }
}

function modernCakeInput(overrides = {}) {
  return { ...cakeInput, requestId: randomUUID(), ...overrides }
}

function multiCakeInput(overrides = {}) {
  const { productId, cakeSize, chocolateType, poundAddon, quantity, ...common } = modernCakeInput(overrides)
  return {
    ...common,
    orderLines: [{ productId, cakeSize, chocolateType, poundAddon, quantity }],
  }
}

function createDatabaseDouble() {
  const documents = new Map()
  const calls = []
  return {
    documents,
    calls,
    async getDocument({ documentId }) {
      const document = documents.get(documentId)
      if (!document) throw new AppwriteException('Not found', 404, 'document_not_found')
      return document
    },
    async listDocuments() {
      return { documents: [] }
    },
    async createDocument({ documentId, data }) {
      calls.push(['createDocument', { documentId, data }])
      const document = { $id: documentId, ...data }
      documents.set(documentId, document)
      return document
    },
  }
}

function assertApiCode(code, callback) {
  assert.throws(callback, (error) => error instanceof ReservationApiError && error.code === code)
}

test('Cake customer-email mode defaults fail-safe to required and only explicit compat enables legacy omission', () => {
  assert.equal(resolveCakeCustomerEmailMode(undefined), 'required')
  assert.equal(resolveCakeCustomerEmailMode(''), 'required')
  assert.equal(resolveCakeCustomerEmailMode('required'), 'required')
  assert.equal(resolveCakeCustomerEmailMode('compat'), 'compat')
  assert.equal(resolveCakeCustomerEmailMode('COMPAT'), 'required')
  assert.equal(resolveCakeCustomerEmailMode('node-22'), 'required')
})

test('reservation runtime config reads only the server-side Cake customer-email mode', () => {
  for (const [value, expected] of [
    [undefined, 'required'],
    ['', 'required'],
    ['required', 'required'],
    ['compat', 'compat'],
    ['COMPAT', 'required'],
  ]) {
    assert.equal(resolveReservationConfig({
      REVIEW_COUPON_HMAC_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      CAKE_CUSTOMER_EMAIL_MODE: value,
      VITE_CAKE_CUSTOMER_EMAIL_MODE: 'compat',
    }).cakeCustomerEmailMode, expected)
  }
})

test('required mode preserves the recovery Cake customer-email validation contract', () => {
  assertApiCode('INVALID_EMAIL', () => buildCakeReservation(legacyCakeInput(), {
    now, customerEmailMode: 'required', reservationNumber: 'VG-C-AU-REQUIRED',
  }))
  for (const customerEmail of ['', ' ', null, 'not-an-email']) {
    assertApiCode('INVALID_EMAIL', () => buildCakeReservation({ ...modernCakeInput(), customerEmail }, {
      now, customerEmailMode: 'required', reservationNumber: 'VG-C-AU-REQUIRED',
    }))
  }
  const reservation = buildCakeReservation(cakeInput, {
    now, customerEmailMode: 'required', reservationNumber: 'VG-C-AU-REQUIRED',
  })
  assert.equal(reservation.customerEmail, 'jenny.cake@example.com')
})

test('compat mode accepts only an omitted legacy Cake email and never writes a placeholder', () => {
  const legacy = buildCakeReservation(legacyCakeInput(), {
    now, customerEmailMode: 'compat', reservationNumber: 'VG-C-AU-COMPAT',
  })
  assert.equal(Object.hasOwn(legacy, 'customerEmail'), false)
  for (const customerEmail of ['', ' ', null, 'not-an-email']) {
    assertApiCode('INVALID_EMAIL', () => buildCakeReservation({ ...modernCakeInput(), customerEmail }, {
      now, customerEmailMode: 'compat', reservationNumber: 'VG-C-AU-COMPAT',
    }))
  }
  const modern = buildCakeReservation(cakeInput, {
    now, customerEmailMode: 'compat', reservationNumber: 'VG-C-AU-COMPAT',
  })
  assert.equal(modern.customerEmail, 'jenny.cake@example.com')
})

test('compat mode keeps the legacy missing-email canonical payload while fingerprinting valid email separately', () => {
  const legacy = legacyCakeInput({ requestId: '11111111-1111-4111-8111-111111111111' })
  const normalized = { ...legacy, customerEmail: ' TEST@example.com ' }
  const normalizedAgain = { ...legacy, customerEmail: 'test@example.com' }
  const alternate = { ...legacy, customerEmail: 'other@example.com' }
  const legacyPayload = canonicalCakeRequestPayload(legacy, { customerEmailMode: 'compat' })
  assert.equal(Object.hasOwn(legacyPayload, 'customerEmail'), false)
  const first = digestCakeRequestPayload(legacyPayload, hmacSecret, ReservationApiError)
  const normalizedFingerprint = digestCakeRequestPayload(
    canonicalCakeRequestPayload(normalized, { customerEmailMode: 'compat' }), hmacSecret, ReservationApiError,
  )
  const normalizedAgainFingerprint = digestCakeRequestPayload(
    canonicalCakeRequestPayload(normalizedAgain, { customerEmailMode: 'compat' }), hmacSecret, ReservationApiError,
  )
  const alternateFingerprint = digestCakeRequestPayload(
    canonicalCakeRequestPayload(alternate, { customerEmailMode: 'compat' }), hmacSecret, ReservationApiError,
  )
  assert.notEqual(first, normalizedFingerprint)
  assert.equal(normalizedFingerprint, normalizedAgainFingerprint)
  assert.notEqual(normalizedFingerprint, alternateFingerprint)
})

test('compat mode supports legacy and recovery response shapes for single Cake creation', async () => {
  const legacyDb = createDatabaseDouble()
  const legacyResult = await createCake(legacyDb, legacyCakeInput(), { now, runtimeConfig: runtimeConfig('compat') })
  assert.equal(Object.hasOwn(legacyResult, 'customerEmail'), false)
  const legacyWrite = legacyDb.calls.find(([name]) => name === 'createDocument')[1].data
  assert.equal(Object.hasOwn(legacyWrite, 'customerEmail'), false)
  assert.equal(Object.hasOwn(cakeReservationResponse(legacyWrite), 'customerEmail'), false)

  const modernDb = createDatabaseDouble()
  const modernResult = await createCake(modernDb, modernCakeInput(), { now, runtimeConfig: runtimeConfig('compat') })
  assert.equal(modernResult.customerEmail, 'jenny.cake@example.com')
  const modernWrite = modernDb.calls.find(([name]) => name === 'createDocument')[1].data
  assert.equal(modernWrite.customerEmail, 'jenny.cake@example.com')
})

test('compat mode preserves legacy missing-email request-ID retry semantics', async () => {
  const request = legacyCakeInput({ requestId: '22222222-2222-4222-8222-222222222222' })
  const db = createDatabaseDouble()
  const first = await createCake(db, request, { now, runtimeConfig: runtimeConfig('compat') })
  const retry = await createCake(db, request, { now, runtimeConfig: runtimeConfig('compat') })
  const write = db.calls.find(([name]) => name === 'createDocument')[1].data
  const expectedFingerprint = digestCakeRequestPayload(
    canonicalCakeRequestPayload(request, { customerEmailMode: 'compat' }), hmacSecret, ReservationApiError,
  )
  assert.equal(db.calls.filter(([name]) => name === 'createDocument').length, 1)
  assert.equal(retry.reservationNumber, first.reservationNumber)
  assert.equal(write.requestFingerprint, expectedFingerprint)
  assert.equal(Object.hasOwn(write, 'customerEmail'), false)
})

test('compat mode supports legacy and recovery response shapes for multi-item Cake creation', async () => {
  const legacy = multiCakeInput()
  delete legacy.customerEmail
  const legacyDb = createDatabaseDouble()
  const legacyResult = await createCake(legacyDb, legacy, { now, runtimeConfig: runtimeConfig('compat') })
  assert.equal(Object.hasOwn(legacyResult, 'customerEmail'), false)
  assert.equal(Object.hasOwn(legacyDb.calls.find(([name]) => name === 'createDocument')[1].data, 'customerEmail'), false)

  const modernDb = createDatabaseDouble()
  const modernResult = await createCake(modernDb, multiCakeInput(), { now, runtimeConfig: runtimeConfig('compat') })
  assert.equal(modernResult.customerEmail, 'jenny.cake@example.com')
  assert.equal(modernDb.calls.find(([name]) => name === 'createDocument')[1].data.customerEmail, 'jenny.cake@example.com')
})

test('the Cake cutover mode does not change Class email validation', () => {
  assert.equal(buildClassReservation(classInput, { now, reservationNumber: 'VG-KC-AU-UNCHANGED' }).parentEmail, 'jenny@example.com')
  assertApiCode('INVALID_EMAIL', () => buildClassReservation({ ...classInput, parentEmail: '' }, {
    now, reservationNumber: 'VG-KC-AU-UNCHANGED', customerEmailMode: 'compat',
  }))
})

test('reservation deployment accepts only the explicit server-side Cake customer-email modes', () => {
  assert.equal(resolveDeployConfig(deployEnv).runtimeVariables.CAKE_CUSTOMER_EMAIL_MODE, 'required')
  assert.equal(resolveDeployConfig({ ...deployEnv, CAKE_CUSTOMER_EMAIL_MODE: 'required' }).runtimeVariables.CAKE_CUSTOMER_EMAIL_MODE, 'required')
  assert.equal(resolveDeployConfig({ ...deployEnv, CAKE_CUSTOMER_EMAIL_MODE: 'compat' }).runtimeVariables.CAKE_CUSTOMER_EMAIL_MODE, 'compat')
  assert.throws(() => resolveDeployConfig({ ...deployEnv, CAKE_CUSTOMER_EMAIL_MODE: 'COMPAT' }), /CAKE_CUSTOMER_EMAIL_MODE/)
  assert.throws(() => buildDryRunPlan({ ...deployEnv, CAKE_CUSTOMER_EMAIL_MODE: 'COMPAT' }), /CAKE_CUSTOMER_EMAIL_MODE/)
  const plan = buildDryRunPlan({ ...deployEnv, CAKE_CUSTOMER_EMAIL_MODE: 'compat' })
  assert.equal(plan.function.variableNames.includes('CAKE_CUSTOMER_EMAIL_MODE'), true)
  assert.equal(plan.function.maskedVariables.CAKE_CUSTOMER_EMAIL_MODE, 'co…at')
})

test('the recovery frontend parser keeps customerEmail required', () => {
  const currentParser = readFileSync('src/lib/review-coupon-client.ts', 'utf8')
  assert.match(currentParser, /responseCustomerEmail\(row, \{ required: true \}\)/)
})

test('cutover environment and README keep compat server-only and explicitly temporary', () => {
  const example = readFileSync('.env.example', 'utf8')
  const readme = readFileSync('README.md', 'utf8')
  assert.match(example, /^CAKE_CUSTOMER_EMAIL_MODE=required$/m)
  assert.equal(example.includes('VITE_CAKE_CUSTOMER_EMAIL_MODE'), false)
  assert.match(readme, /CAKE_CUSTOMER_EMAIL_MODE=compat/)
  assert.match(readme, /CAKE_CUSTOMER_EMAIL_MODE=required/)
  assert.match(readme, /must be returned to `required` after rollout/i)
})
