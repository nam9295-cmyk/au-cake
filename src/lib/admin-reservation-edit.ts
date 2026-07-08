import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  MAX_RESERVATION_QUANTITY,
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
  const totalPrice = getReservationPrice(productId, { cacaoPercent, cakeSize, chocolateType, poundAddon }, quantity)

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
