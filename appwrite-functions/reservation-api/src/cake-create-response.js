import { parseStoredOrderLines } from './business.js'

export function cakeReservationResponse(document) {
  const discountCents = Number(document.discountCents || 0)
  const storedOrder = Object.hasOwn(document, 'orderLinesJson') ? parseStoredOrderLines(document) : null
  const customerEmail = typeof document.customerEmail === 'string' ? document.customerEmail.trim().toLowerCase() : ''
  const promotionKind = typeof document.reviewCouponId === 'string' && document.reviewCouponId.startsWith('manual:')
    ? 'manual-coupon'
    : document.reviewCouponId
      ? 'review-reward'
      : discountCents > 0 && Number(document.discountPercent || 0) > 0
        ? 'static'
        : 'none'
  return {
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    ...(customerEmail ? { customerEmail } : {}),
    productId: document.productId,
    cakeSize: document.cakeSize,
    chocolateType: document.chocolateType,
    poundAddon: document.poundAddon,
    ...(Object.hasOwn(document, 'cupcakeFinish') ? { cupcakeFinish: document.cupcakeFinish } : {}),
    chocolateIcingCount: Number(document.chocolateIcingCount || 0),
    vanillaCreamCount: Number(document.vanillaCreamCount || 0),
    partyDecorationCount: Number(document.partyDecorationCount || 0),
    vanillaCakeSheet: document.vanillaCakeSheet || (document.productId === 'vanilla-fresh-cream-cake' ? 'chocolate' : 'vanilla'),
    vanillaCakeFlavor: document.vanillaCakeFlavor || 'triple-berry',
    vanillaCakePointColor: storedOrder?.lines[0]?.vanillaCakePointColor || 'pink',
    ...(Object.hasOwn(storedOrder?.lines?.[0] || {}, 'individualPackaging') ? {
      individualPackaging: storedOrder.lines[0].individualPackaging === true,
    } : {}),
    quantity: storedOrder?.lines[0]?.quantity ?? document.quantity,
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: Number(document.totalPriceCents || 0) / 100,
    totalPriceCents: document.totalPriceCents,
    subtotalCents: document.subtotalCents,
    discountPercent: document.discountPercent,
    discountCents: document.discountCents,
    ...(storedOrder ? {
      orderLines: storedOrder.lines,
      orderLineCount: document.orderLineCount,
      orderItemCount: document.orderItemCount,
      discountBasisCents: document.discountBasisCents,
      ...(Object.hasOwn(document, 'individualPackagingPieces') ? {
        individualPackagingPieces: Number(document.individualPackagingPieces || 0),
        individualPackagingFeeCents: Number(document.individualPackagingFeeCents || 0),
      } : {}),
    } : {}),
    promotionKind,
    ...(document.appliedPromoCodeLast4 ? { appliedPromoCodeLast4: document.appliedPromoCodeLast4 } : {}),
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt,
    updatedAt: document.updatedAt || document.$updatedAt,
  }
}

