// Current new-order integer-cents pricing, discounts and packaging. Does not interpret stored orders.
import { INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE, INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS, CHOCOLATE_EXTRA_PRICES_CENTS, PROMOTIONS, PRODUCTS, CUPCAKE_PRODUCT_IDS, CUPCAKE_FINISH_PRICES_CENTS, FINISH_PRICES, LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS, CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS, CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS, BROWNIE_FRESH_CREAM_SURCHARGE_CENTS, PROMO_DISCOUNT_RATE, INDIVIDUAL_PACKAGING_PRODUCT_PIECES, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS } from './cake-order-catalog.js'
import { fail, sydneyDateValue, SAFE_LAST4_PATTERN } from './reservation-input-policy.js'
import { canonicalOrderLineKey } from './cake-order-input.js'

export function calculateIndividualPackagingFeeCents(individualPackagingPieces, selectedPackagingProductSubtotalCents) {
  if (!Number.isSafeInteger(individualPackagingPieces) || individualPackagingPieces <= 0) return 0
  const baseFeeCents = individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  return selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : baseFeeCents
}

export function chocolateExtraPriceCents(chocolateExtra) {
  return CHOCOLATE_EXTRA_PRICES_CENTS[chocolateExtra] ?? fail('INVALID_CHOCOLATE_EXTRA')
}

export function safeOrderAmount(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('ORDER_AMOUNT_OVERFLOW')
  return value
}

export function smoreBulkPercent(line) {
  return line.productId === 'smore-stick' ? (line.quantity >= 12 ? 20 : line.quantity >= 6 ? 10 : 0) : 0
}

export function smoreBulkDiscount(line) {
  // Exact integer cents per piece avoid overflowing subtotal * percent.
  return line.productId === 'smore-stick' ? line.quantity * (450 * smoreBulkPercent(line) / 100) : 0
}

export function getValidPromoCode(productId, promoCode, now) {
  if (typeof promoCode !== 'string') return null
  const normalizedCode = promoCode.trim().toLowerCase()
  const promo = PROMOTIONS.find((candidate) => candidate.code === normalizedCode && candidate.productIds.has(productId))
  if (!promo || sydneyDateValue(now) > promo.expiresOn) return null
  return promo.code
}

export function unitPriceForCakeLine(line) {
  const product = PRODUCTS[line.productId]
  if (CUPCAKE_PRODUCT_IDS.has(line.productId) && Object.hasOwn(line, 'cupcakeFinish')) {
    return CUPCAKE_FINISH_PRICES_CENTS[line.productId][line.cupcakeFinish]
  }
  return Math.round((product.usesSize ? (product.sizePrices[line.cakeSize] ?? product.legacySizePrices?.[line.cakeSize]) : product.basePrice) * 100)
    + Math.round((product.usesFinish ? FINISH_PRICES[line.poundAddon] : 0) * 100)
    + line.chocolateIcingCount * LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS
    + line.vanillaCreamCount * CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS
    + line.partyDecorationCount * CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS
    + (line.brownieCreamOption === 'fresh-cream' ? BROWNIE_FRESH_CREAM_SURCHARGE_CENTS : 0)
}

export function validatePricingCoupon(promoCode, reviewCoupon) {
  if (reviewCoupon && typeof promoCode === 'string' && promoCode.trim()) fail('PROMO_CODE_INVALID')
  if (reviewCoupon && (
    (reviewCoupon.rewardPercent !== 5 && reviewCoupon.rewardPercent !== 10) ||
    typeof reviewCoupon.id !== 'string' || !reviewCoupon.id ||
    typeof reviewCoupon.codeLast4 !== 'string' ||
    !SAFE_LAST4_PATTERN.test(reviewCoupon.codeLast4)
  )) fail('PROMO_CODE_INVALID')
}

export function allocateDiscounts(lines, eligibleIndexes, discountPercent, discountCents) {
  const allocations = new Array(lines.length).fill(0)
  const ranked = eligibleIndexes.map((index) => {
    const numerator = lines[index].subtotalCents * discountPercent
    const floorCents = Math.floor(numerator / 100)
    allocations[index] = floorCents
    return { index, remainder: numerator % 100, key: canonicalOrderLineKey(lines[index]) }
  }).sort((left, right) => right.remainder - left.remainder || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
  let remainderCents = discountCents - allocations.reduce((sum, value) => sum + value, 0)
  for (const candidate of ranked) {
    if (remainderCents <= 0) break
    allocations[candidate.index] += 1
    remainderCents -= 1
  }
  return allocations
}

export function priceCakeOrderLines(lines, promoCode, now, reviewCoupon) {
  validatePricingCoupon(promoCode, reviewCoupon)
  const baseLines = lines.map((line) => {
    const unitPriceCents = unitPriceForCakeLine(line)
    const chocolateExtraCents = chocolateExtraPriceCents(line.chocolateExtra)
    return {
      ...line,
      unitPriceCents,
      chocolateExtraCents,
      subtotalCents: safeOrderAmount(unitPriceCents * line.quantity + chocolateExtraCents),
    }
  })
  let appliedPromoCode = null
  const eligibleIndexes = []
  for (let index = 0; index < baseLines.length; index += 1) {
    const linePromoCode = reviewCoupon ? null : getValidPromoCode(baseLines[index].productId, promoCode, now)
    if ((reviewCoupon && baseLines[index].productId !== 'smore-stick') || linePromoCode) eligibleIndexes.push(index)
    if (linePromoCode) appliedPromoCode = linePromoCode
  }
  if (reviewCoupon && eligibleIndexes.length === 0) fail('PROMO_CODE_INVALID')
  const discountPercent = reviewCoupon?.rewardPercent || (eligibleIndexes.length > 0 ? PROMO_DISCOUNT_RATE * 100 : 0)
  const discountBasisCents = eligibleIndexes.reduce((sum, index) => sum + baseLines[index].subtotalCents, 0)
  const promotionDiscountCents = Math.round(discountBasisCents * discountPercent / 100)
  const allocations = allocateDiscounts(baseLines, eligibleIndexes, discountPercent, promotionDiscountCents)
  const discountCents = safeOrderAmount(promotionDiscountCents + baseLines.reduce((sum, line) => sum + smoreBulkDiscount(line), 0))
  const individualPackagingPieces = baseLines.reduce((sum, line) => sum + (
    line.individualPackaging
      ? INDIVIDUAL_PACKAGING_PRODUCT_PIECES[line.productId] * line.quantity
      : 0
  ), 0)
  const selectedPackagingProductSubtotalCents = baseLines.reduce((sum, line) => sum + (
    line.individualPackaging ? line.subtotalCents : 0
  ), 0)
  const individualPackagingFeeCents = calculateIndividualPackagingFeeCents(
    individualPackagingPieces,
    selectedPackagingProductSubtotalCents,
  )
  const pricedLines = baseLines.map((line, index) => {
    const { individualPackaging, brownieCreamOption, ...legacyCompatibleLine } = line
    const lineDiscountPercent = eligibleIndexes.includes(index) ? discountPercent : smoreBulkPercent(line)
    const lineDiscountCents = allocations[index] + smoreBulkDiscount(line)
    const linePackagingPieces = line.individualPackaging
      ? INDIVIDUAL_PACKAGING_PRODUCT_PIECES[line.productId] * line.quantity
      : 0
    const linePackagingFeeCents = individualPackagingFeeCents === 0
      ? 0
      : linePackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
    return {
      ...legacyCompatibleLine,
      ...(BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS.has(line.productId) ? { brownieCreamOption } : {}),
      ...(individualPackagingPieces > 0 ? { individualPackaging } : {}),
      discountPercent: lineDiscountPercent,
      discountCents: lineDiscountCents,
      ...(individualPackagingPieces > 0 ? {
        individualPackagingPieces: linePackagingPieces,
        individualPackagingFeeCents: linePackagingFeeCents,
      } : {}),
      totalPriceCents: line.subtotalCents - lineDiscountCents + linePackagingFeeCents,
    }
  })
  const subtotalCents = safeOrderAmount(pricedLines.reduce((sum, line) => sum + line.subtotalCents, 0))
  const totalPriceCents = safeOrderAmount(subtotalCents - discountCents + individualPackagingFeeCents)
  return {
    lines: pricedLines,
    subtotalCents,
    discountBasisCents,
    discountPercent,
    discountCents,
    ...(individualPackagingPieces > 0 ? {
      individualPackagingPieces,
      individualPackagingFeeCents,
    } : {}),
    totalPrice: totalPriceCents / 100,
    totalPriceCents,
    appliedPromoCode,
    appliedPromoCodeLast4: reviewCoupon?.codeLast4 || (appliedPromoCode ? appliedPromoCode.slice(-4).toUpperCase() : undefined),
    reviewCouponId: reviewCoupon?.id,
  }
}

