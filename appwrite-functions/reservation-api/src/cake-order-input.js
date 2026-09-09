// Current Cake request validation, normalization and canonical identity; no stored-order reader or pricing execution.
import {
  MARKET_TIMEZONE,
  validateEmail,
  isValidDateValue,
  minutes,
  fail,
  zonedTimestamp,
  sydneyDateValue,
  addDaysToDateValue,
  zonedDateParts,
  requiredText,
  validateAustralianMobile,
  optionalText,
  REVIEW_COUPON_ANIMALS,
  normalizeReviewCouponCode,
} from './reservation-input-policy.js'
import {
  FRESH_LEMON_CUPCAKE_PRODUCT_IDS,
  CUPCAKE_PRODUCT_IDS,
  CUPCAKE_FINISHES,
  CREAM_LAYER_CAKE_PRODUCT_IDS,
  LEGACY_VANILLA_CAKE_FLAVORS,
  VANILLA_CAKE_POINT_COLORS,
  VANILLA_CAKE_SHEETS,
  VANILLA_CAKE_FLAVORS,
  CHOCOLATE_EXTRA_PRICES_CENTS,
  CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS,
  BROWNIE_CREAM_OPTIONS,
  BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS,
  PRODUCTS,
  BROWNIE_CHEESECAKE_PRODUCT_IDS,
  FINISH_PRICES,
  MAX_RESERVATION_QUANTITY,
  STRAWBERRY_CREAM_CAKE_PRODUCT_IDS,
  INDIVIDUAL_PACKAGING_PRODUCT_PIECES,
  PROMOTIONS,
} from './cake-order-catalog.js'
import { isActiveCakeOrderProductId, isCompatCakeOrderProductId } from './active-cake-products.js'

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

export function resolveCakeCustomerEmailMode(value) {
  return String(value ?? '').trim() === 'compat' ? 'compat' : 'required'
}

export function resolveCakeCatalogMode(value) {
  return value === 'compat' ? 'compat' : 'required'
}

export function cakeCustomerEmail(input, customerEmailMode) {
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

export function validatePickupDateTime(dateValue, timeValue, now) {
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

export function normalizeChocolateIcingCount(productId, value) {
  if (!FRESH_LEMON_CUPCAKE_PRODUCT_IDS.has(productId)) return 0
  const packSize = Number(productId.split('-').at(-1))
  const count = value === undefined || value === null || value === '' ? 0 : Number(value)
  if (!Number.isInteger(count) || count < 0 || count > packSize) fail('INVALID_ICING_COUNT')
  return count
}

function normalizeCupcakeFinishCounts() {
  // New requests have always discarded the pre-finish count fields.
  return { vanillaCreamCount: 0, partyDecorationCount: 0 }
}

export function normalizeCupcakeFinish(productId, value) {
  if (!CUPCAKE_PRODUCT_IDS.has(productId)) return 'basic'
  if (!CUPCAKE_FINISHES.has(value)) fail('INVALID_CUPCAKE_FINISH')
  return value
}

export function normalizeVanillaCakeOptions(productId, cakeSheet, flavor, pointColor) {
  if (!CREAM_LAYER_CAKE_PRODUCT_IDS.has(productId)) {
    return { vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink' }
  }
  const vanillaCakeSheet = cakeSheet === undefined || cakeSheet === 'vanilla' ? 'chocolate' : cakeSheet
  const vanillaCakeFlavor = flavor === undefined || flavor === 'plain' || LEGACY_VANILLA_CAKE_FLAVORS.has(flavor) ? 'plain' : flavor
  const vanillaCakePointColor = VANILLA_CAKE_POINT_COLORS.has(pointColor) ? pointColor : 'pink'
  const hasValidSheet = VANILLA_CAKE_SHEETS.has(vanillaCakeSheet)
  const hasValidFlavor = VANILLA_CAKE_FLAVORS.has(vanillaCakeFlavor)
  if (!hasValidSheet || !hasValidFlavor) {
    fail('INVALID_VANILLA_CAKE_OPTION')
  }
  return { vanillaCakeSheet, vanillaCakeFlavor, vanillaCakePointColor }
}

export function normalizeChocolateExtra(productId, value) {
  const chocolateExtra = value === undefined || value === null || value === '' ? 'none' : value
  if (typeof chocolateExtra !== 'string' || !Object.hasOwn(CHOCOLATE_EXTRA_PRICES_CENTS, chocolateExtra)) {
    fail('INVALID_CHOCOLATE_EXTRA')
  }
  return CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS.has(productId) ? chocolateExtra : 'none'
}

export function normalizeBrownieCreamOption(productId, value) {
  const brownieCreamOption = value === undefined || value === null || value === '' ? 'none' : value
  if (typeof brownieCreamOption !== 'string' || !BROWNIE_CREAM_OPTIONS.has(brownieCreamOption)) {
    fail('INVALID_BROWNIE_CREAM_OPTION')
  }
  return BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS.has(productId) ? brownieCreamOption : 'none'
}

export function normalizeCakeOptions(input, {
  cakeCatalogMode = 'compat',
} = {}) {
  const isAllowedProduct = isActiveCakeOrderProductId(input.productId)
    || (resolveCakeCatalogMode(cakeCatalogMode) === 'compat' && isCompatCakeOrderProductId(input.productId))
  if (!isAllowedProduct || !Object.hasOwn(PRODUCTS, input.productId)) fail('INVALID_PRODUCT')
  if (BROWNIE_CHEESECAKE_PRODUCT_IDS.has(input.productId) && !Object.hasOwn(input, 'brownieCreamOption')) {
    fail('INVALID_BROWNIE_CREAM_OPTION')
  }
  const product = PRODUCTS[input.productId]

  const canUseLegacySize = resolveCakeCatalogMode(cakeCatalogMode) === 'compat'
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
  )
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    input.productId,
    input.vanillaCreamCount,
    input.partyDecorationCount,
  )
  const vanillaCakeOptions = normalizeVanillaCakeOptions(
    input.productId,
    input.vanillaCakeSheet,
    input.vanillaCakeFlavor,
    input.vanillaCakePointColor,
  )
  const chocolateExtra = normalizeChocolateExtra(input.productId, input.chocolateExtra)
  const brownieCreamOption = normalizeBrownieCreamOption(input.productId, input.brownieCreamOption)

  return {
    product, cakeSize, poundAddon, chocolateType, cupcakeFinish, chocolateIcingCount, chocolateExtra, brownieCreamOption,
    ...cupcakeFinishCounts, ...vanillaCakeOptions,
  }
}

export const LEGACY_ORDER_LINE_IDENTITY_KEYS = [
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

export const ORDER_LINE_IDENTITY_KEYS = [...LEGACY_ORDER_LINE_IDENTITY_KEYS, 'chocolateExtra', 'brownieCreamOption', 'individualPackaging']

export const ORDER_LINE_INPUT_KEYS = new Set([...ORDER_LINE_IDENTITY_KEYS, 'quantity'])

// Only this product accepts (and discards) known client price projections.
export const SMORE_CLIENT_PRICE_KEYS = new Set([
  'price', 'unitPrice', 'totalPrice', 'unitPriceCents', 'subtotalCents',
  'discountPercent', 'discountCents', 'totalPriceCents', 'discountBasisCents',
  'chocolateExtraCents', 'individualPackagingPieces', 'individualPackagingFeeCents',
])

export function validCakeQuantity(productId, quantity) {
  return Number.isSafeInteger(quantity) && quantity > 0
    && (productId === 'smore-stick' || quantity <= MAX_RESERVATION_QUANTITY)
}

export const CAKE_ORDER_REQUEST_KEYS = new Set([
  'customerName', 'customerPhone', 'customerEmail', 'pickupDate', 'pickupTime', 'requestNote',
  'promoCode', 'privacyConsent', 'requestId', 'website', 'orderLines',
])

export const LEGACY_SINGLE_CAKE_INPUT_KEYS = new Set([
  ...CAKE_ORDER_REQUEST_KEYS,
  ...ORDER_LINE_INPUT_KEYS,
  'cacaoPercent',
])

export const LEGACY_ORDER_LINE_FIELDS = new Set([...ORDER_LINE_IDENTITY_KEYS, 'quantity', 'cacaoPercent'])

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function hasOnlyKnownStrawberryPayloadFields(input, allowedKeys) {
  return Reflect.ownKeys(input).every((key) => typeof key === 'string' && allowedKeys.has(key))
}

export function assertKnownStrawberryPayloadFields(input) {
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

export function normalizedCakeLine(input, quantity, options) {
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

export function canonicalOrderLineKey(line) {
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

export function normalizeCakeReservationInput(input, { now, customerEmailMode, cakeCatalogMode }) {
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
  return { customerName, customerPhone, customerEmail, requestNote, normalizedLines }
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
