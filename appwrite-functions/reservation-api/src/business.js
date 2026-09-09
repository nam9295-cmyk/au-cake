import { MARKET_TIMEZONE, MANUAL_REVIEW_COUPON_PATTERN, SAFE_LAST4_PATTERN, fail, normalizeReviewCouponCode, requiredText, optionalText, normalizeAustralianMobile, validateAustralianMobile, validateEmail, isValidDateValue, sydneyDateValue, sydneyTimeCode } from './reservation-input-policy.js'
export { REVIEW_COUPON_ANIMALS, REVIEW_COUPON_FRUITS, normalizeReviewCouponCode, normalizeAustralianMobile, isValidDateValue, sydneyDateValue } from './reservation-input-policy.js'
import { BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS, CAKE_SIZE_LABELS, PRODUCTS } from './cake-order-catalog.js'
export { PROMO_CODE, LEMON_PROMO_CODE, PROMO_DISCOUNT_RATE, LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS, CUPCAKE_PACK_SIZE, CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS, CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS, INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE, INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS, BROWNIE_FRESH_CREAM_SURCHARGE_CENTS, VANILLA_CAKE_SHEETS, VANILLA_CAKE_FLAVORS, VANILLA_CAKE_POINT_COLORS, CAKE_SIZE_LABELS, CHOCOLATE_PROMO_EXPIRES_ON, LEMONI_PROMO_EXPIRES_ON, MAX_RESERVATION_QUANTITY } from './cake-order-catalog.js'
import { buildCakeOrderData } from './cake-order-data.js'
export { serializeStoredOrderLines } from './cake-order-data.js'
export { PICKUP_CUTOFF_HOUR, LATE_ORDER_NEXT_DAY_START_MINUTES, AU_CAKE_PICKUP_SCHEDULE, resolveCakeCustomerEmailMode, resolveCakeCatalogMode, isSchoolPickupWindowClosed, isCakePickupServiceTime, normalizeCakeOrderLines, canonicalCakeRequestPayload } from './cake-order-input.js'
export { getValidPromoCode } from './cake-order-pricing.js'
import { ReservationApiError } from './reservation-error.js'
import { parseStoredOrderLines } from './stored-order-reader.js'
export { ReservationApiError } from './reservation-error.js'
export { parseStoredOrderLines } from './stored-order-reader.js'
import { projectPublicCakeReservation } from './cake-lookup-response.js'
import { digestReviewCouponCode } from './coupon-digest.js'
import { ACTIVE_CAKE_ORDER_PRODUCT_IDS } from './active-cake-products.js'




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


if (ACTIVE_CAKE_ORDER_PRODUCT_IDS.some((productId) => !Object.hasOwn(PRODUCTS, productId))) {
  throw new Error('ACTIVE_CAKE_ORDER_PRODUCT_CATALOG_MISMATCH')
}

export function formatCakeSizeLabel(cakeSize) {
  return CAKE_SIZE_LABELS[cakeSize] || CAKE_SIZE_LABELS['15cm']
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


























// Only this product accepts (and discards) known client price projections.





















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
  return buildCakeOrderData(input, { now, reservationNumber, reviewCoupon, customerEmailMode, cakeCatalogMode })
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
