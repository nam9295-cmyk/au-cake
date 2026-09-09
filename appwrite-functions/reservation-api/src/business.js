import { MARKET_TIMEZONE, MANUAL_REVIEW_COUPON_PATTERN, SAFE_LAST4_PATTERN, fail, normalizeReviewCouponCode, requiredText, optionalText, normalizeAustralianMobile, validateAustralianMobile, validateEmail, isValidDateValue, sydneyDateValue, sydneyTimeCode } from './reservation-input-policy.js'
export { REVIEW_COUPON_ANIMALS, REVIEW_COUPON_FRUITS, normalizeReviewCouponCode, normalizeAustralianMobile, isValidDateValue, sydneyDateValue } from './reservation-input-policy.js'
import { PROMO_DISCOUNT_RATE, LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS, CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS, CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS, INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE, INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS, BROWNIE_FRESH_CREAM_SURCHARGE_CENTS, CUPCAKE_PRODUCT_IDS, CUPCAKE_FINISH_PRICES_CENTS, CHOCOLATE_EXTRA_PRICES_CENTS, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS, CAKE_SIZE_LABELS, INDIVIDUAL_PACKAGING_PRODUCT_PIECES, PROMOTIONS, PRODUCTS, FINISH_PRICES } from './cake-order-catalog.js'
export { PROMO_CODE, LEMON_PROMO_CODE, PROMO_DISCOUNT_RATE, LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS, CUPCAKE_PACK_SIZE, CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS, CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS, INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE, INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS, BROWNIE_FRESH_CREAM_SURCHARGE_CENTS, VANILLA_CAKE_SHEETS, VANILLA_CAKE_FLAVORS, VANILLA_CAKE_POINT_COLORS, CAKE_SIZE_LABELS, CHOCOLATE_PROMO_EXPIRES_ON, LEMONI_PROMO_EXPIRES_ON, MAX_RESERVATION_QUANTITY } from './cake-order-catalog.js'
import { cakeCustomerEmail, validatePickupDateTime, validCakeQuantity, LEGACY_ORDER_LINE_FIELDS, assertKnownStrawberryPayloadFields, normalizedCakeLine, canonicalOrderLineKey, normalizeCakeOrderLines } from './cake-order-input.js'
export { PICKUP_CUTOFF_HOUR, LATE_ORDER_NEXT_DAY_START_MINUTES, AU_CAKE_PICKUP_SCHEDULE, resolveCakeCustomerEmailMode, resolveCakeCatalogMode, isSchoolPickupWindowClosed, isCakePickupServiceTime, normalizeCakeOrderLines, canonicalCakeRequestPayload } from './cake-order-input.js'
import { ReservationApiError } from './reservation-error.js'
import { parseStoredOrderLines } from './stored-order-reader.js'
export { ReservationApiError } from './reservation-error.js'
export { parseStoredOrderLines } from './stored-order-reader.js'
import { projectPublicCakeReservation } from './cake-lookup-response.js'
import { digestReviewCouponCode } from './coupon-digest.js'
import { ACTIVE_CAKE_ORDER_PRODUCT_IDS } from './active-cake-products.js'



function calculateIndividualPackagingFeeCents(individualPackagingPieces, selectedPackagingProductSubtotalCents) {
  if (!Number.isSafeInteger(individualPackagingPieces) || individualPackagingPieces <= 0) return 0
  const baseFeeCents = individualPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
  return selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : baseFeeCents
}

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























function chocolateExtraPriceCents(chocolateExtra) {
  return CHOCOLATE_EXTRA_PRICES_CENTS[chocolateExtra] ?? fail('INVALID_CHOCOLATE_EXTRA')
}



// Only this product accepts (and discards) known client price projections.


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
const STORED_ORDER_MAX_BYTES = 65535








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
