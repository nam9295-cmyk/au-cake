import {
  getProductById,
  getReservationPrice,
  getValidPromoCode,
  isCupcakeProduct,
  MAX_RESERVATION_QUANTITY,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinish,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  normalizeStoredVanillaCakeFlavor,
  normalizeStoredVanillaCakeSheet,
  PRODUCTS,
} from './constants.js'
import { getCakeServingProfile, isHistoricalWholeCakeSize, isHistoricalWholeCakeUnitPrice } from './cake-serving.js'
import { isValidPhone } from './utils.js'
import { isActiveCakeOrderProductId, isStoredCakeOrderProductId } from '../../appwrite-functions/reservation-api/src/active-cake-products.js'
import {
  INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS,
  INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE,
  getIndividualPackagingPieceCount,
  isIndividualPackagingEligibleProduct,
} from './individual-packaging.js'
import { CHOCOLATE_EXTRA_OPTIONS, isChocolateExtraEligibleProduct, normalizeChocolateExtra } from './chocolate-extras.js'
import type { CakeOrderLineRequest, CakeOrderLineResult, CakeOrderRequest, CakeOrderReservation, CakeSize, CacaoPercent, ChocolateExtra, ChocolateType, CupcakeFinish, PoundAddon, ProductId, Reservation, ReservationApiCapabilities, ReservationInput, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet } from './types.js'

const REVIEW_COUPON_ANIMALS = ['FOX', 'CAT', 'DOG', 'OWL', 'PIG', 'BEE', 'COW', 'CUB', 'EMU', 'HEN', 'KOI', 'PUP', 'RAM', 'YAK', 'APE']
const REVIEW_COUPON_FRUITS = ['KIWI', 'FIG', 'LIME', 'PEAR', 'PLUM', 'APPLE', 'GRAPE', 'GUAVA', 'LEMON', 'MANGO', 'MELON', 'PEACH']
const REVIEW_COUPON_PATTERN = new RegExp(
  `^(?:${REVIEW_COUPON_ANIMALS.join('|')})(?:${REVIEW_COUPON_FRUITS.join('|')})[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$`,
)
const MANUAL_REVIEW_COUPON_PATTERN = /^JENNIE[A-Z0-9]{5}$/
const SAFE_LAST4_PATTERN = /^[A-Z0-9]{4}$/
const VALID_CAKE_SIZES = new Set<CakeSize>(['mini', 'size-1', '6in', '8in', '10in', '15cm', '17cm', '19cm', '22cm'])
const VALID_CHOCOLATE_TYPES = new Set<ChocolateType>(['dark', 'milk'])
const VALID_POUND_ADDONS = new Set<PoundAddon>(['none', 'extra-chocolate', 'vanilla-cream'])
const VALID_CUPCAKE_FINISHES = new Set<CupcakeFinish>(['basic', 'vanilla-fresh-cream', 'chocolate-buttercream'])
const VALID_CHOCOLATE_EXTRAS = new Set<ChocolateExtra>(CHOCOLATE_EXTRA_OPTIONS.map((option) => option.value))
const VALID_VANILLA_CAKE_SHEETS = new Set<VanillaCakeSheet>(['vanilla', 'chocolate'])
const VALID_VANILLA_CAKE_FLAVORS = new Set<VanillaCakeFlavor>(['plain', 'triple-berry', 'nutella-chocolate-chip'])
const VALID_VANILLA_CAKE_POINT_COLORS = new Set<VanillaCakePointColor>(['pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'])
const VALID_CACAO = new Set<CacaoPercent>(['기본', '70', '80.5', '100'])
const VALID_STATUSES = new Set<Reservation['status']>(['예약신청', '예약확정', '픽업완료', '취소'])
const VALID_PAYMENT_STATUSES = new Set<Reservation['paymentStatus']>(['입금대기', '입금확인', '현장결제', '환불필요'])

export type PromoEntryState =
  | { kind: 'empty'; normalizedCode: ''; discountPercent: 0 }
  | { kind: 'static-valid'; normalizedCode: string; discountPercent: 10 }
  | { kind: 'review-pending'; normalizedCode: string; discountPercent: 5 | 10 | null }
  | { kind: 'invalid'; normalizedCode: string; discountPercent: 0 }

export function normalizeReviewCouponCode(value?: string): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return REVIEW_COUPON_PATTERN.test(normalized) || MANUAL_REVIEW_COUPON_PATTERN.test(normalized) ? normalized : null
}

export function shouldShowPromoInput(orderKind: 'cake' | 'class', productId?: ProductId): boolean {
  return orderKind === 'cake' && productId !== undefined
}

export function getPromoEntryState(
  productId: ProductId,
  value?: string,
  now = new Date(),
  reviewRewardPercent?: 5 | 10 | null,
): PromoEntryState {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return { kind: 'empty', normalizedCode: '', discountPercent: 0 }

  const staticCode = getValidPromoCode(productId, trimmed, now)
  if (staticCode) return { kind: 'static-valid', normalizedCode: staticCode, discountPercent: 10 }

  const reviewCode = normalizeReviewCouponCode(trimmed)
  if (reviewCode) {
    const isManualCoupon = MANUAL_REVIEW_COUPON_PATTERN.test(reviewCode)
    return {
      kind: 'review-pending',
      normalizedCode: reviewCode,
      discountPercent: isManualCoupon
        ? 5
        : reviewRewardPercent === 5 || reviewRewardPercent === 10
          ? reviewRewardPercent
          : null,
    }
  }

  return { kind: 'invalid', normalizedCode: trimmed, discountPercent: 0 }
}

export function getPromoPriceDisplay(currentPrice: number, promo: PromoEntryState): {
  finalPrice: number
  estimatedPrice: number | null
} {
  if (promo.kind === 'review-pending') {
    const estimatedPrice = promo.discountPercent === null
      ? null
      : Math.max(0, Math.round(currentPrice * 100 * (1 - promo.discountPercent / 100)) / 100)
    return { finalPrice: currentPrice, estimatedPrice }
  }
  const discountedPrice = Math.max(0, Math.round(currentPrice * 100 * (1 - promo.discountPercent / 100)) / 100)
  if (promo.kind === 'static-valid') return { finalPrice: discountedPrice, estimatedPrice: null }
  return { finalPrice: currentPrice, estimatedPrice: null }
}

export function getDemoReviewPricingAudit(currentPrice: number, promo: PromoEntryState): ReservationPricingAudit | null {
  if (promo.kind !== 'review-pending' || promo.discountPercent === null) return null
  const subtotalCents = Math.max(0, Math.round(currentPrice * 100))
  const discountCents = Math.round(subtotalCents * promo.discountPercent / 100)
  return {
    subtotalCents,
    discountPercent: promo.discountPercent,
    discountCents,
    totalPriceCents: subtotalCents - discountCents,
    appliedPromoCodeLast4: promo.normalizedCode.slice(-4),
  }
}

export type ReviewCouponHandoff = {
  offer(value: string): boolean
  consume(): string
  clear(): void
}

export function createReviewCouponHandoff(): ReviewCouponHandoff {
  let pending = ''
  return {
    offer(value) {
      pending = normalizeReviewCouponCode(value) || ''
      return pending !== ''
    },
    consume() {
      const value = pending
      pending = ''
      return value
    },
    clear() {
      pending = ''
    },
  }
}

export function promoErrorMessage(code: string, language: 'en' | 'ko'): string | null {
  if (code.startsWith('PROMO_CODE_')) {
    return language === 'ko'
      ? '이 프로모 또는 후기 리워드 코드는 유효하지 않거나, 사용할 수 없거나, 만료되었습니다.'
      : 'This promo or review reward code is invalid, unavailable, or expired.'
  }
  return null
}

export type ReservationPricingAudit = {
  subtotalCents: number
  discountPercent: 0 | 5 | 10
  discountCents: number
  totalPriceCents: number
  appliedPromoCodeLast4: string
}

function invalidResponse(): never {
  throw new Error('RESERVATION_API_INVALID_RESPONSE')
}

function nonnegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalidResponse()
  return Number(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== 'string') return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return Boolean(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value'))
  })
}

function readPlainDataRecordSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key !== 'string')) return null
  const snapshot: Record<string, unknown> = Object.create(null)
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function readExactPlainDataRecordSnapshot(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  const snapshot = readPlainDataRecordSnapshot(value)
  if (!snapshot) return null
  const keys = Object.keys(snapshot)
  return keys.length === fields.length && fields.every((key) => Object.hasOwn(snapshot, key)) ? snapshot : null
}

function hasOwnDataFields(row: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(row, key)
    return Boolean(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value'))
  })
}

function readDensePlainDataArray(value: unknown, minimumLength: number): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
  if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) return null
  const length = lengthDescriptor.value
  if (!Number.isSafeInteger(length) || length < minimumLength) return null
  const keys = Reflect.ownKeys(value)
  if (keys.length !== length + 1 || !keys.includes('length')) return null

  const result = new Array<unknown>(length)
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
    result[index] = descriptor.value
  }
  return result
}

export function getReservationPricingAudit(value: unknown): ReservationPricingAudit {
  if (!isPlainDataRecord(value) || !hasOwnDataFields(value, [
    'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
  ])) invalidResponse()
  const reservation = value as Record<string, unknown>
  const subtotalCents = nonnegativeInteger(reservation.subtotalCents)
  const discountCents = nonnegativeInteger(reservation.discountCents)
  const totalPriceCents = nonnegativeInteger(reservation.totalPriceCents)
  const discountPercent = reservation.discountPercent
  if (discountPercent !== 0 && discountPercent !== 5 && discountPercent !== 10) invalidResponse()
  const appliedPromoCodeLast4 = reservation.appliedPromoCodeLast4 === undefined
    ? ''
    : typeof reservation.appliedPromoCodeLast4 === 'string'
      ? reservation.appliedPromoCodeLast4.toUpperCase()
      : invalidResponse()
  if (subtotalCents - discountCents !== totalPriceCents) invalidResponse()
  if (discountCents !== Math.round(subtotalCents * Number(discountPercent) / 100)) invalidResponse()
  if (discountPercent === 0 && (discountCents !== 0 || appliedPromoCodeLast4 !== '')) invalidResponse()
  if (discountPercent !== 0 && (discountCents <= 0 || !SAFE_LAST4_PATTERN.test(appliedPromoCodeLast4))) invalidResponse()
  return { subtotalCents, discountPercent, discountCents, totalPriceCents, appliedPromoCodeLast4 }
}

export function getOptionalReservationPricingAudit(value: unknown): ReservationPricingAudit | null {
  if (!isPlainDataRecord(value)) return null
  const row = value as Record<string, unknown>
  const required = ['subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents']
  if (!required.every((key) => row[key] !== undefined)) return null
  try {
    return getReservationPricingAudit(row)
  } catch {
    return null
  }
}

export function buildCakeReservationRequest(input: ReservationInput): ReservationInput {
  if (getCakeServingProfile(input.productId) === 'genoise') {
    const request = {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail.trim().toLowerCase(),
      productId: input.productId,
      cakeSize: input.cakeSize,
      quantity: input.quantity,
      pickupDate: input.pickupDate,
      pickupTime: input.pickupTime,
      requestNote: input.requestNote,
      privacyConsent: input.privacyConsent,
      requestId: input.requestId,
      website: input.website,
    } as ReservationInput
    const promoCode = typeof input.promoCode === 'string' ? input.promoCode.trim() : ''
    return promoCode ? { ...request, promoCode } : request
  }
  const request: ReservationInput = {
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    productId: input.productId,
    cakeSize: input.cakeSize,
    chocolateType: input.chocolateType,
    poundAddon: input.poundAddon,
    ...(isCupcakeProduct(input.productId) ? { cupcakeFinish: input.cupcakeFinish } : {}),
    ...(isChocolateExtraEligibleProduct(input.productId) ? {
      chocolateExtra: normalizeChocolateExtra(input.productId, input.chocolateExtra),
    } : {}),
    chocolateIcingCount: input.chocolateIcingCount,
    vanillaCreamCount: input.vanillaCreamCount,
    partyDecorationCount: input.partyDecorationCount,
    vanillaCakeSheet: normalizeVanillaCakeSheet(input.productId, input.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeVanillaCakeFlavor(input.productId, input.vanillaCakeFlavor),
    ...(input.vanillaCakePointColor ? {
      vanillaCakePointColor: normalizeVanillaCakePointColor(input.productId, input.vanillaCakePointColor),
    } : {}),
    quantity: input.quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent: input.cacaoPercent,
    requestNote: input.requestNote,
    privacyConsent: input.privacyConsent,
    requestId: input.requestId,
    website: input.website,
  }
  const promoDescriptor = Object.getOwnPropertyDescriptor(input, 'promoCode')
  const promoCode = promoDescriptor && Object.prototype.hasOwnProperty.call(promoDescriptor, 'value')
    && typeof promoDescriptor.value === 'string'
    ? promoDescriptor.value.trim()
    : ''
  return promoCode ? { ...request, promoCode } : request
}

export function parseReservationApiCapabilities(value: unknown): ReservationApiCapabilities {
  const row = readExactPlainDataRecordSnapshot(value, ['status', 'capabilities'])
  if (!row || row.status !== 'ready') invalidResponse()
  const capabilities = readExactPlainDataRecordSnapshot(row.capabilities, ['cakeOrderLines'])
  if (!capabilities || capabilities.cakeOrderLines !== 1) invalidResponse()
  return { cakeOrderLines: 1 }
}

function projectCakeOrderLine(line: CakeOrderLineRequest): CakeOrderLineRequest {
  if (getCakeServingProfile(line.productId) === 'genoise') {
    return { productId: line.productId, cakeSize: line.cakeSize, quantity: line.quantity } as CakeOrderLineRequest
  }
  return {
    productId: line.productId,
    cakeSize: line.cakeSize,
    chocolateType: line.chocolateType,
    poundAddon: line.poundAddon,
    cupcakeFinish: line.cupcakeFinish,
    chocolateIcingCount: line.chocolateIcingCount,
    ...(isChocolateExtraEligibleProduct(line.productId) ? {
      chocolateExtra: normalizeChocolateExtra(line.productId, line.chocolateExtra),
    } : {}),
    vanillaCreamCount: line.vanillaCreamCount,
    partyDecorationCount: line.partyDecorationCount,
    vanillaCakeSheet: normalizeVanillaCakeSheet(line.productId, line.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeVanillaCakeFlavor(line.productId, line.vanillaCakeFlavor),
    ...(line.vanillaCakePointColor ? {
      vanillaCakePointColor: normalizeVanillaCakePointColor(line.productId, line.vanillaCakePointColor),
    } : {}),
    individualPackaging: line.individualPackaging === true,
    quantity: line.quantity,
  }
}

const CAKE_ORDER_LINE_FIELDS = [
  'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount',
  'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'individualPackaging', 'quantity',
] as const

function isValidCakeOrderLine(value: unknown): value is CakeOrderLineRequest {
  if (!isPlainRecord(value)) return false
  for (const key of CAKE_ORDER_LINE_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false
  }
  const line = value as Record<string, unknown>
  if (
    typeof line.productId !== 'string' || (!isActiveCakeOrderProductId(line.productId) && getCakeServingProfile(line.productId as ProductId) === null) || !Object.prototype.hasOwnProperty.call(PRODUCTS, line.productId) ||
    typeof line.cakeSize !== 'string' || !VALID_CAKE_SIZES.has(line.cakeSize as CakeSize) ||
    typeof line.chocolateType !== 'string' || !VALID_CHOCOLATE_TYPES.has(line.chocolateType as ChocolateType) ||
    typeof line.poundAddon !== 'string' || !VALID_POUND_ADDONS.has(line.poundAddon as PoundAddon) ||
    (line.chocolateExtra !== undefined && (
      typeof line.chocolateExtra !== 'string' ||
      !VALID_CHOCOLATE_EXTRAS.has(line.chocolateExtra as ChocolateExtra) ||
      !isChocolateExtraEligibleProduct(line.productId as ProductId) ||
      line.chocolateExtra !== normalizeChocolateExtra(line.productId as ProductId, line.chocolateExtra as ChocolateExtra)
    )) ||
    typeof line.cupcakeFinish !== 'string' || !VALID_CUPCAKE_FINISHES.has(line.cupcakeFinish as CupcakeFinish) ||
    typeof line.vanillaCakeSheet !== 'string' || !VALID_VANILLA_CAKE_SHEETS.has(line.vanillaCakeSheet as VanillaCakeSheet) ||
    typeof line.vanillaCakeFlavor !== 'string' || !VALID_VANILLA_CAKE_FLAVORS.has(line.vanillaCakeFlavor as VanillaCakeFlavor) ||
    (line.vanillaCakePointColor !== undefined && (
      typeof line.vanillaCakePointColor !== 'string' ||
      !VALID_VANILLA_CAKE_POINT_COLORS.has(line.vanillaCakePointColor as VanillaCakePointColor)
    )) ||
    typeof line.individualPackaging !== 'boolean' ||
    (line.individualPackaging && !isIndividualPackagingEligibleProduct(line.productId as ProductId)) ||
    !Number.isSafeInteger(line.chocolateIcingCount) || Number(line.chocolateIcingCount) < 0 ||
    !Number.isSafeInteger(line.vanillaCreamCount) || Number(line.vanillaCreamCount) < 0 ||
    !Number.isSafeInteger(line.partyDecorationCount) || Number(line.partyDecorationCount) < 0 ||
    !Number.isSafeInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > MAX_RESERVATION_QUANTITY
  ) return false
  const productId = line.productId as ProductId
  const finishes = normalizeCupcakeFinishCounts(productId, Number(line.vanillaCreamCount), Number(line.partyDecorationCount))
  return (
    line.cakeSize === normalizeCakeSize(productId, line.cakeSize as CakeSize) &&
    line.poundAddon === normalizePoundAddon(productId, line.poundAddon as PoundAddon) &&
    line.cupcakeFinish === normalizeCupcakeFinish(productId, line.cupcakeFinish as CupcakeFinish) &&
    line.chocolateType === normalizeReservationChocolateType(productId, line.chocolateType as ChocolateType, line.poundAddon as PoundAddon) &&
    line.chocolateIcingCount === normalizeChocolateIcingCount(productId, Number(line.chocolateIcingCount)) &&
    line.vanillaCreamCount === finishes.vanillaCreamCount &&
    line.partyDecorationCount === finishes.partyDecorationCount &&
    line.vanillaCakeSheet === normalizeVanillaCakeSheet(productId, line.vanillaCakeSheet as VanillaCakeSheet) &&
    line.vanillaCakeFlavor === normalizeVanillaCakeFlavor(productId, line.vanillaCakeFlavor as VanillaCakeFlavor) &&
    (line.vanillaCakePointColor === undefined ||
      line.vanillaCakePointColor === normalizeVanillaCakePointColor(productId, line.vanillaCakePointColor as VanillaCakePointColor))
  )
}

export function buildCakeOrderRequest(input: CakeOrderRequest): CakeOrderRequest {
  const row = readPlainDataRecordSnapshot(input)
  if (!row || !hasOwnDataFields(row, [
    'customerName', 'customerPhone', 'customerEmail', 'pickupDate', 'pickupTime', 'requestNote', 'privacyConsent',
    'requestId', 'website', 'orderLines',
  ])) throw new Error('INVALID_ORDER_REQUEST')
  if (typeof row.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.requestId)) {
    throw new Error('INVALID_REQUEST_ID')
  }
  if (
    typeof row.customerName !== 'string' ||
    typeof row.customerPhone !== 'string' ||
    typeof row.customerEmail !== 'string' ||
    typeof row.pickupDate !== 'string' ||
    typeof row.pickupTime !== 'string' ||
    typeof row.requestNote !== 'string' ||
    row.privacyConsent !== true ||
    typeof row.website !== 'string' ||
    (row.promoCode !== undefined && typeof row.promoCode !== 'string')
  ) throw new Error('INVALID_ORDER_REQUEST')
  const rawOrderLines = readDensePlainDataArray(row.orderLines, 2)
  if (!rawOrderLines) throw new Error('INVALID_ORDER_LINES')
  const orderLines = rawOrderLines.map(readPlainDataRecordSnapshot)
  if (orderLines.some((line) => !line || !isValidCakeOrderLine(line))) throw new Error('INVALID_ORDER_LINES')
  const trustedOrderLines = orderLines as CakeOrderLineRequest[]
  const canonicalKeys = trustedOrderLines.map(canonicalOrderLineKey)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) throw new Error('INVALID_ORDER_LINES')
  const promoCode = typeof row.promoCode === 'string' ? row.promoCode.trim() : ''
  return {
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail.trim().toLowerCase(),
    pickupDate: row.pickupDate,
    pickupTime: row.pickupTime,
    requestNote: row.requestNote,
    privacyConsent: true,
    requestId: row.requestId,
    website: row.website,
    orderLines: trustedOrderLines.map(projectCakeOrderLine),
    ...(promoCode ? { promoCode } : {}),
  }
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const descriptor = Object.getOwnPropertyDescriptor(row, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'string') invalidResponse()
  return descriptor.value as string
}

function responseCustomerEmail(row: Record<string, unknown>, { required = false } = {}): string {
  if (!Object.hasOwn(row, 'customerEmail')) {
    if (required) invalidResponse()
    return ''
  }
  if (typeof row.customerEmail !== 'string') invalidResponse()
  const customerEmail = row.customerEmail.trim().toLowerCase()
  if (!customerEmail && !required) return ''
  if (customerEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) invalidResponse()
  return customerEmail
}

function requiredFiniteNumber(row: Record<string, unknown>, key: string): number {
  const descriptor = Object.getOwnPropertyDescriptor(row, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) invalidResponse()
  return descriptor.value as number
}

function requiredSetValue<T extends string>(row: Record<string, unknown>, key: string, allowed: ReadonlySet<T>): T {
  const value = requiredString(row, key)
  if (!allowed.has(value as T)) invalidResponse()
  return value as T
}

function requiredProductId(row: Record<string, unknown>): ProductId {
  const value = requiredString(row, 'productId')
  if (!isStoredCakeOrderProductId(value) || !Object.prototype.hasOwnProperty.call(PRODUCTS, value)) invalidResponse()
  return value as ProductId
}

function requiredDateOnly(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) invalidResponse()
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) invalidResponse()
  return value
}

function requiredTime(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key)
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) invalidResponse()
  return value
}

function requiredIsoTimestamp(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key)
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalidResponse()
  return value
}

function canonicalOrderLineKey(line: CakeOrderLineRequest): string {
  return JSON.stringify([
    line.productId, line.cakeSize, line.chocolateType, line.poundAddon, line.cupcakeFinish, line.chocolateIcingCount,
    line.vanillaCreamCount, line.partyDecorationCount, line.vanillaCakeSheet, line.vanillaCakeFlavor,
    normalizeVanillaCakePointColor(line.productId, line.vanillaCakePointColor),
    normalizeChocolateExtra(line.productId, line.chocolateExtra),
    line.individualPackaging === true,
  ])
}

function safeSum(values: number[]): number {
  let sum = 0
  for (const value of values) {
    sum += value
    if (!Number.isSafeInteger(sum)) invalidResponse()
  }
  return sum
}

function expectedLineDiscounts(lines: CakeOrderLineResult[], eligibleIndexes: number[], discountPercent: 0 | 5 | 10, discountCents: number): number[] {
  const allocations = new Array<number>(lines.length).fill(0)
  const ranked = eligibleIndexes.map((index) => {
    const numerator = lines[index].subtotalCents * discountPercent
    if (!Number.isSafeInteger(numerator)) invalidResponse()
    const floorCents = Math.floor(numerator / 100)
    allocations[index] = floorCents
    return { index, remainder: numerator % 100, key: canonicalOrderLineKey(lines[index]) }
  }).sort((left, right) => right.remainder - left.remainder || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
  let remainderCents = discountCents - safeSum(allocations)
  for (const candidate of ranked) {
    if (remainderCents <= 0) break
    allocations[candidate.index] += 1
    remainderCents -= 1
  }
  if (remainderCents !== 0) invalidResponse()
  return allocations
}

export function parseCakeOrderResult(value: unknown): CakeOrderReservation {
  const row = readPlainDataRecordSnapshot(value)
  if (!row) invalidResponse()
  if (!hasOwnDataFields(row, [
    'orderLines', 'orderLineCount', 'orderItemCount', 'discountBasisCents', 'subtotalCents',
    'discountPercent', 'discountCents', 'totalPriceCents', 'promotionKind', 'createdAt',
    'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount',
    'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity',
    'totalPrice', 'customerName', 'customerPhone', 'reservationNumber', 'pickupDate', 'pickupTime',
    'cacaoPercent', 'requestNote', 'status', 'paymentStatus', 'adminMemo', 'updatedAt',
  ])) invalidResponse()
  const rawOrderLines = readDensePlainDataArray(row.orderLines, 1)
  if (!rawOrderLines) invalidResponse()

  const prePackagingLineKeys = new Set([
    'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount',
    'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'quantity', 'unitPriceCents',
    'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
  ])
  const lineKeys = new Set([
    ...prePackagingLineKeys,
    'individualPackaging', 'individualPackagingPieces', 'individualPackagingFeeCents',
  ])
  const legacyLineKeys = new Set([...prePackagingLineKeys].filter((key) => key !== 'vanillaCakePointColor'))
  const orderLines = rawOrderLines.map((value): CakeOrderLineResult => {
    const line = readPlainDataRecordSnapshot(value)
    if (!line) invalidResponse()
    const keys = Object.keys(line)
    const hasPackagingFields = keys.length === lineKeys.size
    const allowedLineKeys = hasPackagingFields
      ? lineKeys
      : keys.length === legacyLineKeys.size ? legacyLineKeys : prePackagingLineKeys
    if (keys.length !== allowedLineKeys.size || !keys.every((key) => typeof key === 'string' && allowedLineKeys.has(key))) invalidResponse()
    const productId = requiredProductId(line)
    const cakeSize = requiredSetValue(line, 'cakeSize', VALID_CAKE_SIZES)
    const chocolateType = requiredSetValue(line, 'chocolateType', VALID_CHOCOLATE_TYPES)
    const poundAddon = requiredSetValue(line, 'poundAddon', VALID_POUND_ADDONS)
    const cupcakeFinish = requiredSetValue(line, 'cupcakeFinish', VALID_CUPCAKE_FINISHES)
    const chocolateIcingCount = nonnegativeInteger(line.chocolateIcingCount)
    const vanillaCreamCount = nonnegativeInteger(line.vanillaCreamCount)
    const partyDecorationCount = nonnegativeInteger(line.partyDecorationCount)
    const vanillaCakeSheet = requiredSetValue(line, 'vanillaCakeSheet', VALID_VANILLA_CAKE_SHEETS)
    const vanillaCakeFlavor = requiredSetValue(line, 'vanillaCakeFlavor', VALID_VANILLA_CAKE_FLAVORS)
    const vanillaCakePointColor = line.vanillaCakePointColor === undefined
      ? 'pink'
      : requiredSetValue(line, 'vanillaCakePointColor', VALID_VANILLA_CAKE_POINT_COLORS)
    const quantity = nonnegativeInteger(line.quantity)
    const individualPackaging = hasPackagingFields && line.individualPackaging === true
    if (hasPackagingFields && typeof line.individualPackaging !== 'boolean') invalidResponse()
    if (individualPackaging && !isIndividualPackagingEligibleProduct(productId)) invalidResponse()
    const individualPackagingPieces = hasPackagingFields ? nonnegativeInteger(line.individualPackagingPieces) : 0
    const individualPackagingFeeCents = hasPackagingFields ? nonnegativeInteger(line.individualPackagingFeeCents) : 0
    const expectedPackagingPieces = individualPackaging ? getIndividualPackagingPieceCount(productId, quantity) : 0
    if (individualPackagingPieces !== expectedPackagingPieces) invalidResponse()
    const normalizedFinishes = normalizeCupcakeFinishCounts(productId, vanillaCreamCount, partyDecorationCount)
    if (
      (cakeSize !== normalizeCakeSize(productId, cakeSize) && !isHistoricalWholeCakeSize(productId, cakeSize)) ||
      poundAddon !== normalizePoundAddon(productId, poundAddon) ||
      cupcakeFinish !== normalizeCupcakeFinish(productId, cupcakeFinish) ||
      chocolateType !== normalizeReservationChocolateType(productId, chocolateType, poundAddon) ||
      chocolateIcingCount !== normalizeChocolateIcingCount(productId, chocolateIcingCount) ||
      vanillaCreamCount !== normalizedFinishes.vanillaCreamCount ||
      partyDecorationCount !== normalizedFinishes.partyDecorationCount ||
      vanillaCakeSheet !== normalizeStoredVanillaCakeSheet(productId, vanillaCakeSheet) ||
      vanillaCakeFlavor !== normalizeStoredVanillaCakeFlavor(productId, vanillaCakeFlavor) ||
      vanillaCakePointColor !== normalizeVanillaCakePointColor(productId, vanillaCakePointColor) ||
      quantity < 1 || quantity > MAX_RESERVATION_QUANTITY
    ) invalidResponse()
    const unitPriceCents = nonnegativeInteger(line.unitPriceCents)
    const subtotalCents = nonnegativeInteger(line.subtotalCents)
    const discountCents = nonnegativeInteger(line.discountCents)
    const totalPriceCents = nonnegativeInteger(line.totalPriceCents)
    const discountPercent = line.discountPercent
    if (discountPercent !== 0 && discountPercent !== 5 && discountPercent !== 10) invalidResponse()
    const authoritativeUnitPriceCents = Math.round(getReservationPrice(productId, {
      cakeSize, chocolateType, poundAddon, cupcakeFinish, chocolateIcingCount, vanillaCreamCount, partyDecorationCount,
    }) * 100)
    const expectedSubtotalCents = unitPriceCents * quantity
    if (
      !Number.isSafeInteger(authoritativeUnitPriceCents) ||
      !Number.isSafeInteger(expectedSubtotalCents) ||
      (!isHistoricalWholeCakeSize(productId, cakeSize) && unitPriceCents !== authoritativeUnitPriceCents) ||
      (isHistoricalWholeCakeSize(productId, cakeSize) && !isHistoricalWholeCakeUnitPrice(productId, cakeSize, unitPriceCents)) ||
      expectedSubtotalCents !== subtotalCents ||
      subtotalCents - discountCents + individualPackagingFeeCents !== totalPriceCents
    ) invalidResponse()
    if (discountPercent === 0 && discountCents !== 0) invalidResponse()
    return {
      productId, cakeSize, chocolateType, poundAddon, cupcakeFinish, chocolateIcingCount, vanillaCreamCount,
      partyDecorationCount, vanillaCakeSheet, vanillaCakeFlavor, vanillaCakePointColor, quantity,
      ...(hasPackagingFields ? { individualPackaging, individualPackagingPieces, individualPackagingFeeCents } : {}),
      unitPriceCents, subtotalCents, discountPercent, discountCents, totalPriceCents,
    }
  })
  const canonicalKeys = orderLines.map(canonicalOrderLineKey)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) invalidResponse()

  const subtotalCents = nonnegativeInteger(row.subtotalCents)
  const discountBasisCents = nonnegativeInteger(row.discountBasisCents)
  const discountCents = nonnegativeInteger(row.discountCents)
  const totalPriceCents = nonnegativeInteger(row.totalPriceCents)
  const discountPercent = row.discountPercent
  if (discountPercent !== 0 && discountPercent !== 5 && discountPercent !== 10) invalidResponse()
  const hasPackagingAggregates = Object.hasOwn(row, 'individualPackagingPieces') || Object.hasOwn(row, 'individualPackagingFeeCents')
  if (hasPackagingAggregates && (!Object.hasOwn(row, 'individualPackagingPieces') || !Object.hasOwn(row, 'individualPackagingFeeCents'))) invalidResponse()
  const individualPackagingPieces = hasPackagingAggregates ? nonnegativeInteger(row.individualPackagingPieces) : 0
  const individualPackagingFeeCents = hasPackagingAggregates ? nonnegativeInteger(row.individualPackagingFeeCents) : 0
  if (subtotalCents - discountCents + individualPackagingFeeCents !== totalPriceCents) invalidResponse()
  const aggregateDiscountNumerator = discountBasisCents * Number(discountPercent)
  if (!Number.isSafeInteger(aggregateDiscountNumerator) || discountCents !== Math.round(aggregateDiscountNumerator / 100)) invalidResponse()
  const appliedPromoCodeLast4 = row.appliedPromoCodeLast4 === undefined
    ? ''
    : typeof row.appliedPromoCodeLast4 === 'string'
      ? row.appliedPromoCodeLast4.toUpperCase()
      : invalidResponse()
  if (discountPercent === 0 && (discountBasisCents !== 0 || discountCents !== 0 || appliedPromoCodeLast4 !== '')) invalidResponse()
  if (discountPercent !== 0 && (discountBasisCents <= 0 || discountCents <= 0 || !SAFE_LAST4_PATTERN.test(appliedPromoCodeLast4))) invalidResponse()

  const promotionKind = requiredSetValue(row, 'promotionKind', new Set(['none', 'static', 'review-reward', 'manual-coupon'] as const))
  const createdAt = requiredIsoTimestamp(row, 'createdAt')
  if ((promotionKind === 'none') !== (discountPercent === 0)) invalidResponse()
  if (promotionKind === 'static' && discountPercent !== 10) invalidResponse()
  if (promotionKind === 'manual-coupon' && discountPercent !== 5) invalidResponse()

  let eligibleIndexes: number[] = []
  if (promotionKind === 'static') {
    const staticCode = appliedPromoCodeLast4 === 'LATE'
      ? 'chocolate'
      : appliedPromoCodeLast4 === 'MONI'
        ? 'lemoni'
        : invalidResponse()
    const createdDate = new Date(createdAt)
    eligibleIndexes = orderLines
      .map((line, index) => getValidPromoCode(line.productId, staticCode, createdDate) === staticCode ? index : -1)
      .filter((index) => index >= 0)
    if (eligibleIndexes.length === 0) invalidResponse()
  } else if (promotionKind === 'review-reward' || promotionKind === 'manual-coupon') {
    eligibleIndexes = orderLines.map((_, index) => index)
  }
  const eligibleIndexSet = new Set(eligibleIndexes)
  if (orderLines.some((line, index) => line.discountPercent !== (eligibleIndexSet.has(index) ? discountPercent : 0))) invalidResponse()

  const expectedBasis = safeSum(eligibleIndexes.map((index) => orderLines[index].subtotalCents))
  const expectedAllocations = expectedLineDiscounts(orderLines, eligibleIndexes, discountPercent, discountCents)
  if (orderLines.some((line, index) => line.discountCents !== expectedAllocations[index])) invalidResponse()
  const lineSubtotal = safeSum(orderLines.map((line) => line.subtotalCents))
  const lineDiscount = safeSum(orderLines.map((line) => line.discountCents))
  const lineTotal = safeSum(orderLines.map((line) => line.totalPriceCents))
  const linePackagingPieces = safeSum(orderLines.map((line) => line.individualPackagingPieces || 0))
  const linePackagingFeeCents = safeSum(orderLines.map((line) => line.individualPackagingFeeCents || 0))
  const selectedPackagingProductSubtotalCents = safeSum(
    orderLines.filter((line) => line.individualPackaging === true).map((line) => line.subtotalCents),
  )
  const expectedPackagingFeeCents = selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  const itemCount = safeSum(orderLines.map((line) => line.quantity))
  if (
    nonnegativeInteger(row.orderLineCount) !== orderLines.length ||
    nonnegativeInteger(row.orderItemCount) !== itemCount ||
    lineSubtotal !== subtotalCents ||
    expectedBasis !== discountBasisCents ||
    lineDiscount !== discountCents ||
    lineTotal !== totalPriceCents ||
    linePackagingPieces !== individualPackagingPieces ||
    linePackagingFeeCents !== individualPackagingFeeCents ||
    individualPackagingFeeCents !== expectedPackagingFeeCents
  ) invalidResponse()

  const first = orderLines[0]
  for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity'] as const) {
    if (row[key] !== first[key]) invalidResponse()
  }
  if (row.vanillaCakePointColor !== undefined && row.vanillaCakePointColor !== first.vanillaCakePointColor) invalidResponse()
  if (row.individualPackaging !== undefined && row.individualPackaging !== first.individualPackaging) invalidResponse()
  const totalPrice = requiredFiniteNumber(row, 'totalPrice')
  if (!Number.isSafeInteger(totalPriceCents) || totalPrice !== totalPriceCents / 100) invalidResponse()
  const customerName = requiredString(row, 'customerName')
  const customerPhone = requiredString(row, 'customerPhone')
  const customerEmail = responseCustomerEmail(row, { required: true })
  if (customerName.trim().length < 2 || !isValidPhone(customerPhone)) invalidResponse()

  return {
    id: '',
    reservationNumber: requiredString(row, 'reservationNumber'),
    customerName,
    customerPhone,
    customerEmail,
    productId: first.productId,
    cakeSize: first.cakeSize,
    chocolateType: first.chocolateType,
    poundAddon: first.poundAddon,
    cupcakeFinish: first.cupcakeFinish,
    chocolateIcingCount: first.chocolateIcingCount,
    vanillaCreamCount: first.vanillaCreamCount,
    partyDecorationCount: first.partyDecorationCount,
    vanillaCakeSheet: first.vanillaCakeSheet,
    vanillaCakeFlavor: first.vanillaCakeFlavor,
    vanillaCakePointColor: first.vanillaCakePointColor,
    ...(first.individualPackaging !== undefined ? { individualPackaging: first.individualPackaging } : {}),
    quantity: first.quantity,
    pickupDate: requiredDateOnly(row, 'pickupDate'),
    pickupTime: requiredTime(row, 'pickupTime'),
    cacaoPercent: requiredSetValue(row, 'cacaoPercent', VALID_CACAO),
    requestNote: requiredString(row, 'requestNote'),
    status: requiredSetValue(row, 'status', VALID_STATUSES),
    paymentStatus: requiredSetValue(row, 'paymentStatus', VALID_PAYMENT_STATUSES),
    totalPrice,
    subtotalCents,
    discountPercent,
    discountCents,
    totalPriceCents,
    promotionKind,
    ...(appliedPromoCodeLast4 ? { appliedPromoCodeLast4 } : {}),
    adminMemo: requiredString(row, 'adminMemo'),
    createdAt,
    updatedAt: requiredIsoTimestamp(row, 'updatedAt'),
    orderLines,
    orderLineCount: orderLines.length,
    orderItemCount: itemCount,
    discountBasisCents,
    ...(hasPackagingAggregates ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }
}

export function parseCakeReservationResult(value: unknown): Reservation {
  const row = readPlainDataRecordSnapshot(value)
  if (!row) invalidResponse()
  if (Array.isArray(row.orderLines)) return parseCakeOrderResult(row)
  const pricing = getReservationPricingAudit(row)
  const totalPrice = requiredFiniteNumber(row, 'totalPrice')
  if (Math.round(totalPrice * 100) !== pricing.totalPriceCents) invalidResponse()
  const promotionKind = requiredSetValue(row, 'promotionKind', new Set(['none', 'static', 'review-reward', 'manual-coupon'] as const))
  if ((promotionKind === 'none') !== (pricing.discountPercent === 0)) invalidResponse()
  if (promotionKind === 'static' && pricing.discountPercent !== 10) invalidResponse()
  if (promotionKind === 'manual-coupon' && pricing.discountPercent !== 5) invalidResponse()

  const productId = requiredProductId(row)
  getProductById(productId)
  const cakeSize = requiredSetValue(row, 'cakeSize', VALID_CAKE_SIZES)
  const chocolateType = requiredSetValue(row, 'chocolateType', VALID_CHOCOLATE_TYPES)
  const poundAddon = requiredSetValue(row, 'poundAddon', VALID_POUND_ADDONS)
  const chocolateIcingCount = row.chocolateIcingCount === undefined ? 0 : nonnegativeInteger(row.chocolateIcingCount)
  const vanillaCreamCount = row.vanillaCreamCount === undefined ? 0 : nonnegativeInteger(row.vanillaCreamCount)
  const partyDecorationCount = row.partyDecorationCount === undefined ? 0 : nonnegativeInteger(row.partyDecorationCount)
  const vanillaCakeSheet = row.vanillaCakeSheet === undefined
    ? productId === 'vanilla-fresh-cream-cake' ? 'chocolate' : 'vanilla'
    : requiredSetValue(row, 'vanillaCakeSheet', VALID_VANILLA_CAKE_SHEETS)
  const vanillaCakeFlavor = row.vanillaCakeFlavor === undefined
    ? 'triple-berry'
    : requiredSetValue(row, 'vanillaCakeFlavor', VALID_VANILLA_CAKE_FLAVORS)
  const vanillaCakePointColor = row.vanillaCakePointColor === undefined
    ? 'pink'
    : requiredSetValue(row, 'vanillaCakePointColor', VALID_VANILLA_CAKE_POINT_COLORS)
  const quantity = nonnegativeInteger(row.quantity)
  const normalizedFinishes = normalizeCupcakeFinishCounts(productId, vanillaCreamCount, partyDecorationCount)
  if (
    (cakeSize !== normalizeCakeSize(productId, cakeSize) && !isHistoricalWholeCakeSize(productId, cakeSize)) ||
    poundAddon !== normalizePoundAddon(productId, poundAddon) ||
    chocolateType !== normalizeReservationChocolateType(productId, chocolateType, poundAddon) ||
    chocolateIcingCount !== normalizeChocolateIcingCount(productId, chocolateIcingCount) ||
    vanillaCreamCount !== normalizedFinishes.vanillaCreamCount ||
    partyDecorationCount !== normalizedFinishes.partyDecorationCount ||
    vanillaCakeSheet !== normalizeStoredVanillaCakeSheet(productId, vanillaCakeSheet) ||
    vanillaCakeFlavor !== normalizeStoredVanillaCakeFlavor(productId, vanillaCakeFlavor) ||
    vanillaCakePointColor !== normalizeVanillaCakePointColor(productId, vanillaCakePointColor) ||
    quantity < 1 || quantity > MAX_RESERVATION_QUANTITY
  ) invalidResponse()

  const customerName = requiredString(row, 'customerName')
  const customerPhone = requiredString(row, 'customerPhone')
  const customerEmail = responseCustomerEmail(row)
  if (customerName.trim().length < 2 || !isValidPhone(customerPhone)) invalidResponse()

  return {
    id: '',
    reservationNumber: requiredString(row, 'reservationNumber'),
    customerName,
    customerPhone,
    customerEmail,
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    vanillaCakeSheet,
    vanillaCakeFlavor,
    vanillaCakePointColor,
    quantity,
    pickupDate: requiredDateOnly(row, 'pickupDate'),
    pickupTime: requiredTime(row, 'pickupTime'),
    cacaoPercent: requiredSetValue(row, 'cacaoPercent', VALID_CACAO),
    requestNote: requiredString(row, 'requestNote'),
    status: requiredSetValue(row, 'status', VALID_STATUSES),
    paymentStatus: requiredSetValue(row, 'paymentStatus', VALID_PAYMENT_STATUSES),
    totalPrice,
    ...pricing,
    promotionKind,
    ...(pricing.appliedPromoCodeLast4 ? { appliedPromoCodeLast4: pricing.appliedPromoCodeLast4 } : {}),
    adminMemo: requiredString(row, 'adminMemo'),
    createdAt: requiredIsoTimestamp(row, 'createdAt'),
    updatedAt: requiredIsoTimestamp(row, 'updatedAt'),
  }
}
