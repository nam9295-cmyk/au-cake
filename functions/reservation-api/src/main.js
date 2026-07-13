import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite'
import {
  ReservationApiError,
  buildCakeReservation,
  buildClassReservation,
  generateCakeReservationNumber,
  generateClassReservationNumber,
  isCakePickupBlocked,
  matchesLookupPhone,
  normalizeAustralianMobile,
  publicCakeReservation,
} from './business.js'
import {
  createCalendarToken,
  sanitizeCakeCalendarEvent,
  sanitizeClassCalendarEvent,
  secureTextEqual,
  verifyCalendarToken,
} from './calendar-access.js'

const config = {
  cakeDatabaseId: process.env.APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au',
  kidsDatabaseId: process.env.APPWRITE_KIDS_DATABASE_ID || process.env.APPWRITE_CAKE_DATABASE_ID || 'verygood_cake_au',
  cakeReservationsId: process.env.APPWRITE_CAKE_RESERVATIONS_TABLE_ID || 'reservations',
  settingsId: process.env.APPWRITE_SETTINGS_TABLE_ID || 'settings',
  classReservationsId: process.env.APPWRITE_KIDS_RESERVATIONS_TABLE_ID || 'class_reservations',
  classBookedDatesId: process.env.APPWRITE_KIDS_BOOKED_DATES_TABLE_ID || 'class_booked_dates',
  cakePickupOpeningsId: process.env.APPWRITE_CAKE_PICKUP_OPENINGS_TABLE_ID || 'cake_pickup_openings',
}

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

function cakeReservationResponse(document) {
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    productId: document.productId,
    cakeSize: document.cakeSize,
    chocolateType: document.chocolateType,
    poundAddon: document.poundAddon,
    chocolateIcingCount: Number(document.chocolateIcingCount || 0),
    quantity: document.quantity,
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: Number(document.totalPriceCents || 0) / 100,
    totalPriceCents: document.totalPriceCents,
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
    totalPrice: document.totalPrice,
    depositAmount: document.depositAmount,
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt,
    updatedAt: document.updatedAt || document.$updatedAt,
  }
}

export async function createCake(databases, input) {
  const documentId = documentIdForInput(input)
  const data = buildCakeReservation(input, { reservationNumber: 'pending' })
  const existing = await getIdempotentDocument(
    databases,
    config.cakeDatabaseId,
    config.cakeReservationsId,
    documentId,
    data.customerPhone,
    'customerPhone',
  )
  if (existing) return cakeReservationResponse(existing)
  data.reservationNumber = await uniqueReservationNumber(
    databases,
    config.cakeDatabaseId,
    config.cakeReservationsId,
    () => generateCakeReservationNumber(),
  )

  const [bookedResult, pickupOpenings] = await Promise.all([
    databases.listDocuments({
      databaseId: config.kidsDatabaseId,
      collectionId: config.classBookedDatesId,
      queries: [Query.equal('classDate', data.pickupDate), Query.limit(100)],
      total: false,
    }),
    listCakePickupOpenings(databases, data.pickupDate),
  ])
  if (isCakePickupBlocked(data.pickupDate, data.pickupTime, bookedResult.documents, pickupOpenings)) {
    throw new ReservationApiError('PICKUP_TIME_CLASS_CONFLICT', 409)
  }

  let document
  try {
    document = await databases.createDocument({
      databaseId: config.cakeDatabaseId,
      collectionId: config.cakeReservationsId,
      documentId,
      data: { ...data, totalPrice: Math.round(data.totalPrice) },
    })
  } catch (error) {
    if (!isConflict(error)) throw error
    const retryDocument = await getIdempotentDocument(
      databases,
      config.cakeDatabaseId,
      config.cakeReservationsId,
      documentId,
      data.customerPhone,
      'customerPhone',
    )
    if (!retryDocument) throw error
    document = retryDocument
  }
  return cakeReservationResponse(document)
}

export async function createClass(databases, input) {
  const documentId = documentIdForInput(input)
  const data = buildClassReservation(input, { reservationNumber: 'pending' })
  const existing = await getIdempotentDocument(
    databases,
    config.kidsDatabaseId,
    config.classReservationsId,
    documentId,
    data.parentPhone,
    'parentPhone',
  )
  if (existing) return classReservationResponse(existing)
  data.reservationNumber = await uniqueReservationNumber(
    databases,
    config.kidsDatabaseId,
    config.classReservationsId,
    () => generateClassReservationNumber(),
  )

  const transaction = await databases.createTransaction()

  try {
    await databases.createDocument({
      databaseId: config.kidsDatabaseId,
      collectionId: config.classBookedDatesId,
      documentId: ID.unique(),
      data: { classDate: data.classDate, classTime: data.classTime, createdAt: data.createdAt },
      transactionId: transaction.$id,
    })
    await databases.createDocument({
      databaseId: config.kidsDatabaseId,
      collectionId: config.classReservationsId,
      documentId,
      data,
      transactionId: transaction.$id,
    })
    await databases.updateTransaction({ transactionId: transaction.$id, commit: true })
  } catch (error) {
    try {
      await databases.updateTransaction({ transactionId: transaction.$id, rollback: true })
    } catch {
      // The transaction may already have been rolled back by Appwrite.
    }
    if (isConflict(error)) {
      const retryDocument = await getIdempotentDocument(
        databases,
        config.kidsDatabaseId,
        config.classReservationsId,
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
    databaseId: config.kidsDatabaseId,
    collectionId: config.classReservationsId,
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

  const [cakeResult, classResult] = await Promise.all([
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
  ])
  const events = [
    ...cakeResult.documents.map(sanitizeCakeCalendarEvent),
    ...classResult.documents.map(sanitizeClassCalendarEvent),
  ].sort((left, right) => `${left.date} ${left.time} ${left.kind}`.localeCompare(`${right.date} ${right.time} ${right.kind}`))
  return { month, events }
}

async function health(databases) {
  await databases.listDocuments({
    databaseId: config.cakeDatabaseId,
    collectionId: config.settingsId,
    queries: [Query.limit(1)],
    total: false,
  })
  return { service: 'verygood-reservation-api', version: 1, database: 'ok' }
}

export default async ({ req, res, log, error }) => {
  let action = 'unknown'
  try {
    const body = requestBody(req)
    action = body.action
    const databases = new Databases(clientForRequest(req))

    let result
    if (action === 'health') result = await health(databases)
    else if (action === 'create-cake') result = await createCake(databases, body.data)
    else if (action === 'create-class') result = await createClass(databases, body.data)
    else if (action === 'lookup-cake') result = await lookupCake(databases, body.data || {})
    else if (action === 'calendar-login') result = calendarLogin(body.data || {})
    else if (action === 'calendar-events') result = await listCalendarEvents(databases, body.data || {})
    else throw new ReservationApiError('UNKNOWN_ACTION', 404)

    log(`reservation-api completed: ${action}`)
    return res.json({ ok: true, result }, 200)
  } catch (caught) {
    const known = caught instanceof ReservationApiError
    const code = known ? caught.code : 'INTERNAL_ERROR'
    const status = known ? caught.status : 500
    const diagnostic = caught instanceof AppwriteException
      ? `appwrite=${caught.type || 'unknown'} http=${caught.code || 'unknown'}`
      : `error=${caught?.name || 'unknown'}`
    error(`reservation-api failed: ${action} ${code} ${diagnostic}`)
    return res.json({ ok: false, code }, status)
  }
}
