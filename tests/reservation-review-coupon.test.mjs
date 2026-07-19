import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { AppwriteException, Query } from 'node-appwrite'
import {
  ReservationApiError,
  buildCakeReservation,
  buildClassReservation,
  hashReviewCouponCode,
  normalizeReviewCouponCode,
  validateReviewCoupon,
} from '../functions/reservation-api/src/business.js'
import {
  createCake,
  cakeReservationResponse,
  checkReservationReadiness,
  publicReservationErrorCode,
  reservationFailureResponse,
  resolveReservationConfig,
  safeReservationLogAction,
} from '../functions/reservation-api/src/main.js'
const now = new Date('2026-07-10T00:00:00.000Z')
const requestId = 'f65f7e08-20f7-4b4a-b12a-6b42c043b268'
const rawCode = 'FOXKIWI7Q2MK'
const TEST_SECRET = 'A'.repeat(43)
const TEST_SECRET_BYTES = Buffer.from(TEST_SECRET, 'base64url')
const codeHash = hashReviewCouponCode(rawCode, TEST_SECRET_BYTES)

test('cake create response omits internal ids and exposes only authoritative promotion kind', () => {
  const base = {
    $id: 'internal-reservation-id', reservationNumber: 'VG-C-AU-1', customerName: 'Customer', customerPhone: '0412345678',
    productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', quantity: 1,
    pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본', requestNote: '', status: '예약신청',
    paymentStatus: '입금대기', totalPriceCents: 7125, subtotalCents: 7500, discountPercent: 5, discountCents: 375,
    appliedPromoCodeLast4: 'Q2MK', reviewCouponId: 'internal-coupon-id', adminMemo: '', createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }
  const response = cakeReservationResponse(base)
  assert.equal(response.promotionKind, 'review-reward')
  assert.equal('id' in response, false)
  assert.equal('reviewCouponId' in response, false)
  assert.equal(JSON.stringify(response).includes('internal-'), false)
  assert.equal(cakeReservationResponse({ ...base, reviewCouponId: undefined, discountPercent: 10, discountCents: 750, totalPriceCents: 6750 }).promotionKind, 'static')
  assert.equal(cakeReservationResponse({ ...base, reviewCouponId: undefined, appliedPromoCodeLast4: undefined, discountPercent: 0, discountCents: 0, totalPriceCents: 7500 }).promotionKind, 'none')
})
const runtimeConfig = {
  cakeDatabaseId: 'verygood_cake_au',
  kidsDatabaseId: 'verygood_cake_au',
  cakeReservationsId: 'reservations',
  settingsId: 'settings',
  classReservationsId: 'class_reservations',
  classBookedDatesId: 'class_booked_dates',
  cakePickupOpeningsId: 'cake_pickup_openings',
  reviewCouponsId: 'review_coupons',
  reviewCouponHmacSecret: TEST_SECRET_BYTES,
}

const cakeInput = {
  requestId,
  customerName: 'Jenny Cake',
  customerPhone: '+61 412 345 678',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'milk',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2099-07-11',
  pickupTime: '10:00',
  requestNote: 'Happy birthday',
  promoCode: rawCode,
  privacyConsent: true,
}

const classInput = {
  classType: 'school-holiday-private-cake-class',
  classDate: '2099-07-11',
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

function coupon(overrides = {}) {
  return {
    $id: 'coupon-1',
    codeHash,
    codeLast4: 'Q2MK',
    rewardPercent: 5,
    scope: 'cake',
    status: 'active',
    expiresAt: '2099-09-01T00:00:00.000Z',
    codeCiphertext: 'encryptedCouponBytes',
    codeIv: 'AQIDBAUGBwgJCgsM',
    codeAuthTag: 'AQIDBAUGBwgJCgsMDQ4PEA',
    codeEncryptionVersion: 1,
    ...overrides,
  }
}

function recoveryEnvelope(value) {
  return {
    codeCiphertext: value.codeCiphertext,
    codeIv: value.codeIv,
    codeAuthTag: value.codeAuthTag,
    codeEncryptionVersion: value.codeEncryptionVersion,
  }
}

function assertApiCode(code) {
  return (error) => error instanceof ReservationApiError && error.code === code
}

function createDatabaseDouble({ couponDocument = coupon(), failAt, commitApplies = false } = {}) {
  const calls = []
  const documents = new Map()
  let storedCoupon = { ...couponDocument }
  const db = {
    calls,
    documents,
    get coupon() { return storedCoupon },
    async getDocument(args) {
      calls.push(['getDocument', args])
      if (args.collectionId === 'reservations') {
        const document = documents.get(args.documentId)
        if (!document) throw new AppwriteException('Not found', 404, 'document_not_found')
        return document
      }
      if (args.collectionId === 'review_coupons') {
        if (!storedCoupon || storedCoupon.$id !== args.documentId) throw new AppwriteException('Not found', 404, 'document_not_found')
        return storedCoupon
      }
      throw new AppwriteException('Not found', 404, 'document_not_found')
    },
    async listDocuments(args) {
      calls.push(['listDocuments', args])
      if (args.collectionId === 'review_coupons') return { documents: storedCoupon ? [storedCoupon] : [] }
      return { documents: [] }
    },
    async createTransaction() {
      calls.push(['createTransaction'])
      return { $id: 'tx-1' }
    },
    async createDocument(args) {
      calls.push(['createDocument', args])
      if (failAt === 'create') throw new Error('create failed')
      const document = { $id: args.documentId, ...args.data }
      documents.set(args.documentId, document)
      return document
    },
    async updateDocument(args) {
      calls.push(['updateDocument', args])
      if (failAt === 'update') throw new Error('update failed')
      storedCoupon = { ...storedCoupon, ...args.data }
      return storedCoupon
    },
    async updateTransaction(args) {
      calls.push(['updateTransaction', args])
      if (args.commit && failAt === 'commit') {
        if (!commitApplies) {
          documents.delete(requestId)
          storedCoupon = { ...couponDocument }
        }
        throw new Error('commit response lost')
      }
      if (args.rollback && !commitApplies) {
        documents.delete(requestId)
        storedCoupon = { ...couponDocument }
      }
      return { $id: 'tx-1' }
    },
  }
  return db
}

test('review coupon format normalizes trim/case and requires curated tokens plus five unambiguous suffix characters', () => {
  assert.equal(normalizeReviewCouponCode('  foxkiwi7q2mk  '), rawCode)
  assert.equal(normalizeReviewCouponCode('CATMANGO2A3BC'), 'CATMANGO2A3BC')
  assert.equal(hashReviewCouponCode('  foxkiwi7q2mk  ', TEST_SECRET_BYTES), codeHash)
  for (const invalid of ['FOXKIWI7Q2MI', 'FOXKIWI7Q20K', 'FOXKIWI7Q2M', 'FOXKIWI7Q2MKA', 'RATKIWI7Q2MK', 'FOXORANGE7Q2MK', 'VG5-ABCD-2345', 'CHOCOLATE', 'LEMONI']) {
    assert.throws(() => normalizeReviewCouponCode(invalid), assertApiCode('PROMO_CODE_INVALID'))
  }
})


test('malformed animal-prefixed promo input fails closed and arbitrary actions cannot enter logs', async () => {
  const db = createDatabaseDouble({ couponDocument: null })
  await assert.rejects(
    () => createCake(db, { ...cakeInput, promoCode: 'FOXKIWI7Q2MI' }, { now, runtimeConfig }),
    assertApiCode('PROMO_CODE_INVALID'),
  )
  assert.equal(db.calls.some(([name]) => name === 'createTransaction' || name === 'createDocument'), false)
  assert.equal(safeReservationLogAction(`create-cake ${rawCode}`), 'unknown')
  assert.equal(safeReservationLogAction('create-cake'), 'create-cake')
  for (const code of ['PROMO_CODE_ALREADY_USED', 'PROMO_CODE_RETRY_REQUIRED', 'PROMO_CODE_INVALID']) {
    assert.equal(publicReservationErrorCode(code), 'PROMO_CODE_INVALID')
  }
})

test('review coupon runtime validation trusts the stored reward and fails closed without exposing record existence', () => {
  assert.equal(validateReviewCoupon(coupon(), rawCode, now, TEST_SECRET_BYTES).rewardPercent, 5)
  assert.equal(validateReviewCoupon(coupon({ rewardPercent: 10 }), rawCode, now, TEST_SECRET_BYTES).rewardPercent, 10)
  assert.throws(() => validateReviewCoupon(null, rawCode, now, TEST_SECRET_BYTES), assertApiCode('PROMO_CODE_INVALID'))
  assert.throws(() => validateReviewCoupon(coupon({ status: 'redeemed' }), rawCode, now, TEST_SECRET_BYTES), assertApiCode('PROMO_CODE_INVALID'))
  for (const invalid of [
    coupon({ status: 'revoked' }),
    coupon({ status: 'expired' }),
    coupon({ scope: 'class' }),
    coupon({ rewardPercent: 7 }),
    coupon({ expiresAt: now.toISOString() }),
    coupon({ expiresAt: 'not-an-iso-date' }),
  ]) assert.throws(() => validateReviewCoupon(invalid, rawCode, now, TEST_SECRET_BYTES), assertApiCode('PROMO_CODE_INVALID'))
})

test('review coupon pricing rounds discount cents and persists only safe audit fields', () => {
  const five = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, promoCode: '' },
    { now, reservationNumber: 'VG-C-AU-5', reviewCoupon: { id: 'coupon-1', rewardPercent: 5, codeLast4: 'Q2MK' } },
  )
  const ten = buildCakeReservation(
    { ...cakeInput, productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1, promoCode: '' },
    { now, reservationNumber: 'VG-C-AU-10', reviewCoupon: { id: 'coupon-2', rewardPercent: 10, codeLast4: 'AB89' } },
  )
  assert.deepEqual(
    [five.subtotalCents, five.discountPercent, five.discountCents, five.totalPriceCents],
    [3650, 5, 183, 3467],
  )
  assert.deepEqual(
    [ten.subtotalCents, ten.discountPercent, ten.discountCents, ten.totalPriceCents],
    [3650, 10, 365, 3285],
  )
  assert.equal(five.appliedPromoCodeLast4, 'Q2MK')
  assert.equal(five.reviewCouponId, 'coupon-1')
  assert.equal(JSON.stringify(five).includes(rawCode), false)
  assert.equal(five.requestNote, 'Happy birthday')
})

test('static Chocolate/Lemoni pricing and audit remain local without review lookup', async () => {
  for (const [productId, promoCode, expected] of [
    ['choco-basque-cheesecake', 'Chocolate', 4950],
    ['fresh-lemon-cupcakes-8', 'Lemoni', 4050],
  ]) {
    const db = createDatabaseDouble({ couponDocument: null })
    const result = await createCake(db, { ...cakeInput, requestId: crypto.randomUUID(), productId, promoCode }, { now, runtimeConfig })
    assert.equal(result.totalPriceCents, expected)
    assert.equal(db.calls.some(([, args]) => args?.collectionId === 'review_coupons'), false)
  }
})

test('review coupon creation uses one transaction, exact audit, and never persists raw code', async () => {
  const db = createDatabaseDouble()
  const result = await createCake(db, { ...cakeInput, promoCode: '  foxkiwi7q2mk  ' }, { now, runtimeConfig })
  assert.equal('id' in result, false)
  assert.equal(result.reservationNumber.startsWith('VG-C-AU-'), true)
  assert.equal(result.totalPriceCents, 7125)
  assert.equal('reviewCouponId' in result, false)
  assert.equal(JSON.stringify(result).includes(rawCode), false)
  const couponRead = db.calls.find(([name, args]) => name === 'listDocuments' && args.collectionId === 'review_coupons')
  const reservationCreate = db.calls.find(([name, args]) => name === 'createDocument' && args.collectionId === 'reservations')
  const couponUpdate = db.calls.find(([name]) => name === 'updateDocument')
  assert.equal(couponRead[1].transactionId, 'tx-1')
  assert.equal(reservationCreate[1].transactionId, 'tx-1')
  assert.equal(couponUpdate[1].transactionId, 'tx-1')
  assert.deepEqual(
    {
      subtotalCents: reservationCreate[1].data.subtotalCents,
      discountPercent: reservationCreate[1].data.discountPercent,
      discountCents: reservationCreate[1].data.discountCents,
      appliedPromoCodeLast4: reservationCreate[1].data.appliedPromoCodeLast4,
      reviewCouponId: reservationCreate[1].data.reviewCouponId,
    },
    { subtotalCents: 7500, discountPercent: 5, discountCents: 375, appliedPromoCodeLast4: 'Q2MK', reviewCouponId: 'coupon-1' },
  )
  assert.deepEqual(couponUpdate[1].data, {
    status: 'redeemed',
    redeemedAt: now.toISOString(),
    redeemedReservationId: requestId,
    codeCiphertext: null,
    codeIv: null,
    codeAuthTag: null,
    codeEncryptionVersion: null,
  })
  assert.equal(JSON.stringify(db.calls).includes(rawCode), false)
  assert.equal(db.calls.some(([name, args]) => name === 'updateTransaction' && args.commit === true), true)
})

test('create/update failures roll back and leave coupon active with its recovery envelope intact', async () => {
  const originalEnvelope = recoveryEnvelope(coupon())
  for (const failAt of ['create', 'update']) {
    const db = createDatabaseDouble({ failAt })
    await assert.rejects(() => createCake(db, cakeInput, { now, runtimeConfig }))
    assert.equal(db.calls.some(([name, args]) => name === 'updateTransaction' && args.rollback === true), true)
    assert.equal(db.coupon.status, 'active')
    assert.deepEqual(recoveryEnvelope(db.coupon), originalEnvelope)
    assert.equal(db.documents.has(requestId), false)
  }
})

test('commit uncertainty returns committed reservation only when both records prove linkage', async () => {
  const committed = createDatabaseDouble({ failAt: 'commit', commitApplies: true })
  const result = await createCake(committed, cakeInput, { now, runtimeConfig })
  assert.equal('id' in result, false)
  assert.equal(result.promotionKind, 'review-reward')
  assert.equal(committed.coupon.redeemedReservationId, requestId)

  const rolledBack = createDatabaseDouble({ failAt: 'commit', commitApplies: false })
  await assert.rejects(() => createCake(rolledBack, cakeInput, { now, runtimeConfig }), assertApiCode('PROMO_CODE_INVALID'))
  assert.equal(rolledBack.coupon.status, 'active')
  assert.deepEqual(recoveryEnvelope(rolledBack.coupon), recoveryEnvelope(coupon()))
})

test('idempotent retry returns existing reservation before coupon lookup or validation', async () => {
  const db = createDatabaseDouble({ couponDocument: coupon({ status: 'redeemed', redeemedReservationId: requestId }) })
  db.documents.set(requestId, {
    $id: requestId,
    ...buildCakeReservation({ ...cakeInput, promoCode: '' }, {
      now,
      reservationNumber: 'VG-C-AU-ORIGINAL',
      reviewCoupon: { id: 'coupon-1', rewardPercent: 5, codeLast4: 'Q2MK' },
    }),
  })
  const result = await createCake(db, { ...cakeInput, pickupDate: 'bad-date' }, { now, runtimeConfig })
  assert.equal(result.reservationNumber, 'VG-C-AU-ORIGINAL')
  assert.equal(db.calls.some(([, args]) => args?.collectionId === 'review_coupons'), false)
})

test('interleaved concurrent coupon submissions have one winner and a generic invalid-code loser', async () => {
  const committedDocuments = new Map()
  const transactions = new Map()
  let storedCoupon = coupon()
  let transactionSequence = 0
  let couponReads = 0
  let releaseCouponReads
  const bothCouponReads = new Promise((resolve) => { releaseCouponReads = resolve })
  const db = {
    async getDocument({ collectionId, documentId }) {
      if (collectionId === 'reservations') {
        const document = committedDocuments.get(documentId)
        if (document) return document
      } else if (collectionId === 'review_coupons' && documentId === storedCoupon.$id) {
        return storedCoupon
      }
      throw new AppwriteException('Not found', 404, 'document_not_found')
    },
    async listDocuments(args) {
      if (args.collectionId === 'review_coupons') {
        couponReads += 1
        if (couponReads === 2) releaseCouponReads()
        await bothCouponReads
        return { documents: [{ ...storedCoupon }] }
      }
      if (args.collectionId === 'reservations') return { documents: [] }
      return { documents: [] }
    },
    async createTransaction() {
      const id = `tx-${++transactionSequence}`
      transactions.set(id, {})
      return { $id: id }
    },
    async createDocument(args) {
      transactions.get(args.transactionId).reservation = { $id: args.documentId, ...args.data }
    },
    async updateDocument(args) {
      transactions.get(args.transactionId).couponUpdate = args.data
    },
    async updateTransaction({ transactionId, commit, rollback }) {
      const transaction = transactions.get(transactionId)
      if (rollback) return
      if (!commit) return
      if (storedCoupon.status !== 'active') {
        throw new AppwriteException('transaction conflict', 409, 'transaction_conflict')
      }
      committedDocuments.set(transaction.reservation.$id, transaction.reservation)
      storedCoupon = { ...storedCoupon, ...transaction.couponUpdate }
    },
  }
  const inputs = [
    { ...cakeInput, requestId: '11111111-1111-4111-8111-111111111111' },
    { ...cakeInput, requestId: '22222222-2222-4222-8222-222222222222' },
  ]
  const results = await Promise.allSettled(inputs.map((input) => createCake(db, input, { now, runtimeConfig })))
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  const loser = results.find(({ status }) => status === 'rejected')
  assert.equal(loser.reason instanceof ReservationApiError, true)
  assert.equal(loser.reason.code, 'PROMO_CODE_INVALID')
  assert.equal(publicReservationErrorCode(loser.reason.code), 'PROMO_CODE_INVALID')
  assert.equal(committedDocuments.size, 1)
  assert.equal(storedCoupon.redeemedReservationId, [...committedDocuments.keys()][0])
})

test('class reservations enforce the exact absent-only policy for both promo fields', () => {
  for (const field of ['promoCode', 'reviewCouponCode']) {
    for (const value of [rawCode, {}, 1, [], true, false]) {
      assert.throws(() => buildClassReservation({ ...classInput, [field]: value }, { now, runtimeConfig }), assertApiCode('PROMO_CODE_INVALID'))
    }
    for (const value of [undefined, null, '', '   ']) {
      assert.doesNotThrow(() => buildClassReservation({ ...classInput, [field]: value }, { now, runtimeConfig }))
    }
  }
})


test('reservation config requires and maps the server-only shared HMAC secret', () => {
  assert.throws(() => resolveReservationConfig({ APPWRITE_CAKE_DATABASE_ID: 'cake-db' }), /FUNCTION_CONFIGURATION_ERROR/)
  const defaults = resolveReservationConfig({
    APPWRITE_CAKE_DATABASE_ID: 'cake-db',
    REVIEW_COUPON_HMAC_SECRET: TEST_SECRET,
  })
  assert.equal(defaults.reviewCouponsId, 'review_coupons')
  assert.equal(defaults.reviewCouponHmacSecret.length, 32)
  assert.equal(resolveReservationConfig({
    APPWRITE_CAKE_DATABASE_ID: 'cake-db',
    APPWRITE_REVIEW_COUPONS_TABLE_ID: 'private-coupons',
    REVIEW_COUPON_HMAC_SECRET: TEST_SECRET,
    VITE_APPWRITE_REVIEW_COUPONS_TABLE_ID: 'public-ignored',
  }).reviewCouponsId, 'private-coupons')
})

const auditAttributes = [
  { key: 'subtotalCents', type: 'integer', required: false, min: 0, max: 9_223_372_036_854_775_807, status: 'available' },
  { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100, status: 'available' },
  { key: 'discountCents', type: 'integer', required: false, min: 0, max: 9_223_372_036_854_775_807, status: 'available' },
  { key: 'appliedPromoCodeLast4', type: 'string', size: 4, required: false, status: 'available' },
  { key: 'reviewCouponId', type: 'string', size: 64, required: false, status: 'available' },
]

const couponAttributes = [
  { key: 'codeHash', type: 'string', size: 64, required: true, status: 'available' },
  { key: 'codeCiphertext', type: 'string', size: 64, required: false, status: 'available' },
  { key: 'codeIv', type: 'string', size: 16, required: false, status: 'available' },
  { key: 'codeAuthTag', type: 'string', size: 22, required: false, status: 'available' },
  { key: 'codeEncryptionVersion', type: 'integer', required: false, min: 1, max: 1, status: 'available' },
]

function readinessDatabase(overrides = {}) {
  const calls = []
  const responses = {
    collection: { $permissions: ['read("user:admin_1")', 'update("user:admin_1")', 'delete("user:admin_1")'] },
    couponAttributes: { total: couponAttributes.length, attributes: couponAttributes },
    indexes: { total: 1, indexes: [{ key: 'code_hash_unique', type: 'unique', attributes: ['codeHash'], status: 'available' }] },
    reservationAttributes: { total: auditAttributes.length, attributes: auditAttributes },
    ...overrides,
  }
  return {
    calls,
    async listDocuments(args) { calls.push(['listDocuments', args]); return { documents: [] } },
    async getCollection(args) { calls.push(['getCollection', args]); return responses.collection },
    async listAttributes(args) {
      calls.push(['listAttributes', args])
      return args.collectionId === runtimeConfig.reviewCouponsId ? responses.couponAttributes : responses.reservationAttributes
    },
    async listIndexes(args) { calls.push(['listIndexes', args]); return responses.indexes },
  }
}

test('reservation readiness returns only generic ready after complete private compatible schema checks', async () => {
  const databases = readinessDatabase()
  assert.deepEqual(await checkReservationReadiness(databases, runtimeConfig), { status: 'ready' })
  assert.deepEqual(databases.calls.map(([name]) => name), [
    'listDocuments', 'getCollection', 'listAttributes', 'listIndexes', 'listAttributes',
  ])
  for (const [name, args] of databases.calls) {
    if (name === 'listDocuments') assert.deepEqual(args.queries, [Query.limit(1)])
    if (name === 'listAttributes' || name === 'listIndexes') {
      assert.deepEqual(args.queries, [Query.limit(100)])
      assert.equal(args.total, true)
    }
  }
})

test('reservation readiness fails closed for every coupon privacy or digest drift', async () => {
  const cases = [
    { collection: { $permissions: [] } },
    { collection: { $permissions: ['read("any")'] } },
    { collection: { $permissions: ['read("users")'] } },
    { collection: { $permissions: ['read("guests")'] } },
    { collection: { $permissions: ['read("team:staff")'] } },
    { collection: { $permissions: ['create("user:admin_1")'] } },
    { collection: { $permissions: ['read("user:admin_1")', 'update("user:admin_1")'] } },
    { collection: { $permissions: ['read("user:admin_1")', 'update("user:admin_1")', 'delete("user:admin_2")'] } },
    { couponAttributes: { total: 0, attributes: [] } },
    { couponAttributes: { total: 1, attributes: [{ key: 'codeHash', type: 'string', size: 63, required: true, status: 'available' }] } },
    { couponAttributes: { total: 1, attributes: [{ key: 'codeHash', type: 'string', size: 64, required: true, status: 'processing' }] } },
    { indexes: { total: 0, indexes: [] } },
    { indexes: { total: 1, indexes: [{ key: 'code_hash_unique', type: 'key', attributes: ['codeHash'], status: 'available' }] } },
    { indexes: { total: 1, indexes: [{ key: 'code_hash_unique', type: 'unique', attributes: ['codeHash'], status: 'processing' }] } },
  ]
  for (const drift of cases) {
    await assert.rejects(() => checkReservationReadiness(readinessDatabase(drift), runtimeConfig), assertApiCode('FUNCTION_CONFIGURATION_ERROR'))
  }
})

test('reservation readiness fails closed for missing, incompatible, or unavailable reservation audit attributes', async () => {
  const cases = [
    auditAttributes.slice(1),
    auditAttributes.map((attribute) => attribute.key === 'discountPercent' ? { ...attribute, max: 99 } : attribute),
    auditAttributes.map((attribute) => attribute.key === 'appliedPromoCodeLast4' ? { ...attribute, required: true } : attribute),
    auditAttributes.map((attribute) => attribute.key === 'reviewCouponId' ? { ...attribute, status: 'processing' } : attribute),
  ]
  for (const attributes of cases) {
    await assert.rejects(
      () => checkReservationReadiness(readinessDatabase({ reservationAttributes: { total: attributes.length, attributes } }), runtimeConfig),
      assertApiCode('FUNCTION_CONFIGURATION_ERROR'),
    )
  }
})

test('reservation readiness rejects incomplete bounded schema pagination', async () => {
  for (const drift of [
    { couponAttributes: { total: 101, attributes: Array(100).fill({ key: 'other', status: 'available' }) } },
    { indexes: { total: 101, indexes: Array(100).fill({ key: 'other', status: 'available' }) } },
    { reservationAttributes: { total: 101, attributes: auditAttributes } },
  ]) {
    await assert.rejects(() => checkReservationReadiness(readinessDatabase(drift), runtimeConfig), assertApiCode('FUNCTION_CONFIGURATION_ERROR'))
  }
})

test('health exceptions map to one generic 503 while non-health failures retain their contract', () => {
  assert.deepEqual(reservationFailureResponse(new Error('schema details'), 'health'), {
    code: 'SERVICE_UNAVAILABLE', status: 503,
  })
  assert.deepEqual(reservationFailureResponse(new ReservationApiError('INVALID_PHONE', 400), 'create-cake'), {
    code: 'INVALID_PHONE', status: 400,
  })
})
