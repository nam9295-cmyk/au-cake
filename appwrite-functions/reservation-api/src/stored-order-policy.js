// Compatibility rules captured from 896574f. Validate saved values without
// repricing or rewriting them. Independent of future new-order policy changes.
import { ReservationApiError } from './reservation-error.js'

const MARKET_TIMEZONE = 'Australia/Sydney'

const MANUAL_REVIEW_COUPON_ID_PATTERN = /^manual:[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/

const SAFE_LAST4_PATTERN = /^[A-Z0-9]{4}$/

const PROMO_CODE = 'chocolate'

const LEMON_PROMO_CODE = 'lemoni'

const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50

const CUPCAKE_PACK_SIZE = 12

const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50

const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100

const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50

const INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS = 10_000

const BROWNIE_FRESH_CREAM_SURCHARGE_CENTS = 2_000

const CUPCAKE_PRODUCT_IDS = new Set(['cupcake-half-dozen', 'cupcake-dozen'])

const CUPCAKE_FINISH_PRICES_CENTS = {
  'cupcake-half-dozen': {
    basic: 3100,
    'vanilla-fresh-cream': 3600,
    'chocolate-buttercream': 4100,
  },
  'cupcake-dozen': {
    basic: 5500,
    'vanilla-fresh-cream': 6400,
    'chocolate-buttercream': 7300,
  },
}

const CUPCAKE_FINISHES = new Set(['basic', 'vanilla-fresh-cream', 'chocolate-buttercream'])

const VANILLA_CAKE_SHEETS = new Set(['chocolate'])

const VANILLA_CAKE_FLAVORS = new Set(['plain'])

const LEGACY_VANILLA_CAKE_FLAVORS = new Set(['triple-berry', 'nutella-chocolate-chip'])

const VANILLA_CAKE_POINT_COLORS = new Set(['pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'])

const CREAM_LAYER_CAKE_PRODUCT_IDS = new Set(['vanilla-fresh-cream-cake', 'buttercream-cake'])

const CHOCOLATE_EXTRA_PRICES_CENTS = Object.freeze({
  none: 0,
  'eiffel-6': 1000,
  'pave-100g': 1200,
  combo: 2000,
})

const BROWNIE_CREAM_OPTIONS = new Set(['none', 'fresh-cream'])

const BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS = new Set(['brownie-cheesecake'])

const CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS = new Set([
  'pave-cake',
  'buttercream-cake',
  'pound-cake',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
])

const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'

const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'

const CHEESECAKE_PROMO_PRODUCT_IDS = new Set([
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
])

const FRESH_LEMON_CUPCAKE_PRODUCT_IDS = new Set([
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
])

const INDIVIDUAL_PACKAGING_PRODUCT_PIECES = Object.freeze({
  'cupcake-half-dozen': 6,
  'cupcake-dozen': 12,
  'fresh-lemon-cupcakes-6': 6,
  'fresh-lemon-cupcakes-8': 8,
  'fresh-lemon-cupcakes-12': 12,
  'fresh-lemon-cupcakes-16': 16,
})

function calculateIndividualPackagingFeeCents(individualPackagingPieces, selectedPackagingProductSubtotalCents) {
  if (!Number.isSafeInteger(individualPackagingPieces) || individualPackagingPieces <= 0) return 0
  const baseFeeCents = individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  return selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : baseFeeCents
}

function calculateLegacyIndividualPackagingFeeCents(individualPackagingPieces) {
  if (!Number.isSafeInteger(individualPackagingPieces) || individualPackagingPieces <= 0) return 0
  return individualPackagingPieces >= 100
    ? 0
    : individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
}

const PROMOTIONS = [
  { code: PROMO_CODE, expiresOn: CHOCOLATE_PROMO_EXPIRES_ON, productIds: CHEESECAKE_PROMO_PRODUCT_IDS },
  { code: LEMON_PROMO_CODE, expiresOn: LEMONI_PROMO_EXPIRES_ON, productIds: FRESH_LEMON_CUPCAKE_PRODUCT_IDS },
]

const MAX_RESERVATION_QUANTITY = 5

const PRODUCTS = {
  'smore-stick': { basePrice: 4.5, sizePrices: {}, usesSize: false, usesFinish: false },
  'pave-cake': {
    basePrice: 79,
    sizePrices: { '6in': 79, '8in': 109, '10in': 159 },
    legacySizePrices: { '15cm': 79, '19cm': 99, '22cm': 137 },
    usesSize: true,
    usesFinish: false,
  },
  'vanilla-fresh-cream-cake': {
    basePrice: 69,
    sizePrices: {},
    legacySizePrices: { '15cm': 69, '19cm': 89, '22cm': 119 },
    usesSize: true,
    usesFinish: false,
  },
  'buttercream-cake': {
    basePrice: 74,
    sizePrices: { '6in': 75, '8in': 99, '10in': 145 },
    legacySizePrices: { '15cm': 74, '19cm': 94, '22cm': 128 },
    usesSize: true,
    usesFinish: false,
  },
  'fresh-strawberry-vanilla-cream-cake': {
    basePrice: 65,
    sizePrices: { '6in': 65, '8in': 89, '10in': 129 },
    usesSize: true,
    usesFinish: false,
  },
  'fresh-strawberry-chocolate-cream-cake': {
    basePrice: 69,
    sizePrices: { '6in': 69, '8in': 95, '10in': 135 },
    usesSize: true,
    usesFinish: false,
  },
  'pound-cake': {
    basePrice: 45,
    sizePrices: {},
    usesSize: false,
    usesFinish: true,
  },
  'cupcake-half-dozen': {
    basePrice: 31,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'cupcake-dozen': {
    basePrice: 55,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'choco-basque-cheesecake': {
    basePrice: 55,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'pave-choco-basque-cheesecake': {
    basePrice: 65,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'eiffel-tower-basque-cheesecake': {
    basePrice: 70,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'brownie-cheesecake': {
    basePrice: 85,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'pave-brownie-cheesecake': {
    basePrice: 95,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'eiffel-tower-brownie-cheesecake': {
    basePrice: 70,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'fresh-lemon-cupcakes-6': { basePrice: 36, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-8': { basePrice: 45, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-12': { basePrice: 65, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-16': { basePrice: 85, sizePrices: {}, usesSize: false, usesFinish: false },
}

const FINISH_PRICES = {
  none: 0,
  'extra-chocolate': 7,
  'vanilla-cream': 10,
}

function fail(code, status = 400) {
  throw new ReservationApiError(code, status)
}

function zonedDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const number = (type) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
  }
}

function sydneyDateValue(date = new Date()) {
  const { year, month, day } = zonedDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function normalizeChocolateIcingCount(productId, value) {
  if (!FRESH_LEMON_CUPCAKE_PRODUCT_IDS.has(productId)) return 0
  const packSize = Number(productId.split('-').at(-1))
  const count = value === undefined || value === null || value === '' ? 0 : Number(value)
  if (!Number.isInteger(count) || count < 0 || count > packSize) fail('INVALID_ICING_COUNT')
  return count
}

function normalizeCupcakeFinishCounts(productId, vanillaValue, partyValue, { allowLegacyCupcakeCounts = false } = {}) {
  if (productId !== 'cupcake-dozen' || !allowLegacyCupcakeCounts) return { vanillaCreamCount: 0, partyDecorationCount: 0 }
  const normalize = (value) => value === undefined || value === null || value === '' ? 0 : value
  const vanillaCreamCount = normalize(vanillaValue)
  const partyDecorationCount = normalize(partyValue)
  if (
    !Number.isInteger(vanillaCreamCount) ||
    !Number.isInteger(partyDecorationCount) ||
    vanillaCreamCount < 0 ||
    partyDecorationCount < 0 ||
    vanillaCreamCount + partyDecorationCount > CUPCAKE_PACK_SIZE
  ) fail('INVALID_CUPCAKE_FINISH_COUNT')
  return { vanillaCreamCount, partyDecorationCount }
}

function normalizeCupcakeFinish(productId, value, { allowLegacyCupcakeCounts = false } = {}) {
  if (!CUPCAKE_PRODUCT_IDS.has(productId)) return 'basic'
  if (allowLegacyCupcakeCounts && value === undefined) return undefined
  if (!CUPCAKE_FINISHES.has(value)) fail('INVALID_CUPCAKE_FINISH')
  return value
}

function normalizeVanillaCakeOptions(productId, cakeSheet, flavor, pointColor, { allowLegacyCreamCakeOptions = false } = {}) {
  if (!CREAM_LAYER_CAKE_PRODUCT_IDS.has(productId)) {
    return { vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink' }
  }
  const vanillaCakeSheet = allowLegacyCreamCakeOptions
    ? (cakeSheet === 'vanilla' || cakeSheet === 'chocolate' ? cakeSheet : 'chocolate')
    : (cakeSheet === undefined || cakeSheet === 'vanilla' ? 'chocolate' : cakeSheet)
  const vanillaCakeFlavor = allowLegacyCreamCakeOptions
    ? (flavor === 'plain' || LEGACY_VANILLA_CAKE_FLAVORS.has(flavor) ? flavor : 'plain')
    : (flavor === undefined || flavor === 'plain' || LEGACY_VANILLA_CAKE_FLAVORS.has(flavor) ? 'plain' : flavor)
  const vanillaCakePointColor = VANILLA_CAKE_POINT_COLORS.has(pointColor) ? pointColor : 'pink'
  const hasValidSheet = allowLegacyCreamCakeOptions
    ? vanillaCakeSheet === 'vanilla' || VANILLA_CAKE_SHEETS.has(vanillaCakeSheet)
    : VANILLA_CAKE_SHEETS.has(vanillaCakeSheet)
  const hasValidFlavor = allowLegacyCreamCakeOptions
    ? VANILLA_CAKE_FLAVORS.has(vanillaCakeFlavor) || LEGACY_VANILLA_CAKE_FLAVORS.has(vanillaCakeFlavor)
    : VANILLA_CAKE_FLAVORS.has(vanillaCakeFlavor)
  if (!hasValidSheet || !hasValidFlavor) {
    fail('INVALID_VANILLA_CAKE_OPTION')
  }
  return { vanillaCakeSheet, vanillaCakeFlavor, vanillaCakePointColor }
}

function normalizeChocolateExtra(productId, value) {
  const chocolateExtra = value === undefined || value === null || value === '' ? 'none' : value
  if (typeof chocolateExtra !== 'string' || !Object.hasOwn(CHOCOLATE_EXTRA_PRICES_CENTS, chocolateExtra)) {
    fail('INVALID_CHOCOLATE_EXTRA')
  }
  return CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS.has(productId) ? chocolateExtra : 'none'
}

function chocolateExtraPriceCents(chocolateExtra) {
  return CHOCOLATE_EXTRA_PRICES_CENTS[chocolateExtra] ?? fail('INVALID_CHOCOLATE_EXTRA')
}

function normalizeBrownieCreamOption(productId, value) {
  const brownieCreamOption = value === undefined || value === null || value === '' ? 'none' : value
  if (typeof brownieCreamOption !== 'string' || !BROWNIE_CREAM_OPTIONS.has(brownieCreamOption)) {
    fail('INVALID_BROWNIE_CREAM_OPTION')
  }
  return BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS.has(productId) ? brownieCreamOption : 'none'
}

function normalizeCakeOptions(input, {
  allowLegacyCupcakeCounts = false,
  allowLegacyCreamCakeOptions = false,
} = {}) {
  const isAllowedProduct = typeof input.productId === 'string' && Object.hasOwn(PRODUCTS, input.productId)
  if (!isAllowedProduct) fail('INVALID_PRODUCT')
  const product = PRODUCTS[input.productId]

  const canUseLegacySize = true
  const hasCurrentSize = product.usesSize && Object.hasOwn(product.sizePrices, input.cakeSize)
  const hasLegacySize = product.usesSize && canUseLegacySize && Object.hasOwn(product.legacySizePrices || {}, input.cakeSize)
  const cakeSize = !product.usesSize
    ? '15cm'
    : hasCurrentSize || hasLegacySize
      ? input.cakeSize
      : input.cakeSize === undefined || input.cakeSize === null || input.cakeSize === ''
        ? (canUseLegacySize && Object.keys(product.legacySizePrices || {}).at(0)) || Object.keys(product.sizePrices).at(0)
        : fail('INVALID_CAKE_SIZE')
  const poundAddon = product.usesFinish && Object.hasOwn(FINISH_PRICES, input.poundAddon)
    ? input.poundAddon
    : 'none'
  const showsChocolate = input.productId === 'pave-cake' || (product.usesFinish && poundAddon === 'extra-chocolate')
  const chocolateType = showsChocolate && (input.chocolateType === 'dark' || input.chocolateType === 'milk')
    ? input.chocolateType
    : 'dark'
  const chocolateIcingCount = normalizeChocolateIcingCount(input.productId, input.chocolateIcingCount)
  const cupcakeFinish = normalizeCupcakeFinish(
    input.productId,
    input.cupcakeFinish,
    { allowLegacyCupcakeCounts },
  )
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    input.productId,
    input.vanillaCreamCount,
    input.partyDecorationCount,
    { allowLegacyCupcakeCounts },
  )
  const vanillaCakeOptions = normalizeVanillaCakeOptions(
    input.productId,
    input.vanillaCakeSheet,
    input.vanillaCakeFlavor,
    input.vanillaCakePointColor,
    { allowLegacyCreamCakeOptions },
  )
  const chocolateExtra = normalizeChocolateExtra(input.productId, input.chocolateExtra)
  const brownieCreamOption = normalizeBrownieCreamOption(input.productId, input.brownieCreamOption)

  return {
    product, cakeSize, poundAddon, chocolateType, cupcakeFinish, chocolateIcingCount, chocolateExtra, brownieCreamOption,
    ...cupcakeFinishCounts, ...vanillaCakeOptions,
  }
}

const LEGACY_ORDER_LINE_IDENTITY_KEYS = [
  'productId',
  'cakeSize',
  'chocolateType',
  'poundAddon',
  'cupcakeFinish',
  'chocolateIcingCount',
  'vanillaCreamCount',
  'partyDecorationCount',
  'vanillaCakeSheet',
  'vanillaCakeFlavor',
  'vanillaCakePointColor',
]

const ORDER_LINE_IDENTITY_KEYS = [...LEGACY_ORDER_LINE_IDENTITY_KEYS, 'chocolateExtra', 'brownieCreamOption', 'individualPackaging']

function validCakeQuantity(productId, quantity) {
  return Number.isSafeInteger(quantity) && quantity > 0
    && (productId === 'smore-stick' || quantity <= MAX_RESERVATION_QUANTITY)
}

function safeOrderAmount(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('ORDER_AMOUNT_OVERFLOW')
  return value
}

function smoreBulkPercent(line) {
  return line.productId === 'smore-stick' ? (line.quantity >= 12 ? 20 : line.quantity >= 6 ? 10 : 0) : 0
}

function smoreBulkDiscount(line) {
  // Exact integer cents per piece avoid overflowing subtotal * percent.
  return line.productId === 'smore-stick' ? line.quantity * (450 * smoreBulkPercent(line) / 100) : 0
}

const PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  ...LEGACY_ORDER_LINE_IDENTITY_KEYS,
  'quantity',
  'unitPriceCents',
  'subtotalCents',
  'discountPercent',
  'discountCents',
  'totalPriceCents',
])

const STORED_ORDER_LINE_KEYS = new Set([
  ...LEGACY_ORDER_LINE_IDENTITY_KEYS,
  'individualPackaging',
  'quantity',
  'unitPriceCents',
  'subtotalCents',
  'discountPercent',
  'discountCents',
  'individualPackagingPieces',
  'individualPackagingFeeCents',
  'totalPriceCents',
])

const CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS = new Set([
  ...PRE_PACKAGING_STORED_ORDER_LINE_KEYS,
  'chocolateExtra',
  'chocolateExtraCents',
])

const CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS = new Set([
  ...STORED_ORDER_LINE_KEYS,
  'chocolateExtra',
  'chocolateExtraCents',
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

const STORED_ORDER_MAX_BYTES = 65535

const REQUIRED_STORED_ORDER_DOCUMENT_KEYS = new Set([
  ...LEGACY_ORDER_LINE_IDENTITY_KEYS.filter((key) => key !== 'vanillaCakePointColor' && key !== 'cupcakeFinish'),
  'quantity',
  'subtotalCents',
  'discountBasisCents',
  'discountPercent',
  'discountCents',
  'totalPriceCents',
  'totalPrice',
  'orderLineCount',
  'orderItemCount',
])

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizedCakeLine(input, quantity, options) {
  if (input.productId === 'smore-stick') input = { productId: input.productId }
  const {
    cakeSize,
    poundAddon,
    chocolateType,
    cupcakeFinish,
    chocolateIcingCount,
    chocolateExtra,
    brownieCreamOption,
    vanillaCreamCount,
    partyDecorationCount,
    vanillaCakeSheet,
    vanillaCakeFlavor,
    vanillaCakePointColor,
  } = normalizeCakeOptions(input, options)
  if (input.individualPackaging !== undefined && typeof input.individualPackaging !== 'boolean') {
    fail('INVALID_INDIVIDUAL_PACKAGING')
  }
  const individualPackaging = input.individualPackaging === true
  if (individualPackaging && !Object.hasOwn(INDIVIDUAL_PACKAGING_PRODUCT_PIECES, input.productId)) {
    fail('INVALID_INDIVIDUAL_PACKAGING')
  }
  return {
    productId: input.productId,
    cakeSize,
    chocolateType,
    poundAddon,
    cupcakeFinish,
    chocolateIcingCount,
    chocolateExtra,
    brownieCreamOption,
    vanillaCreamCount,
    partyDecorationCount,
    vanillaCakeSheet,
    vanillaCakeFlavor,
    vanillaCakePointColor,
    individualPackaging,
    quantity,
  }
}

function canonicalOrderLineKey(line) {
  return JSON.stringify(ORDER_LINE_IDENTITY_KEYS.map((key) => line[key]))
}

function getValidPromoCode(productId, promoCode, now) {
  if (typeof promoCode !== 'string') return null
  const normalizedCode = promoCode.trim().toLowerCase()
  const promo = PROMOTIONS.find((candidate) => candidate.code === normalizedCode && candidate.productIds.has(productId))
  if (!promo || sydneyDateValue(now) > promo.expiresOn) return null
  return promo.code
}

function unitPriceForCakeLine(line) {
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

const LEGACY_STORED_UNIT_PRICE_CENTS = Object.freeze({
  'pave-cake': Object.freeze({ '15cm': [7500], '19cm': [9500], '22cm': [11500] }),
  'vanilla-fresh-cream-cake': Object.freeze({ '15cm': [7500], '19cm': [9800], '22cm': [13900] }),
  'buttercream-cake': Object.freeze({ '15cm': [7500], '19cm': [9800], '22cm': [13900] }),
  'brownie-cheesecake': Object.freeze({ '15cm': [5800] }),
  'pave-brownie-cheesecake': Object.freeze({ '15cm': [6800] }),
})

function isApprovedStoredUnitPrice(line) {
  if (line.unitPriceCents === unitPriceForCakeLine(line)) return true
  if (line.productId === 'brownie-cheesecake' && Object.hasOwn(line, 'brownieCreamOption')) return false
  return LEGACY_STORED_UNIT_PRICE_CENTS[line.productId]?.[line.cakeSize]?.includes(line.unitPriceCents) || false
}

function allocateDiscounts(lines, eligibleIndexes, discountPercent, discountCents) {
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

function hasExactOwnKeys(value, allowedKeys) {
  const keys = isPlainObject(value) ? Reflect.ownKeys(value) : []
  return keys.length === allowedKeys.size
    && keys.every((key) => typeof key === 'string' && allowedKeys.has(key))
}

export { STORED_ORDER_MAX_BYTES, hasExactOwnKeys, REQUIRED_STORED_ORDER_DOCUMENT_KEYS, PRE_CUPCAKE_FINISH_STORED_ORDER_LINE_KEYS, LEGACY_STORED_ORDER_LINE_KEYS, PRE_PACKAGING_STORED_ORDER_LINE_KEYS, STORED_ORDER_LINE_KEYS, CHOCOLATE_EXTRA_PRE_PACKAGING_STORED_ORDER_LINE_KEYS, CHOCOLATE_EXTRA_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_PRE_PACKAGING_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_STORED_ORDER_LINE_KEYS, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS, validCakeQuantity, normalizedCakeLine, ORDER_LINE_IDENTITY_KEYS, canonicalOrderLineKey, isApprovedStoredUnitPrice, chocolateExtraPriceCents, smoreBulkPercent, INDIVIDUAL_PACKAGING_PRODUCT_PIECES, SAFE_LAST4_PATTERN, MANUAL_REVIEW_COUPON_ID_PATTERN, PROMOTIONS, getValidPromoCode, safeOrderAmount, smoreBulkDiscount, allocateDiscounts, calculateIndividualPackagingFeeCents, calculateLegacyIndividualPackagingFeeCents }
