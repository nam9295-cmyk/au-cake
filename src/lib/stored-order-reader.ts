// Browser compatibility projection. No Appwrite writes or new-order submission.
import { isStoredCakeOrderProductId } from '../../appwrite-functions/reservation-api/src/active-cake-products.js'
import { DEFAULT_CHOCOLATE_TYPE, DEFAULT_POUND_ADDON, MAX_RESERVATION_QUANTITY, LEMON_PROMO_CODE, PROMO_CODE, PRODUCTS, fromCurrencyCents, getProductById, getCupcakeFinishSurcharge, getValidPromoCode, toCurrencyCents, getReservationPrice, normalizeChocolateIcingCount, normalizeCupcakeFinish, normalizeCupcakeFinishCounts, normalizeVanillaCakePointColor, normalizeStoredVanillaCakeFlavor, normalizeStoredVanillaCakeSheet, usesReservationChocolateType, normalizePoundAddon } from './constants'
import { isHistoricalWholeCakeSize, isHistoricalWholeCakeUnitPrice, normalizeStoredCakeSize } from './cake-serving'
import type { ReservationPriceOptions } from './constants'
import { getChocolateExtraPrice, normalizeChocolateExtra } from './chocolate-extras'
import { normalizeBrownieCreamOption } from './brownie-cream'
import { INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS, INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE, getIndividualPackagingPieceCount, isIndividualPackagingEligibleProduct } from './individual-packaging'
import type { CakeOrderLineRequest, CakeOrderLineResult, CakeSize, ChocolateType, PoundAddon, ProductId, PublicReservation, Reservation, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet } from './types'
import { getOrderLineBulkDiscountPercent, getOrderLineBulkDiscountCents } from './review-coupon-client'

export type AppwriteReservationDocument = Omit<Reservation, 'id' | 'productId' | 'chocolateExtra' | 'cakeSize' | 'chocolateType' | 'poundAddon' | 'chocolateIcingCount' | 'vanillaCreamCount' | 'partyDecorationCount' | 'vanillaCakeSheet' | 'vanillaCakeFlavor' | 'vanillaCakePointColor' | 'individualPackaging' | 'individualPackagingPieces' | 'individualPackagingFeeCents' | 'quantity' | 'totalPriceCents' | 'subtotalCents' | 'discountPercent' | 'discountCents' | 'discountBasisCents' | 'orderLines' | 'orderLineCount' | 'orderItemCount' | 'appliedPromoCodeLast4' | 'reviewCouponId'> & {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  productId?: string
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  chocolateIcingCount?: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
  vanillaCakeSheet?: VanillaCakeSheet
  vanillaCakeFlavor?: VanillaCakeFlavor
  vanillaCakePointColor?: VanillaCakePointColor
  quantity?: number
  totalPriceCents?: number
  subtotalCents?: number
  discountPercent?: number
  discountCents?: number
  discountBasisCents?: number
  individualPackagingPieces?: number
  individualPackagingFeeCents?: number
  orderLinesJson?: string
  orderLineCount?: number
  orderItemCount?: number
  appliedPromoCodeLast4?: string
  reviewCouponId?: string
}

type PublicReservationPayload = PublicReservation & {
  orderLines?: Array<CakeOrderLineRequest | CakeOrderLineResult>
  orderLineCount?: number
  orderItemCount?: number
  subtotalCents?: number
  discountBasisCents?: number
  discountPercent?: number
  discountCents?: number
  totalPriceCents?: number
}

function isCurrentStoredCakeSize(productId: ProductId, cakeSize: CakeSize) {
  const product = getProductById(productId)
  return product.usesSizeOptions
    ? Object.hasOwn(product.sizePrices, cakeSize)
    : cakeSize === '15cm'
}

function normalizeStoredReservationChocolateType(
  productId: ProductId,
  chocolateType: unknown,
  poundAddon: Reservation['poundAddon'],
) {
  return usesReservationChocolateType(productId, poundAddon)
    && (chocolateType === 'dark' || chocolateType === 'milk')
    ? chocolateType
    : DEFAULT_CHOCOLATE_TYPE
}

function normalizedLineUnitPriceCents(
  productId: ProductId,
  line: ReservationPriceOptions & { cupcakeFinish?: unknown },
  legacyCupcakeCounts: boolean,
) {
  const currentPrice = Math.round(getReservationPrice(productId, line) * 100)
  return legacyCupcakeCounts && productId === 'cupcake-dozen'
    ? currentPrice + Math.round(getCupcakeFinishSurcharge(productId, line.vanillaCreamCount, line.partyDecorationCount) * 100)
    : currentPrice
}

const LEGACY_STORED_UNIT_PRICE_CENTS: Partial<Record<ProductId, Partial<Record<CakeSize, readonly number[]>>>> = {
  'pave-cake': { '15cm': [7500], '19cm': [9500], '22cm': [11500] },
  'vanilla-fresh-cream-cake': { '15cm': [7500], '19cm': [9800], '22cm': [13900] },
  'buttercream-cake': { '15cm': [7500], '19cm': [9800], '22cm': [13900] },
  'brownie-cheesecake': { '15cm': [5800] },
  'pave-brownie-cheesecake': { '15cm': [6800] },
}

function isApprovedStoredUnitPriceCents(
  productId: ProductId,
  cakeSize: CakeSize,
  currentUnitPriceCents: number,
  storedUnitPriceCents: number,
  allowHistoricalUnitPrice: boolean,
  hasBrownieCreamOption: boolean,
) {
  return (isCurrentStoredCakeSize(productId, cakeSize) && storedUnitPriceCents === currentUnitPriceCents)
    || (allowHistoricalUnitPrice
      && !(productId === 'brownie-cheesecake' && hasBrownieCreamOption)
      && (isHistoricalWholeCakeUnitPrice(productId, cakeSize, storedUnitPriceCents)
        || (LEGACY_STORED_UNIT_PRICE_CENTS[productId]?.[cakeSize]?.includes(storedUnitPriceCents) ?? false)))
}

function normalizePublicOrderLine(
  line: CakeOrderLineRequest | CakeOrderLineResult,
  {
    legacyCupcakeCounts = false,
    allowHistoricalUnitPrice = false,
  }: { legacyCupcakeCounts?: boolean; allowHistoricalUnitPrice?: boolean } = {},
) {
  if (!line || typeof line !== 'object' || Array.isArray(line)
    || typeof line.productId !== 'string' || !isStoredCakeOrderProductId(line.productId) || !Object.hasOwn(PRODUCTS, line.productId)) throw new Error('INVALID_RESERVATION_RESPONSE')
  const product = getProductById(line.productId)
  const poundAddon = normalizePoundAddon(product.id, line.poundAddon || DEFAULT_POUND_ADDON)
  const normalized = {
    productId: product.id,
    chocolateExtra: normalizeChocolateExtra(product.id, line.chocolateExtra),
    ...(product.id === 'brownie-cheesecake' && Object.hasOwn(line, 'brownieCreamOption')
      ? { brownieCreamOption: normalizeBrownieCreamOption(product.id, line.brownieCreamOption) }
      : {}),
    cakeSize: normalizeStoredCakeSize(line.cakeSize),
    chocolateType: normalizeStoredReservationChocolateType(product.id, line.chocolateType || DEFAULT_CHOCOLATE_TYPE, poundAddon),
    poundAddon,
    ...(Object.hasOwn(line, 'cupcakeFinish') ? {
      cupcakeFinish: normalizeCupcakeFinish(product.id, line.cupcakeFinish),
    } : {}),
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, line.chocolateIcingCount),
    ...normalizeCupcakeFinishCounts(product.id, line.vanillaCreamCount, line.partyDecorationCount),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(product.id, line.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(product.id, line.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(product.id, line.vanillaCakePointColor),
    ...(Object.hasOwn(line, 'individualPackaging') ? {
      individualPackaging: line.individualPackaging === true,
    } : {}),
    quantity: line.quantity,
  }
  if (!isCurrentStoredCakeSize(product.id, normalized.cakeSize)
    && !isHistoricalWholeCakeSize(product.id, normalized.cakeSize)) throw new Error('INVALID_RESERVATION_RESPONSE')
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || (product.id !== 'smore-stick' && line.quantity > MAX_RESERVATION_QUANTITY)) throw new Error('INVALID_RESERVATION_RESPONSE')
  for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity'] as const) {
    if (line[key] !== normalized[key]) throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (line.chocolateExtra !== undefined && line.chocolateExtra !== normalized.chocolateExtra) throw new Error('INVALID_RESERVATION_RESPONSE')
  if (line.brownieCreamOption !== undefined && line.brownieCreamOption !== normalized.brownieCreamOption) throw new Error('INVALID_RESERVATION_RESPONSE')
  if (Object.hasOwn(line, 'cupcakeFinish') && line.cupcakeFinish !== normalized.cupcakeFinish) throw new Error('INVALID_RESERVATION_RESPONSE')
  if (line.vanillaCakePointColor !== undefined && line.vanillaCakePointColor !== normalized.vanillaCakePointColor) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (Object.hasOwn(line, 'individualPackaging')) {
    if (typeof line.individualPackaging !== 'boolean'
      || (line.individualPackaging && !isIndividualPackagingEligibleProduct(product.id))) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
  }
  const priced = line as Partial<CakeOrderLineResult>
  const priceKeys = ['unitPriceCents', 'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents'] as const
  const packagingKeys = ['individualPackagingPieces', 'individualPackagingFeeCents'] as const
  const presentPriceKeys = priceKeys.filter((key) => Object.hasOwn(priced, key))
  if (presentPriceKeys.length === 0) return normalized
  if (presentPriceKeys.length !== priceKeys.length || priceKeys.some((key) => !Number.isSafeInteger(priced[key]) || (priced[key] as number) < 0)) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const hasPackagingFields = Object.hasOwn(line, 'individualPackaging')
  if (packagingKeys.some((key) => Object.hasOwn(priced, key)) !== hasPackagingFields
    || (hasPackagingFields && packagingKeys.some((key) => !Number.isSafeInteger(priced[key]) || (priced[key] as number) < 0))) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const unitPriceCents = normalizedLineUnitPriceCents(product.id, normalized, legacyCupcakeCounts)
  const chocolateExtraCents = Object.hasOwn(priced, 'chocolateExtraCents')
    ? priced.chocolateExtraCents as number
    : 0
  const subtotalCents = priced.subtotalCents as number
  const discountCents = priced.discountCents as number
  const totalPriceCents = priced.totalPriceCents as number
  const approvedUnitPriceCents = priced.unitPriceCents as number
  const individualPackagingPieces = hasPackagingFields ? priced.individualPackagingPieces as number : 0
  const individualPackagingFeeCents = hasPackagingFields ? priced.individualPackagingFeeCents as number : 0
  const expectedPackagingPieces = normalized.individualPackaging
    ? getIndividualPackagingPieceCount(product.id, line.quantity)
    : 0
  if (!Number.isSafeInteger(chocolateExtraCents) || chocolateExtraCents < 0
    || chocolateExtraCents !== Math.round(getChocolateExtraPrice(normalized.chocolateExtra) * 100)
    || !isApprovedStoredUnitPriceCents(
      product.id,
      normalized.cakeSize,
      unitPriceCents,
      approvedUnitPriceCents,
      allowHistoricalUnitPrice,
      Object.hasOwn(line, 'brownieCreamOption'),
    )
    || priced.subtotalCents !== approvedUnitPriceCents * line.quantity + chocolateExtraCents
    || individualPackagingPieces !== expectedPackagingPieces
    || totalPriceCents !== subtotalCents - discountCents + individualPackagingFeeCents
    || !(product.id === 'smore-stick' ? [0, 10, 20] : [0, 5, 10]).includes(priced.discountPercent!)) throw new Error('INVALID_RESERVATION_RESPONSE')
  return {
    ...normalized,
    ...Object.fromEntries(priceKeys.map((key) => [key, priced[key]])),
    chocolateExtraCents,
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }
}

function orderLineIdentityKey(line: CakeOrderLineRequest) {
  return JSON.stringify([
    line.productId, line.cakeSize, line.chocolateType, line.poundAddon, line.cupcakeFinish || '', line.chocolateIcingCount,
    line.vanillaCreamCount, line.partyDecorationCount, line.vanillaCakeSheet, line.vanillaCakeFlavor,
    normalizeVanillaCakePointColor(line.productId, line.vanillaCakePointColor),
    normalizeChocolateExtra(line.productId, line.chocolateExtra),
    normalizeBrownieCreamOption(line.productId, line.brownieCreamOption),
    line.individualPackaging === true,
  ])
}

function safeOrderSum(values: number[], invalid: () => never) {
  let total = 0
  for (const value of values) {
    total += value
    if (!Number.isSafeInteger(total)) invalid()
  }
  return total
}

function validateOrderPricing(
  lines: CakeOrderLineResult[],
  aggregates: {
    subtotalCents: number
    discountBasisCents: number
    discountPercent: number
    discountCents: number
    totalPriceCents: number
    individualPackagingPieces?: number
    individualPackagingFeeCents?: number
  },
  eligibleIndexes: number[],
  invalid: () => never,
  allowLegacyPackagingFee = false,
) {
  const canonicalKeys = lines.map(orderLineIdentityKey)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) invalid()
  if (aggregates.discountPercent !== 0 && eligibleIndexes.length === 0) invalid()
  const eligibleSet = new Set(eligibleIndexes)
  if (eligibleIndexes.some((index) => lines[index].productId === 'smore-stick')) invalid()
  if (lines.some((line, index) => line.discountPercent !== (line.productId === 'smore-stick' ? getOrderLineBulkDiscountPercent(line) : eligibleSet.has(index) ? aggregates.discountPercent : 0))) invalid()
  const bulkDiscounts = lines.map((line) => {
    try { return getOrderLineBulkDiscountCents(line) } catch { return invalid() }
  })
  const bulkDiscountCents = safeOrderSum(bulkDiscounts, invalid)
  const expectedBasis = safeOrderSum(eligibleIndexes.map((index) => lines[index].subtotalCents), invalid)
  const numerator = expectedBasis * aggregates.discountPercent
  if (!Number.isSafeInteger(numerator)) invalid()
  const expectedDiscount = Math.round(numerator / 100)
  const allocations = new Array<number>(lines.length).fill(0)
  const ranked = eligibleIndexes.map((index) => {
    const lineNumerator = lines[index].subtotalCents * aggregates.discountPercent
    if (!Number.isSafeInteger(lineNumerator)) invalid()
    allocations[index] = Math.floor(lineNumerator / 100)
    return { index, remainder: lineNumerator % 100, key: canonicalKeys[index] }
  }).sort((left, right) => right.remainder - left.remainder || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
  let remaining = expectedDiscount - safeOrderSum(allocations, invalid)
  for (const candidate of ranked) {
    if (remaining <= 0) break
    allocations[candidate.index] += 1
    remaining -= 1
  }
  if (remaining !== 0 || lines.some((line, index) => line.discountCents !== allocations[index] + bulkDiscounts[index])) invalid()

  const subtotalCents = safeOrderSum(lines.map((line) => line.subtotalCents), invalid)
  const discountCents = safeOrderSum(lines.map((line) => line.discountCents), invalid)
  const totalPriceCents = safeOrderSum(lines.map((line) => line.totalPriceCents), invalid)
  const individualPackagingPieces = safeOrderSum(lines.map((line) => line.individualPackagingPieces || 0), invalid)
  const individualPackagingFeeCents = safeOrderSum(lines.map((line) => line.individualPackagingFeeCents || 0), invalid)
  const selectedPackagingProductSubtotalCents = safeOrderSum(
    lines.filter((line) => line.individualPackaging === true).map((line) => line.subtotalCents),
    invalid,
  )
  const expectedPackagingFeeCents = selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  const legacyPackagingFeeCents = individualPackagingPieces >= 100
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  if (
    aggregates.subtotalCents !== subtotalCents || aggregates.discountBasisCents !== expectedBasis
    || aggregates.discountCents !== discountCents || aggregates.discountCents !== safeOrderSum([expectedDiscount, bulkDiscountCents], invalid)
    || aggregates.totalPriceCents !== totalPriceCents
    || aggregates.totalPriceCents !== aggregates.subtotalCents - aggregates.discountCents + individualPackagingFeeCents
    || (aggregates.individualPackagingPieces || 0) !== individualPackagingPieces
    || (aggregates.individualPackagingFeeCents || 0) !== individualPackagingFeeCents
    || (individualPackagingFeeCents !== expectedPackagingFeeCents
      && (!allowLegacyPackagingFee || individualPackagingFeeCents !== legacyPackagingFeeCents))
  ) invalid()
}

export function toPublicReservation(reservation: PublicReservation): PublicReservation {
  const payload = reservation as PublicReservationPayload
  const product = getProductById(reservation.productId)
  const poundAddon = normalizePoundAddon(product.id, reservation.poundAddon || DEFAULT_POUND_ADDON)
  const topProjection = {
    productId: product.id,
    chocolateExtra: normalizeChocolateExtra(product.id, reservation.chocolateExtra),
    ...(product.id === 'brownie-cheesecake' && Object.hasOwn(reservation, 'brownieCreamOption')
      ? { brownieCreamOption: normalizeBrownieCreamOption(product.id, reservation.brownieCreamOption) }
      : {}),
    cakeSize: normalizeStoredCakeSize(reservation.cakeSize),
    chocolateType: normalizeStoredReservationChocolateType(
      product.id,
      reservation.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      poundAddon,
    ),
    poundAddon,
    ...(reservation.cupcakeFinish == null ? {} : {
      cupcakeFinish: normalizeCupcakeFinish(product.id, reservation.cupcakeFinish),
    }),
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, reservation.chocolateIcingCount),
    ...normalizeCupcakeFinishCounts(product.id, reservation.vanillaCreamCount, reservation.partyDecorationCount),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(product.id, reservation.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(product.id, reservation.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(product.id, reservation.vanillaCakePointColor),
    ...(reservation.individualPackaging === undefined ? {} : {
      individualPackaging: reservation.individualPackaging === true,
    }),
    quantity: normalizeQuantity(reservation.quantity, reservation.productId),
  }
  const orderLines = payload.orderLines?.map((line) => normalizePublicOrderLine(line, { allowHistoricalUnitPrice: true }))
  if (payload.orderLines && (!orderLines?.length
    || payload.orderLineCount !== orderLines.length
    || payload.orderItemCount !== safeOrderSum(orderLines.map((line) => line.quantity), () => { throw new Error('INVALID_RESERVATION_RESPONSE') }))) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  if (orderLines) {
    const first = orderLines[0]
    for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'quantity'] as const) {
      if (topProjection[key] !== first[key]) throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    if (topProjection.chocolateExtra !== first.chocolateExtra) throw new Error('INVALID_RESERVATION_RESPONSE')
    if (topProjection.brownieCreamOption !== first.brownieCreamOption) throw new Error('INVALID_RESERVATION_RESPONSE')
  }

  const aggregateKeys = ['subtotalCents', 'discountBasisCents', 'discountPercent', 'discountCents', 'totalPriceCents'] as const
  const packagingAggregateKeys = ['individualPackagingPieces', 'individualPackagingFeeCents'] as const
  const presentAggregateKeys = aggregateKeys.filter((key) => payload[key] !== undefined)
  const hasPricedLines = Boolean(orderLines?.some((line) => Object.hasOwn(line, 'unitPriceCents')))
  if (hasPricedLines) {
    if (!orderLines?.every((line) => Object.hasOwn(line, 'unitPriceCents')) || presentAggregateKeys.length !== aggregateKeys.length) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    for (const key of aggregateKeys) {
      if (!Number.isSafeInteger(payload[key]) || payload[key]! < 0) throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    if (payload.discountPercent !== 0 && payload.discountPercent !== 5 && payload.discountPercent !== 10) throw new Error('INVALID_RESERVATION_RESPONSE')
    const pricedLines = orderLines as CakeOrderLineResult[]
    const presentPackagingAggregateKeys = packagingAggregateKeys.filter((key) => payload[key] !== undefined)
    const hasPackagedLines = pricedLines.some((line) => Object.hasOwn(line, 'individualPackaging'))
    const hasZeroValuePackagingProjection = !hasPackagedLines
      && payload.individualPackagingPieces === 0
      && payload.individualPackagingFeeCents === 0
    if (presentPackagingAggregateKeys.length !== (hasPackagedLines ? packagingAggregateKeys.length : 0)
      && !hasZeroValuePackagingProjection) {
      throw new Error('INVALID_RESERVATION_RESPONSE')
    }
    const eligibleIndexes = payload.discountPercent === 0
      ? []
      : pricedLines.map((line, index) => line.productId !== 'smore-stick' && line.discountPercent === payload.discountPercent ? index : -1).filter((index) => index >= 0)
    validateOrderPricing(pricedLines, {
      subtotalCents: payload.subtotalCents!,
      discountBasisCents: payload.discountBasisCents!,
      discountPercent: payload.discountPercent!,
      discountCents: payload.discountCents!,
      totalPriceCents: payload.totalPriceCents!,
      ...(hasPackagedLines ? {
        individualPackagingPieces: payload.individualPackagingPieces!,
        individualPackagingFeeCents: payload.individualPackagingFeeCents!,
      } : {}),
    }, eligibleIndexes, () => { throw new Error('INVALID_RESERVATION_RESPONSE') })
  } else if (presentAggregateKeys.length !== 0) {
    throw new Error('INVALID_RESERVATION_RESPONSE')
  }
  const aggregates = Object.fromEntries([...presentAggregateKeys, ...packagingAggregateKeys.filter((key) => payload[key] !== undefined)].map((key) => [key, payload[key]]))
  return {
    reservationNumber: reservation.reservationNumber,
    ...topProjection,
    pickupDate: reservation.pickupDate,
    pickupTime: reservation.pickupTime,
    cacaoPercent: reservation.cacaoPercent || '기본',
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
    ...(orderLines ? { orderLines, orderLineCount: payload.orderLineCount, orderItemCount: payload.orderItemCount } : {}),
    ...aggregates,
  } as PublicReservation
}

function normalizeQuantity(quantity?: number, productId?: ProductId) {
  const value = Number(quantity || 1)
  if (productId === 'smore-stick') {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_RESERVATION_RESPONSE')
    return value
  }
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

const STORED_ORDER_MAX_BYTES = 65_535

const PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  'productId', 'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount',
  'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'quantity', 'unitPriceCents',
  'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
])

const STORED_ORDER_LINE_KEYS = new Set([
  ...PRE_PACKAGING_STORED_ORDER_LINE_KEYS,
  'individualPackaging', 'individualPackagingPieces', 'individualPackagingFeeCents',
])

const CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  ...PRE_PACKAGING_STORED_ORDER_LINE_KEYS,
  'chocolateExtra', 'chocolateExtraCents',
])

const CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS = new Set([
  ...STORED_ORDER_LINE_KEYS,
  'chocolateExtra', 'chocolateExtraCents',
])

const BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  ...CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS,
  'brownieCreamOption',
])

const BROWNIE_CREAM_STORED_ORDER_LINE_KEYS = new Set([
  ...CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS,
  'brownieCreamOption',
])

const PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS = new Set([...PRE_PACKAGING_STORED_ORDER_LINE_KEYS].filter((key) => key !== 'cupcakeFinish'))

const LEGACY_STORED_ORDER_LINE_KEYS = new Set([...PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS].filter((key) => key !== 'vanillaCakePointColor'))

const SAFE_PROMO_LAST4_PATTERN = /^[A-Z0-9]{4}$/

const MANUAL_REVIEW_COUPON_ID_PATTERN = /^manual:[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

function invalidStoredOrder(): never {
  throw new Error('INVALID_STORED_ORDER')
}

function parseAdminStoredOrder(document: AppwriteReservationDocument, firstProjection: Reservation): Pick<
  Reservation,
  'orderLines' | 'orderLineCount' | 'orderItemCount' | 'subtotalCents' | 'discountBasisCents' | 'discountPercent' | 'discountCents' | 'totalPriceCents' | 'individualPackagingPieces' | 'individualPackagingFeeCents' | 'promotionKind'
> | null {
  const hasVersionedCompanionMetadata = [
    document.orderLineCount,
    document.orderItemCount,
    document.discountBasisCents,
  ].some((value) => value !== null && value !== undefined)
  if (!Object.hasOwn(document, 'orderLinesJson') || document.orderLinesJson == null) {
    if (hasVersionedCompanionMetadata) invalidStoredOrder()
    return null
  }
  if (typeof document.orderLinesJson !== 'string'
    || new TextEncoder().encode(document.orderLinesJson).byteLength > STORED_ORDER_MAX_BYTES) invalidStoredOrder()
  let payload: unknown
  try {
    payload = JSON.parse(document.orderLinesJson)
  } catch {
    invalidStoredOrder()
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Reflect.ownKeys(payload).length !== 2 || !Object.hasOwn(payload, 'version') || !Object.hasOwn(payload, 'lines')
    || (payload as { version?: unknown }).version !== 1 || !Array.isArray((payload as { lines?: unknown }).lines)
    || !(payload as { lines: unknown[] }).lines.length) invalidStoredOrder()
  const rawLines = (payload as { lines: unknown[] }).lines
  const packagingVersions = new Set<boolean>()
  const chocolateExtraVersions = new Set<boolean>()
  const orderLines = rawLines.map((rawLine): CakeOrderLineResult => {
    if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) invalidStoredOrder()
    const rawKeys = Reflect.ownKeys(rawLine)
    if (rawKeys.some((key) => typeof key !== 'string')) invalidStoredOrder()
    const keys = rawKeys as string[]
    const hasPackagingFields = keys.length === STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => STORED_ORDER_LINE_KEYS.has(key))
    const hasChocolateExtraPrePackagingFields = keys.length === CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS.has(key))
    const hasChocolateExtraPackagingFields = keys.length === CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS.has(key))
    const hasBrownieCreamPrePackagingFields = keys.length === BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS.has(key))
    const hasBrownieCreamPackagingFields = keys.length === BROWNIE_CREAM_STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => BROWNIE_CREAM_STORED_ORDER_LINE_KEYS.has(key))
    const hasBrownieCreamFields = hasBrownieCreamPrePackagingFields || hasBrownieCreamPackagingFields
    const hasChocolateExtraFields = hasChocolateExtraPrePackagingFields || hasChocolateExtraPackagingFields || hasBrownieCreamFields
    const hasCurrentPackagingFields = hasPackagingFields || hasChocolateExtraPackagingFields || hasBrownieCreamPackagingFields
    const hasPrePackagingFields = keys.length === PRE_PACKAGING_STORED_ORDER_LINE_KEYS.size
      && keys.every((key) => PRE_PACKAGING_STORED_ORDER_LINE_KEYS.has(key))
    const hasCupcakeFinish = hasCurrentPackagingFields || hasChocolateExtraPrePackagingFields || hasBrownieCreamPrePackagingFields || hasPrePackagingFields
    packagingVersions.add(hasCurrentPackagingFields)
    chocolateExtraVersions.add(hasChocolateExtraFields)
    const productId = (rawLine as { productId?: unknown }).productId
    if (hasBrownieCreamFields && productId !== 'brownie-cheesecake') invalidStoredOrder()
    const allowedKeys = hasBrownieCreamPackagingFields
      ? BROWNIE_CREAM_STORED_ORDER_LINE_KEYS
      : hasBrownieCreamPrePackagingFields
        ? BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS
        : hasChocolateExtraPackagingFields
      ? CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS
      : hasChocolateExtraPrePackagingFields
        ? CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS
        : hasPackagingFields
          ? STORED_ORDER_LINE_KEYS
      : hasCupcakeFinish
        ? PRE_PACKAGING_STORED_ORDER_LINE_KEYS
        : keys.length === PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS.size
        ? PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS
        : LEGACY_STORED_ORDER_LINE_KEYS
    if (keys.length !== allowedKeys.size
      || !keys.every((key) => typeof key === 'string' && allowedKeys.has(key))) invalidStoredOrder()
    try {
      const normalized = normalizePublicOrderLine(rawLine as CakeOrderLineResult, {
        legacyCupcakeCounts: !hasCupcakeFinish,
        allowHistoricalUnitPrice: true,
      })
      if (!Object.hasOwn(normalized, 'unitPriceCents')) invalidStoredOrder()
      return normalized as CakeOrderLineResult
    } catch {
      invalidStoredOrder()
    }
  })
  if (packagingVersions.size !== 1 || chocolateExtraVersions.size !== 1) invalidStoredOrder()
  const hasPackagingFields = packagingVersions.has(true)
  const safeSum = (values: number[]) => {
    let sum = 0
    for (const value of values) {
      sum += value
      if (!Number.isSafeInteger(sum)) invalidStoredOrder()
    }
    return sum
  }
  const orderItemCount = safeSum(orderLines.map((line) => line.quantity))
  const subtotalCents = safeSum(orderLines.map((line) => line.subtotalCents))
  const discountCents = safeSum(orderLines.map((line) => line.discountCents))
  const totalPriceCents = safeSum(orderLines.map((line) => line.totalPriceCents))
  const individualPackagingPieces = safeSum(orderLines.map((line) => line.individualPackagingPieces || 0))
  const individualPackagingFeeCents = safeSum(orderLines.map((line) => line.individualPackagingFeeCents || 0))
  if (
    document.orderLineCount !== orderLines.length || document.orderItemCount !== orderItemCount
    || document.subtotalCents !== subtotalCents || document.discountCents !== discountCents
    || document.totalPriceCents !== totalPriceCents
    || (hasPackagingFields && (
      document.individualPackagingPieces !== individualPackagingPieces
      || document.individualPackagingFeeCents !== individualPackagingFeeCents
    ))
    || !Number.isSafeInteger(document.discountBasisCents) || Number(document.discountBasisCents) < 0
    || ![0, 5, 10].includes(Number(document.discountPercent))
  ) invalidStoredOrder()

  const aggregateDiscountPercent = Number(document.discountPercent)
  const hasReviewCoupon = document.reviewCouponId != null
  const hasPromoLast4 = document.appliedPromoCodeLast4 != null
  let eligibleIndexes: number[] = []
  if (hasReviewCoupon) {
    if (
      typeof document.reviewCouponId !== 'string' || !document.reviewCouponId
      || !hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string'
      || !SAFE_PROMO_LAST4_PATTERN.test(document.appliedPromoCodeLast4)
      || (aggregateDiscountPercent !== 5 && aggregateDiscountPercent !== 10)
      || (document.reviewCouponId.startsWith('manual:')
        && (!MANUAL_REVIEW_COUPON_ID_PATTERN.test(document.reviewCouponId) || aggregateDiscountPercent !== 5))
    ) invalidStoredOrder()
    eligibleIndexes = orderLines.map((line, index) => line.productId !== 'smore-stick' ? index : -1).filter((index) => index >= 0)
  } else if (aggregateDiscountPercent === 10) {
    if (!hasPromoLast4 || typeof document.appliedPromoCodeLast4 !== 'string'
      || !SAFE_PROMO_LAST4_PATTERN.test(document.appliedPromoCodeLast4)) invalidStoredOrder()
    const staticCode = [PROMO_CODE, LEMON_PROMO_CODE]
      .find((code) => code.slice(-4).toUpperCase() === document.appliedPromoCodeLast4)
    const createdAt = new Date(document.createdAt || document.$createdAt || '')
    if (!staticCode || !Number.isFinite(createdAt.getTime())) invalidStoredOrder()
    eligibleIndexes = orderLines
      .map((line, index) => getValidPromoCode(line.productId, staticCode, createdAt) === staticCode ? index : -1)
      .filter((index) => index >= 0)
    if (eligibleIndexes.length === 0) invalidStoredOrder()
  } else if (aggregateDiscountPercent === 0) {
    if (hasReviewCoupon || hasPromoLast4) invalidStoredOrder()
  } else {
    invalidStoredOrder()
  }
  const promotionKind: NonNullable<Reservation['promotionKind']> = hasReviewCoupon
    ? document.reviewCouponId?.startsWith('manual:') ? 'manual-coupon' : 'review-reward'
    : hasPromoLast4
      ? 'static'
      : 'none'

  validateOrderPricing(orderLines, {
    subtotalCents,
    discountBasisCents: Number(document.discountBasisCents),
    discountPercent: aggregateDiscountPercent,
    discountCents,
    totalPriceCents,
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }, eligibleIndexes, invalidStoredOrder, true)
  const exactTotal = totalPriceCents / 100
  if (document.totalPrice !== exactTotal && document.totalPrice !== Math.round(exactTotal)) invalidStoredOrder()

  const first = orderLines[0]
  for (const key of ['productId', 'cakeSize', 'chocolateType', 'poundAddon', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'quantity'] as const) {
    if (firstProjection[key] !== first[key]
      || (key === 'quantity' && first.productId === 'smore-stick' && document.quantity !== first.quantity)) invalidStoredOrder()
  }
  if (Object.hasOwn(first, 'cupcakeFinish') !== Object.hasOwn(firstProjection, 'cupcakeFinish')
    || (Object.hasOwn(first, 'cupcakeFinish') && firstProjection.cupcakeFinish !== first.cupcakeFinish)) invalidStoredOrder()
  return {
    orderLines,
    orderLineCount: orderLines.length,
    orderItemCount,
    subtotalCents,
    discountBasisCents: document.discountBasisCents,
    discountPercent: document.discountPercent,
    discountCents,
    totalPriceCents,
    promotionKind,
    ...(hasPackagingFields ? { individualPackagingPieces, individualPackagingFeeCents } : {}),
  }
}

export function toReservation(document: AppwriteReservationDocument): Reservation {
  const reservation: Reservation = {
    id: document.$id,
    reservationNumber: document.reservationNumber,
    customerName: document.customerName,
    customerPhone: document.customerPhone,
    customerEmail: typeof document.customerEmail === 'string' ? document.customerEmail.trim().toLowerCase() : '',
    productId: getProductById(document.productId).id,
    chocolateExtra: 'none',
    cakeSize: normalizeStoredCakeSize(document.cakeSize),
    poundAddon: normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    chocolateType: normalizeStoredReservationChocolateType(
      getProductById(document.productId).id,
      document.chocolateType || DEFAULT_CHOCOLATE_TYPE,
      normalizePoundAddon(getProductById(document.productId).id, document.poundAddon || DEFAULT_POUND_ADDON),
    ),
    ...(document.cupcakeFinish == null ? {} : {
      cupcakeFinish: normalizeCupcakeFinish(getProductById(document.productId).id, document.cupcakeFinish),
    }),
    chocolateIcingCount: normalizeChocolateIcingCount(
      getProductById(document.productId).id,
      document.chocolateIcingCount,
    ),
    ...normalizeCupcakeFinishCounts(
      getProductById(document.productId).id,
      document.vanillaCreamCount,
      document.partyDecorationCount,
    ),
    vanillaCakeSheet: normalizeStoredVanillaCakeSheet(getProductById(document.productId).id, document.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeStoredVanillaCakeFlavor(getProductById(document.productId).id, document.vanillaCakeFlavor),
    vanillaCakePointColor: normalizeVanillaCakePointColor(getProductById(document.productId).id, document.vanillaCakePointColor),
    quantity: normalizeQuantity(document.quantity, getProductById(document.productId).id),
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent,
    requestNote: document.requestNote || '',
    status: document.status,
    paymentStatus: document.paymentStatus,
    totalPrice: document.totalPriceCents === undefined || document.totalPriceCents === null
      ? Number(document.totalPrice || 0)
      : fromCurrencyCents(document.totalPriceCents),
    totalPriceCents: document.totalPriceCents ?? toCurrencyCents(Number(document.totalPrice || 0)),
    subtotalCents: document.subtotalCents,
    discountPercent: document.discountPercent,
    discountCents: document.discountCents,
    discountBasisCents: document.discountBasisCents,
    appliedPromoCodeLast4: document.appliedPromoCodeLast4 ?? undefined,
    reviewCouponId: document.reviewCouponId ?? undefined,
    adminMemo: document.adminMemo || '',
    createdAt: document.createdAt || document.$createdAt || '',
    updatedAt: document.updatedAt || document.$updatedAt || '',
  }
  const storedOrder = parseAdminStoredOrder(document, reservation)
  return storedOrder
    ? {
        ...reservation,
        ...storedOrder,
        quantity: storedOrder.orderLines![0].quantity,
        chocolateExtra: storedOrder.orderLines?.[0]?.chocolateExtra || 'none',
        ...(Object.hasOwn(storedOrder.orderLines?.[0] || {}, 'brownieCreamOption') ? {
          brownieCreamOption: storedOrder.orderLines?.[0]?.brownieCreamOption,
        } : {}),
        ...(storedOrder.orderLines?.[0]?.individualPackaging !== undefined ? {
          individualPackaging: storedOrder.orderLines[0].individualPackaging,
        } : {}),
        totalPrice: fromCurrencyCents(storedOrder.totalPriceCents ?? 0),
      }
    : reservation
}
