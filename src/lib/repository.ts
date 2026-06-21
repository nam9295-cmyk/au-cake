import { ID, OAuthProvider, Query } from 'appwrite'
import { account, appwriteConfig, databases, isAppwriteConfigured } from './appwrite'
import { MARKET } from './market'
import {
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  getProductById,
  getReservationPrice,
  normalizeCakeSize,
} from './constants'
import type {
  CakeSize,
  CacaoPercent,
  PaymentStatus,
  Reservation,
  ReservationFilters,
  ReservationInput,
  ReservationStatus,
  StoreSettings,
} from './types'
import { generateReservationNumber } from './utils'

const LOCAL_RESERVATIONS_KEY = `verygood-cake-reservations-${MARKET.toLowerCase()}`
const LOCAL_SETTINGS_KEY = `verygood-cake-settings-${MARKET.toLowerCase()}`
const LOCAL_ADMIN_KEY = `verygood-cake-admin-${MARKET.toLowerCase()}`

type AppwriteReservationDocument = Omit<Reservation, 'id' | 'productId' | 'cakeSize' | 'quantity'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  productId?: string
  cakeSize?: CakeSize
  quantity?: number
}

function normalizeReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    productId: getProductById(reservation.productId).id,
    cakeSize: normalizeCakeSize(getProductById(reservation.productId).id, reservation.cakeSize),
    quantity: normalizeQuantity(reservation.quantity),
  }
}

function normalizeQuantity(quantity?: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

function normalizeSettings(settings?: Partial<StoreSettings> | null): StoreSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  }
}

function toReservation(document: AppwriteReservationDocument): Reservation {
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    productId: getProductById(document.productId).id,
    cakeSize: normalizeCakeSize(getProductById(document.productId).id, document.cakeSize),
    quantity: normalizeQuantity(document.quantity),
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: document.totalPrice,
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
  const quantity = normalizeQuantity(input.quantity)
  const data = {
    reservationNumber,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    productId: product.id,
    cakeSize,
    quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent,
    requestNote: input.requestNote.trim(),
    status: '예약신청' as ReservationStatus,
    paymentStatus: '입금대기' as PaymentStatus,
    totalPrice: getReservationPrice(product.id, cacaoPercent, quantity, cakeSize),
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
    data,
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
  updates: Partial<Pick<Reservation, 'status' | 'paymentStatus' | 'adminMemo'>>,
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
