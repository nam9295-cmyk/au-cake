// Pure new Cake order storage payload. Time and reservation identity are supplied by the caller.
import { fail } from './reservation-input-policy.js'
import { normalizeCakeReservationInput } from './cake-order-input.js'
import { priceCakeOrderLines } from './cake-order-pricing.js'

const STORED_ORDER_MAX_BYTES = 65535

export function serializeStoredOrderLines(lines) {
  const serialized = JSON.stringify({ version: 1, lines })
  if (new TextEncoder().encode(serialized).byteLength > STORED_ORDER_MAX_BYTES) fail('ORDER_TOO_LARGE', 413)
  return serialized
}

function buildPromoNote(note, pricing) {
  if (!pricing.appliedPromoCode) return note
  const discountedBasisCents = pricing.discountBasisCents - Math.round(pricing.discountBasisCents * pricing.discountPercent / 100)
  const promoLine = `[Promo ${pricing.appliedPromoCode}] 10% discount applied: ${(pricing.discountBasisCents / 100).toFixed(2)} -> ${(discountedBasisCents / 100).toFixed(2)}`
  const result = [promoLine, note].filter(Boolean).join('\n')
  if (result.length > 1000) fail('REQUEST_NOTE_TOO_LONG')
  return result
}

export function buildCakeOrderData(input, { now, reservationNumber, reviewCoupon, customerEmailMode, cakeCatalogMode }) {
  const { customerName, customerPhone, customerEmail, requestNote, normalizedLines } = normalizeCakeReservationInput(
    input, { now, customerEmailMode, cakeCatalogMode },
  )
  const pricing = priceCakeOrderLines(normalizedLines, input.promoCode, now, reviewCoupon)
  const firstLine = pricing.lines[0]
  const orderLineCount = pricing.lines.length
  const orderItemCount = pricing.lines.reduce((sum, line) => sum + line.quantity, 0)
  const orderLinesJson = serializeStoredOrderLines(pricing.lines)
  const createdAt = now.toISOString()

  return {
    reservationNumber,
    customerName,
    customerPhone,
    ...(customerEmail === undefined ? {} : { customerEmail }),
    productId: firstLine.productId,
    cakeSize: firstLine.cakeSize,
    chocolateType: firstLine.chocolateType,
    poundAddon: firstLine.poundAddon,
    cupcakeFinish: firstLine.cupcakeFinish,
    chocolateIcingCount: firstLine.chocolateIcingCount,
    vanillaCreamCount: firstLine.vanillaCreamCount,
    partyDecorationCount: firstLine.partyDecorationCount,
    vanillaCakeSheet: firstLine.vanillaCakeSheet,
    vanillaCakeFlavor: firstLine.vanillaCakeFlavor,
    quantity: firstLine.quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent: '기본',
    requestNote: buildPromoNote(requestNote, pricing),
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: pricing.totalPrice,
    totalPriceCents: pricing.totalPriceCents,
    subtotalCents: pricing.subtotalCents,
    discountBasisCents: pricing.discountBasisCents,
    discountPercent: pricing.discountPercent,
    discountCents: pricing.discountCents,
    ...(pricing.individualPackagingPieces > 0 ? {
      individualPackagingPieces: pricing.individualPackagingPieces,
      individualPackagingFeeCents: pricing.individualPackagingFeeCents,
    } : {}),
    orderLineCount,
    orderItemCount,
    orderLinesJson,
    ...(pricing.appliedPromoCodeLast4 ? { appliedPromoCodeLast4: pricing.appliedPromoCodeLast4 } : {}),
    ...(pricing.reviewCouponId ? { reviewCouponId: pricing.reviewCouponId } : {}),
    adminMemo: '',
    createdAt,
    updatedAt: createdAt,
  }
}

