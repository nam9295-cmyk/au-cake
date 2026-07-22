import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite'
import {
  ReservationApiError,
  REVIEW_COUPON_ANIMALS,
  buildCakeReservation,
  buildClassReservation,
  generateCakeReservationNumber,
  generateClassReservationNumber,
  hashReviewCouponCode,
  isCakePickupBlocked,
  matchesLookupPhone,
  normalizeAustralianMobile,
  normalizeReviewCouponCode,
  publicCakeReservation,
  validateReviewCoupon,
} from './business.js'
import {
  createCalendarToken,
  sanitizeCakeCalendarEvent,
  sanitizeClassCalendarEvents,
  secureTextEqual,
  verifyCalendarToken,
} from './calendar-access.js'
import { resolveReviewCouponHmacSecret } from './coupon-digest.js'

function reservationResourceConfig(env = process.env) {
  const cakeDatabaseId = env.APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au'
  return {
    cakeDatabaseId,
    kidsDatabaseId: env.APPWRITE_KIDS_DATABASE_ID || cakeDatabaseId,
    cakeReservationsId: env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations',
    settingsId: env.APPWRITE_SETTINGS_TABLE_ID || 'settings',
    classReservationsId: env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID || 'class_reservations',
    classBookedDatesId: env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID || 'class_booked_dates',
    cakePickupOpeningsId: env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID || 'cake_pickup_openings',
    reviewCouponsId: env.APPWRITE_REVIEW_COUPONS_TABLE_ID || 'review_coupons',
    manualCouponsId: env.APPWRITE_MANUAL_COUPONS_TABLE_ID || 'manual_coupons',
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
  if (typeof req.bodyText === 'string' && req.bodyText.length > 20_000) {
    throw new ReservationApiError('REQUEST_TOO_LARGE', 413)
  }
  const body = req.bodyJson
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ReservationApiError('INVALID_REQUEST')
  return body
}

function isMissingCollection(error) {
  return error instanceof AppwriteException && error.code === 404 && error.type === 'collection_not_found'
}

function isConflict(error) {
  return error instanceof AppwriteException && (error.code === 409 || /unique|duplicate|already exists/i.test(error.message))
}

function documentIdForInput(input) {
  if (input?.requestId === undefined || input?.requestId === null || input?.requestId === '') return ID.unique()
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

async function listCakePickupOpenings(databases, pickupDate) {
  try {
    const result = await databases.listDocuments({
      databaseId: config.cakeDatabaseId,
      collectionId: config.cakePickupOpeningsId,
      queries: [Query.equal('pickupDate', pickupDate), Query.limit(100)],
      total: false,
    })
    return result.documents.map((document) => ({
      pickupDate: document.pickupDate,
      pickupTime: document.pickupTime,
    }))
  } catch (error) {
    if (isMissingCollection(error)) return []
    throw error
  }
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

export function cakeReservationResponse(document) {
  const discountCents = Number(document.discountCents || 0)
  const promotionKind = typeof document.reviewCouponId === 'string' && document.reviewCouponId.startsWith('manual:')
    ? 'manual-coupon'
    : document.reviewCouponId
      ? 'review-reward'
      : discountCents > 0
        ? 'static'
        : 'none'
  return {
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    productId: document.productId,
    cakeSize: document.cakeSize,
    chocolateType: document.chocolateType,
    poundAddon: document.poundAddon,
    chocolateIcingCount: Number(document.chocolateIcingCount || 0),
    vanillaCreamCount: Number(document.vanillaCreamCount || 0),
    partyDecorationCount: Number(document.partyDecorationCount || 0),
    quantity: document.quantity,
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: Number(document.totalPriceCents || 0) / 100,
    totalPriceCents: document.totalPriceCents,
    subtotalCents: document.subtotalCents,
    discountPercent: document.discountPercent,
    discountCents: document.discountCents,
    promotionKind,
    ...(document.appliedPromoCodeLast4 ? { appliedPromoCodeLast4: document.appliedPromoCodeLast4 } : {}),
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt,
    updatedAt: document.updatedAt || document.$updatedAt,
  }
}

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

async function reconcileReviewCouponCommit(databases, runtimeConfig, documentId, customerPhone, couponId, collectionId) {
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
  } catch {
    throw new ReservationApiError('PROMO_CODE_INVALID')
  }
  if (reservation && currentCoupon?.status === 'redeemed' && currentCoupon.redeemedReservationId === documentId) {
    return cakeReservationResponse(reservation)
  }
  if (currentCoupon?.status === 'redeemed') throw new ReservationApiError('PROMO_CODE_INVALID')
  if (!reservation && (!currentCoupon || currentCoupon.status === 'active')) {
    throw new ReservationApiError('PROMO_CODE_INVALID')
  }
  throw new ReservationApiError('PROMO_CODE_INVALID')
}

export async function createCake(databases, input, { now = new Date(), runtimeConfig = config } = {}) {
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
  if (existing) return cakeReservationResponse(existing)

  const normalizedReviewCode = reviewCouponInput(input?.promoCode)
  const safeInput = normalizedReviewCode ? { ...input, promoCode: '' } : input
  let data = buildCakeReservation(safeInput, { now, reservationNumber: 'pending' })
  data.reservationNumber = await uniqueReservationNumber(
    databases,
    runtimeConfig.cakeDatabaseId,
    runtimeConfig.cakeReservationsId,
    () => generateCakeReservationNumber(now),
  )

  const [bookedResult, pickupOpenings] = await Promise.all([
    databases.listDocuments({
      databaseId: runtimeConfig.kidsDatabaseId,
      collectionId: runtimeConfig.classBookedDatesId,
      queries: [Query.equal('classDate', data.pickupDate), Query.limit(100)],
      total: false,
    }),
    listCakePickupOpenings(databases, data.pickupDate),
  ])
  if (isCakePickupBlocked(data.pickupDate, data.pickupTime, bookedResult.documents, pickupOpenings)) {
    throw new ReservationApiError('PICKUP_TIME_CLASS_CONFLICT', 409)
  }

  if (!normalizedReviewCode) {
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
      document = retryDocument
    }
    return cakeReservationResponse(document)
  }

  const transaction = await databases.createTransaction()
  const transactionId = transaction.$id || transaction.id
  const couponLedger = couponLedgerForCode(runtimeConfig, normalizedReviewCode)
  let couponId
  let commitAttempted = false
  try {
    const couponDocument = await findReviewCoupon(
      databases,
      runtimeConfig,
      normalizedReviewCode,
      couponLedger.collectionId,
      transactionId,
    )
    const reviewCoupon = validateReviewCoupon(couponDocument, normalizedReviewCode, now, runtimeConfig.reviewCouponHmacSecret)
    couponId = reviewCoupon.id
    const pricingCoupon = couponLedger.manual
      ? { ...reviewCoupon, id: `manual:${reviewCoupon.id}` }
      : reviewCoupon
    data = buildCakeReservation(safeInput, { now, reservationNumber: data.reservationNumber, reviewCoupon: pricingCoupon })
    await databases.createDocument({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.cakeReservationsId,
      documentId,
      data: { ...data, totalPrice: Math.round(data.totalPrice) },
      transactionId,
    })
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
    if (error instanceof ReservationApiError) throw error
    if (commitAttempted || isConflict(error)) {
      return reconcileReviewCouponCommit(
        databases,
        runtimeConfig,
        documentId,
        customerPhone,
        couponId,
        couponLedger.collectionId,
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

export async function checkReservationReadiness(databases, runtimeConfig) {
  await databases.listDocuments({
    databaseId: runtimeConfig.cakeDatabaseId,
    collectionId: runtimeConfig.settingsId,
    queries: [Query.limit(1)],
    total: false,
  })
  const [
    couponCollection,
    couponAttributeResult,
    couponIndexResult,
    manualCouponCollection,
    manualCouponAttributeResult,
    manualCouponIndexResult,
    reservationAttributeResult,
  ] = await Promise.all([
    databases.getCollection({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listIndexes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.reviewCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.getCollection({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listIndexes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.manualCouponsId,
      queries: [Query.limit(100)],
      total: true,
    }),
    databases.listAttributes({
      databaseId: runtimeConfig.cakeDatabaseId,
      collectionId: runtimeConfig.cakeReservationsId,
      queries: [Query.limit(100)],
      total: true,
    }),
  ])

  const completeResources = (response, key) => {
    const resources = Array.isArray(response?.[key]) ? response[key] : []
    if (!Number.isInteger(response?.total) || response.total !== resources.length) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
    return resources
  }
  const validateAdminOnlyPermissions = (collection) => {
    const permissions = collection?.$permissions || collection?.permissions
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
    const permissionsByAdmin = new Map()
    for (const permission of permissions) {
      const match = typeof permission === 'string'
        ? /^(read|update|delete)\("user:([A-Za-z0-9][A-Za-z0-9._-]{0,35})"\)$/.exec(permission)
        : null
      if (!match) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
      const actions = permissionsByAdmin.get(match[2]) || new Set()
      if (actions.has(match[1])) throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
      actions.add(match[1])
      permissionsByAdmin.set(match[2], actions)
    }
    if ([...permissionsByAdmin.values()].some((actions) =>
      actions.size !== 3 || !['read', 'update', 'delete'].every((action) => actions.has(action)))) {
      throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
    }
  }
  const manualCouponCollectionId = manualCouponCollection?.$id || manualCouponCollection?.id
  if (
    manualCouponCollectionId !== runtimeConfig.manualCouponsId ||
    manualCouponCollection?.name !== 'manual_coupons' ||
    manualCouponCollection?.enabled !== true ||
    manualCouponCollection?.documentSecurity !== false
  ) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  validateAdminOnlyPermissions(couponCollection)
  validateAdminOnlyPermissions(manualCouponCollection)

  const couponAttributes = completeResources(couponAttributeResult, 'attributes')
  const couponIndexes = completeResources(couponIndexResult, 'indexes')
  const manualCouponAttributes = completeResources(manualCouponAttributeResult, 'attributes')
  const manualCouponIndexes = completeResources(manualCouponIndexResult, 'indexes')
  const reservationAttributes = completeResources(reservationAttributeResult, 'attributes')
  const codeHash = couponAttributes.find((attribute) => (attribute.key || attribute.$id) === 'codeHash')
  const uniqueCodeHash = couponIndexes.some((index) =>
    index.type === 'unique' &&
    index.status === 'available' &&
    Array.isArray(index.attributes) &&
    index.attributes.length === 1 &&
    index.attributes[0] === 'codeHash')
  if (!codeHash || codeHash.type !== 'string' || codeHash.required !== true || codeHash.size !== 64 || codeHash.status !== 'available' || !uniqueCodeHash) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedCouponEnvelopeAttributes = [
    { key: 'codeCiphertext', type: 'string', required: false, size: 64 },
    { key: 'codeIv', type: 'string', required: false, size: 16 },
    { key: 'codeAuthTag', type: 'string', required: false, size: 22 },
    { key: 'codeEncryptionVersion', type: 'integer', required: false, min: 1, max: 1 },
  ]
  const compatibleCouponEnvelopeAttribute = (expected) => {
    const current = couponAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key)
    if (!current || current.status !== 'available' || current.type !== expected.type || current.required !== false) return false
    if (expected.type === 'string') return current.size === expected.size
    return (current.min ?? null) === expected.min && (current.max ?? null) === expected.max
  }
  if (!expectedCouponEnvelopeAttributes.every(compatibleCouponEnvelopeAttribute)) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedManualCouponAttributes = [
    { key: 'codeHash', type: 'string', required: true, size: 64 },
    { key: 'codeLast4', type: 'string', required: true, size: 4 },
    { key: 'rewardPercent', type: 'integer', required: true, min: 5, max: 5 },
    { key: 'scope', type: 'enum', required: true, elements: ['cake'] },
    { key: 'status', type: 'enum', required: true, elements: ['active', 'redeemed', 'expired', 'revoked'] },
    { key: 'expiresAt', type: 'string', required: true, size: 40 },
    { key: 'redeemedAt', type: 'string', required: false, size: 40 },
    { key: 'redeemedReservationId', type: 'string', required: false, size: 64 },
    { key: 'createdAt', type: 'string', required: true, size: 40 },
  ]
  const compatibleManualAttribute = (expected, current) => {
    if (!current || current.status !== 'available' || current.required !== expected.required) return false
    if (expected.type === 'enum') {
      if (current.type !== 'enum' && current.type !== 'string') return false
      return Array.isArray(current.elements) &&
        current.elements.length === expected.elements.length &&
        expected.elements.every((element, index) => current.elements[index] === element)
    }
    if (current.type !== expected.type) return false
    if (expected.type === 'string') return current.size === expected.size
    return (current.min ?? null) === expected.min && (current.max ?? null) === expected.max
  }
  if (manualCouponAttributes.length !== expectedManualCouponAttributes.length ||
      !expectedManualCouponAttributes.every((expected) => compatibleManualAttribute(
        expected,
        manualCouponAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key),
      ))) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedManualCouponIndexes = [
    { key: 'codeHash_unique', type: 'unique', attributes: ['codeHash'] },
    { key: 'status_idx', type: 'key', attributes: ['status'] },
    { key: 'expiresAt_idx', type: 'key', attributes: ['expiresAt'] },
  ]
  if (manualCouponIndexes.length !== expectedManualCouponIndexes.length ||
      !expectedManualCouponIndexes.every((expected) => {
        const current = manualCouponIndexes.find((index) => (index.key || index.$id) === expected.key)
        return current?.status === 'available' && current.type === expected.type &&
          Array.isArray(current.attributes) && current.attributes.length === expected.attributes.length &&
          expected.attributes.every((attribute, index) => current.attributes[index] === attribute)
      })) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }

  const expectedAuditAttributes = [
    { key: 'subtotalCents', type: 'integer', required: false, min: 0, max: null },
    { key: 'discountPercent', type: 'integer', required: false, min: 0, max: 100 },
    { key: 'discountCents', type: 'integer', required: false, min: 0, max: null },
    { key: 'appliedPromoCodeLast4', type: 'string', required: false, size: 4 },
    { key: 'reviewCouponId', type: 'string', required: false, size: 64 },
  ]
  const compatibleAuditAttribute = (expected) => {
    const current = reservationAttributes.find((attribute) => (attribute.key || attribute.$id) === expected.key)
    if (!current || current.status !== 'available' || current.type !== expected.type || current.required !== expected.required) return false
    if (expected.type === 'string') return current.size === expected.size
    if ((current.min ?? null) !== expected.min) return false
    return expected.max === null || (current.max ?? null) === expected.max
  }
  if (!expectedAuditAttributes.every(compatibleAuditAttribute)) {
    throw new ReservationApiError('FUNCTION_CONFIGURATION_ERROR', 500)
  }
  return { status: 'ready' }
}

export default async ({ req, res, log, error }) => {
  let action = 'unknown'
  try {
    const body = requestBody(req)
    action = body.action
    const runtimeConfig = resolveReservationConfig(process.env)
    const databases = new Databases(clientForRequest(req))

    let result
    if (action === 'health') result = await checkReservationReadiness(databases, runtimeConfig)
    else if (action === 'create-cake') result = await createCake(databases, body.data, { runtimeConfig })
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
