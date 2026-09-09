import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite'
import {
  ReservationApiError,
  REVIEW_COUPON_ANIMALS,
  buildCakeReservation,
  buildClassReservation,
  canonicalCakeRequestPayload,
  generateCakeReservationNumber,
  generateClassReservationNumber,
  hashReviewCouponCode,
  matchesLookupPhone,
  normalizeAustralianMobile,
  normalizeReviewCouponCode,
  parseStoredOrderLines,
  publicCakeReservation,
  resolveCakeCatalogMode,
  resolveCakeCustomerEmailMode,
  validateReviewCoupon,
} from './business.js'
import {
  createCalendarToken,
  sanitizeCakeCalendarEvent,
  sanitizeClassCalendarEvents,
  secureTextEqual,
  verifyCalendarToken,
} from './calendar-access.js'
import { digestCakeRequestPayload, resolveReviewCouponHmacSecret } from './coupon-digest.js'
import { SMORE_WRITES_ENABLED } from './smore-write-policy.js'
import { cakeReservationResponse } from './cake-create-response.js'
import { checkReservationReadiness } from './reservation-health.js'
import { cakeServicesForRequest } from './custom-cake-runtime.js'
import { isCakeWireAction, handleCakeWireRequest, handleCakePhotoRecovery } from './custom-cake-routes.js'
import { createLegacyCakeGate } from './custom-cake-legacy-gate.js'

function reservationResourceConfig(env = process.env) {
  const cakeDatabaseId = env.APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au'
  return {
    cakeDatabaseId,
    kidsDatabaseId: env.APPWRITE_KIDS_DATABASE_ID || cakeDatabaseId,
    cakeReservationsId: env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations',
    settingsId: env.APPWRITE_SETTINGS_TABLE_ID || 'settings',
    classReservationsId: env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID || 'class_reservations',
    classBookedDatesId: env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID || 'class_booked_dates',

    reviewCouponsId: env.APPWRITE_REVIEW_COUPONS_TABLE_ID || 'review_coupons',
    manualCouponsId: env.APPWRITE_MANUAL_COUPONS_TABLE_ID || 'manual_coupons',
    cakeCatalogMode: resolveCakeCatalogMode(env.CAKE_CATALOG_MODE),
    cakeCustomerEmailMode: resolveCakeCustomerEmailMode(env.CAKE_CUSTOMER_EMAIL_MODE),
    reviewCouponHmacSecret: typeof env.REVIEW_COUPON_HMAC_SECRET === 'string' && env.REVIEW_COUPON_HMAC_SECRET.trim()
      ? resolveReviewCouponHmacSecret(env, ReservationApiError)
      : null,
  }
}

export function resolveReservationConfig(env = process.env) {
  const resolved = reservationResourceConfig(env)
  if (!resolved.reviewCouponHmacSecret) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  return resolved
}

const config = reservationResourceConfig()

function clientForRequest(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID
  const apiKey = req.headers['x-appwrite-key']
  if (!endpoint || !projectId || !apiKey) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
}

function requestBody(req) {
  if (typeof req.bodyText === 'string' && Buffer.byteLength(req.bodyText, 'utf8') > 20_000) {
    throw new ReservationApiError('REQUEST_TOO_LARGE', 413)
  }
  const body = req.bodyJson
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReservationApiError('INVALID_REQUEST')
  return body
}

function isConflict(error) {
  return error instanceof AppwriteException && (error.code === 409 || /unique|duplicate|already exists/i.test(error.message))
}

function documentIdForInput(input) {
  const requestIdMissing = input?.requestId === undefined || input?.requestId === null || input?.requestId === ''
  if (requestIdMissing) {
    if (input && Object.prototype.hasOwnProperty.call(input, 'orderLines')) {
      throw new ReservationApiError('INVALID_REQUEST_ID')
    }
    return ID.unique()
  }
  if (typeof input.requestId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.requestId)) {
    throw new ReservationApiError('INVALID_REQUEST_ID')
  }
  return input.requestId
}

async function getIdempotentDocument(databases, databaseId, collectionId, documentId, customerPhone, phoneField) {
  if (documentId === 'unique()') return null
  try {
    const document = await databases.getDocument({ databaseId, collectionId, documentId })
    if (normalizeAustralianMobile(document[phoneField]) !== customerPhone) {
      throw new ReservationApiError('REQUEST_ID_CONFLICT', 409)
    }
    return document
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null
    throw error
  }
}

function cakeRequestFingerprint(input, runtimeConfig) {
  return digestCakeRequestPayload(
    canonicalCakeRequestPayload(input, {
      customerEmailMode: runtimeConfig.cakeCustomerEmailMode,
      cakeCatalogMode: runtimeConfig.cakeCatalogMode,
    }),
    runtimeConfig.reviewCouponHmacSecret,
    ReservationApiError,
  )
}

function assertMatchingRequestFingerprint(document, fingerprint) {
  if (!Object.hasOwn(document, 'requestFingerprint')) return
  if (typeof document.requestFingerprint !== 'string' || !secureTextEqual(document.requestFingerprint, fingerprint)) {
    throw new ReservationApiError('REQUEST_ID_CONFLICT', 409)
  }
}

function assertRequiredMatchingRequestFingerprint(document, fingerprint) {
  if (!Object.hasOwn(document, 'requestFingerprint')) {
    throw new ReservationApiError('REQUEST_ID_CONFLICT', 409)
  }
  assertMatchingRequestFingerprint(document, fingerprint)
}

async function uniqueReservationNumber(databases, databaseId, collectionId, generate) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reservationNumber = generate()
    const result = await databases.listDocuments({
      databaseId,
      collectionId,
      queries: [Query.equal('reservationNumber', reservationNumber), Query.limit(1)],
      total: false,
    })
    if (result.documents.length === 0) return reservationNumber
  }
  throw new ReservationApiError('RESERVATION_NUMBER_UNAVAILABLE', 503)
}

export { cakeReservationResponse } from './cake-create-response.js'

function classReservationResponse(document) {
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    classType: document.classType,
    classDate: document.classDate,
    classTime: document.classTime,
    coursePlan: document.coursePlan || 'basic',
    extensionMinutes: Number(document.extensionMinutes || 0),
    durationMinutes: Number(document.durationMinutes || 120),
    ...(document.advancedClassDate ? {
      advancedClassDate: document.advancedClassDate,
      advancedClassTime: document.advancedClassTime,
      advancedExtensionMinutes: Number(document.advancedExtensionMinutes || 0),
      advancedDurationMinutes: Number(document.advancedDurationMinutes || 120),
    } : {}),
    bookingType: document.bookingType,
    parentName: document.parentName,
    parentPhone: document.parentPhone,
    parentEmail: document.parentEmail,
    childName: document.childName,
    childAge: document.childAge,
    schoolYear: document.schoolYear,
    secondChildName: document.secondChildName || '',
    secondChildAge: document.secondChildAge ?? null,
    secondChildSchoolYear: document.secondChildSchoolYear || '',
    allergyNote: document.allergyNote || '',
    emergencyContact: document.emergencyContact,
    pickupPerson: document.pickupPerson,
    parentConsent: document.parentConsent,
    cancellationAgreement: document.cancellationAgreement,
    photoConsent: document.photoConsent,
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: document.totalPriceCents === undefined || document.totalPriceCents === null
      ? Number(document.totalPrice || 0)
      : Number(document.totalPriceCents) / 100,
    totalPriceCents: document.totalPriceCents ?? Math.round(Number(document.totalPrice || 0) * 100),
    subtotalCents: document.subtotalCents,
    discountPercent: document.discountPercent,
    discountCents: document.discountCents,
    depositAmount: document.depositAmount,
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt,
    updatedAt: document.updatedAt || document.$updatedAt,
  }
}

function reviewCouponInput(value) {
  if (value === undefined) return null
  if (typeof value !== 'string') throw new ReservationApiError('PROMO_CODE_INVALID')
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()
  const hasAnimalPrefix = REVIEW_COUPON_ANIMALS.some((animal) => upper.startsWith(animal))
  if (!upper.startsWith('VG') && !hasAnimalPrefix) return null
  return normalizeReviewCouponCode(trimmed)
}

const LOGGABLE_ACTIONS = new Set([
  'health',
  'create-cake',
  'create-class',
  'lookup-cake',
  'calendar-login',
  'calendar-events',
])

export function safeReservationLogAction(value) {
  return LOGGABLE_ACTIONS.has(value) ? value : 'unknown'
}

export function publicReservationErrorCode(code) {
  return typeof code === 'string' && code.startsWith('PROMO_CODE_') ? 'PROMO_CODE_INVALID' : code
}

export function reservationFailureResponse(caught, action) {
  if (action === 'health') return { code: 'SERVICE_UNAVAILABLE', status: 503 }
  const known = caught instanceof ReservationApiError
  return {
    code: publicReservationErrorCode(known ? caught.code : 'INTERNAL_ERROR'),
    status: known ? caught.status : 500,
  }
}

function couponLedgerForCode(runtimeConfig, normalizedCode) {
  const manual = normalizedCode.startsWith('JENNIE')
  return {
    collectionId: manual ? runtimeConfig.manualCouponsId : runtimeConfig.reviewCouponsId,
    manual,
  }
}

async function findReviewCoupon(databases, runtimeConfig, normalizedCode, collectionId, transactionId) {
  const result = await databases.listDocuments({
    databaseId: runtimeConfig.cakeDatabaseId,
    collectionId,
    queries: [Query.equal('codeHash', hashReviewCouponCode(normalizedCode, runtimeConfig.reviewCouponHmacSecret)), Query.limit(1)],
    total: false,
    ...(transactionId ? { transactionId } : {}),
  })
  return result.documents[0] || null
}

async function reconcileReviewCouponCommit(
  databases,
  runtimeConfig,
  documentId,
  customerPhone,
  requestFingerprint,
  couponId,
  collectionId,
  expectedReviewCouponId,
) {
  let reservation
  let currentCoupon
  try {
    [reservation, currentCoupon] = await Promise.all([
      getIdempotentDocument(
        databases,
        runtimeConfig.cakeDatabaseId,
        runtimeConfig.cakeReservationsId,
        documentId,
        customerPhone,
        'customerPhone',
      ),
      couponId
        ? databases.getDocument({
            databaseId: runtimeConfig.cakeDatabaseId,
            collectionId,
            documentId: couponId,
          }).catch((error) => {
            if (error instanceof AppwriteException && error.code === 404) return null
            throw error
          })
        : Promise.resolve(null),
    ])
    if (reservation) assertRequiredMatchingRequestFingerprint(reservation, requestFingerprint)
  } catch {
    throw new ReservationApiError('PROMO_CODE_INVALID')
  }
  if (
    reservation &&
    reservation.reviewCouponId === expectedReviewCouponId &&
    currentCoupon?.status === 'redeemed' &&
    currentCoupon.redeemedReservationId === documentId
  ) {
    return cakeReservationResponse(reservation)
  }
  if (currentCoupon?.status === 'redeemed') throw new ReservationApiError('PROMO_CODE_INVALID')
  if (!reservation && (!currentCoupon || currentCoupon.status === 'active')) {
    throw new ReservationApiError('PROMO_CODE_INVALID')
  }
  throw new ReservationApiError('PROMO_CODE_INVALID')
}

export async function createCake(databases, input, {
  now = new Date(),
  runtimeConfig = config,
  smoreWritesEnabled = SMORE_WRITES_ENABLED,
  legacyGate,
} = {}) {
  const documentId = documentIdForInput(input)
  const customerPhone = normalizeAustralianMobile(input?.customerPhone)
  if (!/^04\d{8}$/.test(customerPhone)) throw new ReservationApiError('INVALID_PHONE')
  const existing = await getIdempotentDocument(
    databases,
    runtimeConfig.cakeDatabaseId,
    runtimeConfig.cakeReservationsId,
    documentId,
    customerPhone,
    'customerPhone',
  )
  let requestFingerprint
  if (existing) {
    if (Object.hasOwn(existing, 'requestFingerprint')) {
      requestFingerprint = cakeRequestFingerprint(input, runtimeConfig)
      assertMatchingRequestFingerprint(existing, requestFingerprint)
    }
    if (!Object.hasOwn(existing, 'requestFingerprint') && legacyGate?.mode === 'required') throw new ReservationApiError('CAKE_ORDER_UPGRADE_REQUIRED', 409)
    return cakeReservationResponse(existing)
  }
  if (legacyGate) await legacyGate.beforeNew(documentId)
  requestFingerprint = cakeRequestFingerprint(input, runtimeConfig)
  const sharedIdentity = legacyGate?.identity(documentId, customerPhone, requestFingerprint)

  const normalizedReviewCode = reviewCouponInput(input?.promoCode)
  const safeInput = normalizedReviewCode ? { ...input, promoCode: '' } : input
  let data = {
    ...buildCakeReservation(safeInput, {
      now,
      reservationNumber: 'pending',
      customerEmailMode: runtimeConfig.cakeCustomerEmailMode,
      cakeCatalogMode: runtimeConfig.cakeCatalogMode,
    }),
    requestFingerprint,
  }
  // The compatibility deployment keeps the complete S'more reader/replay path,
  // but its immutable artifact policy blocks every new request containing S'more.
  const storedOrder = parseStoredOrderLines(data)
  if (!smoreWritesEnabled && storedOrder?.lines.some(line => line.productId === 'smore-stick')) {
    throw new ReservationApiError('SMORE_WRITES_DISABLED', 503)
  }
  // Storage capacity, not a product maximum: the original Appwrite quantity
  // attribute was created in the signed-32-bit range. Integer range PATCH does
  // not widen that physical column. Keep pricing/line policy independent.
  if (storedOrder?.lines.some(line => line.quantity > 2147483647)) {
    throw new ReservationApiError('QUANTITY_STORAGE_OVERFLOW')
  }
  data.reservationNumber = await uniqueReservationNumber(
    databases,
    runtimeConfig.cakeDatabaseId,
    runtimeConfig.cakeReservationsId,
    () => generateCakeReservationNumber(now),
  )

  if (!normalizedReviewCode) {
    if (sharedIdentity) return legacyGate.createPlain(sharedIdentity, async transactionId => {
      const document = await databases.createDocument({ databaseId: runtimeConfig.cakeDatabaseId, collectionId: runtimeConfig.cakeReservationsId, documentId, data: { ...data, totalPrice: Math.round(data.totalPrice) }, transactionId })
      return cakeReservationResponse(document)
    })
    let document
    try {
      document = await databases.createDocument({
        databaseId: runtimeConfig.cakeDatabaseId,
        collectionId: runtimeConfig.cakeReservationsId,
        documentId,
        data: { ...data, totalPrice: Math.round(data.totalPrice) },
      })
    } catch (error) {
      if (!isConflict(error)) throw error
      const retryDocument = await getIdempotentDocument(
        databases,
        runtimeConfig.cakeDatabaseId,
        runtimeConfig.cakeReservationsId,
        documentId,
        data.customerPhone,
        'customerPhone',
      )
      if (!retryDocument) throw error
      assertRequiredMatchingRequestFingerprint(retryDocument, requestFingerprint)
      document = retryDocument
    }
    return cakeReservationResponse(document)
  }

  const transaction = await databases.createTransaction()
  const transactionId = transaction.$id || transaction.id
  const couponLedger = couponLedgerForCode(runtimeConfig, normalizedReviewCode)
  let couponId
  let expectedReviewCouponId
  let commitAttempted = false
  try {
    const couponDocument = await findReviewCoupon(
      databases,
      runtimeConfig,
      normalizedReviewCode,
      couponLedger.collectionId,
      transactionId,
    )
    couponId = couponDocument?.$id || couponDocument?.id
    expectedReviewCouponId = couponLedger.manual && couponId ? `manual:${couponId}` : couponId
    const reviewCoupon = validateReviewCoupon(couponDocument, normalizedReviewCode, now, runtimeConfig.reviewCouponHmacSecret)
    const pricingCoupon = couponLedger.manual
      ? { ...reviewCoupon, id: `manual:${reviewCoupon.id}` }
      : reviewCoupon
    expectedReviewCouponId = pricingCoupon.id
    data = {
      ...buildCakeReservation(safeInput, {
        now,
        reservationNumber: data.reservationNumber,
        reviewCoupon: pricingCoupon,
        customerEmailMode: runtimeConfig.cakeCustomerEmailMode,
        cakeCatalogMode: runtimeConfig.cakeCatalogMode,
      }),
      requestFingerprint,
    }
    await databases.createDocument({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.cakeReservationsId,
      documentId,
      data: { ...data, totalPrice: Math.round(data.totalPrice) },
      transactionId,
    })
    if (sharedIdentity) await legacyGate.claim(transactionId, sharedIdentity, cakeReservationResponse({ ...data, $id: documentId }))
    await databases.updateDocument({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: couponLedger.collectionId,
      documentId: couponId,
      data: couponLedger.manual ? {
        status: 'redeemed',
        redeemedAt: now.toISOString(),
        redeemedReservationId: documentId,
      } : {
        status: 'redeemed',
        redeemedAt: now.toISOString(),
        redeemedReservationId: documentId,
        codeCiphertext: null,
        codeIv: null,
        codeAuthTag: null,
        codeEncryptionVersion: null,
      },
      transactionId,
    })
    commitAttempted = true
    await databases.updateTransaction({ transactionId, commit: true })
  } catch (error) {
    try { await databases.updateTransaction({ transactionId, rollback: true }) } catch { /* already rolled back or committed */ }
    if (sharedIdentity && (commitAttempted || isConflict(error))) await legacyGate.assertNoForeignClaim(documentId)
    if (error instanceof ReservationApiError) {
      if (error.code !== 'PROMO_CODE_INVALID' || !couponId) throw error
      return reconcileReviewCouponCommit(
        databases,
        runtimeConfig,
        documentId,
        customerPhone,
        requestFingerprint,
        couponId,
        couponLedger.collectionId,
        expectedReviewCouponId,
      )
    }
    if (commitAttempted || isConflict(error)) {
      return reconcileReviewCouponCommit(
        databases,
        runtimeConfig,
        documentId,
        customerPhone,
        requestFingerprint,
        couponId,
        couponLedger.collectionId,
        expectedReviewCouponId,
      )
    }
    throw error
  }

  const document = await databases.getDocument({
    databaseId: runtimeConfig.cakeDatabaseId,
    collectionId: runtimeConfig.cakeReservationsId,
    documentId,
  })
  return cakeReservationResponse(document)
}

export async function createClass(databases, input, { now = new Date(), runtimeConfig = config } = {}) {
  const documentId = documentIdForInput(input)
  const data = buildClassReservation(input, { now, reservationNumber: 'pending' })
  const existing = await getIdempotentDocument(
    databases,
    runtimeConfig.kidsDatabaseId,
    runtimeConfig.classReservationsId,
    documentId,
    data.parentPhone,
    'parentPhone',
  )
  if (existing) return classReservationResponse(existing)
  data.reservationNumber = await uniqueReservationNumber(
    databases,
    runtimeConfig.kidsDatabaseId,
    runtimeConfig.classReservationsId,
    () => generateClassReservationNumber(now),
  )

  const transaction = await databases.createTransaction()
  const transactionId = transaction.$id || transaction.id
  const slots = [
    { classDate: data.classDate, classTime: data.classTime, durationMinutes: data.durationMinutes },
    ...(data.coursePlan === 'basic-advanced-package' ? [{
      classDate: data.advancedClassDate,
      classTime: data.advancedClassTime,
      durationMinutes: data.advancedDurationMinutes,
    }] : []),
  ]

  try {
    for (const slot of slots) {
      await databases.createDocument({
        databaseId: runtimeConfig.kidsDatabaseId,
        collectionId: runtimeConfig.classBookedDatesId,
        documentId: ID.unique(),
        data: { ...slot, createdAt: data.createdAt },
        transactionId,
      })
    }
    await databases.createDocument({
      databaseId: runtimeConfig.kidsDatabaseId,
      collectionId: runtimeConfig.classReservationsId,
      documentId,
      data,
      transactionId,
    })
    await databases.updateTransaction({ transactionId, commit: true })
  } catch (error) {
    try {
      await databases.updateTransaction({ transactionId, rollback: true })
    } catch {
      // The transaction may already have been rolled back by Appwrite.
    }
    if (isConflict(error)) {
      const retryDocument = await getIdempotentDocument(
        databases,
        runtimeConfig.kidsDatabaseId,
        runtimeConfig.classReservationsId,
        documentId,
        data.parentPhone,
        'parentPhone',
      )
      if (retryDocument) return classReservationResponse(retryDocument)
      throw new ReservationApiError('CLASS_SESSION_UNAVAILABLE', 409)
    }
    throw error
  }

  const document = await databases.getDocument({
    databaseId: runtimeConfig.kidsDatabaseId,
    collectionId: runtimeConfig.classReservationsId,
    documentId,
  })
  return classReservationResponse(document)
}

export async function lookupCake(databases, input) {
  const reservationNumber = typeof input.reservationNumber === 'string' ? input.reservationNumber.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!/^[A-Za-z0-9-]{6,40}$/.test(reservationNumber)) throw new ReservationApiError('INVALID_LOOKUP')
  if (!/^04\d{8}$/.test(normalizeAustralianMobile(phone))) throw new ReservationApiError('INVALID_LOOKUP')

  const result = await databases.listDocuments({
    databaseId: config.cakeDatabaseId,
    collectionId: config.cakeReservationsId,
    queries: [Query.equal('reservationNumber', reservationNumber), Query.limit(10)],
    total: false,
  })
  const match = result.documents.find((document) => matchesLookupPhone(document.customerPhone, phone))
  return match ? publicCakeReservation(match) : null
}

function calendarConfig(env) {
  const pin = env.CALENDAR_VIEW_PIN
  const secret = env.CALENDAR_TOKEN_SECRET
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin) || typeof secret !== 'string' || secret.length < 32) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  return { pin, secret }
}

export function calendarLogin(input, env = process.env, now = new Date()) {
  const { pin, secret } = calendarConfig(env)
  const suppliedPin = typeof input?.pin === 'string' ? input.pin.trim() : ''
  if (!secureTextEqual(suppliedPin, pin)) throw new ReservationApiError('CALENDAR_UNAUTHORIZED', 401)
  return { token: createCalendarToken(secret, now), expiresInDays: 30 }
}

export async function listCalendarEvents(databases, input, env = process.env, now = new Date()) {
  const { secret } = calendarConfig(env)
  if (!verifyCalendarToken(input?.token, secret, now)) throw new ReservationApiError('CALENDAR_UNAUTHORIZED', 401)
  const month = typeof input?.month === 'string' ? input.month : ''
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new ReservationApiError('INVALID_CALENDAR_MONTH')
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  const startDate = `${month}-01`
  const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)

  const [cakeResult, primaryClassResult, advancedClassResult] = await Promise.all([
    databases.listDocuments({
      databaseId: config.cakeDatabaseId,
      collectionId: config.cakeReservationsId,
      queries: [Query.greaterThanEqual('pickupDate', startDate), Query.lessThanEqual('pickupDate', endDate), Query.limit(200)],
      total: false,
    }),
    databases.listDocuments({
      databaseId: config.kidsDatabaseId,
      collectionId: config.classReservationsId,
      queries: [Query.greaterThanEqual('classDate', startDate), Query.lessThanEqual('classDate', endDate), Query.limit(200)],
      total: false,
    }),
    databases.listDocuments({
      databaseId: config.kidsDatabaseId,
      collectionId: config.classReservationsId,
      queries: [Query.greaterThanEqual('advancedClassDate', startDate), Query.lessThanEqual('advancedClassDate', endDate), Query.limit(200)],
      total: false,
    }),
  ])
  const classDocuments = Array.from(new Map(
    [...primaryClassResult.documents, ...advancedClassResult.documents].map((document) => [document.$id, document]),
  ).values())
  const events = [
    ...cakeResult.documents.map(sanitizeCakeCalendarEvent),
    ...classDocuments.flatMap(sanitizeClassCalendarEvents),
  ]
    .filter((event) => event.date >= startDate && event.date <= endDate)
    .sort((left, right) => `${left.date} ${left.time} ${left.kind}`.localeCompare(`${right.date} ${right.time} ${right.kind}`))
  return { month, events }
}

export { checkReservationReadiness } from './reservation-health.js'

export function createReservationHandler({ env = process.env, servicesForRequest, now = () => new Date(), smoreWritesEnabled = SMORE_WRITES_ENABLED } = {}) {
return async ({ req, res, log, error }) => {
  let action = 'unknown'
  if (isCakeWireAction(req.bodyJson?.action) || req.headers?.['x-appwrite-trigger'] === 'schedule') {
    const options = { env, now, smoreWritesEnabled }
    try {
      options.runtimeConfig = resolveReservationConfig(env)
      options.services = servicesForRequest ? servicesForRequest(req) : cakeServicesForRequest(req, env)
    } catch {
      // Route-owned mapping retains the selected strict wire envelope.
      options.services = {}
      options.runtimeConfig = {}
    }
    return req.headers?.['x-appwrite-trigger'] === 'schedule'
      ? handleCakePhotoRecovery({ req, res }, options)
      : handleCakeWireRequest({ req, res }, options)
  }
  try {
    const body = requestBody(req)
    action = body.action
    const runtimeConfig = resolveReservationConfig(env)
    const databases = servicesForRequest ? servicesForRequest(req).databases : new Databases(clientForRequest(req))

    let result
    if (action === 'health') result = await checkReservationReadiness(databases, runtimeConfig)
    else if (action === 'create-cake') {
      const services = servicesForRequest ? servicesForRequest(req) : { databases, storage: cakeServicesForRequest(req, env).storage }
      const legacyGate = createLegacyCakeGate({ env, services })
      result = await createCake(databases, body.data, { runtimeConfig, now: now(), smoreWritesEnabled, legacyGate })
    }
    else if (action === 'create-class') result = await createClass(databases, body.data)
    else if (action === 'lookup-cake') result = await lookupCake(databases, body.data || {})
    else if (action === 'calendar-login') result = calendarLogin(body.data || {})
    else if (action === 'calendar-events') result = await listCalendarEvents(databases, body.data || {})
    else throw new ReservationApiError('UNKNOWN_ACTION', 404)

    log(`reservation-api completed: ${safeReservationLogAction(action)}`)
    return res.json({ ok: true, result }, 200)
  } catch (caught) {
    const { code, status } = reservationFailureResponse(caught, action)
    const diagnostic = caught instanceof AppwriteException
      ? `appwrite=${caught.type || 'unknown'} http=${caught.code || 'unknown'}`
      : `error=${caught?.name || 'unknown'}`
    error(`reservation-api failed: ${safeReservationLogAction(action)} ${code} ${diagnostic}`)
    return res.json({ ok: false, code }, status)
  }
}
}

export default createReservationHandler()
