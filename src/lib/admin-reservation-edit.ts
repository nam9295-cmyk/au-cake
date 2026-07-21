import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  MAX_RESERVATION_QUANTITY,
  LEMON_PROMO_CODE,
  PROMO_CODE,
  getReservationPrice,
  isFreshLemonCupcakeProduct,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  toCurrencyCents,
} from './constants.js'
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
    edits[field] !== undefined && edits[field] !== reservation[field]
  ))
  if (changesPrice) {
    throw new Error('일회용 쿠폰 예약은 서버 재가격 계산 기능이 필요합니다. 제품·옵션·수량·카카오·금액은 수정할 수 없습니다.')
  }
}

function normalizeQuantity(quantity: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

type ReservationPromoKind = typeof PROMO_CODE | typeof LEMON_PROMO_CODE | 'legacy'

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
      chocolateIcingCount: reservation.chocolateIcingCount || 0,
      vanillaCreamCount: reservation.vanillaCreamCount || 0,
      partyDecorationCount: reservation.partyDecorationCount || 0,
    },
    normalizeQuantity(reservation.quantity),
  )
  const storedCents = reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice)
  const expectedTotal = discountedByTenPercent(originalTotal)
  return storedCents === toCurrencyCents(expectedTotal) ? kind : null
}

export function buildAdminReservationUpdate(
  reservation: Reservation,
  edits: AdminReservationEditInput,
): AdminReservationUpdate {
  assertReviewCouponRepricingAllowed(reservation, edits)
  const productId = (edits.productId || reservation.productId) as ProductId
  const poundAddon = normalizePoundAddon(productId, (edits.poundAddon || reservation.poundAddon || DEFAULT_POUND_ADDON) as PoundAddon)
  const cakeSize = normalizeCakeSize(productId, (edits.cakeSize || reservation.cakeSize || DEFAULT_CAKE_SIZE) as CakeSize)
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
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    productId,
    edits.vanillaCreamCount ?? reservation.vanillaCreamCount ?? 0,
    edits.partyDecorationCount ?? reservation.partyDecorationCount ?? 0,
  )
  const cacaoPercent = (edits.cacaoPercent || reservation.cacaoPercent || '기본') as CacaoPercent
  const originalTotalPrice = getReservationPrice(
    productId,
    { cacaoPercent, cakeSize, chocolateType, poundAddon, chocolateIcingCount, ...cupcakeFinishCounts },
    quantity,
  )
  const promoKind = reservationPromoKind(reservation)
  const totalPrice = reservation.reviewCouponId
    ? reservation.totalPrice
    : promoKind && promoAppliesToProduct(promoKind, productId)
      ? discountedByTenPercent(originalTotalPrice)
      : originalTotalPrice

  return {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
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
