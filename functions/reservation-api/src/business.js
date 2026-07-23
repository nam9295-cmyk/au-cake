import { digestReviewCouponCode } from './coupon-digest.js'

const MARKET_TIMEZONE = 'Australia/Sydney'
const GENERATED_REVIEW_COUPON_ANIMALS = [
  'FOX', 'CAT', 'DOG', 'OWL', 'PIG', 'BEE', 'COW', 'CUB', 'EMU', 'HEN', 'KOI', 'PUP', 'RAM', 'YAK', 'APE',
]
export const REVIEW_COUPON_ANIMALS = [...GENERATED_REVIEW_COUPON_ANIMALS, 'JENNIE']
export const REVIEW_COUPON_FRUITS = [
  'KIWI', 'FIG', 'LIME', 'PEAR', 'PLUM', 'APPLE', 'GRAPE', 'GUAVA', 'LEMON', 'MANGO', 'MELON', 'PEACH',
]
const REVIEW_COUPON_PATTERN = new RegExp(
  `^(?:${GENERATED_REVIEW_COUPON_ANIMALS.join('|')})(?:${REVIEW_COUPON_FRUITS.join('|')})[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$`,
)
const MANUAL_REVIEW_COUPON_PATTERN = /^JENNIE[A-Z0-9]{5}$/
const SAFE_LAST4_PATTERN = /^[A-Z0-9]{4}$/

export const PROMO_CODE = 'chocolate'
export const LEMON_PROMO_CODE = 'lemoni'
export const PROMO_DISCOUNT_RATE = 0.1
export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50
export const CUPCAKE_PACK_SIZE = 12
export const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50
export const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100
export const CAKE_SIZE_LABELS = {
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
const PROMOTIONS = [
  { code: PROMO_CODE, expiresOn: CHOCOLATE_PROMO_EXPIRES_ON, productIds: CHEESECAKE_PROMO_PRODUCT_IDS },
  { code: LEMON_PROMO_CODE, expiresOn: LEMONI_PROMO_EXPIRES_ON, productIds: FRESH_LEMON_CUPCAKE_PRODUCT_IDS },
]
export const MAX_RESERVATION_QUANTITY = 5
export const PICKUP_CUTOFF_HOUR = 20
export const LATE_ORDER_NEXT_DAY_START_MINUTES = 12 * 60
export const CLASS_SESSION_TIMES = ['10:00', '13:00', '16:00']
export const CLASS_SESSION_DURATION_MINUTES = 120
export const CLASS_BASIC_DURATION_MINUTES = 90
export const CLASS_ADVANCED_DURATION_MINUTES = 120
const CLASS_TYPES = new Set(['school-holiday-private-cake-class', 'cupcake-chocolate-class', 'advanced-2-tier-cake-class'])
const CLASS_COURSE_PLANS = new Set(['basic', 'advanced', 'basic-advanced-package'])
const BASIC_CLASS_SCHOOL_YEARS = new Set(['Kindy', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])
const ADVANCED_CLASS_SCHOOL_YEARS = new Set(['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])

const PRODUCTS = {
  'pave-cake': {
    basePrice: 75,
    sizePrices: { '15cm': 75, '19cm': 95, '22cm': 115 },
    usesSize: true,
    usesFinish: false,
  },
  'vanilla-fresh-cream-cake': {
    basePrice: 75,
    sizePrices: { '15cm': 75, '19cm': 98, '22cm': 139 },
    usesSize: true,
    usesFinish: false,
  },
  'pound-cake': {
    basePrice: 45,
    sizePrices: {},
    usesSize: false,
    usesFinish: true,
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
    basePrice: 75,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'fresh-lemon-cupcakes-6': { basePrice: 36, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-8': { basePrice: 45, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-12': { basePrice: 65, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-16': { basePrice: 85, sizePrices: {}, usesSize: false, usesFinish: false },
}

export function formatCakeSizeLabel(cakeSize) {
  return CAKE_SIZE_LABELS[cakeSize] || CAKE_SIZE_LABELS['15cm']
}

const FINISH_PRICES = {
  none: 0,
  'extra-chocolate': 7,
  'vanilla-cream': 5,
}

const CLASS_PRICES = {
  'year-1-2': 99,
  '1-child': 109,
  '2-friends': 198,
}

export class ReservationApiError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.name = 'ReservationApiError'
    this.code = code
    this.status = status
  }
}

function fail(code, status = 400) {
  throw new ReservationApiError(code, status)
}

export function normalizeReviewCouponCode(value) {
  if (typeof value !== 'string') fail('PROMO_CODE_INVALID')
  const normalized = value.trim().toUpperCase()
  if (!REVIEW_COUPON_PATTERN.test(normalized) && !MANUAL_REVIEW_COUPON_PATTERN.test(normalized)) fail('PROMO_CODE_INVALID')
  return normalized
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

function requiredText(value, { min = 1, max, code }) {
  if (typeof value !== 'string') fail(code)
  const text = value.trim()
  if (text.length < min || (max !== undefined && text.length > max)) fail(code)
  return text
}

function optionalText(value, { max, code }) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(code)
  const text = value.trim()
  if (text.length > max) fail(code)
  return text
}

export function normalizeAustralianMobile(value) {
  if (typeof value !== 'string') return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 9 && digits.startsWith('4')) return `0${digits}`
  if (digits.length === 11 && digits.startsWith('61')) return `0${digits.slice(2)}`
  return digits
}

function validateAustralianMobile(value, code = 'INVALID_PHONE') {
  const phone = normalizeAustralianMobile(value)
  if (!/^04\d{8}$/.test(phone)) fail(code)
  return phone
}

function validateEmail(value) {
  const email = requiredText(value, { max: 120, code: 'INVALID_EMAIL' }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_EMAIL')
  return email
}

export function isValidDateValue(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
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

export function sydneyDateValue(date = new Date()) {
  const { year, month, day } = zonedDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDaysToDateValue(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function sydneyTimeCode(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MARKET_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value || '00'
  return `${value('hour')}${value('minute')}${value('second')}`
}

function zonedTimestamp(dateValue, timeValue) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!dateMatch || !timeMatch || !isValidDateValue(dateValue)) return null

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (target.hour > 23 || target.minute > 59) return null

  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  let timestamp = targetAsUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = zonedDateParts(new Date(timestamp))
    const representedAsUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    )
    const adjustment = targetAsUtc - representedAsUtc
    timestamp += adjustment
    if (adjustment === 0) break
  }

  const resolved = zonedDateParts(new Date(timestamp))
  return Object.entries(target).every(([key, value]) => resolved[key] === value) ? timestamp : null
}

function validatePickupDateTime(dateValue, timeValue, now) {
  if (!isValidDateValue(dateValue)) fail('INVALID_PICKUP_DATE')
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue || '')
  if (!match) fail('INVALID_PICKUP_TIME')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const totalMinutes = hour * 60 + minute
  if ((minute !== 0 && minute !== 30) || totalMinutes < 10 * 60 || totalMinutes > 20 * 60) {
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
}

function normalizeChocolateIcingCount(productId, value) {
  if (!FRESH_LEMON_CUPCAKE_PRODUCT_IDS.has(productId)) return 0
  const packSize = Number(productId.split('-').at(-1))
  const count = value === undefined || value === null || value === '' ? 0 : Number(value)
  if (!Number.isInteger(count) || count < 0 || count > packSize) fail('INVALID_ICING_COUNT')
  return count
}

function normalizeCupcakeFinishCounts(productId, vanillaValue, partyValue) {
  if (productId !== 'cupcake-dozen') return { vanillaCreamCount: 0, partyDecorationCount: 0 }
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

function normalizeCakeOptions(input) {
  if (!Object.hasOwn(PRODUCTS, input.productId)) fail('INVALID_PRODUCT')
  const product = PRODUCTS[input.productId]

  const cakeSize = product.usesSize && Object.hasOwn(product.sizePrices, input.cakeSize)
    ? input.cakeSize
    : '15cm'
  const poundAddon = product.usesFinish && Object.hasOwn(FINISH_PRICES, input.poundAddon)
    ? input.poundAddon
    : 'none'
  const showsChocolate = input.productId === 'pave-cake' || (product.usesFinish && poundAddon === 'extra-chocolate')
  const chocolateType = showsChocolate && (input.chocolateType === 'dark' || input.chocolateType === 'milk')
    ? input.chocolateType
    : 'dark'
  const chocolateIcingCount = normalizeChocolateIcingCount(input.productId, input.chocolateIcingCount)
  const cupcakeFinishCounts = normalizeCupcakeFinishCounts(
    input.productId,
    input.vanillaCreamCount,
    input.partyDecorationCount,
  )

  return { product, cakeSize, poundAddon, chocolateType, chocolateIcingCount, ...cupcakeFinishCounts }
}

function getValidPromoCode(productId, promoCode, now) {
  if (typeof promoCode !== 'string') return null
  const normalizedCode = promoCode.trim().toLowerCase()
  const promo = PROMOTIONS.find((candidate) => candidate.code === normalizedCode && candidate.productIds.has(productId))
  if (!promo || sydneyDateValue(now) > promo.expiresOn) return null
  return promo.code
}

function calculateCakeTotal(
  productId,
  product,
  cakeSize,
  poundAddon,
  chocolateIcingCount,
  vanillaCreamCount,
  partyDecorationCount,
  quantity,
  promoCode,
  now,
  reviewCoupon,
) {
  const unitPriceCents = Math.round((product.usesSize ? product.sizePrices[cakeSize] : product.basePrice) * 100)
    + Math.round((product.usesFinish ? FINISH_PRICES[poundAddon] : 0) * 100)
    + chocolateIcingCount * LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS
    + vanillaCreamCount * CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS
    + partyDecorationCount * CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS
  const originalTotalCents = unitPriceCents * quantity
  const originalTotal = originalTotalCents / 100
  if (reviewCoupon && typeof promoCode === 'string' && promoCode.trim()) fail('PROMO_CODE_INVALID')
  const appliedPromoCode = reviewCoupon ? null : getValidPromoCode(productId, promoCode, now)
  const staticPromoApplied = appliedPromoCode !== null
  const discountPercent = reviewCoupon?.rewardPercent || (staticPromoApplied ? PROMO_DISCOUNT_RATE * 100 : 0)
  if (reviewCoupon && (
    (discountPercent !== 5 && discountPercent !== 10) ||
    typeof reviewCoupon.id !== 'string' || !reviewCoupon.id ||
    typeof reviewCoupon.codeLast4 !== 'string' ||
    !SAFE_LAST4_PATTERN.test(reviewCoupon.codeLast4)
  )) fail('PROMO_CODE_INVALID')
  const discountedCents = reviewCoupon
    ? originalTotalCents - Math.round(originalTotalCents * discountPercent / 100)
    : staticPromoApplied
      ? Math.round(originalTotalCents * (1 - PROMO_DISCOUNT_RATE))
      : originalTotalCents
  const discountCents = originalTotalCents - discountedCents
  return {
    originalTotal,
    subtotalCents: originalTotalCents,
    discountPercent,
    discountCents,
    totalPrice: discountedCents / 100,
    totalPriceCents: discountedCents,
    promoApplied: staticPromoApplied || Boolean(reviewCoupon),
    appliedPromoCode,
    appliedPromoCodeLast4: reviewCoupon?.codeLast4 || (appliedPromoCode ? appliedPromoCode.slice(-4).toUpperCase() : undefined),
    reviewCouponId: reviewCoupon?.id,
    productId,
  }
}

function buildPromoNote(note, pricing) {
  if (!pricing.appliedPromoCode) return note
  const promoLine = `[Promo ${pricing.appliedPromoCode}] 10% discount applied: ${pricing.originalTotal.toFixed(2)} -> ${pricing.totalPrice.toFixed(2)}`
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
} = {}) {
  if (!input || typeof input !== 'object') fail('INVALID_REQUEST')
  if (typeof input.website === 'string' && input.website.trim()) fail('INVALID_REQUEST')
  if (input.privacyConsent !== true) fail('CONSENT_REQUIRED')
  const customerName = requiredText(input.customerName, { min: 2, max: 80, code: 'INVALID_NAME' })
  const customerPhone = validateAustralianMobile(input.customerPhone)
  const quantity = Number(input.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_RESERVATION_QUANTITY) fail('INVALID_QUANTITY')
  if (FRESH_LEMON_CUPCAKE_PRODUCT_IDS.has(input.productId) && quantity !== 1) fail('INVALID_QUANTITY')
  validatePickupDateTime(input.pickupDate, input.pickupTime, now)

  const requestNote = optionalText(input.requestNote, { max: 1000, code: 'REQUEST_NOTE_TOO_LONG' })
  const {
    product,
    cakeSize,
    poundAddon,
    chocolateType,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
  } = normalizeCakeOptions(input)
  const pricing = calculateCakeTotal(
    input.productId,
    product,
    cakeSize,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    quantity,
    input.promoCode,
    now,
    reviewCoupon,
  )
  const createdAt = now.toISOString()

  return {
    reservationNumber,
    customerName,
    customerPhone,
    productId: input.productId,
    cakeSize,
    chocolateType,
    poundAddon,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    quantity,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    cacaoPercent: '기본',
    requestNote: buildPromoNote(requestNote, pricing),
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: pricing.totalPrice,
    totalPriceCents: pricing.totalPriceCents,
    subtotalCents: pricing.subtotalCents,
    discountPercent: pricing.discountPercent,
    discountCents: pricing.discountCents,
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

function isWeekendDateValue(value) {
  if (!isValidDateValue(value)) return false
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
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
  if (!isWeekendDateValue(input.classDate) || input.classDate < sydneyDateValue(now)) fail('INVALID_CLASS_DATE')
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
    if (!isWeekendDateValue(advancedClassDate) || advancedClassDate < sydneyDateValue(now) || !CLASS_SESSION_TIMES.includes(advancedClassTime)) {
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

function minutes(value) {
  if (typeof value !== 'string') return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function isCakePickupBlocked(pickupDate, pickupTime, bookedSlots, pickupOpenings = []) {
  if (pickupOpenings.some((opening) => opening.pickupDate === pickupDate && opening.pickupTime === pickupTime)) return false
  const pickupMinutes = minutes(pickupTime)
  if (pickupMinutes === null) return false
  const slots = bookedSlots.filter((slot) => slot.classDate === pickupDate)
  if (slots.some((slot) => slot.classTime === undefined || slot.classTime === null || slot.classTime === '')) return true
  const knownTimes = new Set(slots.map((slot) => slot.classTime).filter((time) => CLASS_SESSION_TIMES.includes(time)))
  if (CLASS_SESSION_TIMES.every((time) => knownTimes.has(time))) return true
  return slots.some((slot) => {
    const start = minutes(slot.classTime)
    const durationMinutes = Number.isInteger(slot.durationMinutes) && slot.durationMinutes > 0
      ? slot.durationMinutes
      : CLASS_SESSION_DURATION_MINUTES
    return start !== null && pickupMinutes >= start && pickupMinutes <= start + durationMinutes
  })
}

export function matchesLookupPhone(storedPhone, suppliedPhone) {
  const suppliedDigits = normalizeAustralianMobile(String(suppliedPhone || ''))
  const storedDigits = normalizeAustralianMobile(String(storedPhone || ''))
  return /^04\d{8}$/.test(suppliedDigits) && storedDigits === suppliedDigits
}

export function publicCakeReservation(document) {
  return {
    reservationNumber: document.reservationNumber,
    productId: document.productId || 'pave-cake',
    cakeSize: document.cakeSize || '15cm',
    chocolateType: document.chocolateType || 'dark',
    poundAddon: document.poundAddon || 'none',
    chocolateIcingCount: Number(document.chocolateIcingCount || 0),
    vanillaCreamCount: Number(document.vanillaCreamCount || 0),
    partyDecorationCount: Number(document.partyDecorationCount || 0),
    quantity: Number(document.quantity || 1),
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent || '기본',
    status: document.status,
    paymentStatus: document.paymentStatus,
  }
}
