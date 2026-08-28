import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_CUPCAKE_FINISH,
  DEFAULT_POUND_ADDON,
  MAX_RESERVATION_QUANTITY,
  LEMON_PROMO_CODE,
  PROMO_CODE,
  getReservationPrice,
  getCupcakeFinishSurcharge,
  isFreshLemonCupcakeProduct,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinish,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  toCurrencyCents,
} from './constants.js'
import { getHistoricalWholeCakeUnitPrice, isHistoricalWholeCakeSize } from './cake-serving.js'
import type {
  CacaoPercent,
  CakeSize,
  ChocolateType,
  PaymentStatus,
  PoundAddon,
  ProductId,
  Reservation,
  ReservationStatus,
} from './types.js'

export type AdminReservationEditInput = Partial<Pick<Reservation,
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
  | 'status'
  | 'paymentStatus'
  | 'adminMemo'
>>

export type AdminReservationUpdate = Pick<Reservation,
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
  | 'status'
  | 'paymentStatus'
  | 'totalPrice'
  | 'totalPriceCents'
  | 'adminMemo'
>

const REVIEW_COUPON_PRICE_FIELDS = [
  'productId',
  'cakeSize',
  'chocolateType',
  'poundAddon',
  'cupcakeFinish',
  'chocolateIcingCount',
  'vanillaCreamCount',
  'partyDecorationCount',
  'quantity',
  'cacaoPercent',
  'totalPrice',
  'totalPriceCents',
] as const

export function assertReviewCouponRepricingAllowed(
  reservation: Reservation,
  edits: Partial<Reservation>,
): void {
  if (!reservation.reviewCouponId) return
  const changesPrice = REVIEW_COUPON_PRICE_FIELDS.some((field) => (
    Object.hasOwn(edits, field) && edits[field] !== reservation[field]
  ))
  if (changesPrice) {
    throw new Error('일회용 쿠폰 예약은 서버 재가격 계산 기능이 필요합니다. 제품·옵션·수량·카카오·금액은 수정할 수 없습니다.')
  }
}

export function assertReservationRepricingAllowed(
  reservation: Reservation,
  edits: Partial<Reservation>,
): void {
  assertReviewCouponRepricingAllowed(reservation, edits)
  const hasVersionedOrder = Array.isArray(reservation.orderLines)
  if (!hasVersionedOrder && Number(reservation.orderLineCount || 1) <= 1) return
  const changesPrice = REVIEW_COUPON_PRICE_FIELDS.some((field) => (
    Object.hasOwn(edits, field) && edits[field] !== reservation[field]
  ))
  if (changesPrice) throw new Error('MULTI_LINE_EDIT_UNAVAILABLE')
}

function normalizeQuantity(quantity: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

type ReservationPromoKind = typeof PROMO_CODE | typeof LEMON_PROMO_CODE | 'legacy'

const LEGACY_PROMO_UNIT_PRICE_CENTS: Partial<Record<ProductId, Partial<Record<CakeSize, number>>>> = {
  'pave-cake': { '15cm': 7500, '19cm': 9500, '22cm': 11500 },
  'vanilla-fresh-cream-cake': { '15cm': 7500, '19cm': 9800, '22cm': 13900 },
  'buttercream-cake': { '15cm': 7500, '19cm': 9800, '22cm': 13900 },
}

function discountedByTenPercent(total: number) {
  return Math.round(toCurrencyCents(total) * 0.9) / 100
}

function promoAppliesToProduct(kind: ReservationPromoKind, productId: ProductId) {
  if (kind === PROMO_CODE) {
    return [
      'choco-basque-cheesecake',
      'pave-choco-basque-cheesecake',
      'eiffel-tower-basque-cheesecake',
    ].includes(productId)
  }
  if (kind === LEMON_PROMO_CODE) return isFreshLemonCupcakeProduct(productId)
  return true
}

function reservationPromoKind(reservation: Reservation): ReservationPromoKind | null {
  const auditMatch = /^\[Promo ([^\]]+)\] 10% discount applied: \d+(?:\.\d{2})? -> \d+(?:\.\d{2})?(?:\n|$)/i
    .exec(reservation.requestNote || '')
  if (!auditMatch) return null

  const code = auditMatch[1].trim().toLowerCase()
  const kind: ReservationPromoKind | null = code === PROMO_CODE
    ? PROMO_CODE
    : code === LEMON_PROMO_CODE
      ? LEMON_PROMO_CODE
      : code === 'verygoodsyd'
        ? 'legacy'
        : null
  if (!kind || !promoAppliesToProduct(kind, reservation.productId)) return null

  const originalTotal = getReservationPrice(
    reservation.productId,
    {
      cacaoPercent: reservation.cacaoPercent,
      cakeSize: reservation.cakeSize,
      chocolateType: reservation.chocolateType,
      poundAddon: reservation.poundAddon,
      ...(reservation.cupcakeFinish === undefined ? {} : { cupcakeFinish: reservation.cupcakeFinish }),
      chocolateIcingCount: reservation.chocolateIcingCount || 0,
      vanillaCreamCount: reservation.vanillaCreamCount || 0,
      partyDecorationCount: reservation.partyDecorationCount || 0,
    },
    normalizeQuantity(reservation.quantity),
  )
  const storedCents = reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice)
  const expectedTotal = discountedByTenPercent(originalTotal)
  if (storedCents === toCurrencyCents(expectedTotal)) return kind
  const historicalUnitPriceCents = kind === 'legacy'
    ? LEGACY_PROMO_UNIT_PRICE_CENTS[reservation.productId]?.[reservation.cakeSize]
    : undefined
  const historicalTotal = historicalUnitPriceCents === undefined
    ? null
    : discountedByTenPercent(historicalUnitPriceCents * normalizeQuantity(reservation.quantity) / 100)
  return historicalTotal !== null && storedCents === toCurrencyCents(historicalTotal) ? kind : null
}

export function buildAdminReservationUpdate(
  reservation: Reservation,
  edits: AdminReservationEditInput,
): AdminReservationUpdate {
  assertReservationRepricingAllowed(reservation, edits)
  const orderLineCount = Number((reservation as Reservation & { orderLineCount?: number }).orderLineCount || 1)
  const hasVersionedOrder = Array.isArray(reservation.orderLines)
  if (hasVersionedOrder || orderLineCount > 1) {
    const changesPrice = REVIEW_COUPON_PRICE_FIELDS
      .filter((field) => field !== 'totalPrice' && field !== 'totalPriceCents')
      .some((field) => Object.hasOwn(edits, field) && edits[field] !== reservation[field])
    if (changesPrice) throw new Error('MULTI_LINE_EDIT_UNAVAILABLE')
    return {
      productId: reservation.productId,
      cakeSize: reservation.cakeSize,
      chocolateType: reservation.chocolateType,
      poundAddon: reservation.poundAddon,
      chocolateIcingCount: reservation.chocolateIcingCount || 0,
      vanillaCreamCount: reservation.vanillaCreamCount || 0,
      partyDecorationCount: reservation.partyDecorationCount || 0,
      quantity: reservation.quantity,
      pickupDate: edits.pickupDate || reservation.pickupDate,
      pickupTime: edits.pickupTime || reservation.pickupTime,
      cacaoPercent: reservation.cacaoPercent,
      status: (edits.status || reservation.status) as ReservationStatus,
      paymentStatus: (edits.paymentStatus || reservation.paymentStatus) as PaymentStatus,
      totalPrice: reservation.totalPrice,
      totalPriceCents: reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice),
      adminMemo: edits.adminMemo ?? reservation.adminMemo,
    }
  }
  const productId = (edits.productId || reservation.productId) as ProductId
  const poundAddon = normalizePoundAddon(productId, (edits.poundAddon || reservation.poundAddon || DEFAULT_POUND_ADDON) as PoundAddon)
  const requestedCakeSize = (edits.cakeSize || reservation.cakeSize || DEFAULT_CAKE_SIZE) as CakeSize
  const preservesHistoricalWholeCakeSize = productId === reservation.productId
    && isHistoricalWholeCakeSize(reservation.productId, reservation.cakeSize)
    && isHistoricalWholeCakeSize(productId, requestedCakeSize)
  const cakeSize = preservesHistoricalWholeCakeSize ? requestedCakeSize : normalizeCakeSize(productId, requestedCakeSize)
  const chocolateType = normalizeReservationChocolateType(
    productId,
    (edits.chocolateType || reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE) as ChocolateType,
    poundAddon,
  )
  const quantity = isFreshLemonCupcakeProduct(productId)
    ? 1
    : normalizeQuantity(edits.quantity ?? reservation.quantity)
  const chocolateIcingCount = normalizeChocolateIcingCount(
    productId,
    edits.chocolateIcingCount ?? reservation.chocolateIcingCount ?? 0,
  )
  const isLegacyCupcake = productId === reservation.productId
    && productId === 'cupcake-dozen'
    && reservation.cupcakeFinish === undefined
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    productId,
    isLegacyCupcake ? edits.vanillaCreamCount ?? reservation.vanillaCreamCount ?? 0 : 0,
    isLegacyCupcake ? edits.partyDecorationCount ?? reservation.partyDecorationCount ?? 0 : 0,
  )
  const cupcakeFinish = normalizeCupcakeFinish(
    productId,
    edits.cupcakeFinish ?? reservation.cupcakeFinish ?? DEFAULT_CUPCAKE_FINISH,
  )
  const cacaoPercent = (edits.cacaoPercent || reservation.cacaoPercent || '기본') as CacaoPercent
  const historicalUnitPrice = getHistoricalWholeCakeUnitPrice(productId, cakeSize)
  const originalTotalPrice = (historicalUnitPrice === null ? getReservationPrice(productId, { cacaoPercent, cakeSize, chocolateType, poundAddon, cupcakeFinish, chocolateIcingCount, ...cupcakeFinishCounts }, quantity) : historicalUnitPrice / 100 * quantity) + (isLegacyCupcake ? getCupcakeFinishSurcharge(productId, cupcakeFinishCounts.vanillaCreamCount, cupcakeFinishCounts.partyDecorationCount) * quantity : 0)
  const promoKind = reservationPromoKind(reservation)
  const hasPriceAffectingEdit = REVIEW_COUPON_PRICE_FIELDS
    .filter((field) => field !== 'totalPrice' && field !== 'totalPriceCents')
    .some((field) => Object.hasOwn(edits, field) && (edits as Partial<Reservation>)[field] !== reservation[field])
  const totalPrice = !hasPriceAffectingEdit || reservation.reviewCouponId
    ? reservation.totalPrice
    : promoKind && promoAppliesToProduct(promoKind, productId)
      ? discountedByTenPercent(originalTotalPrice)
      : originalTotalPrice

  return {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    ...(isLegacyCupcake ? {} : { cupcakeFinish }),
    chocolateIcingCount,
    ...cupcakeFinishCounts,
    quantity,
    pickupDate: edits.pickupDate || reservation.pickupDate,
    pickupTime: edits.pickupTime || reservation.pickupTime,
    cacaoPercent,
    status: (edits.status || reservation.status) as ReservationStatus,
    paymentStatus: (edits.paymentStatus || reservation.paymentStatus) as PaymentStatus,
    totalPrice,
    totalPriceCents: toCurrencyCents(totalPrice),
    adminMemo: edits.adminMemo ?? reservation.adminMemo,
  }
}
