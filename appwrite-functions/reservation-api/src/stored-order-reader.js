import { ReservationApiError } from './reservation-error.js'
import { STORED_ORDER_MAX_BYTES, hasExactOwnKeys, REQUIRED_STORED_ORDER_DOCUMENT_KEYS, PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS, LEGACY_STORED_ORDER_LINE_KEYS, PRE_PACKAGING_STORED_ORDER_LINE_KEYS, STORED_ORDER_LINE_KEYS, CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS, CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS, validCakeQuantity, normalizedCakeLine, ORDER_LINE_IDENTITY_KEYS, canonicalOrderLineKey, isApprovedStoredUnitPrice, chocolateExtraPriceCents, smoreBulkPercent, INDIVIDUAL_PACKAGING_PRODUCT_PIECES, SAFE_LAST4_PATTERN, MANUAL_REVIEW_COUPON_ID_PATTERN, PROMOTIONS, getValidPromoCode, safeOrderAmount, smoreBulkDiscount, allocateDiscounts, calculateIndividualPackagingFeeCents, calculateLegacyIndividualPackagingFeeCents } from './stored-order-policy.js'

export function parseStoredOrderLines(document) {
  if (!document || !Object.hasOwn(document, 'orderLinesJson') || document.orderLinesJson == null) return null
  try {
    if (typeof document.orderLinesJson !== 'string') throw new Error('invalid serialization')
    if (new TextEncoder().encode(document.orderLinesJson).byteLength > STORED_ORDER_MAX_BYTES) throw new Error('oversized serialization')
    const payload = JSON.parse(document.orderLinesJson)
    if (!hasExactOwnKeys(payload, new Set(['version', 'lines'])) || payload.version !== 1 || !Array.isArray(payload.lines) || payload.lines.length === 0) {
      throw new Error('invalid payload')
    }
    if ([...REQUIRED_STORED_ORDER_DOCUMENT_KEYS].some((key) => !Object.hasOwn(document, key))) {
      throw new Error('missing document projection')
    }

    const canonicalKeys = new Set()
    let currentPackagingDocument = null
    let currentChocolateExtraDocument = null
    for (const line of payload.lines) {
      const preCupcakeFinishStoredLine = hasExactOwnKeys(line, PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS)
      const legacyStoredLine = hasExactOwnKeys(line, LEGACY_STORED_ORDER_LINE_KEYS)
      const prePackagingStoredLine = hasExactOwnKeys(line, PRE_PACKAGING_STORED_ORDER_LINE_KEYS)
      const hasPackagingFields = hasExactOwnKeys(line, STORED_ORDER_LINE_KEYS)
      const hasChocolateExtraPrePackagingFields = hasExactOwnKeys(line, CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS)
      const hasChocolateExtraPackagingFields = hasExactOwnKeys(line, CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS)
      const hasBrownieCreamPrePackagingFields = hasExactOwnKeys(line, BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS)
      const hasBrownieCreamPackagingFields = hasExactOwnKeys(line, BROWNIE_CREAM_STORED_ORDER_LINE_KEYS)
      const hasBrownieCreamFields = hasBrownieCreamPrePackagingFields || hasBrownieCreamPackagingFields
      const hasChocolateExtraFields = hasChocolateExtraPrePackagingFields || hasChocolateExtraPackagingFields || hasBrownieCreamFields
      const hasCurrentPackagingFields = hasPackagingFields || hasChocolateExtraPackagingFields || hasBrownieCreamPackagingFields
      const hasCupcakeFinish = prePackagingStoredLine || hasCurrentPackagingFields || hasChocolateExtraPrePackagingFields || hasBrownieCreamPrePackagingFields
      if (!preCupcakeFinishStoredLine && !legacyStoredLine && !prePackagingStoredLine && !hasChocolateExtraFields && !hasCurrentPackagingFields && !hasBrownieCreamFields) throw new Error('invalid line keys')
      if (currentPackagingDocument === null) currentPackagingDocument = hasCurrentPackagingFields
      if (currentPackagingDocument !== hasCurrentPackagingFields) throw new Error('mixed line versions')
      if (currentChocolateExtraDocument === null) currentChocolateExtraDocument = hasChocolateExtraFields
      if (currentChocolateExtraDocument !== hasChocolateExtraFields) throw new Error('mixed chocolate extra versions')
      if (hasBrownieCreamFields && !BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS.has(line.productId)) throw new Error('ineligible brownie cream fields')
      if (!validCakeQuantity(line.productId, line.quantity)) throw new Error('invalid quantity')
      for (const key of ['chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount']) {
        if (!Number.isInteger(line[key]) || line[key] < 0) throw new Error('invalid option count')
      }
      for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'vanillaCakeSheet', 'vanillaCakeFlavor']) {
        if (typeof line[key] !== 'string') throw new Error('invalid option')
      }
      const normalized = normalizedCakeLine(line, line.quantity, {
        allowStoredProduct: true,
        allowLegacyCupcakeCounts: !hasCupcakeFinish,
        allowLegacyCreamCakeOptions: true,
      })
      if (ORDER_LINE_IDENTITY_KEYS.some((key) =>
        key !== 'vanillaCakePointColor' &&
        (key !== 'cupcakeFinish' || hasCupcakeFinish) &&
        (key !== 'chocolateExtra' || hasChocolateExtraFields) &&
        (key !== 'brownieCreamOption' || hasBrownieCreamFields) &&
        (key !== 'individualPackaging' || hasCurrentPackagingFields) &&
        normalized[key] !== line[key])) {
        throw new Error('noncanonical line')
      }
      if (!legacyStoredLine && normalized.vanillaCakePointColor !== line.vanillaCakePointColor) {
        throw new Error('noncanonical point color')
      }
      const canonicalKey = canonicalOrderLineKey(normalized)
      if (canonicalKeys.has(canonicalKey)) throw new Error('duplicate line')
      canonicalKeys.add(canonicalKey)
      for (const key of ['unitPriceCents', 'subtotalCents', 'discountCents', 'totalPriceCents']) {
        if (!Number.isSafeInteger(line[key]) || line[key] < 0) throw new Error('invalid price')
      }
      if (!isApprovedStoredUnitPrice(line)) throw new Error('invalid unit price')
      const chocolateExtraCents = hasChocolateExtraFields ? chocolateExtraPriceCents(normalized.chocolateExtra) : 0
      if (hasChocolateExtraFields && (
        line.chocolateExtra !== normalized.chocolateExtra || line.chocolateExtraCents !== chocolateExtraCents
      )) throw new Error('invalid chocolate extra')
      if (line.subtotalCents !== line.unitPriceCents * line.quantity + chocolateExtraCents) throw new Error('invalid subtotal')
      if (line.productId === 'smore-stick'
        ? line.discountPercent !== smoreBulkPercent(line)
        : line.discountPercent !== 0 && line.discountPercent !== 5 && line.discountPercent !== 10) throw new Error('invalid discount percent')
      if (hasCurrentPackagingFields) {
        const expectedPieces = line.individualPackaging
          ? INDIVIDUAL_PACKAGING_PRODUCT_PIECES[line.productId] * line.quantity
          : 0
        if (line.individualPackagingPieces !== expectedPieces) throw new Error('invalid packaging pieces')
        if (!Number.isInteger(line.individualPackagingFeeCents) || line.individualPackagingFeeCents < 0) throw new Error('invalid packaging fee')
      }
      const packagingFeeCents = hasCurrentPackagingFields ? line.individualPackagingFeeCents : 0
      if (line.totalPriceCents !== line.subtotalCents - line.discountCents + packagingFeeCents) throw new Error('invalid total')
      if (line.discountPercent === 0 && line.discountCents !== 0) throw new Error('invalid undiscounted line')
    }

    const discountPercent = document.discountPercent
    if (discountPercent !== 0 && discountPercent !== 5 && discountPercent !== 10) throw new Error('invalid aggregate discount percent')
    const hasReviewCoupon = document.reviewCouponId != null
    const hasPromoLast4 = document.appliedPromoCodeLast4 != null
    let eligibleIndexes = []
    if (hasReviewCoupon) {
      if (
        typeof document.reviewCouponId !== 'string' || !document.reviewCouponId ||
        !hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string' ||
        !SAFE_LAST4_PATTERN.test(document.appliedPromoCodeLast4) ||
        (discountPercent !== 5 && discountPercent !== 10) ||
        (document.reviewCouponId.startsWith('manual:') && (
          !MANUAL_REVIEW_COUPON_ID_PATTERN.test(document.reviewCouponId) || discountPercent !== 5
        ))
      ) throw new Error('invalid review discount provenance')
      eligibleIndexes = payload.lines.map((line, index) => line.productId !== 'smore-stick' ? index : -1).filter((index) => index >= 0)
      if (eligibleIndexes.length === 0) throw new Error('ineligible review coupon')
    } else if (discountPercent === 10) {
      if (!hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string' || !SAFE_LAST4_PATTERN.test(document.appliedPromoCodeLast4)) {
        throw new Error('invalid static discount provenance')
      }
      const matchingPromotions = PROMOTIONS.filter(
        (promotion) => promotion.code.slice(-4).toUpperCase() === document.appliedPromoCodeLast4,
      )
      const createdAt = new Date(document.createdAt)
      if (matchingPromotions.length !== 1 || !Number.isFinite(createdAt.getTime())) throw new Error('unknown static promotion')
      const promotion = matchingPromotions[0]
      eligibleIndexes = payload.lines
        .map((line, index) => getValidPromoCode(line.productId, promotion.code, createdAt) === promotion.code ? index : -1)
        .filter((index) => index >= 0)
      if (eligibleIndexes.length === 0) throw new Error('ineligible static promotion')
    } else if (discountPercent === 0) {
      if (hasPromoLast4) throw new Error('unexpected discount provenance')
    } else {
      throw new Error('missing review discount provenance')
    }
    const eligibleIndexSet = new Set(eligibleIndexes)
    if (payload.lines.some((line, index) => line.discountPercent !== (eligibleIndexSet.has(index) ? discountPercent : smoreBulkPercent(line)))) {
      throw new Error('invalid line discount eligibility')
    }
    const discountBasisCents = eligibleIndexes.reduce((sum, index) => sum + payload.lines[index].subtotalCents, 0)
    const promotionDiscountCents = Math.round(discountBasisCents * discountPercent / 100)
    const discountCents = safeOrderAmount(promotionDiscountCents + payload.lines.reduce((sum, line) => sum + smoreBulkDiscount(line), 0))
    const expectedAllocations = allocateDiscounts(payload.lines, eligibleIndexes, discountPercent, promotionDiscountCents)
    if (payload.lines.some((line, index) => line.discountCents !== expectedAllocations[index] + smoreBulkDiscount(line))) throw new Error('invalid discount allocation')

    const individualPackagingPieces = currentPackagingDocument
      ? payload.lines.reduce((sum, line) => sum + line.individualPackagingPieces, 0)
      : 0
    const selectedPackagingProductSubtotalCents = currentPackagingDocument
      ? payload.lines.reduce((sum, line) => sum + (line.individualPackaging ? line.subtotalCents : 0), 0)
      : 0
    const expectedPackagingFeeCents = calculateIndividualPackagingFeeCents(
      individualPackagingPieces,
      selectedPackagingProductSubtotalCents,
    )
    const legacyPackagingFeeCents = calculateLegacyIndividualPackagingFeeCents(individualPackagingPieces)
    const storedPackagingFeeCents = currentPackagingDocument
      ? payload.lines.reduce((sum, line) => sum + line.individualPackagingFeeCents, 0)
      : 0
    if (currentPackagingDocument
      && storedPackagingFeeCents !== expectedPackagingFeeCents
      && storedPackagingFeeCents !== legacyPackagingFeeCents) {
      throw new Error('invalid aggregate packaging fee')
    }
    const subtotalCents = safeOrderAmount(payload.lines.reduce((sum, line) => sum + line.subtotalCents, 0))
    const totalPriceCents = safeOrderAmount(payload.lines.reduce((sum, line) => sum + line.totalPriceCents, 0))
    const orderLineCount = payload.lines.length
    const orderItemCount = payload.lines.reduce((sum, line) => sum + line.quantity, 0)
    const expectedDocumentValues = {
      subtotalCents,
      discountBasisCents,
      discountPercent,
      discountCents,
      totalPriceCents,
      orderLineCount,
      orderItemCount,
      ...(currentPackagingDocument ? {
        individualPackagingPieces,
        individualPackagingFeeCents: storedPackagingFeeCents,
      } : {}),
    }
    for (const [key, expected] of Object.entries(expectedDocumentValues)) {
      if (document[key] !== expected) throw new Error(`inconsistent ${key}`)
    }
    const exactTotal = totalPriceCents / 100
    if (document.totalPrice !== exactTotal && document.totalPrice !== Math.round(exactTotal)) {
      throw new Error('inconsistent totalPrice')
    }
    const firstLine = payload.lines[0]
    const firstLineHasCupcakeFinish = Object.hasOwn(firstLine, 'cupcakeFinish')
    const documentHasCupcakeFinish = typeof document.cupcakeFinish === 'string'
    if (firstLineHasCupcakeFinish !== documentHasCupcakeFinish) throw new Error('inconsistent cupcakeFinish projection')
    for (const key of [...ORDER_LINE_IDENTITY_KEYS.filter((key) =>
      key !== 'vanillaCakePointColor' &&
      key !== 'chocolateExtra' &&
      key !== 'brownieCreamOption' &&
      key !== 'individualPackaging' &&
      (key !== 'cupcakeFinish' || firstLineHasCupcakeFinish)), 'quantity']) {
      if (document[key] !== firstLine[key]) throw new Error(`inconsistent ${key}`)
    }
    return payload
  } catch {
    throw new ReservationApiError('INVALID_STORED_ORDER', 500)
  }
}
