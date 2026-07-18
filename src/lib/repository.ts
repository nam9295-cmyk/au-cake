import { AppwriteException, ExecutionMethod, ID, OAuthProvider, Query, type Models } from 'appwrite'
import { account, appwriteConfig, databases, functions, isAppwriteConfigured } from './appwrite'
import { MARKET } from './market'
import {
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  applyPromoDiscount,
  fromCurrencyCents,
  getProductById,
  getValidPromoCode,
  toCurrencyCents,
  getReservationPrice,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizeReservationChocolateType,
  normalizePoundAddon,
} from './constants'
import {
  CLASS_TYPE_ID,
  generateClassReservationNumber,
  getClassBookingPrice,
  isCakePickupBlockedByClass,
  type CakePickupOpening,
  type ClassBookedSlot,
} from './class-utils'
import type {
  CakeSize,
  CacaoPercent,
  ChocolateType,
  ClassPaymentStatus,
  ClassReservation,
  ClassReservationFilters,
  ClassReservationInput,
  ClassReservationStatus,
  PaymentStatus,
  PoundAddon,
  ProductId,
  PublicReservation,
  Reservation,
  ReservationFilters,
  ReservationInput,
  ReservationStatus,
  StoreSettings,
} from './types'
import { generateReservationNumber, isPickupTimeAllowed, isValidPhone, normalizePhone, PICKUP_TIME_TOO_SOON_ERROR, todayInputValue } from './utils'

const LOCAL_RESERVATIONS_KEY = `verygood-cake-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_RESERVATIONS_KEY = `verygood-class-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_BOOKED_DATES_KEY = `verygood-class-booked-dates-${MARKET.toLowerCase()}`
const LOCAL_CAKE_PICKUP_OPENINGS_KEY = `verygood-cake-pickup-openings-${MARKET.toLowerCase()}`
const LOCAL_SETTINGS_KEY = `verygood-cake-settings-${MARKET.toLowerCase()}`
const LOCAL_ADMIN_KEY = `verygood-cake-admin-${MARKET.toLowerCase()}`

export const PICKUP_TIME_CLASS_CONFLICT_ERROR = 'PICKUP_TIME_CLASS_CONFLICT'

type AppwriteReservationDocument = Omit<Reservation, 'id' | 'productId' | 'cakeSize' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'quantity' | 'totalPriceCents'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  productId?: string
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  chocolateIcingCount?: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
  quantity?: number
  totalPriceCents?: number
}

type AppwriteClassReservationDocument = Omit<ClassReservation, 'id'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
}

type AppwriteClassBookedSlotDocument = {
  $id: string
  $createdAt?: string
  classDate: string
  classTime?: string
  createdAt?: string
}

type AppwriteCakePickupOpeningDocument = {
  $id: string
  $createdAt?: string
  pickupDate: string
  pickupTime: string
}

type ReservationApiResponse<T> = {
  ok: boolean
  result?: T
  code?: string
}

export type ReadOnlyCalendarEvent = {
  id: string
  kind: 'cake' | 'class'
  date: string
  time: string
  label: string
  status: string
  isCancelled: boolean
}

export type ReadOnlyCalendarResult = {
  month: string
  events: ReadOnlyCalendarEvent[]
}

function shouldUseReservationApi(scope: 'lookup' | 'all') {
  if (!isAppwriteConfigured) return false
  if (scope === 'all') return appwriteConfig.reservationApiMode === 'all'
  return appwriteConfig.reservationApiMode === 'lookup' || appwriteConfig.reservationApiMode === 'all'
}

async function executeReservationApi<T>(action: string, data?: unknown): Promise<T> {
  const execution = await functions.createExecution({
    functionId: appwriteConfig.reservationApiFunctionId,
    body: JSON.stringify({ action, data }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  })

  let response: ReservationApiResponse<T>
  try {
    response = JSON.parse(execution.responseBody || '{}') as ReservationApiResponse<T>
  } catch {
    throw new Error('RESERVATION_API_INVALID_RESPONSE')
  }
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300 || response.ok !== true) {
    throw new Error(response.code || 'RESERVATION_API_UNAVAILABLE')
  }
  return response.result as T
}

export async function loginReadOnlyCalendar(pin: string) {
  if (!isAppwriteConfigured) throw new Error('CALENDAR_UNAVAILABLE')
  return executeReservationApi<{ token: string; expiresInDays: number }>('calendar-login', { pin })
}

export async function getReadOnlyCalendarEvents(token: string, month: string) {
  if (!isAppwriteConfigured) throw new Error('CALENDAR_UNAVAILABLE')
  return executeReservationApi<ReadOnlyCalendarResult>('calendar-events', { token, month })
}

async function listAllDocuments(databaseId: string, collectionId: string, queries: string[]) {
  const documents: Models.Document[] = []
  let cursor = ''

  for (let page = 0; page < 50; page += 1) {
    const result = await databases.listDocuments({
      databaseId,
      collectionId,
      queries: [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      total: false,
    })
    documents.push(...result.documents)
    if (result.documents.length < 100) return documents
    cursor = result.documents.at(-1)?.$id || ''
    if (!cursor) return documents
  }

  throw new Error('APPWRITE_RESULT_LIMIT_EXCEEDED')
}

function normalizeReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    productId: getProductById(reservation.productId).id,
    cakeSize: normalizeCakeSize(getProductById(reservation.productId).id, reservation.cakeSize),
    poundAddon: normalizePoundAddon(getProductById(reservation.productId).id, reservation.poundAddon || DEFAULT_POUND_ADDON),
    chocolateType: normalizeReservationChocolateType(
      getProductById(reservation.productId).id,
      reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      normalizePoundAddon(getProductById(reservation.productId).id, reservation.poundAddon || DEFAULT_POUND_ADDON),
    ),
    chocolateIcingCount: normalizeChocolateIcingCount(
      getProductById(reservation.productId).id,
      reservation.chocolateIcingCount,
    ),
    ...normalizeCupcakeFinishCounts(
      getProductById(reservation.productId).id,
      reservation.vanillaCreamCount,
      reservation.partyDecorationCount,
    ),
    quantity: normalizeQuantity(reservation.quantity),
    totalPrice: reservation.totalPriceCents === undefined || reservation.totalPriceCents === null
      ? reservation.totalPrice
      : fromCurrencyCents(reservation.totalPriceCents),
    totalPriceCents: reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice),
  }
}

function toPublicReservation(reservation: PublicReservation): PublicReservation {
  const product = getProductById(reservation.productId)
  const poundAddon = normalizePoundAddon(product.id, reservation.poundAddon || DEFAULT_POUND_ADDON)
  return {
    reservationNumber: reservation.reservationNumber,
    productId: product.id,
    cakeSize: normalizeCakeSize(product.id, reservation.cakeSize),
    chocolateType: normalizeReservationChocolateType(
      product.id,
      reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      poundAddon,
    ),
    poundAddon,
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount),
    ...normalizeCupcakeFinishCounts(product.id, reservation.vanillaCreamCount, reservation.partyDecorationCount),
    quantity: normalizeQuantity(reservation.quantity),
    pickupDate: reservation.pickupDate,
    pickupTime: reservation.pickupTime,
    cacaoPercent: reservation.cacaoPercent || '기본',
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
  }
}

function matchesReservationPhone(storedPhone: string, suppliedPhone: string) {
  const suppliedDigits = normalizePhone(suppliedPhone)
  const storedDigits = normalizePhone(storedPhone)
  return isValidPhone(suppliedDigits) && storedDigits === suppliedDigits
}

function normalizeQuantity(quantity?: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

function buildPromoRequestNote(requestNote: string, productId: ProductId, originalTotal: number, discountedTotal: number, code?: string) {
  const trimmedNote = requestNote.trim()
  const appliedPromoCode = getValidPromoCode(productId, code)
  if (!appliedPromoCode) return trimmedNote
  const promoLine = `[Promo ${appliedPromoCode}] 10% discount applied: ${originalTotal.toFixed(2)} -> ${discountedTotal.toFixed(2)}`
  return [promoLine, trimmedNote].filter(Boolean).join('\n')
}

function normalizeSettings(settings?: Partial<StoreSettings> | null): StoreSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  }

  if (MARKET === 'AU') {
    if (merged.bankName === 'Payment details TBC') merged.bankName = DEFAULT_SETTINGS.bankName
    if (merged.bankAccount === 'Confirm with Jenny') merged.bankAccount = DEFAULT_SETTINGS.bankAccount
    if (merged.accountHolder === 'Verygood Chocolate' || merged.accountHolder === 'verygood') {
      merged.accountHolder = DEFAULT_SETTINGS.accountHolder
    }
    if (
      merged.pickupNotice === 'For pick-up outside listed hours, leave a note and we will confirm what is possible.' ||
      merged.pickupNotice === 'Street pick-up near 1 Bundil Blvd, Melrose Park. There is a small playground and seating nearby. Parking can be limited, so Jenny will bring the cake down to you.'
    ) {
      merged.pickupNotice = DEFAULT_SETTINGS.pickupNotice
    }
    if (merged.storeAddress === 'Sydney pick-up address TBC' || merged.storeAddress === 'Sydney pickup address TBC') {
      merged.storeAddress = DEFAULT_SETTINGS.storeAddress
    }
    if (merged.storePhone === '+61 phone number TBC' || merged.storePhone === '+61 mobile number TBC') {
      merged.storePhone = DEFAULT_SETTINGS.storePhone
    }
    if (merged.weekdayClose === '17:00') merged.weekdayClose = DEFAULT_SETTINGS.weekdayClose
    if (merged.weekendClose === '16:00') merged.weekendClose = DEFAULT_SETTINGS.weekendClose
  }

  return merged
}

function toReservation(document: AppwriteReservationDocument): Reservation {
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    productId: getProductById(document.productId).id,
    cakeSize: normalizeCakeSize(getProductById(document.productId).id, document.cakeSize),
    poundAddon: normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    chocolateType: normalizeReservationChocolateType(
      getProductById(document.productId).id,
      document.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    ),
    chocolateIcingCount: normalizeChocolateIcingCount(
      getProductById(document.productId).id,
      document.chocolateIcingCount,
    ),
    ...normalizeCupcakeFinishCounts(
      getProductById(document.productId).id,
      document.vanillaCreamCount,
      document.partyDecorationCount,
    ),
    quantity: normalizeQuantity(document.quantity),
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: document.totalPriceCents === undefined || document.totalPriceCents === null
      ? Number(document.totalPrice || 0)
      : fromCurrencyCents(document.totalPriceCents),
    totalPriceCents: document.totalPriceCents ?? toCurrencyCents(Number(document.totalPrice || 0)),
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt || '',
    updatedAt: document.updatedAt || document.$updatedAt || '',
  }
}

function readLocalReservations(): Reservation[] {
  const reservations = JSON.parse(localStorage.getItem(LOCAL_RESERVATIONS_KEY) || '[]') as Reservation[]
  return reservations.map(normalizeReservation)
}

function writeLocalReservations(reservations: Reservation[]) {
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(reservations))
}

function isAllowedAdminEmail(email?: string) {
  if (!email) return false
  return appwriteConfig.adminEmails.includes(email.trim().toLowerCase())
}

function applyLocalFilters(reservations: Reservation[], filters?: ReservationFilters) {
  if (!filters) return reservations
  const search = filters.search.trim().toLowerCase()

  return reservations.filter((reservation) => {
    if (filters.pickupDate && reservation.pickupDate !== filters.pickupDate) return false
    if (filters.status && reservation.status !== filters.status) return false
    if (filters.paymentStatus && reservation.paymentStatus !== filters.paymentStatus) return false
    if (filters.cacaoPercent && reservation.cacaoPercent !== filters.cacaoPercent) return false
    if (!search) return true
    return (
      reservation.customerName.toLowerCase().includes(search) ||
      reservation.customerPhone.includes(search) ||
      reservation.reservationNumber.toLowerCase().includes(search)
    )
  })
}

function toClassReservation(document: AppwriteClassReservationDocument): ClassReservation {
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    classType: document.classType || CLASS_TYPE_ID,
    classDate: document.classDate,
    classTime: document.classTime,
    bookingType: document.bookingType,
    parentName: document.parentName,
    parentPhone: document.parentPhone,
    parentEmail: document.parentEmail,
    childName: document.childName,
    childAge: Number(document.childAge || 0),
    schoolYear: document.schoolYear || '',
    secondChildName: document.secondChildName || '',
    secondChildAge: document.secondChildAge === null || document.secondChildAge === undefined ? null : Number(document.secondChildAge),
    secondChildSchoolYear: document.secondChildSchoolYear || '',
    allergyNote: document.allergyNote || '',
    emergencyContact: document.emergencyContact || '',
    pickupPerson: document.pickupPerson || '',
    parentConsent: Boolean(document.parentConsent),
    cancellationAgreement: Boolean(document.cancellationAgreement),
    photoConsent: Boolean(document.photoConsent),
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: Number(document.totalPrice || 0),
    depositAmount: Number(document.depositAmount || 0),
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt || '',
    updatedAt: document.updatedAt || document.$updatedAt || '',
  }
}

function readLocalClassReservations(): ClassReservation[] {
  return JSON.parse(localStorage.getItem(LOCAL_CLASS_RESERVATIONS_KEY) || '[]') as ClassReservation[]
}

function writeLocalClassReservations(reservations: ClassReservation[]) {
  localStorage.setItem(LOCAL_CLASS_RESERVATIONS_KEY, JSON.stringify(reservations))
}

function readLocalClassBookedSlots(): ClassBookedSlot[] {
  const storedSlots = JSON.parse(localStorage.getItem(LOCAL_CLASS_BOOKED_DATES_KEY) || '[]') as Array<ClassBookedSlot | { classDate?: string; classTime?: string }>
  const normalizedStoredSlots = storedSlots
    .map((slot) => (typeof slot === 'string' ? slot : slot.classDate ? { classDate: slot.classDate, classTime: slot.classTime || '' } : null))
    .filter(Boolean) as ClassBookedSlot[]
  const activeReservationSlots = readLocalClassReservations()
    .filter((reservation) => reservation.status !== 'Cancelled')
    .map((reservation) => ({ classDate: reservation.classDate, classTime: reservation.classTime }))
  const uniqueSlots = new Map<string, ClassBookedSlot>()
  for (const slot of [...normalizedStoredSlots, ...activeReservationSlots]) {
    const key = typeof slot === 'string' ? slot : `${slot.classDate} ${slot.classTime}`
    uniqueSlots.set(key, slot)
  }
  return Array.from(uniqueSlots.values()).sort((a, b) => {
    const aKey = typeof a === 'string' ? a : `${a.classDate} ${a.classTime}`
    const bKey = typeof b === 'string' ? b : `${b.classDate} ${b.classTime}`
    return aKey.localeCompare(bKey)
  })
}

function writeLocalClassBookedSlots(classSlots: ClassBookedSlot[]) {
  const uniqueSlots = new Map<string, ClassBookedSlot>()
  for (const slot of classSlots) {
    const key = typeof slot === 'string' ? slot : `${slot.classDate} ${slot.classTime}`
    uniqueSlots.set(key, slot)
  }
  localStorage.setItem(LOCAL_CLASS_BOOKED_DATES_KEY, JSON.stringify(Array.from(uniqueSlots.values())))
}

function readLocalCakePickupOpenings(): CakePickupOpening[] {
  const serializedOpenings = localStorage.getItem(LOCAL_CAKE_PICKUP_OPENINGS_KEY) || '[]'
  let storedOpenings: unknown
  try {
    storedOpenings = JSON.parse(serializedOpenings)
  } catch {
    return []
  }
  if (!Array.isArray(storedOpenings)) return []

  return storedOpenings
    .map((opening): CakePickupOpening | null => {
      if (!opening || typeof opening !== 'object') return null
      const row = opening as Record<string, unknown>
      if (typeof row.pickupDate !== 'string' || typeof row.pickupTime !== 'string') return null
      return { pickupDate: row.pickupDate, pickupTime: row.pickupTime }
    })
    .filter((opening): opening is CakePickupOpening => opening !== null)
}

function isDuplicateAppwriteError(error: unknown) {
  return error instanceof AppwriteException && (error.code === 409 || /unique|duplicate|already exists/i.test(error.message))
}

function isMissingCakePickupOpeningsCollectionError(error: unknown) {
  return error instanceof AppwriteException && error.code === 404 && error.type === 'collection_not_found'
}

async function createClassBookedSlot(classDate: string, classTime: string) {
  if (!isAppwriteConfigured) {
    const bookedSlots = readLocalClassBookedSlots()
    const alreadyBooked = bookedSlots.some((slot) => {
      if (typeof slot === 'string') return slot === classDate
      return slot.classDate === classDate && slot.classTime === classTime
    })
    if (alreadyBooked) throw new Error('CLASS_SESSION_UNAVAILABLE')
    writeLocalClassBookedSlots([...bookedSlots, { classDate, classTime }])
    return
  }

  try {
    await databases.createDocument(
      appwriteConfig.classReservationsDatabaseId,
      appwriteConfig.classBookedDatesCollectionId,
      ID.unique(),
      { classDate, classTime, createdAt: new Date().toISOString() },
    )
  } catch (error) {
    if (isDuplicateAppwriteError(error)) throw new Error('CLASS_SESSION_UNAVAILABLE', { cause: error })
    throw error
  }
}

async function findClassBookedSlotDocument(classDate: string, classTime: string) {
  const result = await databases.listDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classBookedDatesCollectionId,
    [Query.equal('classDate', classDate), Query.equal('classTime', classTime), Query.limit(1)],
  )
  return result.documents[0] as unknown as AppwriteClassBookedSlotDocument | undefined
}

async function deleteClassBookedSlot(classDate: string, classTime: string) {
  if (!isAppwriteConfigured) {
    writeLocalClassBookedSlots(readLocalClassBookedSlots().filter((slot) => {
      if (typeof slot === 'string') return slot !== classDate
      return !(slot.classDate === classDate && slot.classTime === classTime)
    }))
    return
  }

  const document = await findClassBookedSlotDocument(classDate, classTime)
  if (!document) return
  await databases.deleteDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classBookedDatesCollectionId,
    document.$id,
  )
}

function applyLocalClassFilters(reservations: ClassReservation[], filters?: ClassReservationFilters) {
  if (!filters) return reservations
  const search = filters.search.trim().toLowerCase()
  return reservations.filter((reservation) => {
    if (filters.classDate && reservation.classDate !== filters.classDate) return false
    if (filters.status && reservation.status !== filters.status) return false
    if (filters.paymentStatus && reservation.paymentStatus !== filters.paymentStatus) return false
    if (!search) return true
    return (
      reservation.parentName.toLowerCase().includes(search) ||
      reservation.childName.toLowerCase().includes(search) ||
      reservation.parentPhone.includes(search) ||
      reservation.reservationNumber.toLowerCase().includes(search)
    )
  })
}

export async function getSettings(): Promise<StoreSettings> {
  if (!isAppwriteConfigured) {
    return normalizeSettings(JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}') as Partial<StoreSettings>)
  }

  try {
    const result = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.settingsCollectionId, [
      Query.limit(1),
    ])
    return normalizeSettings(result.documents[0] as unknown as Partial<StoreSettings>)
  } catch {
    return normalizeSettings()
  }
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  if (!isPickupTimeAllowed(input.pickupDate, input.pickupTime)) {
    throw new Error(PICKUP_TIME_TOO_SOON_ERROR)
  }

  const [classBookedSlots, cakePickupOpenings] = await Promise.all([
    listClassBookedSlots(input.pickupDate),
    listCakePickupOpenings(input.pickupDate),
  ])
  if (isCakePickupBlockedByClass(input.pickupDate, input.pickupTime, classBookedSlots, cakePickupOpenings)) {
    throw new Error(PICKUP_TIME_CLASS_CONFLICT_ERROR)
  }

  if (shouldUseReservationApi('all')) {
    const reservation = await executeReservationApi<Reservation>('create-cake', input)
    return normalizeReservation(reservation)
  }

  const now = new Date().toISOString()
  const reservationNumber = generateReservationNumber()
  const product = getProductById(input.productId || DEFAULT_PRODUCT_ID)
  const cacaoPercent = product.usesCacaoOptions ? input.cacaoPercent : '기본'
  const cakeSize = normalizeCakeSize(product.id, input.cakeSize)
  const poundAddon = normalizePoundAddon(product.id, input.poundAddon)
  const chocolateType = normalizeReservationChocolateType(product.id, input.chocolateType, poundAddon)
  const chocolateIcingCount = normalizeChocolateIcingCount(product.id, input.chocolateIcingCount)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    product.id,
    input.vanillaCreamCount,
    input.partyDecorationCount,
  )
  const quantity = normalizeQuantity(input.quantity)
  const originalTotalPrice = getReservationPrice(
    product.id,
    { cacaoPercent, cakeSize, chocolateType, poundAddon, chocolateIcingCount, ...cupcakeFinishCounts },
    quantity,
  )
  const totalPrice = applyPromoDiscount(originalTotalPrice, product.id, input.promoCode)
  const totalPriceCents = toCurrencyCents(totalPrice)
  const data = {
    reservationNumber,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    productId: product.id,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    ...cupcakeFinishCounts,
    quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent,
    requestNote: buildPromoRequestNote(input.requestNote, product.id, originalTotalPrice, totalPrice, input.promoCode),
    status: '예약신청' as ReservationStatus,
    paymentStatus: '입금대기' as PaymentStatus,
    totalPrice,
    totalPriceCents,
    adminMemo: '',
    createdAt: now,
    updatedAt: now,
  }

  if (!isAppwriteConfigured) {
    const reservation: Reservation = { id: crypto.randomUUID(), ...data }
    writeLocalReservations([reservation, ...readLocalReservations()])
    return reservation
  }

  const document = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    ID.unique(),
    {
      ...data,
      // Keep the legacy Appwrite integer field for older admin/export code,
      // while totalPriceCents stores the exact AUD cent amount.
      totalPrice: Math.round(totalPrice),
      totalPriceCents,
    },
  )
  return toReservation(document as unknown as AppwriteReservationDocument)
}

export async function listReservations(filters?: ReservationFilters): Promise<Reservation[]> {
  if (!isAppwriteConfigured) {
    return applyLocalFilters(readLocalReservations(), filters).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const queries = [Query.orderDesc('createdAt')]
  if (filters?.pickupDate) queries.push(Query.equal('pickupDate', filters.pickupDate))
  if (filters?.status) queries.push(Query.equal('status', filters.status))
  if (filters?.paymentStatus) queries.push(Query.equal('paymentStatus', filters.paymentStatus))
  if (filters?.cacaoPercent) queries.push(Query.equal('cacaoPercent', filters.cacaoPercent as CacaoPercent))

  const documents = await listAllDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    queries,
  )
  return applyLocalFilters(documents.map((doc) => toReservation(doc as unknown as AppwriteReservationDocument)), {
    pickupDate: '',
    status: '',
    paymentStatus: '',
    cacaoPercent: '',
    search: filters?.search || '',
  })
}

export async function getReservationByNumber(reservationNumber: string, phone: string): Promise<PublicReservation | null> {
  if (shouldUseReservationApi('lookup')) {
    const reservation = await executeReservationApi<PublicReservation | null>('lookup-cake', {
      reservationNumber,
      phone,
    })
    return reservation ? toPublicReservation(reservation) : null
  }

  if (!isAppwriteConfigured) {
    const reservation = readLocalReservations().find((item) => {
      return item.reservationNumber === reservationNumber && matchesReservationPhone(item.customerPhone, phone)
    })
    return reservation ? toPublicReservation(reservation) : null
  }

  const result = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.reservationsCollectionId, [
    Query.equal('reservationNumber', reservationNumber),
    Query.limit(1),
  ])
  const reservation = result.documents[0]
    ? toReservation(result.documents[0] as unknown as AppwriteReservationDocument)
    : null
  if (!reservation) return null
  return matchesReservationPhone(reservation.customerPhone, phone) ? toPublicReservation(reservation) : null
}

export async function updateReservation(
  id: string,
  updates: Partial<Pick<Reservation,
    | 'status'
    | 'paymentStatus'
    | 'adminMemo'
    | 'productId'
    | 'cakeSize'
    | 'chocolateType'
    | 'poundAddon'
    | 'chocolateIcingCount'
    | 'vanillaCreamCount'
    | 'partyDecorationCount'
    | 'quantity'
    | 'pickupDate'
    | 'pickupTime'
    | 'cacaoPercent'
    | 'totalPrice'
    | 'totalPriceCents'
  >>,
): Promise<Reservation> {
  const nextUpdates = { ...updates, updatedAt: new Date().toISOString() }

  if (!isAppwriteConfigured) {
    const reservations = readLocalReservations()
    const index = reservations.findIndex((reservation) => reservation.id === id)
    if (index < 0) throw new Error('예약을 찾을 수 없습니다.')
    reservations[index] = { ...reservations[index], ...nextUpdates }
    writeLocalReservations(reservations)
    return reservations[index]
  }

  const document = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    id,
    nextUpdates,
  )
  return toReservation(document as unknown as AppwriteReservationDocument)
}

export async function listCakePickupOpenings(pickupDate: string): Promise<CakePickupOpening[]> {
  if (!isAppwriteConfigured) {
    return readLocalCakePickupOpenings().filter((opening) => opening.pickupDate === pickupDate)
  }

  try {
    const result = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.cakePickupOpeningsCollectionId,
      [Query.equal('pickupDate', pickupDate), Query.limit(200)],
    )
    return result.documents
      .map((doc) => {
        const opening = doc as unknown as AppwriteCakePickupOpeningDocument
        if (typeof opening.pickupDate !== 'string' || typeof opening.pickupTime !== 'string') return null
        return { pickupDate: opening.pickupDate, pickupTime: opening.pickupTime }
      })
      .filter((opening): opening is CakePickupOpening => opening !== null)
  } catch (error) {
    if (isMissingCakePickupOpeningsCollectionError(error)) return []
    throw error
  }
}

export async function listClassBookedSlots(classDate?: string): Promise<ClassBookedSlot[]> {
  if (!isAppwriteConfigured) {
    const bookedSlots = readLocalClassBookedSlots()
    if (classDate === undefined) return bookedSlots
    return bookedSlots.filter((slot) => (typeof slot === 'string' ? slot === classDate : slot.classDate === classDate))
  }

  const queries = classDate === undefined
    ? [Query.greaterThanEqual('classDate', todayInputValue()), Query.orderAsc('classDate')]
    : [Query.equal('classDate', classDate)]

  const documents = await listAllDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classBookedDatesCollectionId,
    queries,
  )
  return documents
    .map((doc) => {
      const slot = doc as unknown as AppwriteClassBookedSlotDocument
      if (!slot.classDate) return null
      return { classDate: slot.classDate, classTime: slot.classTime || '' }
    })
    .filter(Boolean) as ClassBookedSlot[]
}

export async function createClassReservation(input: ClassReservationInput): Promise<ClassReservation> {
  if (shouldUseReservationApi('all')) {
    return executeReservationApi<ClassReservation>('create-class', input)
  }

  const now = new Date().toISOString()
  const data = {
    reservationNumber: generateClassReservationNumber(),
    classType: input.classType,
    classDate: input.classDate,
    classTime: input.classTime,
    bookingType: input.bookingType,
    parentName: input.parentName.trim(),
    parentPhone: input.parentPhone.trim(),
    parentEmail: input.parentEmail.trim(),
    childName: input.childName.trim(),
    childAge: Number(input.childAge || 0),
    schoolYear: input.schoolYear.trim(),
    secondChildName: input.bookingType === '2-friends' ? input.secondChildName.trim() : '',
    secondChildAge: input.bookingType === '2-friends' && input.secondChildAge ? Number(input.secondChildAge) : null,
    secondChildSchoolYear: input.bookingType === '2-friends' ? input.secondChildSchoolYear.trim() : '',
    allergyNote: input.allergyNote.trim(),
    emergencyContact: input.emergencyContact.trim(),
    pickupPerson: input.pickupPerson.trim(),
    parentConsent: input.parentConsent,
    cancellationAgreement: input.cancellationAgreement,
    photoConsent: input.photoConsent,
    status: 'Requested' as ClassReservationStatus,
    paymentStatus: 'Payment pending' as ClassPaymentStatus,
    totalPrice: getClassBookingPrice(input.bookingType),
    depositAmount: 0,
    adminMemo: '',
    createdAt: now,
    updatedAt: now,
  }

  if (!isAppwriteConfigured) {
    await createClassBookedSlot(data.classDate, data.classTime)
    const reservation: ClassReservation = { id: crypto.randomUUID(), ...data }
    writeLocalClassReservations([reservation, ...readLocalClassReservations()])
    return reservation
  }

  await createClassBookedSlot(data.classDate, data.classTime)
  const document = await databases.createDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    ID.unique(),
    data,
  )
  return toClassReservation(document as unknown as AppwriteClassReservationDocument)
}

export async function listClassReservations(filters?: ClassReservationFilters): Promise<ClassReservation[]> {
  if (!isAppwriteConfigured) {
    return applyLocalClassFilters(readLocalClassReservations(), filters).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const queries = [Query.orderDesc('createdAt')]
  if (filters?.classDate) queries.push(Query.equal('classDate', filters.classDate))
  if (filters?.status) queries.push(Query.equal('status', filters.status))
  if (filters?.paymentStatus) queries.push(Query.equal('paymentStatus', filters.paymentStatus))

  const documents = await listAllDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    queries,
  )
  return applyLocalClassFilters(documents.map((doc) => toClassReservation(doc as unknown as AppwriteClassReservationDocument)), {
    classDate: '',
    status: '',
    paymentStatus: '',
    search: filters?.search || '',
  })
}

export async function updateClassReservation(
  id: string,
  updates: Partial<Pick<ClassReservation, 'status' | 'paymentStatus' | 'adminMemo'>>,
): Promise<ClassReservation> {
  const nextUpdates = { ...updates, updatedAt: new Date().toISOString() }

  if (!isAppwriteConfigured) {
    const reservations = readLocalClassReservations()
    const index = reservations.findIndex((reservation) => reservation.id === id)
    if (index < 0) throw new Error('클래스 예약을 찾을 수 없습니다.')
    const previous = reservations[index]
    const nextStatus = updates.status ?? previous.status
    if (previous.status === 'Cancelled' && nextStatus !== 'Cancelled') {
      await createClassBookedSlot(previous.classDate, previous.classTime)
    }
    reservations[index] = { ...reservations[index], ...nextUpdates }
    writeLocalClassReservations(reservations)
    if (previous.status !== 'Cancelled' && nextStatus === 'Cancelled') {
      await deleteClassBookedSlot(previous.classDate, previous.classTime)
    }
    return reservations[index]
  }

  const current = (await databases.getDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    id,
  )) as unknown as AppwriteClassReservationDocument
  const nextStatus = updates.status ?? current.status
  const isCancelling = current.status !== 'Cancelled' && nextStatus === 'Cancelled'
  const isReactivating = current.status === 'Cancelled' && nextStatus !== 'Cancelled'

  if (!isCancelling && !isReactivating) {
    const document = await databases.updateDocument(
      appwriteConfig.classReservationsDatabaseId,
      appwriteConfig.classReservationsCollectionId,
      id,
      nextUpdates,
    )
    return toClassReservation(document as unknown as AppwriteClassReservationDocument)
  }

  const slotDocument = isCancelling
    ? await findClassBookedSlotDocument(current.classDate, current.classTime)
    : undefined
  const transaction = await databases.createTransaction()
  try {
    if (isReactivating) {
      await databases.createDocument({
        databaseId: appwriteConfig.classReservationsDatabaseId,
        collectionId: appwriteConfig.classBookedDatesCollectionId,
        documentId: ID.unique(),
        data: { classDate: current.classDate, classTime: current.classTime, createdAt: new Date().toISOString() },
        transactionId: transaction.$id,
      })
    }
    await databases.updateDocument({
      databaseId: appwriteConfig.classReservationsDatabaseId,
      collectionId: appwriteConfig.classReservationsCollectionId,
      documentId: id,
      data: nextUpdates,
      transactionId: transaction.$id,
    })
    if (isCancelling && slotDocument) {
      await databases.deleteDocument({
        databaseId: appwriteConfig.classReservationsDatabaseId,
        collectionId: appwriteConfig.classBookedDatesCollectionId,
        documentId: slotDocument.$id,
        transactionId: transaction.$id,
      })
    }
    await databases.updateTransaction({ transactionId: transaction.$id, commit: true })
  } catch (error) {
    try {
      await databases.updateTransaction({ transactionId: transaction.$id, rollback: true })
    } catch {
      // Appwrite may already have rolled back a failed transaction.
    }
    if (isDuplicateAppwriteError(error)) throw new Error('CLASS_SESSION_UNAVAILABLE', { cause: error })
    throw error
  }

  const saved = await databases.getDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    id,
  )
  return toClassReservation(saved as unknown as AppwriteClassReservationDocument)
}

export async function loginAdmin(email: string, password: string) {
  if (!isAllowedAdminEmail(email)) {
    throw new Error('허용된 관리자 이메일이 아닙니다.')
  }

  if (!isAppwriteConfigured) {
    localStorage.setItem(LOCAL_ADMIN_KEY, email || 'demo-admin')
    return
  }

  await account.createEmailPasswordSession(email, password)
  const user = await account.get()
  if (!isAllowedAdminEmail(user.email)) {
    await account.deleteSession('current')
    throw new Error('허용된 관리자 이메일이 아닙니다.')
  }
}

export function loginAdminWithGoogle() {
  if (!isAppwriteConfigured) {
    localStorage.setItem(LOCAL_ADMIN_KEY, appwriteConfig.adminEmails[0] || 'demo-admin')
    window.location.assign('/admin')
    return
  }

  const origin = window.location.origin
  account.createOAuth2Session({
    provider: OAuthProvider.Google,
    success: `${origin}/admin/login?oauth=success`,
    failure: `${origin}/admin/login?oauth=failed`,
  })
}

export async function logoutAdmin() {
  if (!isAppwriteConfigured) {
    localStorage.removeItem(LOCAL_ADMIN_KEY)
    return
  }

  await account.deleteSession('current')
}

export async function isAdminLoggedIn() {
  if (!isAppwriteConfigured) return Boolean(localStorage.getItem(LOCAL_ADMIN_KEY))

  try {
    const user = await account.get()
    if (isAllowedAdminEmail(user.email)) return true
    await account.deleteSession('current')
    return false
  } catch {
    return false
  }
}
