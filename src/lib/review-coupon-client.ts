import {
  getProductById,
  getValidPromoCode,
  MAX_RESERVATION_QUANTITY,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  PRODUCTS,
} from './constants.js'
import { isValidPhone } from './utils.js'
import type { CakeSize, CacaoPercent, ChocolateType, PoundAddon, ProductId, Reservation, ReservationInput } from './types.js'

const REVIEW_COUPON_ANIMALS = ['FOX', 'CAT', 'DOG', 'OWL', 'PIG', 'BEE', 'COW', 'CUB', 'EMU', 'HEN', 'KOI', 'PUP', 'RAM', 'YAK', 'APE']
const REVIEW_COUPON_FRUITS = ['KIWI', 'FIG', 'LIME', 'PEAR', 'PLUM', 'APPLE', 'GRAPE', 'GUAVA', 'LEMON', 'MANGO', 'MELON', 'PEACH']
const REVIEW_COUPON_PATTERN = new RegExp(
  `^(?:${REVIEW_COUPON_ANIMALS.join('|')})(?:${REVIEW_COUPON_FRUITS.join('|')})[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$`,
)
const SAFE_LAST4_PATTERN = /^[A-Z0-9]{4}$/
const VALID_CAKE_SIZES = new Set<CakeSize>(['mini', 'size-1', '15cm', '17cm', '19cm', '22cm'])
const VALID_CHOCOLATE_TYPES = new Set<ChocolateType>(['dark', 'milk'])
const VALID_POUND_ADDONS = new Set<PoundAddon>(['none', 'extra-chocolate', 'vanilla-cream'])
const VALID_CACAO = new Set<CacaoPercent>(['기본', '70', '80.5', '100'])
const VALID_STATUSES = new Set<Reservation['status']>(['예약신청', '예약확정', '픽업완료', '취소'])
const VALID_PAYMENT_STATUSES = new Set<Reservation['paymentStatus']>(['입금대기', '입금확인', '현장결제', '환불필요'])

export type PromoEntryState =
  | { kind: 'empty'; normalizedCode: ''; discountPercent: 0 }
  | { kind: 'static-valid'; normalizedCode: string; discountPercent: 10 }
  | { kind: 'review-pending'; normalizedCode: string; discountPercent: 5 | 10 | null }
  | { kind: 'invalid'; normalizedCode: string; discountPercent: 0 }

export function normalizeReviewCouponCode(value?: string): string | null {
  const normalized = String(value || '').trim().toUpperCase()
  return REVIEW_COUPON_PATTERN.test(normalized) ? normalized : null
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
  const trimmed = String(value || '').trim()
  if (!trimmed) return { kind: 'empty', normalizedCode: '', discountPercent: 0 }

  const staticCode = getValidPromoCode(productId, trimmed, now)
  if (staticCode) return { kind: 'static-valid', normalizedCode: staticCode, discountPercent: 10 }

  const reviewCode = normalizeReviewCouponCode(trimmed)
  if (reviewCode) {
    return {
      kind: 'review-pending',
      normalizedCode: reviewCode,
      discountPercent: reviewRewardPercent === 5 || reviewRewardPercent === 10 ? reviewRewardPercent : null,
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
  if (!Number.isInteger(value) || Number(value) < 0) invalidResponse()
  return Number(value)
}

export function getReservationPricingAudit(value: unknown): ReservationPricingAudit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
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
  const request: ReservationInput = {
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    productId: input.productId,
    cakeSize: input.cakeSize,
    chocolateType: input.chocolateType,
    poundAddon: input.poundAddon,
    chocolateIcingCount: input.chocolateIcingCount,
    vanillaCreamCount: input.vanillaCreamCount,
    partyDecorationCount: input.partyDecorationCount,
    quantity: input.quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent: input.cacaoPercent,
    requestNote: input.requestNote,
    privacyConsent: input.privacyConsent,
    requestId: input.requestId,
    website: input.website,
  }
  if (typeof input.promoCode === 'string' && input.promoCode.trim()) request.promoCode = input.promoCode.trim()
  return request
}

function requiredString(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== 'string') invalidResponse()
  return row[key] as string
}

function requiredFiniteNumber(row: Record<string, unknown>, key: string): number {
  if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) invalidResponse()
  return row[key] as number
}

function requiredSetValue<T extends string>(row: Record<string, unknown>, key: string, allowed: ReadonlySet<T>): T {
  const value = requiredString(row, key)
  if (!allowed.has(value as T)) invalidResponse()
  return value as T
}

function requiredProductId(row: Record<string, unknown>): ProductId {
  const value = requiredString(row, 'productId')
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, value)) invalidResponse()
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

export function parseCakeReservationResult(value: unknown): Reservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  const row = value as Record<string, unknown>
  const pricing = getReservationPricingAudit(row)
  const totalPrice = requiredFiniteNumber(row, 'totalPrice')
  if (Math.round(totalPrice * 100) !== pricing.totalPriceCents) invalidResponse()
  const promotionKind = requiredSetValue(row, 'promotionKind', new Set(['none', 'static', 'review-reward'] as const))
  if ((promotionKind === 'none') !== (pricing.discountPercent === 0)) invalidResponse()
  if (promotionKind === 'static' && pricing.discountPercent !== 10) invalidResponse()

  const productId = requiredProductId(row)
  getProductById(productId)
  const cakeSize = requiredSetValue(row, 'cakeSize', VALID_CAKE_SIZES)
  const chocolateType = requiredSetValue(row, 'chocolateType', VALID_CHOCOLATE_TYPES)
  const poundAddon = requiredSetValue(row, 'poundAddon', VALID_POUND_ADDONS)
  const chocolateIcingCount = row.chocolateIcingCount === undefined ? 0 : nonnegativeInteger(row.chocolateIcingCount)
  const vanillaCreamCount = row.vanillaCreamCount === undefined ? 0 : nonnegativeInteger(row.vanillaCreamCount)
  const partyDecorationCount = row.partyDecorationCount === undefined ? 0 : nonnegativeInteger(row.partyDecorationCount)
  const quantity = nonnegativeInteger(row.quantity)
  const normalizedFinishes = normalizeCupcakeFinishCounts(productId, vanillaCreamCount, partyDecorationCount)
  if (
    cakeSize !== normalizeCakeSize(productId, cakeSize) ||
    poundAddon !== normalizePoundAddon(productId, poundAddon) ||
    chocolateType !== normalizeReservationChocolateType(productId, chocolateType, poundAddon) ||
    chocolateIcingCount !== normalizeChocolateIcingCount(productId, chocolateIcingCount) ||
    vanillaCreamCount !== normalizedFinishes.vanillaCreamCount ||
    partyDecorationCount !== normalizedFinishes.partyDecorationCount ||
    quantity < 1 || quantity > MAX_RESERVATION_QUANTITY
  ) invalidResponse()

  const customerName = requiredString(row, 'customerName')
  const customerPhone = requiredString(row, 'customerPhone')
  if (customerName.trim().length < 2 || !isValidPhone(customerPhone)) invalidResponse()

  return {
    id: '',
    reservationNumber: requiredString(row, 'reservationNumber'),
    customerName,
    customerPhone,
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
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
