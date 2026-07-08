import { AppwriteException, ID, OAuthProvider, Query } from 'appwrite'
import { account, appwriteConfig, databases, isAppwriteConfigured } from './appwrite'
import { MARKET } from './market'
import {
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  PROMO_CODE,
  applyPromoDiscount,
  fromCurrencyCents,
  getProductById,
  isValidPromoCode,
  toCurrencyCents,
  getReservationPrice,
  normalizeCakeSize,
  normalizeReservationChocolateType,
  normalizePoundAddon,
} from './constants'
import {
  CLASS_TYPE_ID,
  generateClassReservationNumber,
  getClassBookingPrice,
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
  Reservation,
  ReservationFilters,
  ReservationInput,
  ReservationStatus,
  StoreSettings,
} from './types'
import { generateReservationNumber } from './utils'

const LOCAL_RESERVATIONS_KEY = `verygood-cake-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_RESERVATIONS_KEY = `verygood-class-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_BOOKED_DATES_KEY = `verygood-class-booked-dates-${MARKET.toLowerCase()}`
const LOCAL_SETTINGS_KEY = `verygood-cake-settings-${MARKET.toLowerCase()}`
const LOCAL_ADMIN_KEY = `verygood-cake-admin-${MARKET.toLowerCase()}`

type AppwriteReservationDocument = Omit<Reservation, 'id' | 'productId' | 'cakeSize' | 'chocolateType' | 'poundAddon' | 'quantity' | 'totalPriceCents'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  productId?: string
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  quantity?: number
  totalPriceCents?: number
}

type AppwriteClassReservationDocument = Omit<ClassReservation, 'id'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
}

type AppwriteClassBookedDateDocument = {
  $id: string
  $createdAt?: string
  classDate: string
  createdAt?: string
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
    quantity: normalizeQuantity(reservation.quantity),
    totalPrice: reservation.totalPriceCents === undefined || reservation.totalPriceCents === null
      ? reservation.totalPrice
      : fromCurrencyCents(reservation.totalPriceCents),
    totalPriceCents: reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice),
  }
}

function normalizeQuantity(quantity?: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

function buildPromoRequestNote(requestNote: string, originalTotal: number, discountedTotal: number, code?: string) {
  const trimmedNote = requestNote.trim()
  if (!isValidPromoCode(code)) return trimmedNote
  const promoLine = `[Promo ${PROMO_CODE}] 10% discount applied: ${originalTotal.toFixed(2)} -> ${discountedTotal.toFixed(2)}`
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

function readLocalClassBookedDates(): string[] {
  const storedDates = JSON.parse(localStorage.getItem(LOCAL_CLASS_BOOKED_DATES_KEY) || '[]') as string[]
  const activeReservationDates = readLocalClassReservations()
    .filter((reservation) => reservation.status !== 'Cancelled')
    .map((reservation) => reservation.classDate)
  return Array.from(new Set([...storedDates, ...activeReservationDates])).sort()
}

function writeLocalClassBookedDates(classDates: string[]) {
  localStorage.setItem(LOCAL_CLASS_BOOKED_DATES_KEY, JSON.stringify(Array.from(new Set(classDates)).sort()))
}

function isDuplicateAppwriteError(error: unknown) {
  return error instanceof AppwriteException && (error.code === 409 || /unique|duplicate|already exists/i.test(error.message))
}

async function createClassBookedDate(classDate: string) {
  if (!isAppwriteConfigured) {
    const bookedDates = readLocalClassBookedDates()
    if (bookedDates.includes(classDate)) throw new Error('CLASS_DATE_UNAVAILABLE')
    writeLocalClassBookedDates([...bookedDates, classDate])
    return
  }

  try {
    await databases.createDocument(
      appwriteConfig.classReservationsDatabaseId,
      appwriteConfig.classBookedDatesCollectionId,
      ID.unique(),
      { classDate, createdAt: new Date().toISOString() },
    )
  } catch (error) {
    if (isDuplicateAppwriteError(error)) throw new Error('CLASS_DATE_UNAVAILABLE', { cause: error })
    throw error
  }
}

async function deleteClassBookedDate(classDate: string) {
  if (!isAppwriteConfigured) {
    writeLocalClassBookedDates(readLocalClassBookedDates().filter((date) => date !== classDate))
    return
  }

  const result = await databases.listDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classBookedDatesCollectionId,
    [Query.equal('classDate', classDate), Query.limit(1)],
  )
  const document = result.documents[0] as unknown as AppwriteClassBookedDateDocument | undefined
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
  const now = new Date().toISOString()
  const reservationNumber = generateReservationNumber()
  const product = getProductById(input.productId || DEFAULT_PRODUCT_ID)
  const cacaoPercent = product.usesCacaoOptions ? input.cacaoPercent : '기본'
  const cakeSize = normalizeCakeSize(product.id, input.cakeSize)
  const poundAddon = normalizePoundAddon(product.id, input.poundAddon)
  const chocolateType = normalizeReservationChocolateType(product.id, input.chocolateType, poundAddon)
  const quantity = normalizeQuantity(input.quantity)
  const originalTotalPrice = getReservationPrice(product.id, { cacaoPercent, cakeSize, chocolateType, poundAddon }, quantity)
  const totalPrice = applyPromoDiscount(originalTotalPrice, input.promoCode)
  const totalPriceCents = toCurrencyCents(totalPrice)
  const data = {
    reservationNumber,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    productId: product.id,
    cakeSize,
    chocolateType,
    poundAddon,
    quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent,
    requestNote: buildPromoRequestNote(input.requestNote, originalTotalPrice, totalPrice, input.promoCode),
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

  const queries = [Query.orderDesc('createdAt'), Query.limit(200)]
  if (filters?.pickupDate) queries.push(Query.equal('pickupDate', filters.pickupDate))
  if (filters?.status) queries.push(Query.equal('status', filters.status))
  if (filters?.paymentStatus) queries.push(Query.equal('paymentStatus', filters.paymentStatus))
  if (filters?.cacaoPercent) queries.push(Query.equal('cacaoPercent', filters.cacaoPercent as CacaoPercent))

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    queries,
  )
  return applyLocalFilters(result.documents.map((doc) => toReservation(doc as unknown as AppwriteReservationDocument)), {
    pickupDate: '',
    status: '',
    paymentStatus: '',
    cacaoPercent: '',
    search: filters?.search || '',
  })
}

export async function getReservationByNumber(reservationNumber: string, phone: string): Promise<Reservation | null> {
  const phoneDigits = phone.replace(/\D/g, '')

  if (!isAppwriteConfigured) {
    const reservation = readLocalReservations().find((item) => {
      const itemDigits = item.customerPhone.replace(/\D/g, '')
      return item.reservationNumber === reservationNumber && (itemDigits === phoneDigits || itemDigits.endsWith(phoneDigits))
    })
    return reservation || null
  }

  const result = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.reservationsCollectionId, [
    Query.equal('reservationNumber', reservationNumber),
    Query.limit(1),
  ])
  const reservation = result.documents[0]
    ? toReservation(result.documents[0] as unknown as AppwriteReservationDocument)
    : null
  if (!reservation) return null
  const reservationPhone = reservation.customerPhone.replace(/\D/g, '')
  return reservationPhone === phoneDigits || reservationPhone.endsWith(phoneDigits) ? reservation : null
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

export async function listClassBookedDates(): Promise<string[]> {
  if (!isAppwriteConfigured) return readLocalClassBookedDates()

  const result = await databases.listDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classBookedDatesCollectionId,
    [Query.orderAsc('classDate'), Query.limit(200)],
  )
  return result.documents
    .map((doc) => (doc as unknown as AppwriteClassBookedDateDocument).classDate)
    .filter(Boolean)
}

export async function createClassReservation(input: ClassReservationInput): Promise<ClassReservation> {
  const now = new Date().toISOString()
  const data = {
    reservationNumber: generateClassReservationNumber(),
    classType: CLASS_TYPE_ID,
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
    await createClassBookedDate(data.classDate)
    const reservation: ClassReservation = { id: crypto.randomUUID(), ...data }
    writeLocalClassReservations([reservation, ...readLocalClassReservations()])
    return reservation
  }

  await createClassBookedDate(data.classDate)
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

  const queries = [Query.orderDesc('createdAt'), Query.limit(200)]
  if (filters?.classDate) queries.push(Query.equal('classDate', filters.classDate))
  if (filters?.status) queries.push(Query.equal('status', filters.status))
  if (filters?.paymentStatus) queries.push(Query.equal('paymentStatus', filters.paymentStatus))

  const result = await databases.listDocuments(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    queries,
  )
  return applyLocalClassFilters(result.documents.map((doc) => toClassReservation(doc as unknown as AppwriteClassReservationDocument)), {
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
    const previousClassDate = reservations[index].classDate
    reservations[index] = { ...reservations[index], ...nextUpdates }
    writeLocalClassReservations(reservations)
    if (updates.status === 'Cancelled') await deleteClassBookedDate(previousClassDate)
    return reservations[index]
  }

  const current = (await databases.getDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    id,
  )) as unknown as AppwriteClassReservationDocument
  const document = await databases.updateDocument(
    appwriteConfig.classReservationsDatabaseId,
    appwriteConfig.classReservationsCollectionId,
    id,
    nextUpdates,
  )
  if (updates.status === 'Cancelled') await deleteClassBookedDate(current.classDate)
  return toClassReservation(document as unknown as AppwriteClassReservationDocument)
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
