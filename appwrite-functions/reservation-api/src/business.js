import { MARKET_TIMEZONE, REVIEW_COUPON_ANIMALS, MANUAL_REVIEW_COUPON_PATTERN, SAFE_LAST4_PATTERN, fail, normalizeReviewCouponCode, requiredText, optionalText, normalizeAustralianMobile, validateAustralianMobile, validateEmail, isValidDateValue, zonedDateParts, sydneyDateValue, addDaysToDateValue, sydneyTimeCode, zonedTimestamp, minutes } from './reservation-input-policy.js'
export { REVIEW_COUPON_ANIMALS, REVIEW_COUPON_FRUITS, normalizeReviewCouponCode, normalizeAustralianMobile, isValidDateValue, sydneyDateValue } from './reservation-input-policy.js'
import { ReservationApiError } from './reservation-error.js'
import { parseStoredOrderLines } from './stored-order-reader.js'
export { ReservationApiError } from './reservation-error.js'
export { parseStoredOrderLines } from './stored-order-reader.js'
import { projectPublicCakeReservation } from './cake-lookup-response.js'
import { digestReviewCouponCode } from './coupon-digest.js'
import {
  ACTIVE_CAKE_ORDER_PRODUCT_IDS,
  isActiveCakeOrderProductId,
  isCompatCakeOrderProductId,
  isStoredCakeOrderProductId,
} from './active-cake-products.js'


export const PROMO_CODE = 'chocolate'
export const LEMON_PROMO_CODE = 'lemoni'
export const PROMO_DISCOUNT_RATE = 0.1
export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50
export const CUPCAKE_PACK_SIZE = 12
export const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50
export const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100
export const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50
export const INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS = 10_000
export const BROWNIE_FRESH_CREAM_SURCHARGE_CENTS = 2_000
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
export const VANILLA_CAKE_SHEETS = new Set(['chocolate'])
export const VANILLA_CAKE_FLAVORS = new Set(['plain'])
const LEGACY_VANILLA_CAKE_FLAVORS = new Set(['triple-berry', 'nutella-chocolate-chip'])
export const VANILLA_CAKE_POINT_COLORS = new Set(['pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'])
const CREAM_LAYER_CAKE_PRODUCT_IDS = new Set(['vanilla-fresh-cream-cake', 'buttercream-cake'])
const STRAWBERRY_CREAM_CAKE_PRODUCT_IDS = new Set([
  'fresh-strawberry-vanilla-cream-cake',
  'fresh-strawberry-chocolate-cream-cake',
])
const CHOCOLATE_EXTRA_PRICES_CENTS = Object.freeze({
  none: 0,
  'eiffel-6': 1000,
  'pave-100g': 1200,
  combo: 2000,
})
const BROWNIE_CREAM_OPTIONS = new Set(['none', 'fresh-cream'])
const BROWNIE_CHEESECAKE_PRODUCT_IDS = new Set(['brownie-cheesecake', 'pave-brownie-cheesecake'])
const BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS = new Set(['brownie-cheesecake'])
const CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS = new Set([
  'pave-cake',
  'buttercream-cake',
  'pound-cake',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
])
export const CAKE_SIZE_LABELS = {
  '6in': '6"',
  '8in': '8"',
  '10in': '10"',
  '15cm': '6" | serves 8',
  '19cm': '7.5" | serves 14',
  '22cm': '9" | serves 22',
}
export const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'
export const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'
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

const PROMOTIONS = [
  { code: PROMO_CODE, expiresOn: CHOCOLATE_PROMO_EXPIRES_ON, productIds: CHEESECAKE_PROMO_PRODUCT_IDS },
  { code: LEMON_PROMO_CODE, expiresOn: LEMONI_PROMO_EXPIRES_ON, productIds: FRESH_LEMON_CUPCAKE_PRODUCT_IDS },
]
export const MAX_RESERVATION_QUANTITY = 5
export const PICKUP_CUTOFF_HOUR = 20
export const LATE_ORDER_NEXT_DAY_START_MINUTES = 12 * 60
export const AU_CAKE_PICKUP_SCHEDULE = Object.freeze({
  timezone: MARKET_TIMEZONE,
  intervalMinutes: 15,
  weekdays: Object.freeze({
    0: Object.freeze({ open: '08:00', close: '20:00' }),
    1: Object.freeze({ open: '08:00', close: '20:00' }),
    2: Object.freeze({ open: '08:00', close: '20:00' }),
    3: Object.freeze({ open: '08:00', close: '20:00' }),
    4: Object.freeze({ open: '08:00', close: '20:00' }),
    5: Object.freeze({ open: '08:00', close: '20:00' }),
    6: Object.freeze({ open: '08:00', close: '20:00' }),
  }),
  closedIntervals: Object.freeze({
    '2026-08-29': Object.freeze([{ start: '09:30', end: '12:00' }]),
  }),
})
export const CLASS_SESSION_TIMES = ['10:00', '13:00', '16:00']
export const SPRING_CLASS_CAMPAIGN_2026 = Object.freeze({
  enabled: true,
  timezone: MARKET_TIMEZONE,
  allowedDates: Object.freeze(['2026-09-26', '2026-10-03', '2026-10-10']),
  sessionTimes: Object.freeze([...CLASS_SESSION_TIMES]),
  visibleThrough: '2026-10-10',
})
export const CLASS_SESSION_DURATION_MINUTES = 120
export const CLASS_BASIC_DURATION_MINUTES = 90
export const CLASS_ADVANCED_DURATION_MINUTES = 120
const CLASS_TYPES = new Set(['school-holiday-private-cake-class', 'cupcake-chocolate-class', 'advanced-2-tier-cake-class'])
const CLASS_COURSE_PLANS = new Set(['basic', 'advanced', 'basic-advanced-package'])
const BASIC_CLASS_SCHOOL_YEARS = new Set(['Kindy', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])
const ADVANCED_CLASS_SCHOOL_YEARS = new Set(['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])

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

if (ACTIVE_CAKE_ORDER_PRODUCT_IDS.some((productId) => !Object.hasOwn(PRODUCTS, productId))) {
  throw new Error('ACTIVE_CAKE_ORDER_PRODUCT_CATALOG_MISMATCH')
}

export function formatCakeSizeLabel(cakeSize) {
  return CAKE_SIZE_LABELS[cakeSize] || CAKE_SIZE_LABELS['15cm']
}

const FINISH_PRICES = {
  none: 0,
  'extra-chocolate': 7,
  'vanilla-cream': 10,
}

const CLASS_PRICES = {
  'year-1-2': 99,
  '1-child': 109,
  '2-friends': 198,
}




export function hashReviewCouponCode(value, hmacSecret) {
  return digestReviewCouponCode(normalizeReviewCouponCode(value), hmacSecret, ReservationApiError)
}

function strictFutureIso(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false
  const timestamp = new Date(value).getTime()
  return !Number.isNaN(timestamp) && timestamp > now.getTime()
}

export function validateReviewCoupon(coupon, normalizedCodeValue, now = new Date(), hmacSecret) {
  const normalizedCode = normalizeReviewCouponCode(normalizedCodeValue)
  const codeLast4 = normalizedCode.slice(-4)
  if (
    !coupon ||
    coupon.codeHash !== hashReviewCouponCode(normalizedCode, hmacSecret) ||
    !SAFE_LAST4_PATTERN.test(codeLast4) ||
    coupon.codeLast4 !== codeLast4 ||
    (MANUAL_REVIEW_COUPON_PATTERN.test(normalizedCode)
      ? coupon.rewardPercent !== 5
      : coupon.rewardPercent !== 5 && coupon.rewardPercent !== 10) ||
    coupon.scope !== 'cake' ||
    coupon.status !== 'active' ||
    !strictFutureIso(coupon.expiresAt, now)
  ) fail('PROMO_CODE_INVALID')
  return {
    id: coupon.$id || coupon.id,
    rewardPercent: coupon.rewardPercent,
    codeLast4,
  }
}






export function resolveCakeCustomerEmailMode(value) {
  return String(value ?? '').trim() === 'compat' ? 'compat' : 'required'
}

export function resolveCakeCatalogMode(value) {
  return value === 'compat' ? 'compat' : 'required'
}

function cakeCustomerEmail(input, customerEmailMode) {
  if (resolveCakeCustomerEmailMode(customerEmailMode) === 'compat' && !Object.hasOwn(input, 'customerEmail')) {
    return undefined
  }
  return validateEmail(input.customerEmail)
}







export function isSchoolPickupWindowClosed(_dateValue, _timeValue) {
  // Daily customer availability is now defined exclusively by the pickup
  // schedule and its explicit date closures.
  return false
}

export function isCakePickupServiceTime(dateValue, timeValue) {
  if (!isValidDateValue(dateValue)) return false
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue || '')
  if (!match) return false

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return false
  const weekday = new Date(`${dateValue}T00:00:00.000Z`).getUTCDay()
  const window = AU_CAKE_PICKUP_SCHEDULE.weekdays[weekday]
  if (!window) return false
  const pickupMinutes = hour * 60 + minute
  const openMinutes = minutes(window.open)
  const closeMinutes = minutes(window.close)
  const closedIntervals = AU_CAKE_PICKUP_SCHEDULE.closedIntervals[dateValue] || []
  const isSpeciallyClosed = closedIntervals.some((interval) => {
    const start = minutes(interval.start)
    const end = minutes(interval.end)
    return start !== null && end !== null && pickupMinutes >= start && pickupMinutes < end
  })
  return openMinutes !== null
    && closeMinutes !== null
    && pickupMinutes >= openMinutes
    && pickupMinutes <= closeMinutes
    && (pickupMinutes - openMinutes) % AU_CAKE_PICKUP_SCHEDULE.intervalMinutes === 0
    && !isSpeciallyClosed
}

function validatePickupDateTime(dateValue, timeValue, now) {
  if (!isValidDateValue(dateValue)) fail('INVALID_PICKUP_DATE')
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue || '')
  if (!match) fail('INVALID_PICKUP_TIME')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const totalMinutes = hour * 60 + minute
  if (minute % AU_CAKE_PICKUP_SCHEDULE.intervalMinutes !== 0 || hour > 23) {
    fail('INVALID_PICKUP_TIME')
  }
  if (zonedTimestamp(dateValue, timeValue) === null) fail('INVALID_PICKUP_DATE')

  const today = sydneyDateValue(now)
  const tomorrow = addDaysToDateValue(today, 1)
  const currentSydneyHour = zonedDateParts(now).hour
  const isTooSoon = dateValue <= today || (
    dateValue === tomorrow &&
    currentSydneyHour >= PICKUP_CUTOFF_HOUR &&
    totalMinutes < LATE_ORDER_NEXT_DAY_START_MINUTES
  )
  if (isTooSoon) fail('PICKUP_TIME_TOO_SOON')
  if (!isCakePickupServiceTime(dateValue, timeValue)) fail('PICKUP_TIME_UNAVAILABLE', 409)
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
  allowStoredProduct = false,
  allowLegacyCupcakeCounts = false,
  allowLegacyCreamCakeOptions = false,
  cakeCatalogMode = 'compat',
} = {}) {
  const isAllowedProduct = allowStoredProduct
    ? isStoredCakeOrderProductId(input.productId)
    : (isActiveCakeOrderProductId(input.productId)
      || (resolveCakeCatalogMode(cakeCatalogMode) === 'compat' && isCompatCakeOrderProductId(input.productId)))
  if (!isAllowedProduct || !Object.hasOwn(PRODUCTS, input.productId)) fail('INVALID_PRODUCT')
  if (!allowStoredProduct && BROWNIE_CHEESECAKE_PRODUCT_IDS.has(input.productId) && !Object.hasOwn(input, 'brownieCreamOption')) {
    fail('INVALID_BROWNIE_CREAM_OPTION')
  }
  const product = PRODUCTS[input.productId]

  const canUseLegacySize = allowStoredProduct || resolveCakeCatalogMode(cakeCatalogMode) === 'compat'
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
const ORDER_LINE_INPUT_KEYS = new Set([...ORDER_LINE_IDENTITY_KEYS, 'quantity'])
// Only this product accepts (and discards) known client price projections.
const SMORE_CLIENT_PRICE_KEYS = new Set([
  'price', 'unitPrice', 'totalPrice', 'unitPriceCents', 'subtotalCents',
  'discountPercent', 'discountCents', 'totalPriceCents', 'discountBasisCents',
  'chocolateExtraCents', 'individualPackagingPieces', 'individualPackagingFeeCents',
])

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
const CAKE_ORDER_REQUEST_KEYS = new Set([
  'customerName', 'customerPhone', 'customerEmail', 'pickupDate', 'pickupTime', 'requestNote',
  'promoCode', 'privacyConsent', 'requestId', 'website', 'orderLines',
])
const LEGACY_SINGLE_CAKE_INPUT_KEYS = new Set([
  ...CAKE_ORDER_REQUEST_KEYS,
  ...ORDER_LINE_INPUT_KEYS,
  'cacaoPercent',
])
const LEGACY_ORDER_LINE_FIELDS = new Set([...ORDER_LINE_IDENTITY_KEYS, 'quantity', 'cacaoPercent'])
const STORED_ORDER_MAX_BYTES = 65535

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKnownStrawberryPayloadFields(input, allowedKeys) {
  return Reflect.ownKeys(input).every((key) => typeof key === 'string' && allowedKeys.has(key))
}

function assertKnownStrawberryPayloadFields(input) {
  if (Object.hasOwn(input, 'orderLines')) {
    if (!Array.isArray(input.orderLines)) return
    if (input.orderLines.some((line) => isPlainObject(line) && STRAWBERRY_CREAM_CAKE_PRODUCT_IDS.has(line.productId))
      && !hasOnlyKnownStrawberryPayloadFields(input, CAKE_ORDER_REQUEST_KEYS)) {
      fail('INVALID_ORDER_LINE')
    }
    return
  }
  if (STRAWBERRY_CREAM_CAKE_PRODUCT_IDS.has(input.productId)
    && !hasOnlyKnownStrawberryPayloadFields(input, LEGACY_SINGLE_CAKE_INPUT_KEYS)) {
    fail('INVALID_ORDER_LINE')
  }
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

export function normalizeCakeOrderLines(orderLines, { cakeCatalogMode = 'compat' } = {}) {
  if (!Array.isArray(orderLines) || orderLines.length === 0) fail('INVALID_ORDER_LINE')
  const normalized = []
  const positions = new Map()
  for (const input of orderLines) {
    if (!isPlainObject(input) || Reflect.ownKeys(input).some((key) => typeof key !== 'string'
      || (!ORDER_LINE_INPUT_KEYS.has(key) && !(input.productId === 'smore-stick' && SMORE_CLIENT_PRICE_KEYS.has(key))))) {
      fail('INVALID_ORDER_LINE')
    }
    if (!validCakeQuantity(input.productId, input.quantity)) {
      fail('INVALID_QUANTITY')
    }
    const line = normalizedCakeLine(input, input.quantity, { cakeCatalogMode })
    const key = canonicalOrderLineKey(line)
    const existingPosition = positions.get(key)
    if (existingPosition === undefined) {
      positions.set(key, normalized.length)
      normalized.push(line)
      continue
    }
    const mergedQuantity = normalized[existingPosition].quantity + line.quantity
    if (!validCakeQuantity(line.productId, mergedQuantity)) fail('INVALID_QUANTITY')
    normalized[existingPosition] = { ...normalized[existingPosition], quantity: mergedQuantity }
  }
  return normalized
}

export function canonicalCakeRequestPayload(input, { customerEmailMode = 'required', cakeCatalogMode = 'compat' } = {}) {
  if (!isPlainObject(input)) fail('INVALID_REQUEST')
  assertKnownStrawberryPayloadFields(input)
  if (typeof input.website === 'string' && input.website.trim()) fail('INVALID_REQUEST')
  if (input.privacyConsent !== true) fail('CONSENT_REQUIRED')
  const customerName = requiredText(input.customerName, { min: 2, max: 80, code: 'INVALID_NAME' })
  const customerPhone = validateAustralianMobile(input.customerPhone)
  const customerEmail = cakeCustomerEmail(input, customerEmailMode)
  const requestNote = optionalText(input.requestNote, { max: 1000, code: 'REQUEST_NOTE_TOO_LONG' })
  let lines
  if (Object.hasOwn(input, 'orderLines')) {
    if ([...LEGACY_ORDER_LINE_FIELDS].some((field) => Object.hasOwn(input, field))) fail('INVALID_ORDER_LINE')
    lines = normalizeCakeOrderLines(input.orderLines, { cakeCatalogMode })
  } else {
    const quantity = input.productId === 'smore-stick' ? input.quantity : Number(input.quantity)
    if (!validCakeQuantity(input.productId, quantity)) fail('INVALID_QUANTITY')
    lines = [normalizedCakeLine(input, quantity, { cakeCatalogMode })]
  }
  const promoText = input.promoCode === undefined
    ? ''
    : typeof input.promoCode === 'string'
      ? input.promoCode.trim()
      : fail('PROMO_CODE_INVALID')
  const promoUpper = promoText.toUpperCase()
  const looksLikeCoupon = promoUpper.startsWith('VG') || promoUpper.startsWith('JENNIE')
    || REVIEW_COUPON_ANIMALS.some((animal) => promoUpper.startsWith(animal))
  const reviewCode = looksLikeCoupon ? normalizeReviewCouponCode(promoText) : null
  const staticCode = PROMOTIONS.find((promotion) => promotion.code === promoText.toLowerCase()
    && lines.some((line) => promotion.productIds.has(line.productId)))?.code
  return {
    version: 1,
    customerName,
    customerPhone,
    ...(customerEmail === undefined ? {} : { customerEmail }),
    pickupDate: typeof input.pickupDate === 'string' ? input.pickupDate : '',
    pickupTime: typeof input.pickupTime === 'string' ? input.pickupTime : '',
    requestNote,
    promoCode: reviewCode || staticCode || '',
    orderLines: [...lines].sort((left, right) => canonicalOrderLineKey(left).localeCompare(canonicalOrderLineKey(right))),
  }
}

export function getValidPromoCode(productId, promoCode, now) {
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



function validatePricingCoupon(promoCode, reviewCoupon) {
  if (reviewCoupon && typeof promoCode === 'string' && promoCode.trim()) fail('PROMO_CODE_INVALID')
  if (reviewCoupon && (
    (reviewCoupon.rewardPercent !== 5 && reviewCoupon.rewardPercent !== 10) ||
    typeof reviewCoupon.id !== 'string' || !reviewCoupon.id ||
    typeof reviewCoupon.codeLast4 !== 'string' ||
    !SAFE_LAST4_PATTERN.test(reviewCoupon.codeLast4)
  )) fail('PROMO_CODE_INVALID')
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

function priceCakeOrderLines(lines, promoCode, now, reviewCoupon) {
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

export function generateCakeReservationNumber(date = new Date()) {
  const ymd = sydneyDateValue(date).replaceAll('-', '')
  return `VG-C-AU-${ymd}-${sydneyTimeCode(date)}${Math.floor(Math.random() * 900 + 100)}`
}

export function generateClassReservationNumber(date = new Date()) {
  const ymd = sydneyDateValue(date).replaceAll('-', '')
  return `VG-KC-AU-${ymd}-${sydneyTimeCode(date)}${Math.floor(Math.random() * 900 + 100)}`
}

export function buildCakeReservation(input, {
  now = new Date(),
  reservationNumber = generateCakeReservationNumber(now),
  reviewCoupon,
  customerEmailMode = 'required',
  cakeCatalogMode = 'compat',
} = {}) {
  if (!input || typeof input !== 'object') fail('INVALID_REQUEST')
  assertKnownStrawberryPayloadFields(input)
  if (typeof input.website === 'string' && input.website.trim()) fail('INVALID_REQUEST')
  if (input.privacyConsent !== true) fail('CONSENT_REQUIRED')
  const customerName = requiredText(input.customerName, { min: 2, max: 80, code: 'INVALID_NAME' })
  const customerPhone = validateAustralianMobile(input.customerPhone)
  const customerEmail = cakeCustomerEmail(input, customerEmailMode)
  validatePickupDateTime(input.pickupDate, input.pickupTime, now)

  const requestNote = optionalText(input.requestNote, { max: 1000, code: 'REQUEST_NOTE_TOO_LONG' })
  let normalizedLines
  if (Object.hasOwn(input, 'orderLines')) {
    if ([...LEGACY_ORDER_LINE_FIELDS].some((field) => Object.hasOwn(input, field))) fail('INVALID_ORDER_LINE')
    normalizedLines = normalizeCakeOrderLines(input.orderLines, { cakeCatalogMode })
  } else {
    const quantity = input.productId === 'smore-stick' ? input.quantity : Number(input.quantity)
    if (!validCakeQuantity(input.productId, quantity)) fail('INVALID_QUANTITY')
    normalizedLines = [normalizedCakeLine(input, quantity, { cakeCatalogMode })]
  }
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

function validateAge(value, code) {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 3 || age > 18) fail(code)
  return age
}

export function isSpringClassBookingDateAllowed(value, now = new Date()) {
  if (!isValidDateValue(value) || !SPRING_CLASS_CAMPAIGN_2026.enabled) return false
  const today = sydneyDateValue(now)
  return today <= SPRING_CLASS_CAMPAIGN_2026.visibleThrough
    && value >= today
    && SPRING_CLASS_CAMPAIGN_2026.allowedDates.includes(value)
}

function classExtensionMinutes(value) {
  const normalized = value === undefined || value === null ? 0 : value
  if (normalized !== 0 && normalized !== 30) fail('INVALID_EXTENSION')
  return normalized
}

function classPricing(coursePlan, bookingType, extensionMinutes, advancedExtensionMinutes) {
  const participantCount = bookingType === '2-friends' ? 2 : 1
  const basicBaseCents = CLASS_PRICES[bookingType] * 100
  const advancedBaseCents = 15900
  const baseCents = coursePlan === 'advanced'
    ? advancedBaseCents
    : coursePlan === 'basic-advanced-package'
      ? basicBaseCents + advancedBaseCents
      : basicBaseCents
  const extensionCents = extensionMinutes === 30 ? 2000 * participantCount : 0
  const advancedExtensionCents = coursePlan === 'basic-advanced-package' && advancedExtensionMinutes === 30 ? 2000 : 0
  const discountPercent = coursePlan === 'basic-advanced-package' ? 5 : 0
  const discountCents = Math.round(baseCents * discountPercent / 100)
  const subtotalCents = baseCents + extensionCents + advancedExtensionCents
  return { subtotalCents, discountPercent, discountCents, totalPriceCents: subtotalCents - discountCents }
}

export function buildClassReservation(input, { now = new Date(), reservationNumber = generateClassReservationNumber(now) } = {}) {
  if (!input || typeof input !== 'object') fail('INVALID_REQUEST')
  if (typeof input.website === 'string' && input.website.trim()) fail('INVALID_REQUEST')
  const promoFieldIsPresent = (value) => value !== undefined && value !== null &&
    !(typeof value === 'string' && value.trim() === '')
  if (promoFieldIsPresent(input.promoCode) || promoFieldIsPresent(input.reviewCouponCode)) fail('PROMO_CODE_INVALID')
  if (!Object.hasOwn(CLASS_PRICES, input.bookingType)) fail('INVALID_BOOKING_TYPE')
  const coursePlan = input.coursePlan || 'basic'
  if (!CLASS_COURSE_PLANS.has(coursePlan)) fail('INVALID_COURSE_PLAN')
  const classType = input.classType || 'school-holiday-private-cake-class'
  if (!CLASS_TYPES.has(classType)) fail('INVALID_CLASS_TYPE')
  if (coursePlan === 'advanced' && classType !== 'advanced-2-tier-cake-class') fail('INVALID_CLASS_TYPE')
  if (coursePlan !== 'advanced' && classType === 'advanced-2-tier-cake-class') fail('INVALID_CLASS_TYPE')
  if (!isSpringClassBookingDateAllowed(input.classDate, now)) fail('INVALID_CLASS_DATE')
  if (!CLASS_SESSION_TIMES.includes(input.classTime)) fail('INVALID_CLASS_TIME')
  if (input.parentConsent !== true || input.cancellationAgreement !== true || input.privacyConsent !== true) fail('CONSENT_REQUIRED')
  if (typeof input.photoConsent !== 'boolean') fail('PHOTO_CONSENT_REQUIRED')

  const extensionMinutes = classExtensionMinutes(input.extensionMinutes)
  const advancedExtensionMinutes = classExtensionMinutes(input.advancedExtensionMinutes)
  if (coursePlan !== 'basic-advanced-package' && advancedExtensionMinutes !== 0) fail('INVALID_EXTENSION')
  const oneChildOnly = coursePlan === 'advanced' || coursePlan === 'basic-advanced-package'
  if (oneChildOnly && input.bookingType === '2-friends') fail('INVALID_PARTY_SIZE')

  const schoolYear = requiredText(input.schoolYear, { max: 40, code: 'INVALID_SCHOOL_YEAR' })
  const allowedSchoolYears = coursePlan === 'basic' ? BASIC_CLASS_SCHOOL_YEARS : ADVANCED_CLASS_SCHOOL_YEARS
  if (!allowedSchoolYears.has(schoolYear)) fail('INVALID_SCHOOL_YEAR')
  const expectedOneChildBookingType = ['Kindy', 'Year 1', 'Year 2'].includes(schoolYear) ? 'year-1-2' : '1-child'
  if (input.bookingType !== '2-friends' && input.bookingType !== expectedOneChildBookingType) fail('INVALID_BOOKING_TYPE')

  let advancedClassDate = ''
  let advancedClassTime = ''
  if (coursePlan === 'basic-advanced-package') {
    advancedClassDate = input.advancedClassDate
    advancedClassTime = input.advancedClassTime
    if (!isSpringClassBookingDateAllowed(advancedClassDate, now) || !CLASS_SESSION_TIMES.includes(advancedClassTime)) {
      fail('INVALID_PACKAGE_SESSION')
    }
    if (advancedClassDate === input.classDate && advancedClassTime === input.classTime) fail('INVALID_PACKAGE_SESSION')
  }

  const secondChild = input.bookingType === '2-friends'
  const secondChildSchoolYear = secondChild
    ? requiredText(input.secondChildSchoolYear, { max: 40, code: 'INVALID_SECOND_CHILD_SCHOOL_YEAR' })
    : ''
  if (secondChild && !BASIC_CLASS_SCHOOL_YEARS.has(secondChildSchoolYear)) fail('INVALID_SECOND_CHILD_SCHOOL_YEAR')
  const pricing = classPricing(coursePlan, input.bookingType, extensionMinutes, advancedExtensionMinutes)
  const durationMinutes = (coursePlan === 'advanced' ? CLASS_ADVANCED_DURATION_MINUTES : CLASS_BASIC_DURATION_MINUTES) + extensionMinutes
  const createdAt = now.toISOString()
  return {
    reservationNumber,
    classType,
    coursePlan,
    classDate: input.classDate,
    classTime: input.classTime,
    extensionMinutes,
    durationMinutes,
    ...(coursePlan === 'basic-advanced-package' ? {
      advancedClassDate,
      advancedClassTime,
      advancedExtensionMinutes,
      advancedDurationMinutes: CLASS_ADVANCED_DURATION_MINUTES + advancedExtensionMinutes,
    } : {}),
    bookingType: input.bookingType,
    parentName: requiredText(input.parentName, { min: 2, max: 80, code: 'INVALID_PARENT_NAME' }),
    parentPhone: validateAustralianMobile(input.parentPhone),
    parentEmail: validateEmail(input.parentEmail),
    childName: requiredText(input.childName, { min: 1, max: 80, code: 'INVALID_CHILD_NAME' }),
    childAge: validateAge(input.childAge, 'INVALID_CHILD_AGE'),
    schoolYear,
    secondChildName: secondChild
      ? requiredText(input.secondChildName, { min: 1, max: 80, code: 'INVALID_SECOND_CHILD_NAME' })
      : '',
    secondChildAge: secondChild ? validateAge(input.secondChildAge, 'INVALID_SECOND_CHILD_AGE') : null,
    secondChildSchoolYear,
    allergyNote: optionalText(input.allergyNote, { max: 1000, code: 'ALLERGY_NOTE_TOO_LONG' }),
    emergencyContact: requiredText(input.emergencyContact, { max: 120, code: 'INVALID_EMERGENCY_CONTACT' }),
    pickupPerson: requiredText(input.pickupPerson, { max: 80, code: 'INVALID_PICKUP_PERSON' }),
    parentConsent: true,
    cancellationAgreement: true,
    photoConsent: input.photoConsent,
    status: 'Requested',
    paymentStatus: 'Payment pending',
    totalPrice: Math.round(pricing.totalPriceCents / 100),
    ...pricing,
    depositAmount: 0,
    adminMemo: '',
    createdAt,
    updatedAt: createdAt,
  }
}


export function isCakePickupBlocked(_pickupDate, _pickupTime, _bookedSlots, _pickupOpenings = []) {
  // Kids Class reservations retain their own booking rules, but do not close
  // the independently requested Cake pickup schedule.
  return false
}

export function matchesLookupPhone(storedPhone, suppliedPhone) {
  const suppliedDigits = normalizeAustralianMobile(String(suppliedPhone || ''))
  const storedDigits = normalizeAustralianMobile(String(storedPhone || ''))
  return /^04\d{8}$/.test(suppliedDigits) && storedDigits === suppliedDigits
}




export function publicCakeReservation(document) {
  return projectPublicCakeReservation(document, parseStoredOrderLines, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS)
}
