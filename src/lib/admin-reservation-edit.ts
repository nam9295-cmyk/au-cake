import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  MAX_RESERVATION_QUANTITY,
  PROMO_CODE,
  applyPromoDiscount,
  getReservationPrice,
  normalizeCakeSize,
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

function normalizeQuantity(quantity: number) {
  const value = Number(quantity || 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

function reservationHasPromo(reservation: Reservation) {
  const escapedCode = PROMO_CODE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hasAuditNote = new RegExp(`^\\[Promo ${escapedCode}\\] 10% discount applied: \\d+(?:\\.\\d{2})? -> \\d+(?:\\.\\d{2})?(?:\\n|$)`, 'i')
    .test(reservation.requestNote || '')
  if (!hasAuditNote) return false

  const originalTotal = getReservationPrice(
    reservation.productId,
    {
      cacaoPercent: reservation.cacaoPercent,
      cakeSize: reservation.cakeSize,
      chocolateType: reservation.chocolateType,
      poundAddon: reservation.poundAddon,
    },
    normalizeQuantity(reservation.quantity),
  )
  const storedCents = reservation.totalPriceCents ?? toCurrencyCents(reservation.totalPrice)
  return storedCents === toCurrencyCents(applyPromoDiscount(originalTotal, PROMO_CODE))
}

export function buildAdminReservationUpdate(
  reservation: Reservation,
  edits: AdminReservationEditInput,
): AdminReservationUpdate {
  const productId = (edits.productId || reservation.productId) as ProductId
  const poundAddon = normalizePoundAddon(productId, (edits.poundAddon || reservation.poundAddon || DEFAULT_POUND_ADDON) as PoundAddon)
  const cakeSize = normalizeCakeSize(productId, (edits.cakeSize || reservation.cakeSize || DEFAULT_CAKE_SIZE) as CakeSize)
  const chocolateType = normalizeReservationChocolateType(
    productId,
    (edits.chocolateType || reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE) as ChocolateType,
    poundAddon,
  )
  const quantity = normalizeQuantity(edits.quantity ?? reservation.quantity)
  const cacaoPercent = (edits.cacaoPercent || reservation.cacaoPercent || '기본') as CacaoPercent
  const originalTotalPrice = getReservationPrice(productId, { cacaoPercent, cakeSize, chocolateType, poundAddon }, quantity)
  const totalPrice = reservationHasPromo(reservation)
    ? applyPromoDiscount(originalTotalPrice, PROMO_CODE)
    : originalTotalPrice

  return {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
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
