import { AppwriteException, ExecutionMethod, ID, OAuthProvider, Query, type Models } from 'appwrite'
import { account, appwriteConfig, databases, functions, isAppwriteConfigured } from './appwrite'
import { MARKET } from './market'
import { normalizeAuDailyLimitText } from './legacy-settings'
import { isStoredCakeOrderProductId } from '../../appwrite-functions/reservation-api/src/active-cake-products.js'
import {
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_CUPCAKE_FINISH,
  DEFAULT_POUND_ADDON,
  DEFAULT_PRODUCT_ID,
  DEFAULT_SETTINGS,
  MAX_RESERVATION_QUANTITY,
  LEMON_PROMO_CODE,
  PROMO_CODE,
  PRODUCTS,
  applyPromoDiscount,
  fromCurrencyCents,
  getProductById,
  getCupcakeFinishSurcharge,
  getValidPromoCode,
  toCurrencyCents,
  getReservationPrice,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinish,
  normalizeCupcakeFinishCounts,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  normalizeStoredVanillaCakeFlavor,
  normalizeStoredVanillaCakeSheet,
  normalizeReservationChocolateType,
  normalizePoundAddon,
} from './constants'
import { normalizeStoredCakeSize } from './cake-serving'
import type { ReservationPriceOptions } from './constants'
import {
  INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS,
  INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE,
  getIndividualPackagingPieceCount,
  isIndividualPackagingEligibleProduct,
} from './individual-packaging'
import {
  CLASS_TYPE_ID,
  calculateClassPricing,
  filterClassReservationsForAdmin,
  generateClassReservationNumber,
  getClassDurationMinutes,
  type CakePickupOpening,
  type ClassBookedSlot,
} from './class-utils'
import type {
  CakeOrderRequest,
  CakeOrderReservation,
  CakeOrderLineRequest,
  CakeOrderLineResult,
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
  VanillaCakeFlavor,
  VanillaCakePointColor,
  VanillaCakeSheet,
} from './types'
import {
  generateReservationNumber,
  isCakePickupServiceTime,
  isPickupTimeAllowed,
  isValidPhone,
  normalizePhone,
  PICKUP_TIME_TOO_SOON_ERROR,
  PICKUP_TIME_UNAVAILABLE_ERROR,
  todayInputValue,
} from './utils'
import {
  buildCakeOrderRequest,
  buildCakeReservationRequest,
  normalizeReviewCouponCode,
  parseCakeOrderResult,
  parseCakeReservationResult,
  parseReservationApiCapabilities,
} from './review-coupon-client'
import { assertReservationRepricingAllowed } from './admin-reservation-edit'

const LOCAL_RESERVATIONS_KEY = `verygood-cake-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_RESERVATIONS_KEY = `verygood-class-reservations-${MARKET.toLowerCase()}`
const LOCAL_CLASS_BOOKED_DATES_KEY = `verygood-class-booked-dates-${MARKET.toLowerCase()}`
const LOCAL_CAKE_PICKUP_OPENINGS_KEY = `verygood-cake-pickup-openings-${MARKET.toLowerCase()}`
const LOCAL_SETTINGS_KEY = `verygood-cake-settings-${MARKET.toLowerCase()}`
const LOCAL_ADMIN_KEY = `verygood-cake-admin-${MARKET.toLowerCase()}`
const CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PICKUP_TIME_CLASS_CONFLICT_ERROR = 'PICKUP_TIME_CLASS_CONFLICT'
export const CAKE_ORDER_LINES_UNAVAILABLE_ERROR = 'CAKE_ORDER_LINES_UNAVAILABLE'

type AppwriteReservationDocument = Omit<Reservation, 'id' | 'productId' | 'cakeSize' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'vanillaCakeSheet' | 'vanillaCakeFlavor' | 'vanillaCakePointColor' | 'individualPackaging' | 'individualPackagingPieces' | 'individualPackagingFeeCents' | 'quantity' | 'totalPriceCents' | 'subtotalCents' | 'discountPercent' | 'discountCents' | 'discountBasisCents' | 'orderLines' | 'orderLineCount' | 'orderItemCount' | 'appliedPromoCodeLast4' | 'reviewCouponId'> & {
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
  vanillaCakeSheet?: VanillaCakeSheet
  vanillaCakeFlavor?: VanillaCakeFlavor
  vanillaCakePointColor?: VanillaCakePointColor
  quantity?: number
  totalPriceCents?: number
  subtotalCents?: number
  discountPercent?: number
  discountCents?: number
  discountBasisCents?: number
  individualPackagingPieces?: number
  individualPackagingFeeCents?: number
  orderLinesJson?: string
  orderLineCount?: number
  orderItemCount?: number
  appliedPromoCodeLast4?: string
  reviewCouponId?: string
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
  durationMinutes?: number
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
  coursePlan?: ClassReservation['coursePlan']
  durationMinutes?: number
  extensionMinutes?: ClassReservation['extensionMinutes']
  subtotalCents?: number
  discountPercent?: number
  discountCents?: number
  totalPriceCents?: number
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

async function executeReservationApi<T>(action: string, data?: unknown, parseResult?: (value: unknown) => T): Promise<T> {
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
  return parseResult ? parseResult(response.result) : response.result as T
}

let cakeOrderLinesCapability: Promise<boolean> | null = null

export function supportsCakeOrderLines(): Promise<boolean> {
  if (!shouldUseReservationApi('all')) return Promise.resolve(false)
  if (cakeOrderLinesCapability) return cakeOrderLinesCapability

  const capability = executeReservationApi('health', undefined, parseReservationApiCapabilities)
    .then(() => true)
    .catch(() => {
      // A transient or malformed health result must not permanently disable
      // multi-line orders for the rest of this browser module's lifetime.
      // Preserve a newer in-flight/successful check if one ever replaces this
      // promise before the failure handler settles.
      if (cakeOrderLinesCapability === capability) cakeOrderLinesCapability = null
      return false
    })
  cakeOrderLinesCapability = capability
  return capability
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
    customerEmail: typeof reservation.customerEmail === 'string' ? reservation.customerEmail.trim().toLowerCase() : '',
    productId: getProductById(reservation.productId).id,
    cakeSize: normalizeStoredCakeSize(reservation.cakeSize),
    poundAddon: normalizePoundAddon(getProductById(reservation.productId).id, reservation.poundAddon || DEFAULT_POUND_ADDON),
    ...(reservation.cupcakeFinish === undefined ? {} : {
      cupcakeFinish: normalizeCupcakeFinish(getProductById(reservation.productId).id, reservation.cupcakeFinish),
    }),
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
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(getProductById(reservation.productId).id, reservation.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(getProductById(reservation.productId).id, reservation.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(getProductById(reservation.productId).id, reservation.vanillaCakePointColor),
    quantity: normalizeQuantity(reservation.quantity),
    totalPrice: reservation.totalPriceCents === undefined || reservation.totalPriceCents === null
      ? reservation.totalPrice
      : fromCurrencyCents(reservation.totalPriceCents),
    totalPriceCents: reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice),
    subtotalCents: reservation.subtotalCents,
    discountPercent: reservation.discountPercent,
    discountCents: reservation.discountCents,
    appliedPromoCodeLast4: reservation.appliedPromoCodeLast4,
    reviewCouponId: reservation.reviewCouponId,
  }
}

function normalizeCustomerEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_EMAIL')
  const customerEmail = value.trim().toLowerCase()
  if (customerEmail.length === 0 || customerEmail.length > 120 || !CUSTOMER_EMAIL_PATTERN.test(customerEmail)) {
    throw new Error('INVALID_EMAIL')
  }
  return customerEmail
}

type PublicReservationPayload = PublicReservation & {
  orderLines?: Array<CakeOrderLineRequest | CakeOrderLineResult>
  orderLineCount?: number
  orderItemCount?: number
  subtotalCents?: number
  discountBasisCents?: number
  discountPercent?: number
  discountCents?: number
  totalPriceCents?: number
}

function normalizedLineUnitPriceCents(
  productId: ProductId,
  line: ReservationPriceOptions & { cupcakeFinish?: unknown },
  legacyCupcakeCounts: boolean,
) {
  const currentPrice = Math.round(getReservationPrice(productId, line) * 100)
  return legacyCupcakeCounts && productId === 'cupcake-dozen'
    ? currentPrice + Math.round(getCupcakeFinishSurcharge(productId, line.vanillaCreamCount, line.partyDecorationCount) * 100)
    : currentPrice
}

const LEGACY_STORED_UNIT_PRICE_CENTS: Partial<Record<ProductId, Partial<Record<CakeSize, readonly number[]>>>> = {
  'pave-cake': { '15cm': [7500], '19cm': [9500], '22cm': [11500] },
  'vanilla-fresh-cream-cake': { '15cm': [7500], '19cm': [9800], '22cm': [13900] },
  'buttercream-cake': { '15cm': [7500], '19cm': [9800], '22cm': [13900] },
}

function isApprovedStoredUnitPriceCents(
  productId: ProductId,
  cakeSize: CakeSize,
  currentUnitPriceCents: number,
  storedUnitPriceCents: number,
  allowHistoricalUnitPrice: boolean,
) {
  return storedUnitPriceCents === currentUnitPriceCents
    || (allowHistoricalUnitPrice && (LEGACY_STORED_UNIT_PRICE_CENTS[productId]?.[cakeSize]?.includes(storedUnitPriceCents) ?? false))
}

function normalizePublicOrderLine(
  line: CakeOrderLineRequest | CakeOrderLineResult,
  {
    legacyCupcakeCounts = false,
    allowHistoricalUnitPrice = false,
  }: { legacyCupcakeCounts?: boolean; allowHistoricalUnitPrice?: boolean } = {},
) {
  if (!line || typeof line !== 'object' || Array.isArray(line)
    || typeof line.productId !== 'string' || !isStoredCakeOrderProductId(line.productId) || !Object.hasOwn(PRODUCTS, line.productId)) throw new Error('INVALID_RESERVATION_RESPONSE')
  const product = getProductById(line.productId)
  const poundAddon = normalizePoundAddon(product.id, line.poundAddon || DEFAULT_POUND_ADDON)
  const normalized = {
    productId: product.id,
    cakeSize: normalizeStoredCakeSize(line.cakeSize),
    chocolateType: normalizeReservationChocolateType(product.id, line.chocolateType || DEFAULT_CHOCOLATE_TYPE, poundAddon),
    poundAddon,
    ...(Object.hasOwn(line, 'cupcakeFinish') ? {
      cupcakeFinish: normalizeCupcakeFinish(product.id, line.cupcakeFinish),
    } : {}),
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, line.chocolateIcingCount),
    ...normalizeCupcakeFinishCounts(product.id, line.vanillaCreamCount, line.partyDecorationCount),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(product.id, line.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(product.id, line.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(product.id, line.vanillaCakePointColor),
    ...(Object.hasOwn(line, 'individualPackaging') ? {
      individualPackaging: line.individualPackaging === true,
    } : {}),
    quantity: line.quantity,
  }
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_RESERVATION_QUANTITY) throw new Error('INVALID_RESERVATION_RESPONSE')
  for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity'] as const) {
    if (line[key] !== normalized[key]) throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (Object.hasOwn(line, 'cupcakeFinish') && line.cupcakeFinish !== normalized.cupcakeFinish) throw new Error('INVALID_RESERVATION_RESPONSE')
  if (line.vanillaCakePointColor !== undefined && line.vanillaCakePointColor !== normalized.vanillaCakePointColor) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (Object.hasOwn(line, 'individualPackaging')) {
    if (typeof line.individualPackaging !== 'boolean'
      || (line.individualPackaging && !isIndividualPackagingEligibleProduct(product.id))) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
  }
  const priced = line as Partial<CakeOrderLineResult>
  const priceKeys = ['unitPriceCents', 'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents'] as const
  const packagingKeys = ['individualPackagingPieces', 'individualPackagingFeeCents'] as const
  const presentPriceKeys = priceKeys.filter((key) => Object.hasOwn(priced, key))
  if (presentPriceKeys.length === 0) return normalized
  if (presentPriceKeys.length !== priceKeys.length || priceKeys.some((key) => !Number.isSafeInteger(priced[key]) || (priced[key] as number) < 0)) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const hasPackagingFields = Object.hasOwn(line, 'individualPackaging')
  if (packagingKeys.some((key) => Object.hasOwn(priced, key)) !== hasPackagingFields
    || (hasPackagingFields && packagingKeys.some((key) => !Number.isSafeInteger(priced[key]) || (priced[key] as number) < 0))) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const unitPriceCents = normalizedLineUnitPriceCents(product.id, normalized, legacyCupcakeCounts)
  const subtotalCents = priced.subtotalCents as number
  const discountCents = priced.discountCents as number
  const totalPriceCents = priced.totalPriceCents as number
  const approvedUnitPriceCents = priced.unitPriceCents as number
  const individualPackagingPieces = hasPackagingFields ? priced.individualPackagingPieces as number : 0
  const individualPackagingFeeCents = hasPackagingFields ? priced.individualPackagingFeeCents as number : 0
  const expectedPackagingPieces = normalized.individualPackaging
    ? getIndividualPackagingPieceCount(product.id, line.quantity)
    : 0
  if (!isApprovedStoredUnitPriceCents(product.id, normalized.cakeSize, unitPriceCents, approvedUnitPriceCents, allowHistoricalUnitPrice)
    || priced.subtotalCents !== approvedUnitPriceCents * line.quantity
    || individualPackagingPieces !== expectedPackagingPieces
    || totalPriceCents !== subtotalCents - discountCents + individualPackagingFeeCents
    || ![0, 5, 10].includes(priced.discountPercent!)) throw new Error('INVALID_RESERVATION_RESPONSE')
  return {
    ...normalized,
    ...Object.fromEntries(priceKeys.map((key) => [key, priced[key]])),
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }
}

function orderLineIdentityKey(line: CakeOrderLineRequest) {
  return JSON.stringify([
    line.productId, line.cakeSize, line.chocolateType, line.poundAddon, line.cupcakeFinish || '', line.chocolateIcingCount,
    line.vanillaCreamCount, line.partyDecorationCount, line.vanillaCakeSheet, line.vanillaCakeFlavor,
    normalizeVanillaCakePointColor(line.productId, line.vanillaCakePointColor),
    line.individualPackaging === true,
  ])
}

function safeOrderSum(values: number[], invalid: () => never) {
  let total = 0
  for (const value of values) {
    total += value
    if (!Number.isSafeInteger(total)) invalid()
  }
  return total
}

function validateOrderPricing(
  lines: CakeOrderLineResult[],
  aggregates: {
    subtotalCents: number
    discountBasisCents: number
    discountPercent: number
    discountCents: number
    totalPriceCents: number
    individualPackagingPieces?: number
    individualPackagingFeeCents?: number
  },
  eligibleIndexes: number[],
  invalid: () => never,
  allowLegacyPackagingFee = false,
) {
  const canonicalKeys = lines.map(orderLineIdentityKey)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) invalid()
  if (aggregates.discountPercent !== 0 && eligibleIndexes.length === 0) invalid()
  const eligibleSet = new Set(eligibleIndexes)
  if (lines.some((line, index) => line.discountPercent !== (eligibleSet.has(index) ? aggregates.discountPercent : 0))) invalid()
  const expectedBasis = safeOrderSum(eligibleIndexes.map((index) => lines[index].subtotalCents), invalid)
  const numerator = expectedBasis * aggregates.discountPercent
  if (!Number.isSafeInteger(numerator)) invalid()
  const expectedDiscount = Math.round(numerator / 100)
  const allocations = new Array<number>(lines.length).fill(0)
  const ranked = eligibleIndexes.map((index) => {
    const lineNumerator = lines[index].subtotalCents * aggregates.discountPercent
    if (!Number.isSafeInteger(lineNumerator)) invalid()
    allocations[index] = Math.floor(lineNumerator / 100)
    return { index, remainder: lineNumerator % 100, key: canonicalKeys[index] }
  }).sort((left, right) => right.remainder - left.remainder || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
  let remaining = expectedDiscount - safeOrderSum(allocations, invalid)
  for (const candidate of ranked) {
    if (remaining <= 0) break
    allocations[candidate.index] += 1
    remaining -= 1
  }
  if (remaining !== 0 || lines.some((line, index) => line.discountCents !== allocations[index])) invalid()

  const subtotalCents = safeOrderSum(lines.map((line) => line.subtotalCents), invalid)
  const discountCents = safeOrderSum(lines.map((line) => line.discountCents), invalid)
  const totalPriceCents = safeOrderSum(lines.map((line) => line.totalPriceCents), invalid)
  const individualPackagingPieces = safeOrderSum(lines.map((line) => line.individualPackagingPieces || 0), invalid)
  const individualPackagingFeeCents = safeOrderSum(lines.map((line) => line.individualPackagingFeeCents || 0), invalid)
  const selectedPackagingProductSubtotalCents = safeOrderSum(
    lines.filter((line) => line.individualPackaging === true).map((line) => line.subtotalCents),
    invalid,
  )
  const expectedPackagingFeeCents = selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  const legacyPackagingFeeCents = individualPackagingPieces >= 100
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  if (
    aggregates.subtotalCents !== subtotalCents || aggregates.discountBasisCents !== expectedBasis
    || aggregates.discountCents !== discountCents || aggregates.discountCents !== expectedDiscount
    || aggregates.totalPriceCents !== totalPriceCents
    || aggregates.totalPriceCents !== aggregates.subtotalCents - aggregates.discountCents + individualPackagingFeeCents
    || (aggregates.individualPackagingPieces || 0) !== individualPackagingPieces
    || (aggregates.individualPackagingFeeCents || 0) !== individualPackagingFeeCents
    || (individualPackagingFeeCents !== expectedPackagingFeeCents
      && (!allowLegacyPackagingFee || individualPackagingFeeCents !== legacyPackagingFeeCents))
  ) invalid()
}

function toPublicReservation(reservation: PublicReservation): PublicReservation {
  const payload = reservation as PublicReservationPayload
  const product = getProductById(reservation.productId)
  const poundAddon = normalizePoundAddon(product.id, reservation.poundAddon || DEFAULT_POUND_ADDON)
  const topProjection = {
    productId: product.id,
    cakeSize: normalizeStoredCakeSize(reservation.cakeSize),
    chocolateType: normalizeReservationChocolateType(
      product.id,
      reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      poundAddon,
    ),
    poundAddon,
    ...(reservation.cupcakeFinish === undefined ? {} : {
      cupcakeFinish: normalizeCupcakeFinish(product.id, reservation.cupcakeFinish),
    }),
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount),
    ...normalizeCupcakeFinishCounts(product.id, reservation.vanillaCreamCount, reservation.partyDecorationCount),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(product.id, reservation.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(product.id, reservation.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(product.id, reservation.vanillaCakePointColor),
    ...(reservation.individualPackaging === undefined ? {} : {
      individualPackaging: reservation.individualPackaging === true,
    }),
    quantity: normalizeQuantity(reservation.quantity),
  }
  const orderLines = payload.orderLines?.map((line) => normalizePublicOrderLine(line, { allowHistoricalUnitPrice: true }))
  if (payload.orderLines && (!orderLines?.length
    || payload.orderLineCount !== orderLines.length
    || payload.orderItemCount !== safeOrderSum(orderLines.map((line) => line.quantity), () => { throw new Error('INVALID_RESERVATION_RESPONSE') }))) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (orderLines) {
    const first = orderLines[0]
    for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'quantity'] as const) {
      if (topProjection[key] !== first[key]) throw new Error('INVALID_RESERVATION_RESPONSE')
    }
  }

  const aggregateKeys = ['subtotalCents', 'discountBasisCents', 'discountPercent', 'discountCents', 'totalPriceCents'] as const
  const packagingAggregateKeys = ['individualPackagingPieces', 'individualPackagingFeeCents'] as const
  const presentAggregateKeys = aggregateKeys.filter((key) => payload[key] !== undefined)
  const hasPricedLines = Boolean(orderLines?.some((line) => Object.hasOwn(line, 'unitPriceCents')))
  if (hasPricedLines) {
    if (!orderLines?.every((line) => Object.hasOwn(line, 'unitPriceCents')) || presentAggregateKeys.length !== aggregateKeys.length) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    for (const key of aggregateKeys) {
      if (!Number.isSafeInteger(payload[key]) || payload[key]! < 0) throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    if (payload.discountPercent !== 0 && payload.discountPercent !== 5 && payload.discountPercent !== 10) throw new Error('INVALID_RESERVATION_RESPONSE')
    const pricedLines = orderLines as CakeOrderLineResult[]
    const presentPackagingAggregateKeys = packagingAggregateKeys.filter((key) => payload[key] !== undefined)
    const hasPackagedLines = pricedLines.some((line) => Object.hasOwn(line, 'individualPackaging'))
    if (presentPackagingAggregateKeys.length !== (hasPackagedLines ? packagingAggregateKeys.length : 0)) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    const eligibleIndexes = payload.discountPercent === 0
      ? []
      : pricedLines.map((line, index) => line.discountPercent === payload.discountPercent ? index : -1).filter((index) => index >= 0)
    validateOrderPricing(pricedLines, {
      subtotalCents: payload.subtotalCents!,
      discountBasisCents: payload.discountBasisCents!,
      discountPercent: payload.discountPercent!,
      discountCents: payload.discountCents!,
      totalPriceCents: payload.totalPriceCents!,
      ...(hasPackagedLines ? {
        individualPackagingPieces: payload.individualPackagingPieces!,
        individualPackagingFeeCents: payload.individualPackagingFeeCents!,
      } : {}),
    }, eligibleIndexes, () => { throw new Error('INVALID_RESERVATION_RESPONSE') })
  } else if (presentAggregateKeys.length !== 0) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const aggregates = Object.fromEntries([...presentAggregateKeys, ...packagingAggregateKeys.filter((key) => payload[key] !== undefined)].map((key) => [key, payload[key]]))
  return {
    reservationNumber: reservation.reservationNumber,
    ...topProjection,
    pickupDate: reservation.pickupDate,
    pickupTime: reservation.pickupTime,
    cacaoPercent: reservation.cacaoPercent || '기본',
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
    ...(orderLines ? { orderLines, orderLineCount: payload.orderLineCount, orderItemCount: payload.orderItemCount } : {}),
    ...aggregates,
  } as PublicReservation
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
    merged.dailyLimitText = normalizeAuDailyLimitText(merged.dailyLimitText)
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

const STORED_ORDER_MAX_BYTES = 65_535
const PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount',
  'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'quantity', 'unitPriceCents',
  'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
])
const STORED_ORDER_LINE_KEYS = new Set([
  ...PRE_PACKAGING_STORED_ORDER_LINE_KEYS,
  'individualPackaging', 'individualPackagingPieces', 'individualPackagingFeeCents',
])
const PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS = new Set([...PRE_PACKAGING_STORED_ORDER_LINE_KEYS].filter((key) => key !== 'cupcakeFinish'))
const LEGACY_STORED_ORDER_LINE_KEYS = new Set([...PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS].filter((key) => key !== 'vanillaCakePointColor'))
const SAFE_PROMO_LAST4_PATTERN = /^[A-Z0-9]{4}$/
const MANUAL_REVIEW_COUPON_ID_PATTERN = /^manual:[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

function invalidStoredOrder(): never {
  throw new Error('INVALID_STORED_ORDER')
}

function parseAdminStoredOrder(document: AppwriteReservationDocument, firstProjection: Reservation): Pick<
  Reservation,
  'orderLines' | 'orderLineCount' | 'orderItemCount' | 'subtotalCents' | 'discountBasisCents' | 'discountPercent' | 'discountCents' | 'totalPriceCents' | 'individualPackagingPieces' | 'individualPackagingFeeCents'
> | null {
  if (!Object.hasOwn(document, 'orderLinesJson') || document.orderLinesJson == null) return null
  if (typeof document.orderLinesJson !== 'string'
    || new TextEncoder().encode(document.orderLinesJson).byteLength > STORED_ORDER_MAX_BYTES) invalidStoredOrder()
  let payload: unknown
  try {
    payload = JSON.parse(document.orderLinesJson)
  } catch {
    invalidStoredOrder()
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Reflect.ownKeys(payload).length !== 2 || !Object.hasOwn(payload, 'version') || !Object.hasOwn(payload, 'lines')
    || (payload as { version?: unknown }).version !== 1 || !Array.isArray((payload as { lines?: unknown }).lines)
    || !(payload as { lines: unknown[] }).lines.length) invalidStoredOrder()
  const rawLines = (payload as { lines: unknown[] }).lines
  const packagingVersions = new Set<boolean>()
  const orderLines = rawLines.map((rawLine): CakeOrderLineResult => {
    if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) invalidStoredOrder()
    const keys = Reflect.ownKeys(rawLine)
    const hasPackagingFields = keys.length === STORED_ORDER_LINE_KEYS.size
    const hasCupcakeFinish = hasPackagingFields || keys.length === PRE_PACKAGING_STORED_ORDER_LINE_KEYS.size
    packagingVersions.add(hasPackagingFields)
    const allowedKeys = hasPackagingFields
      ? STORED_ORDER_LINE_KEYS
      : hasCupcakeFinish
        ? PRE_PACKAGING_STORED_ORDER_LINE_KEYS
        : keys.length === PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS.size
        ? PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS
        : LEGACY_STORED_ORDER_LINE_KEYS
    if (keys.length !== allowedKeys.size
      || !keys.every((key) => typeof key === 'string' && allowedKeys.has(key))) invalidStoredOrder()
    try {
      const normalized = normalizePublicOrderLine(rawLine as CakeOrderLineResult, {
        legacyCupcakeCounts: !hasCupcakeFinish,
        allowHistoricalUnitPrice: true,
      })
      if (!Object.hasOwn(normalized, 'unitPriceCents')) invalidStoredOrder()
      return normalized as CakeOrderLineResult
    } catch {
      invalidStoredOrder()
    }
  })
  if (packagingVersions.size !== 1) invalidStoredOrder()
  const hasPackagingFields = packagingVersions.has(true)
  const safeSum = (values: number[]) => {
    let sum = 0
    for (const value of values) {
      sum += value
      if (!Number.isSafeInteger(sum)) invalidStoredOrder()
    }
    return sum
  }
  const orderItemCount = safeSum(orderLines.map((line) => line.quantity))
  const subtotalCents = safeSum(orderLines.map((line) => line.subtotalCents))
  const discountCents = safeSum(orderLines.map((line) => line.discountCents))
  const totalPriceCents = safeSum(orderLines.map((line) => line.totalPriceCents))
  const individualPackagingPieces = safeSum(orderLines.map((line) => line.individualPackagingPieces || 0))
  const individualPackagingFeeCents = safeSum(orderLines.map((line) => line.individualPackagingFeeCents || 0))
  if (
    document.orderLineCount !== orderLines.length || document.orderItemCount !== orderItemCount
    || document.subtotalCents !== subtotalCents || document.discountCents !== discountCents
    || document.totalPriceCents !== totalPriceCents
    || (hasPackagingFields && (
      document.individualPackagingPieces !== individualPackagingPieces
      || document.individualPackagingFeeCents !== individualPackagingFeeCents
    ))
    || !Number.isSafeInteger(document.discountBasisCents) || Number(document.discountBasisCents) < 0
    || ![0, 5, 10].includes(Number(document.discountPercent))
  ) invalidStoredOrder()

  const aggregateDiscountPercent = Number(document.discountPercent)
  const hasReviewCoupon = document.reviewCouponId != null
  const hasPromoLast4 = document.appliedPromoCodeLast4 != null
  let eligibleIndexes: number[] = []
  if (hasReviewCoupon) {
    if (
      typeof document.reviewCouponId !== 'string' || !document.reviewCouponId
      || !hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string'
      || !SAFE_PROMO_LAST4_PATTERN.test(document.appliedPromoCodeLast4)
      || (aggregateDiscountPercent !== 5 && aggregateDiscountPercent !== 10)
      || (document.reviewCouponId.startsWith('manual:')
        && (!MANUAL_REVIEW_COUPON_ID_PATTERN.test(document.reviewCouponId) || aggregateDiscountPercent !== 5))
    ) invalidStoredOrder()
    eligibleIndexes = orderLines.map((_, index) => index)
  } else if (aggregateDiscountPercent === 10) {
    if (!hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string'
      || !SAFE_PROMO_LAST4_PATTERN.test(document.appliedPromoCodeLast4)) invalidStoredOrder()
    const staticCode = [PROMO_CODE, LEMON_PROMO_CODE]
      .find((code) => code.slice(-4).toUpperCase() === document.appliedPromoCodeLast4)
    const createdAt = new Date(document.createdAt || document.$createdAt || '')
    if (!staticCode || !Number.isFinite(createdAt.getTime())) invalidStoredOrder()
    eligibleIndexes = orderLines
      .map((line, index) => getValidPromoCode(line.productId, staticCode, createdAt) === staticCode ? index : -1)
      .filter((index) => index >= 0)
    if (eligibleIndexes.length === 0) invalidStoredOrder()
  } else if (aggregateDiscountPercent === 0) {
    if (hasReviewCoupon || hasPromoLast4) invalidStoredOrder()
  } else {
    invalidStoredOrder()
  }

  validateOrderPricing(orderLines, {
    subtotalCents,
    discountBasisCents: Number(document.discountBasisCents),
    discountPercent: aggregateDiscountPercent,
    discountCents,
    totalPriceCents,
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }, eligibleIndexes, invalidStoredOrder, true)
  const exactTotal = totalPriceCents / 100
  if (document.totalPrice !== exactTotal && document.totalPrice !== Math.round(exactTotal)) invalidStoredOrder()

  const first = orderLines[0]
  for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity'] as const) {
    if (firstProjection[key] !== first[key]) invalidStoredOrder()
  }
  if (Object.hasOwn(first, 'cupcakeFinish') !== Object.hasOwn(firstProjection, 'cupcakeFinish')
    || (Object.hasOwn(first, 'cupcakeFinish') && firstProjection.cupcakeFinish !== first.cupcakeFinish)) invalidStoredOrder()
  return {
    orderLines,
    orderLineCount: orderLines.length,
    orderItemCount,
    subtotalCents,
    discountBasisCents: document.discountBasisCents,
    discountPercent: document.discountPercent,
    discountCents,
    totalPriceCents,
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }
}

export function toReservation(document: AppwriteReservationDocument): Reservation {
  const reservation: Reservation = {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    customerEmail: typeof document.customerEmail === 'string' ? document.customerEmail.trim().toLowerCase() : '',
    productId: getProductById(document.productId).id,
    cakeSize: normalizeStoredCakeSize(document.cakeSize),
    poundAddon: normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    chocolateType: normalizeReservationChocolateType(
      getProductById(document.productId).id,
      document.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    ),
    ...(document.cupcakeFinish === undefined ? {} : {
      cupcakeFinish: normalizeCupcakeFinish(getProductById(document.productId).id, document.cupcakeFinish),
    }),
    chocolateIcingCount: normalizeChocolateIcingCount(
      getProductById(document.productId).id,
      document.chocolateIcingCount,
    ),
    ...normalizeCupcakeFinishCounts(
      getProductById(document.productId).id,
      document.vanillaCreamCount,
      document.partyDecorationCount,
    ),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(getProductById(document.productId).id, document.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(getProductById(document.productId).id, document.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(getProductById(document.productId).id, document.vanillaCakePointColor),
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
    subtotalCents: document.subtotalCents,
    discountPercent: document.discountPercent,
    discountCents: document.discountCents,
    discountBasisCents: document.discountBasisCents,
    appliedPromoCodeLast4: document.appliedPromoCodeLast4,
    reviewCouponId: document.reviewCouponId,
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt || '',
    updatedAt: document.updatedAt || document.$updatedAt || '',
  }
  const storedOrder = parseAdminStoredOrder(document, reservation)
  return storedOrder
    ? {
        ...reservation,
        ...storedOrder,
        ...(storedOrder.orderLines?.[0]?.individualPackaging !== undefined ? {
          individualPackaging: storedOrder.orderLines[0].individualPackaging,
        } : {}),
        totalPrice: fromCurrencyCents(storedOrder.totalPriceCents ?? 0),
      }
    : reservation
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
      (reservation.customerEmail || '').toLowerCase().includes(search) ||
      reservation.reservationNumber.toLowerCase().includes(search)
    )
  })
}

function toClassReservation(document: AppwriteClassReservationDocument): ClassReservation {
  const extensionMinutes = document.extensionMinutes === 30 ? 30 : 0
  const coursePlan = document.coursePlan || 'basic'
  const hasProgramFields = document.coursePlan !== undefined
  const totalPriceCents = document.totalPriceCents ?? Math.round(Number(document.totalPrice || 0) * 100)
  return {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    classType: document.classType || CLASS_TYPE_ID,
    classDate: document.classDate,
    classTime: document.classTime,
    coursePlan,
    extensionMinutes,
    durationMinutes: Number(document.durationMinutes || (hasProgramFields ? (coursePlan === 'advanced' ? 120 : 90) + extensionMinutes : 120)),
    advancedClassDate: document.advancedClassDate || undefined,
    advancedClassTime: document.advancedClassTime || undefined,
    advancedExtensionMinutes: document.advancedExtensionMinutes === 30 ? 30 : 0,
    advancedDurationMinutes: document.advancedClassDate ? Number(document.advancedDurationMinutes || 120) : undefined,
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
    totalPrice: totalPriceCents / 100,
    totalPriceCents,
    subtotalCents: document.subtotalCents ?? totalPriceCents,
    discountPercent: Number(document.discountPercent || 0),
    discountCents: Number(document.discountCents || 0),
    depositAmount: Number(document.depositAmount || 0),
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt || '',
    updatedAt: document.updatedAt || document.$updatedAt || '',
  }
}

function readLocalClassReservations(): ClassReservation[] {
  const rows = JSON.parse(localStorage.getItem(LOCAL_CLASS_RESERVATIONS_KEY) || '[]') as ClassReservation[]
  return rows.map((row) => toClassReservation({ ...row, $id: row.id } as AppwriteClassReservationDocument))
}

function writeLocalClassReservations(reservations: ClassReservation[]) {
  localStorage.setItem(LOCAL_CLASS_RESERVATIONS_KEY, JSON.stringify(reservations))
}

function classReservationSlots(reservation: Pick<ClassReservation,
  'classDate' | 'classTime' | 'durationMinutes' | 'coursePlan' | 'advancedClassDate' | 'advancedClassTime' | 'advancedDurationMinutes'
>): Exclude<ClassBookedSlot, string>[] {
  return [
    { classDate: reservation.classDate, classTime: reservation.classTime, durationMinutes: reservation.durationMinutes },
    ...(reservation.coursePlan === 'basic-advanced-package' && reservation.advancedClassDate && reservation.advancedClassTime
      ? [{
          classDate: reservation.advancedClassDate,
          classTime: reservation.advancedClassTime,
          durationMinutes: reservation.advancedDurationMinutes,
        }]
      : []),
  ]
}

function readLocalClassBookedSlots(): ClassBookedSlot[] {
  const storedSlots = JSON.parse(localStorage.getItem(LOCAL_CLASS_BOOKED_DATES_KEY) || '[]') as Array<ClassBookedSlot | { classDate?: string; classTime?: string; durationMinutes?: number }>
  const normalizedStoredSlots = storedSlots
    .map((slot) => (typeof slot === 'string' ? slot : slot.classDate ? {
      classDate: slot.classDate,
      classTime: slot.classTime || '',
      durationMinutes: slot.durationMinutes,
    } : null))
    .filter(Boolean) as ClassBookedSlot[]
  const activeReservationSlots = readLocalClassReservations()
    .filter((reservation) => reservation.status !== 'Cancelled')
    .flatMap(classReservationSlots)
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

async function createClassBookedSlot(classDate: string, classTime: string, durationMinutes = 120) {
  if (!isAppwriteConfigured) {
    const bookedSlots = readLocalClassBookedSlots()
    const alreadyBooked = bookedSlots.some((slot) => {
      if (typeof slot === 'string') return slot === classDate
      return slot.classDate === classDate && slot.classTime === classTime
    })
    if (alreadyBooked) throw new Error('CLASS_SESSION_UNAVAILABLE')
    writeLocalClassBookedSlots([...bookedSlots, { classDate, classTime, durationMinutes }])
    return
  }

  try {
    await databases.createDocument(
      appwriteConfig.classReservationsDatabaseId,
      appwriteConfig.classBookedDatesCollectionId,
      ID.unique(),
      { classDate, classTime, durationMinutes, createdAt: new Date().toISOString() },
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

export async function createCakeOrder(input: CakeOrderRequest): Promise<CakeOrderReservation> {
  if (!await supportsCakeOrderLines()) throw new Error(CAKE_ORDER_LINES_UNAVAILABLE_ERROR)
  if (!isCakePickupServiceTime(input.pickupDate, input.pickupTime)) {
    throw new Error(PICKUP_TIME_UNAVAILABLE_ERROR)
  }
  if (!isPickupTimeAllowed(input.pickupDate, input.pickupTime)) {
    throw new Error(PICKUP_TIME_TOO_SOON_ERROR)
  }
  return executeReservationApi<CakeOrderReservation>('create-cake', buildCakeOrderRequest(input), parseCakeOrderResult)
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  const customerEmail = normalizeCustomerEmail(input.customerEmail)
  if (!isCakePickupServiceTime(input.pickupDate, input.pickupTime)) {
    throw new Error(PICKUP_TIME_UNAVAILABLE_ERROR)
  }
  if (!isPickupTimeAllowed(input.pickupDate, input.pickupTime)) {
    throw new Error(PICKUP_TIME_TOO_SOON_ERROR)
  }

  if (shouldUseReservationApi('all')) {
    const reservation = await executeReservationApi<Reservation>('create-cake', buildCakeReservationRequest(input), parseCakeReservationResult)
    return normalizeReservation(reservation)
  }

  if (normalizeReviewCouponCode(input.promoCode)) throw new Error('PROMO_CODE_SERVER_REQUIRED')

  const now = new Date().toISOString()
  const reservationNumber = generateReservationNumber()
  const product = getProductById(input.productId || DEFAULT_PRODUCT_ID)
  const cacaoPercent = product.usesCacaoOptions ? input.cacaoPercent : '기본'
  const cakeSize = normalizeCakeSize(product.id, input.cakeSize)
  const poundAddon = normalizePoundAddon(product.id, input.poundAddon)
  const chocolateType = normalizeReservationChocolateType(product.id, input.chocolateType, poundAddon)
  const chocolateIcingCount = normalizeChocolateIcingCount(product.id, input.chocolateIcingCount)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(product.id, 0, 0)
  const cupcakeFinish = normalizeCupcakeFinish(product.id, input.cupcakeFinish || DEFAULT_CUPCAKE_FINISH)
  const vanillaCakeSheet = normalizeVanillaCakeSheet(product.id, input.vanillaCakeSheet)
  const vanillaCakeFlavor = normalizeVanillaCakeFlavor(product.id, input.vanillaCakeFlavor)
  const vanillaCakePointColor = normalizeVanillaCakePointColor(product.id, input.vanillaCakePointColor)
  const quantity = normalizeQuantity(input.quantity)
  const originalTotalPrice = getReservationPrice(
    product.id,
    { cacaoPercent, cakeSize, chocolateType, poundAddon, cupcakeFinish, chocolateIcingCount, ...cupcakeFinishCounts },
    quantity,
  )
  const totalPrice = applyPromoDiscount(originalTotalPrice, product.id, input.promoCode)
  const totalPriceCents = toCurrencyCents(totalPrice)
  const subtotalCents = toCurrencyCents(originalTotalPrice)
  const discountCents = Math.max(0, subtotalCents - totalPriceCents)
  const appliedStaticPromo = getValidPromoCode(product.id, input.promoCode)
  const data = {
    reservationNumber,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerEmail,
    productId: product.id,
    cakeSize,
    chocolateType,
    poundAddon,
    cupcakeFinish,
    chocolateIcingCount,
    ...cupcakeFinishCounts,
    vanillaCakeSheet,
    vanillaCakeFlavor,
    vanillaCakePointColor,
    quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent,
    requestNote: buildPromoRequestNote(input.requestNote, product.id, originalTotalPrice, totalPrice, input.promoCode),
    status: '예약신청' as ReservationStatus,
    paymentStatus: '입금대기' as PaymentStatus,
    totalPrice,
    totalPriceCents,
    subtotalCents,
    discountPercent: discountCents > 0 ? 10 : 0,
    discountCents,
    ...(appliedStaticPromo ? { appliedPromoCodeLast4: appliedStaticPromo.slice(-4).toUpperCase() } : {}),
    adminMemo: '',
    createdAt: now,
    updatedAt: now,
  }

  if (!isAppwriteConfigured) {
    const reservation: Reservation = {
      id: crypto.randomUUID(),
      ...data,
      promotionKind: discountCents > 0 ? 'static' : 'none',
    }
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
  const reservation = toReservation(document as unknown as AppwriteReservationDocument)
  return { ...reservation, promotionKind: discountCents > 0 ? 'static' : 'none' }
}

export function toReservationList(documents: AppwriteReservationDocument[]): Reservation[] {
  const reservations: Reservation[] = []
  for (const document of documents) {
    try {
      reservations.push(toReservation(document))
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'INVALID_STORED_ORDER') throw error
    }
  }
  return reservations
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
  return applyLocalFilters(toReservationList(documents as unknown as AppwriteReservationDocument[]), {
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

type ReservationUpdate = Partial<Pick<Reservation,
  | 'status'
  | 'paymentStatus'
  | 'adminMemo'
  | 'productId'
  | 'cakeSize'
  | 'chocolateType'
  | 'poundAddon'
  | 'cupcakeFinish'
  | 'chocolateIcingCount'
  | 'vanillaCreamCount'
  | 'partyDecorationCount'
  | 'quantity'
  | 'pickupDate'
  | 'pickupTime'
  | 'cacaoPercent'
  | 'totalPrice'
  | 'totalPriceCents'
>>

const RESERVATION_UPDATE_KEYS = new Set<string>([
  'status', 'paymentStatus', 'adminMemo', 'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish',
  'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'quantity', 'pickupDate',
  'pickupTime', 'cacaoPercent', 'totalPrice', 'totalPriceCents',
])

function snapshotReservationUpdate(updates: ReservationUpdate): ReservationUpdate {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('INVALID_RESERVATION_UPDATE')
  }
  const snapshot: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(updates)) {
    if (typeof key !== 'string' || !RESERVATION_UPDATE_KEYS.has(key)) {
      throw new Error('INVALID_RESERVATION_UPDATE')
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(updates, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new Error('INVALID_RESERVATION_UPDATE')
    }
    snapshot[key] = descriptor.value
  }
  return snapshot as ReservationUpdate
}

export async function updateReservation(
  id: string,
  updates: ReservationUpdate,
): Promise<Reservation> {
  const updateSnapshot = snapshotReservationUpdate(updates)
  const nextUpdates = { ...updateSnapshot, updatedAt: new Date().toISOString() }

  if (!isAppwriteConfigured) {
    const reservations = readLocalReservations()
    const index = reservations.findIndex((reservation) => reservation.id === id)
    if (index < 0) throw new Error('예약을 찾을 수 없습니다.')
    assertReservationRepricingAllowed(reservations[index], updateSnapshot)
    reservations[index] = { ...reservations[index], ...nextUpdates }
    writeLocalReservations(reservations)
    return reservations[index]
  }

  const currentDocument = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    id,
  )
  assertReservationRepricingAllowed(toReservation(currentDocument as unknown as AppwriteReservationDocument), updateSnapshot)

  const document = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.reservationsCollectionId,
    id,
    nextUpdates,
  )
  return toReservation(document as unknown as AppwriteReservationDocument)
}

export async function listCakePickupOpenings(pickupDate?: string): Promise<CakePickupOpening[]> {
  if (!isAppwriteConfigured) {
    const openings = readLocalCakePickupOpenings()
    return pickupDate === undefined ? openings : openings.filter((opening) => opening.pickupDate === pickupDate)
  }

  try {
    const queries = pickupDate === undefined
      ? [Query.greaterThanEqual('pickupDate', todayInputValue()), Query.orderAsc('pickupDate')]
      : [Query.equal('pickupDate', pickupDate)]
    const documents = await listAllDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.cakePickupOpeningsCollectionId,
      queries,
    )
    return documents
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
      return { classDate: slot.classDate, classTime: slot.classTime || '', durationMinutes: slot.durationMinutes }
    })
    .filter(Boolean) as ClassBookedSlot[]
}

export async function createClassReservation(input: ClassReservationInput): Promise<ClassReservation> {
  // Configured deployments must always use the authoritative Function for kids classes.
  // The direct/local path below exists only for an unconfigured local preview.
  if (isAppwriteConfigured) {
    return executeReservationApi<ClassReservation>('create-class', input)
  }

  const now = new Date().toISOString()
  const coursePlan = input.coursePlan || 'basic'
  const extensionMinutes: ClassReservation['extensionMinutes'] = input.extensionMinutes === 30 ? 30 : 0
  const advancedExtensionMinutes: ClassReservation['advancedExtensionMinutes'] = input.advancedExtensionMinutes === 30 ? 30 : 0
  const pricing = calculateClassPricing({ coursePlan, bookingType: input.bookingType, extensionMinutes, advancedExtensionMinutes })
  const data = {
    reservationNumber: generateClassReservationNumber(),
    classType: input.classType,
    classDate: input.classDate,
    classTime: input.classTime,
    coursePlan,
    extensionMinutes,
    durationMinutes: getClassDurationMinutes(coursePlan === 'advanced' ? 'advanced' : 'basic', extensionMinutes),
    ...(coursePlan === 'basic-advanced-package' ? {
      advancedClassDate: input.advancedClassDate,
      advancedClassTime: input.advancedClassTime,
      advancedExtensionMinutes,
      advancedDurationMinutes: getClassDurationMinutes('advanced', advancedExtensionMinutes),
    } : {}),
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
    totalPrice: pricing.totalPriceCents / 100,
    ...pricing,
    depositAmount: 0,
    adminMemo: '',
    createdAt: now,
    updatedAt: now,
  }

  const previousSlots = readLocalClassBookedSlots()
  try {
    for (const slot of classReservationSlots(data)) {
      await createClassBookedSlot(slot.classDate, slot.classTime, slot.durationMinutes)
    }
    const reservation: ClassReservation = { id: crypto.randomUUID(), ...data }
    writeLocalClassReservations([reservation, ...readLocalClassReservations()])
    return reservation
  } catch (error) {
    writeLocalClassBookedSlots(previousSlots)
    throw error
  }
}

export async function listClassReservations(filters?: ClassReservationFilters): Promise<ClassReservation[]> {
  if (!isAppwriteConfigured) {
    return filterClassReservationsForAdmin(readLocalClassReservations(), filters).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const baseQueries = [Query.orderDesc('createdAt')]
  if (filters?.status) baseQueries.push(Query.equal('status', filters.status))
  if (filters?.paymentStatus) baseQueries.push(Query.equal('paymentStatus', filters.paymentStatus))

  const documentGroups = filters?.classDate
    ? await Promise.all([
      listAllDocuments(
        appwriteConfig.classReservationsDatabaseId,
        appwriteConfig.classReservationsCollectionId,
        [...baseQueries, Query.equal('classDate', filters.classDate)],
      ),
      listAllDocuments(
        appwriteConfig.classReservationsDatabaseId,
        appwriteConfig.classReservationsCollectionId,
        [...baseQueries, Query.equal('advancedClassDate', filters.classDate)],
      ),
    ])
    : [await listAllDocuments(
      appwriteConfig.classReservationsDatabaseId,
      appwriteConfig.classReservationsCollectionId,
      baseQueries,
    )]
  const documents = Array.from(new Map(
    documentGroups.flat().map((document) => [document.$id, document]),
  ).values())
  return filterClassReservationsForAdmin(
    documents.map((document) => toClassReservation(document as unknown as AppwriteClassReservationDocument)),
    filters,
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
      const previousSlots = readLocalClassBookedSlots()
      try {
        for (const slot of classReservationSlots(previous)) {
          await createClassBookedSlot(slot.classDate, slot.classTime, slot.durationMinutes)
        }
      } catch (error) {
        writeLocalClassBookedSlots(previousSlots)
        throw error
      }
    }
    reservations[index] = { ...reservations[index], ...nextUpdates }
    writeLocalClassReservations(reservations)
    if (previous.status !== 'Cancelled' && nextStatus === 'Cancelled') {
      for (const slot of classReservationSlots(previous)) await deleteClassBookedSlot(slot.classDate, slot.classTime)
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

  const currentReservation = toClassReservation(current)
  const slots = classReservationSlots(currentReservation)
  const slotDocuments = isCancelling
    ? await Promise.all(slots.map((slot) => findClassBookedSlotDocument(slot.classDate, slot.classTime)))
    : []
  const transaction = await databases.createTransaction()
  try {
    if (isReactivating) {
      for (const slot of slots) {
        await databases.createDocument({
          databaseId: appwriteConfig.classReservationsDatabaseId,
          collectionId: appwriteConfig.classBookedDatesCollectionId,
          documentId: ID.unique(),
          data: { ...slot, createdAt: new Date().toISOString() },
          transactionId: transaction.$id,
        })
      }
    }
    await databases.updateDocument({
      databaseId: appwriteConfig.classReservationsDatabaseId,
      collectionId: appwriteConfig.classReservationsCollectionId,
      documentId: id,
      data: nextUpdates,
      transactionId: transaction.$id,
    })
    if (isCancelling) {
      for (const slotDocument of slotDocuments.filter(Boolean)) {
        await databases.deleteDocument({
          databaseId: appwriteConfig.classReservationsDatabaseId,
          collectionId: appwriteConfig.classBookedDatesCollectionId,
          documentId: slotDocument!.$id,
          transactionId: transaction.$id,
        })
      }
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
