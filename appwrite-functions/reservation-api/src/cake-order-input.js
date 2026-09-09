// Current Cake request validation, normalization and canonical identity; no stored-order reader or pricing execution.
import { createHmac } from 'node:crypto'
import { resolveReviewCouponHmacSecret } from './coupon-digest.js'
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
  CUSTOM_CAKE_V1_BASE_CENTS,
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

// Opt-in wires have strict shapes and stable line identity. These exports do not
// widen legacy input acceptance or run the submit clock during canonical replay.
const WIRE_ID = /^[A-Za-z0-9_-]{1,64}$/
const WIRE_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const WIRE_OPTION_ENUMS = {
  cakeSize: ['6in', '8in', '10in', '15cm'],
  chocolateType: ['dark', 'milk'],
  poundAddon: ['none', 'extra-chocolate', 'vanilla-cream'],
  cupcakeFinish: ['basic', 'vanilla-fresh-cream', 'chocolate-buttercream'],
  chocolateExtra: ['none', 'eiffel-6', 'pave-100g', 'combo'],
  brownieCreamOption: ['none', 'fresh-cream'],
  vanillaCakeSheet: ['vanilla', 'chocolate'],
  vanillaCakeFlavor: ['plain', 'triple-berry'],
  vanillaCakePointColor: ['pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'],
}
const WIRE_OPTION_KEYS = [
  'cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount',
  'chocolateExtra', 'brownieCreamOption', 'vanillaCreamCount', 'partyDecorationCount',
  'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'individualPackaging',
]

function exactWireFields(value, keys) {
  if (!isPlainObject(value) || Reflect.ownKeys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) fail('INVALID_REQUEST')
}

function wireText(value, min = 0, max = 1000) {
  return requiredText(value, { min, max, code: 'INVALID_REQUEST' })
}

function wireInputBoundary(run) {
  try { return run() } catch (error) {
    if (['INVALID_REQUEST', 'INVALID_LINE_ID', 'INVALID_LINE_REFERENCE', 'INVALID_PHOTO_REFERENCE', 'PROMO_CODE_INVALID'].includes(error.code)) throw error
    if (error.status) fail('INVALID_REQUEST')
    throw error
  }
}

function normalizeWireOptions(line) {
  exactWireFields(line.options, WIRE_OPTION_KEYS)
  for (const [key, values] of Object.entries(WIRE_OPTION_ENUMS)) {
    if (!values.includes(line.options[key])) fail('INVALID_REQUEST')
  }
  const count = line.options.chocolateIcingCount
  if (!Number.isSafeInteger(count) || count < 0 || Object.is(count, -0)
    || line.options.vanillaCreamCount !== 0 || Object.is(line.options.vanillaCreamCount, -0)
    || line.options.partyDecorationCount !== 0 || Object.is(line.options.partyDecorationCount, -0)
    || typeof line.options.individualPackaging !== 'boolean'
    || line.productId === 'smore-stick') fail('INVALID_REQUEST')
  const normalized = normalizedCakeLine({ productId: line.productId, ...line.options }, line.quantity, { cakeCatalogMode: 'required' })
  return Object.fromEntries(WIRE_OPTION_KEYS.map(key => [key, normalized[key]]))
}

function normalizeWireLines(lines, custom) {
  if (!Array.isArray(lines) || lines.length === 0) fail('INVALID_REQUEST')
  const ids = new Set()
  const refs = new Set()
  const aggregate = new Map()
  const cakeKind = custom ? 'custom-cake' : 'cake'
  const normalized = lines.map(line => {
    if (!isPlainObject(line)) fail('INVALID_REQUEST')
    if (typeof line.lineId !== 'string' || !WIRE_ID.test(line.lineId) || ids.has(line.lineId)) fail('INVALID_LINE_ID')
    ids.add(line.lineId)
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) fail('INVALID_REQUEST')
    if (line.kind === cakeKind) {
      exactWireFields(line, custom
        ? ['kind', 'lineId', 'parentCakeLineId', 'productId', 'quantity', 'tier', 'size', 'designNote', 'figurineSource', 'photoRefs']
        : ['kind', 'lineId', 'parentCakeLineId', 'productId', 'quantity', 'options'])
      if (line.parentCakeLineId !== null) fail('INVALID_LINE_REFERENCE')
      if (line.quantity > MAX_RESERVATION_QUANTITY) fail('INVALID_REQUEST')
      let result = { kind: line.kind, lineId: line.lineId, parentCakeLineId: null, productId: line.productId, quantity: line.quantity }
      let identity
      if (custom) {
        if (line.productId !== 'custom-cake' || typeof line.tier !== 'string' || typeof line.size !== 'string'
          || !Object.hasOwn(CUSTOM_CAKE_V1_BASE_CENTS, line.tier)
          || !Object.hasOwn(CUSTOM_CAKE_V1_BASE_CENTS[line.tier], line.size)
          || !['none', 'customer', 'shop'].includes(line.figurineSource)) fail('INVALID_REQUEST')
        if (!Array.isArray(line.photoRefs)) fail('INVALID_PHOTO_REFERENCE')
        for (const ref of line.photoRefs) {
          if (typeof ref !== 'string' || !WIRE_ID.test(ref) || refs.has(ref)) fail('INVALID_PHOTO_REFERENCE')
          refs.add(ref)
        }
        if (refs.size > 5) fail('INVALID_PHOTO_REFERENCE')
        result = { ...result, tier: line.tier, size: line.size, designNote: wireText(line.designNote), figurineSource: line.figurineSource, photoRefs: [...line.photoRefs].sort() }
        // Notes and photos do not allow splitting the same base selection past 5.
        identity = JSON.stringify([line.tier, line.size])
      } else {
        result.options = normalizeWireOptions(line)
        identity = canonicalOrderLineKey({ productId: result.productId, ...result.options })
      }
      const quantity = (aggregate.get(identity) || 0) + line.quantity
      if (quantity > MAX_RESERVATION_QUANTITY) fail('INVALID_REQUEST')
      aggregate.set(identity, quantity)
      return result
    }
    exactWireFields(line, ['kind', 'lineId', 'productId', 'quantity', 'parentCakeLineId'])
    if (!['standalone-smore', 'cake-addon-smore'].includes(line.kind) || line.productId !== 'smore-stick') fail('INVALID_REQUEST')
    if (line.kind === 'standalone-smore' && line.parentCakeLineId !== null) fail('INVALID_LINE_REFERENCE')
    return { kind: line.kind, lineId: line.lineId, productId: line.productId, quantity: line.quantity, parentCakeLineId: line.parentCakeLineId }
  })
  if (custom && !normalized.some(line => line.kind === cakeKind)) fail('INVALID_REQUEST')
  const byId = new Map(normalized.map(line => [line.lineId, line]))
  for (const line of normalized) {
    if (line.kind === 'cake-addon-smore' && (typeof line.parentCakeLineId !== 'string'
      || !WIRE_ID.test(line.parentCakeLineId) || line.parentCakeLineId === line.lineId
      || byId.get(line.parentCakeLineId)?.kind !== cakeKind)) fail('INVALID_LINE_REFERENCE')
  }
  return normalized.sort((a, b) => a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0)
}

function normalizeWireRequest(value, contractVersion) {
  return wireInputBoundary(() => {
    if (!['custom-cake.v1', 'cake-order.v2'].includes(contractVersion)) fail('INVALID_REQUEST')
    const custom = contractVersion === 'custom-cake.v1'
    exactWireFields(value, ['contractVersion', 'requestId', 'customer', 'pickup', 'requestNote', 'privacyConsent', ...(custom ? [] : ['promoCode']), 'lines'])
    if (value.contractVersion !== contractVersion || typeof value.requestId !== 'string'
      || !WIRE_REQUEST_ID.test(value.requestId) || value.privacyConsent !== true) fail('INVALID_REQUEST')
    exactWireFields(value.customer, ['customerName', 'customerPhone', 'customerEmail'])
    exactWireFields(value.pickup, ['pickupDate', 'pickupTime'])
    if (!isValidDateValue(value.pickup.pickupDate) || typeof value.pickup.pickupTime !== 'string'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.pickup.pickupTime)
      || zonedTimestamp(value.pickup.pickupDate, value.pickup.pickupTime) === null) fail('INVALID_REQUEST')
    const result = {
      contractVersion,
      requestId: value.requestId,
      customer: {
        customerName: wireText(value.customer.customerName, 2, 80),
        customerPhone: validateAustralianMobile(value.customer.customerPhone),
        customerEmail: validateEmail(value.customer.customerEmail),
      },
      pickup: { pickupDate: value.pickup.pickupDate, pickupTime: value.pickup.pickupTime },
      requestNote: wireText(value.requestNote),
      privacyConsent: true,
    }
    if (!custom) {
      if (typeof value.promoCode !== 'string') fail('INVALID_REQUEST')
      const promo = value.promoCode.trim()
      result.promoCode = !promo ? '' : PROMOTIONS.find(p => p.code === promo.toLowerCase())?.code || normalizeReviewCouponCode(promo)
    }
    result.lines = normalizeWireLines(value.lines, custom)
    return result
  })
}

export function normalizeCustomCakeV1Request(value) {
  return normalizeWireRequest(value, 'custom-cake.v1')
}

export function normalizeCakeOrderV2Request(value) {
  return normalizeWireRequest(value, 'cake-order.v2')
}

export function validateNewCakeWirePickup(request, now) {
  return wireInputBoundary(() => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) fail('INVALID_REQUEST')
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('INVALID_REQUEST')
    const normalized = normalizeWireRequest(request, request.contractVersion)
    validatePickupDateTime(normalized.pickup.pickupDate, normalized.pickup.pickupTime, now)
  })
}

export function canonicalCustomCakeV1Request(value) {
  const { requestId: _requestId, ...payload } = normalizeCustomCakeV1Request(value)
  return JSON.stringify(payload)
}

export function canonicalCakeOrderV2Request(value) {
  const { requestId: _requestId, ...payload } = normalizeCakeOrderV2Request(value)
  return JSON.stringify(payload)
}

function fingerprintWire(canonical, domain, secretValue) {
  // Reuse the canonical base64url configuration convention even for injected bytes.
  const encoded = Buffer.isBuffer(secretValue) ? secretValue.toString('base64url') : secretValue
  const secret = resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: encoded })
  return createHmac('sha256', secret).update(domain, 'utf8').update(canonical, 'utf8').digest('hex')
}

export function fingerprintCustomCakeV1Request(value, secretValue) {
  return fingerprintWire(canonicalCustomCakeV1Request(value), 'custom-cake-request-v1\0', secretValue)
}

export function fingerprintCakeOrderV2Request(value, secretValue) {
  return fingerprintWire(canonicalCakeOrderV2Request(value), 'cake-request-v2\0', secretValue)
}
