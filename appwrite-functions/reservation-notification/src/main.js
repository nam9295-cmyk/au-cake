import { Client, Databases } from 'node-appwrite'
import {
  buildEmailDeliveryEventKey,
  evaluateEmailDeliveryRetry,
  normalizeRecipientEmail,
  normalizeRecipientEmailSet,
  payloadHashForEmail,
  recipientHashForEmail,
  recipientHashForEmailSet,
  resendIdempotencyKeyForEvent,
} from '../shared/email-delivery/email-delivery.js'
import { createEmailDeliveryRepository } from '../shared/email-delivery/email-delivery-repository.js'
import { createEmailDeliveryRetryClaimRepository } from '../shared/email-delivery/email-delivery-retry-claim-repository.js'
import { createResendTransport as createSharedResendTransport, ResendTransportError } from '../shared/email-delivery/resend-transport.js'
import { deliverEmail, deliverEmails } from '../shared/email-delivery/email-delivery-sender.js'
import { retryEmail } from '../shared/email-delivery/email-delivery-retry.js'
import { parseStoredOrderLines } from '../shared/reservation-api/business.js'

const APPWRITE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const BOOKING_OPERATOR_RECEIPT_TEMPLATE_VERSION = 'v1'
const BOOKING_CUSTOMER_RECEIPT_TEMPLATE_VERSION = 'v2'
const BOOKING_RECEIPT_TEMPLATES = Object.freeze({
  operator: 'booking-received-operator',
  customer: 'booking-received-customer',
})
const BOOKING_CONFIRMATION_TEMPLATE = 'booking-confirmed-customer'
const BOOKING_CONFIRMATION_TEMPLATE_VERSION = 'v2'
const BOOKING_EMAIL_KINDS = Object.freeze([
  BOOKING_RECEIPT_TEMPLATES.operator,
  BOOKING_RECEIPT_TEMPLATES.customer,
  BOOKING_CONFIRMATION_TEMPLATE,
])
const BOOKING_CONFIRMATION_ALLOWED_STATUSES = Object.freeze({
  cake: '예약확정',
  class: 'Confirmed',
})
const CAKE_PICKUP_LOCATION = 'https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw'
const CLASS_LOCATION = '1 Bundil Blvd, Melrose Park, Sydney'

const MARKET_CONFIG = {
  KR: {
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
    currency: 'KRW',
    subjectPrefix: '[베리굿초콜릿] 새 예약 신청',
    heading: '새 예약 신청',
    productLabels: {
      'pave-cake': '생초콜릿 파베 케이크',
      'vanilla-fresh-cream-cake': '바닐라 생크림 케이크',
      'buttercream-cake': '버터크림 케이크',
      'fresh-strawberry-vanilla-cream-cake': '프레시 딸기 바닐라 크림 케이크',
      'fresh-strawberry-chocolate-cream-cake': '프레시 딸기 초콜릿 크림 케이크',
      'pound-cake': '시그니처 갸또 쇼콜라',
      'cupcake-half-dozen': '초콜릿 컵케이크',
      'cupcake-dozen': '초콜릿 컵케이크',
      'choco-basque-cheesecake': '초코 바스크 치즈케이크',
      'pave-choco-basque-cheesecake': '파베초코 바스크 치즈케이크',
      'eiffel-tower-basque-cheesecake': '에펠탑 초콜릿 바스크 치즈케이크',
      'brownie-cheesecake': '브라우니 치즈케이크',
      'pave-brownie-cheesecake': '브라우니 치즈케이크 · 파베 초콜릿 on top',
      'eiffel-tower-brownie-cheesecake': '브라우니 치즈케이크 · 에펠탑 마감',
      'fresh-lemon-cupcakes-4': '레몬 케이크 · 4개',
      'fresh-lemon-cupcakes-6': '레몬 케이크 · 6개',
      'fresh-lemon-cupcakes-8': '레몬 케이크 · 8개',
      'fresh-lemon-cupcakes-12': '레몬 케이크 · 12개',
      'fresh-lemon-cupcakes-16': '레몬 케이크 · 16개',
    },
    sizeLabels: {
      mini: '미니케이크',
      'size-1': '1호사이즈',
      '15cm': '6 inch / 15cm',
      '17cm': '6.7 inch / 17cm',
      '19cm': '7.5 inch / 19cm',
      '22cm': '8.7 inch / 22cm',
      '6in': '6 inch',
      '8in': '8 inch',
      '10in': '10 inch',
    },
    chocolateLabels: {
      dark: 'Dark chocolate',
      milk: 'Milk chocolate',
    },
    poundAddonLabels: {
      none: 'Basic finish',
      'extra-chocolate': 'Extra chocolate',
      'vanilla-cream': 'Vanilla cream',
    },
    quantityUnit: '개',
    classSubjectPrefix: '[베리굿초콜릿] 새 키즈 클래스 예약',
    classHeading: '새 키즈 클래스 예약',
    bookingTypeLabels: {
      'year-1-2': 'Kindy–Year 2',
      '1-child': 'Year 3–6',
      '2-friends': '2 children',
    },
    classTypeLabels: {
      'school-holiday-private-cake-class': 'Basic Cake Class',
      'cupcake-chocolate-class': 'Basic Cupcakes & Chocolate Class',
      'advanced-2-tier-cake-class': 'Advanced 2-Tier Cake Class',
    },
    yesNoLabels: { true: '예', false: '아니오' },
    labels: {
      bookingNumber: '예약번호',
      product: '제품명',
      size: '사이즈',
      chocolate: '초콜릿',
      finish: '마감',
      cakeSheet: '케이크 시트',
      flavour: '맛',
      icingMix: '마감 구성',
      quantity: '수량',
      customer: '예약자명',
      mobile: '연락처',
      pickupDate: '픽업일',
      pickupTime: '픽업시간',
      total: '총 금액',
      note: '요청사항',
      createdAt: '신청일시',
      none: '없음',
      className: '클래스',
      coursePlan: '과정',
      firstSession: '첫 세션',
      firstDuration: '첫 세션 시간',
      firstExtension: '첫 세션 연장',
      advancedSession: 'Advanced 세션',
      advancedDuration: 'Advanced 세션 시간',
      advancedExtension: 'Advanced 세션 연장',
      subtotal: '소계',
      discount: '할인',
      classDate: '클래스 날짜',
      classTime: '클래스 시간',
      bookingType: '예약 타입',
      parentName: '보호자명',
      parentPhone: '보호자 연락처',
      parentEmail: '보호자 이메일',
      childName: '아이 이름',
      childAge: '아이 나이',
      schoolYear: '학년',
      secondChild: '두 번째 아이',
      allergyNote: '알러지/주의사항',
      emergencyContact: '비상 연락처',
      pickupPerson: '픽업 보호자',
      parentConsent: '보호자 동의',
      cancellationAgreement: '취소 규정 동의',
      photoConsent: '사진 동의',
      status: '상태',
      paymentStatus: '결제 상태',
      deposit: '예약금',
    },
  },
  AU: {
    timezone: 'Australia/Sydney',
    locale: 'en-AU',
    currency: 'AUD',
    subjectPrefix: '[Verygood Chocolate AU] New cake request',
    heading: 'New cake request',
    productLabels: {
      'pave-cake': 'Pave Chocolate Cake',
      'vanilla-fresh-cream-cake': 'vanilla fresh cream cake',
      'buttercream-cake': 'Buttercream Cake',
      'fresh-strawberry-vanilla-cream-cake': 'Fresh Strawberry Vanilla Cream Cake',
      'fresh-strawberry-chocolate-cream-cake': 'Fresh Strawberry Chocolate Cream Cake',
      'pound-cake': 'Signature Gâteau au Chocolat',
      'cupcake-half-dozen': 'Chocolate Cupcakes',
      'cupcake-dozen': 'Chocolate Cupcakes',
      'choco-basque-cheesecake': "Chocolatier's Basque Cheesecake",
      'pave-choco-basque-cheesecake': 'Pave chocolate on top',
      'eiffel-tower-basque-cheesecake': 'Cake finishing with Eiffel Tower',
      'brownie-cheesecake': 'Brownie Cheesecake',
      'pave-brownie-cheesecake': 'Brownie Cheesecake · Pave chocolate on top',
      'eiffel-tower-brownie-cheesecake': 'Brownie Cheesecake · Eiffel Tower finish',
      'fresh-lemon-cupcakes-4': 'Lemon Cake · 4 pieces',
      'fresh-lemon-cupcakes-6': 'Lemon Cake · 6 pieces',
      'fresh-lemon-cupcakes-8': 'Lemon Cake · 8 pieces',
      'fresh-lemon-cupcakes-12': 'Lemon Cake · 12 pieces',
      'fresh-lemon-cupcakes-16': 'Lemon Cake · 16 pieces',
    },
    sizeLabels: {
      mini: 'Mini cake',
      'size-1': 'Size 1',
      '15cm': '6" | serves 8',
      '19cm': '7.5" | serves 14',
      '22cm': '9" | serves 22',
      '6in': '6"',
      '8in': '8"',
      '10in': '10"',
    },
    chocolateLabels: {
      dark: 'Dark chocolate',
      milk: 'Milk chocolate',
    },
    poundAddonLabels: {
      none: 'Basic finish',
      'extra-chocolate': 'Extra chocolate',
      'vanilla-cream': 'Vanilla cream',
    },
    quantityUnit: 'ea',
    classSubjectPrefix: '[Verygood Chocolate AU] New kids class request',
    classHeading: 'New kids class request',
    bookingTypeLabels: {
      'year-1-2': 'Kindy–Year 2',
      '1-child': 'Year 3–6',
      '2-friends': '2 children',
    },
    classTypeLabels: {
      'school-holiday-private-cake-class': 'Basic Cake Class',
      'cupcake-chocolate-class': 'Basic Cupcakes & Chocolate Class',
      'advanced-2-tier-cake-class': 'Advanced 2-Tier Cake Class',
    },
    yesNoLabels: { true: 'Yes', false: 'No' },
    labels: {
      bookingNumber: 'Booking number',
      product: 'Product',
      size: 'Size',
      chocolate: 'Chocolate',
      finish: 'Finish',
      cakeSheet: 'Cake sheet',
      flavour: 'Flavour',
      icingMix: 'Finishing mix',
      quantity: 'Quantity',
      customer: 'Customer name',
      mobile: 'Mobile',
      pickupDate: 'Pick-up date',
      pickupTime: 'Pick-up time',
      total: 'Total',
      note: 'Request note',
      createdAt: 'Submitted at',
      none: 'None',
      className: 'Class',
      coursePlan: 'Plan',
      firstSession: 'First session',
      firstDuration: 'First duration',
      firstExtension: 'First extension',
      advancedSession: 'Advanced session',
      advancedDuration: 'Advanced duration',
      advancedExtension: 'Advanced extension',
      subtotal: 'Subtotal',
      discount: 'Discount',
      classDate: 'Class date',
      classTime: 'Class time',
      bookingType: 'Booking type',
      parentName: 'Parent name',
      parentPhone: 'Parent phone',
      parentEmail: 'Parent email',
      childName: 'Child name',
      childAge: 'Child age',
      schoolYear: 'School year',
      secondChild: 'Second child',
      allergyNote: 'Allergy / notes',
      emergencyContact: 'Emergency contact',
      pickupPerson: 'Pick-up person',
      parentConsent: 'Parent consent',
      cancellationAgreement: 'Cancellation agreement',
      photoConsent: 'Photo consent',
      status: 'Status',
      paymentStatus: 'Payment status',
      deposit: 'Deposit',
    },
  },
}

function parseRecipients(value = '') {
  return value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function detectMarket(reservation) {
  const envMarket = String(process.env.MARKET || process.env.VITE_MARKET || '').toUpperCase()
  if (envMarket === 'AU' || envMarket === 'KR') return envMarket
  if (String(reservation?.reservationNumber || '').includes('-AU-')) return 'AU'
  return 'KR'
}

function getConfig(reservation) {
  return MARKET_CONFIG[detectMarket(reservation)] || MARKET_CONFIG.KR
}

function getProductName(reservation, config) {
  return config.productLabels[reservation.productId] || config.productLabels['pave-cake']
}

function getCakeSizeText(reservation, config) {
  if (['pound-cake', 'cupcake-half-dozen', 'cupcake-dozen'].includes(reservation.productId)) return '-'
  if (reservation.productId === 'vanilla-fresh-cream-cake') return config.sizeLabels[reservation.cakeSize] || config.sizeLabels['15cm']
  if (['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake', 'brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'].includes(reservation.productId)) return config.sizeLabels['15cm']
  return config.sizeLabels[reservation.cakeSize] || reservation.cakeSize || '-'
}

function isCreamLayerCake(reservation) {
  return ['vanilla-fresh-cream-cake', 'buttercream-cake'].includes(reservation.productId)
}

function getVanillaCakeFlavorText(reservation, config) {
  if (reservation.productId !== 'vanilla-fresh-cream-cake' || reservation.vanillaCakeFlavor === 'plain') return null
  const nutellaChocolateChip = reservation.vanillaCakeFlavor === 'nutella-chocolate-chip'
  return config.currency === 'AUD'
    ? nutellaChocolateChip ? 'Nutella chocolate chip' : 'Triple berry'
    : nutellaChocolateChip ? '누텔라 초코칩' : '트리플베리'
}

function isCurrentVanillaSelection(reservation) {
  return reservation.productId === 'vanilla-fresh-cream-cake'
    && reservation.vanillaCakeSheet === 'chocolate'
    && reservation.vanillaCakeFlavor === 'plain'
}

function getHistoricalVanillaCakeSheetText(reservation, config) {
  const chocolate = reservation.vanillaCakeSheet === 'chocolate'
  if (config.currency === 'AUD') return chocolate ? 'Chocolate cake sheet' : 'Vanilla cake sheet'
  return chocolate ? '초콜릿 케이크 시트' : '바닐라 케이크 시트'
}

function getHistoricalVanillaCakeFlavorText(reservation, config) {
  if (reservation.vanillaCakeFlavor === 'plain') {
    return config.currency === 'AUD' ? 'Plain fresh cream (legacy)' : '플레인 생크림 (과거 주문)'
  }
  return getVanillaCakeFlavorText(reservation, config)
}

function getCreamCakeFillingText(reservation, config) {
  if (!isCreamLayerCake(reservation)) return null
  if (reservation.productId === 'buttercream-cake') {
    return config.currency === 'AUD' ? 'Chocolate Buttercream' : '초콜릿 버터크림'
  }
  return config.currency === 'AUD'
    ? 'Vanilla fresh cream with real vanilla bean'
    : '실제 바닐라빈을 넣은 바닐라 생크림'
}

function getVanillaCakePointColorText(reservation, config) {
  if (!isCreamLayerCake(reservation)) return null
  const labels = config.currency === 'AUD'
    ? { pink: 'Pink', red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue', purple: 'Purple', orange: 'Orange', white: 'White' }
    : { pink: '핑크', red: '레드', green: '그린', yellow: '옐로우', blue: '블루', purple: '퍼플', orange: '오렌지', white: '화이트' }
  return labels[reservation.vanillaCakePointColor] || labels.pink
}

function normalizeOptionKey(value = '') {
  return String(value).trim().toLowerCase().replace(/[_\s]+/g, '-')
}

function normalizePoundAddonValue(value) {
  const normalized = normalizeOptionKey(value)
  if (normalized === 'extra-chocolate') return 'extra-chocolate'
  if (normalized === 'vanilla-cream') return 'vanilla-cream'
  return 'none'
}

function getChocolateText(reservation, config) {
  const poundAddon = normalizePoundAddonValue(reservation.poundAddon)
  const showsChocolate = reservation.productId === 'pave-cake' || (reservation.productId === 'pound-cake' && poundAddon === 'extra-chocolate')
  if (!showsChocolate) return '-'
  return config.chocolateLabels[reservation.chocolateType] || reservation.chocolateType || '-'
}

function getPoundAddonText(reservation, config) {
  if (reservation.productId !== 'pound-cake') return '-'
  const poundAddon = normalizePoundAddonValue(reservation.poundAddon)
  return config.poundAddonLabels[poundAddon] || config.poundAddonLabels[reservation.poundAddon] || reservation.poundAddon || '-'
}

function getChocolateExtraText(reservation, config) {
  const labels = config.currency === 'AUD'
    ? {
        'eiffel-6': 'Eiffel Tower Chocolates · 6 pieces',
        'pave-100g': 'Pavé Chocolate · 100g tub',
        combo: 'Chocolate Extra Set',
      }
    : {
        'eiffel-6': '에펠탑 초콜릿 · 6개',
        'pave-100g': '파베 초콜릿 · 100g 통',
        combo: '초콜릿 추가 세트',
      }
  const prices = { 'eiffel-6': 10, 'pave-100g': 12, combo: 20 }
  const chocolateExtra = reservation.chocolateExtra
  if (!Object.hasOwn(labels, chocolateExtra) || !Object.hasOwn(prices, chocolateExtra)) return null
  return `${labels[chocolateExtra]} · ${formatCurrency(prices[chocolateExtra], config)}`
}

function getIcingMixText(reservation, config) {
  if (reservation.productId === 'cupcake-half-dozen' || reservation.productId === 'cupcake-dozen') {
    if (['basic', 'vanilla-fresh-cream', 'chocolate-buttercream'].includes(reservation.cupcakeFinish)) {
      const packSize = reservation.productId === 'cupcake-half-dozen' ? 6 : 12
      const finishLabels = config.currency === 'AUD'
        ? { basic: 'Basic', 'vanilla-fresh-cream': 'Vanilla Fresh Cream', 'chocolate-buttercream': 'Chocolate Buttercream' }
        : { basic: '기본', 'vanilla-fresh-cream': '바닐라 생크림', 'chocolate-buttercream': '초콜릿 버터크림' }
      return config.currency === 'AUD'
        ? `Pack: ${packSize === 6 ? 'Half Dozen' : 'Dozen'} · ${packSize} cupcakes / Finish: ${finishLabels[reservation.cupcakeFinish]}`
        : `구성: ${packSize === 6 ? '하프 더즌' : '더즌'} · ${packSize}개 / 마감: ${finishLabels[reservation.cupcakeFinish]}`
    }
    const rawVanilla = Number(reservation.vanillaCreamCount || 0)
    const rawParty = Number(reservation.partyDecorationCount || 0)
    const vanilla = Number.isInteger(rawVanilla) ? Math.min(12, Math.max(0, rawVanilla)) : 0
    const party = Number.isInteger(rawParty) ? Math.min(12 - vanilla, Math.max(0, rawParty)) : 0
    const basic = 12 - vanilla - party
    return config.currency === 'AUD'
      ? `Basic ${basic} / Vanilla cream ${vanilla} / Party decoration ${party}`
      : `기본 ${basic}개 / 바닐라 크림 ${vanilla}개 / 파티용 데코 ${party}개`
  }
  if (!String(reservation.productId || '').startsWith('fresh-lemon-cupcakes-')) return config.labels.none
  const packSize = Number(String(reservation.productId).split('-').at(-1))
  const rawCount = Number(reservation.chocolateIcingCount || 0)
  const chocolateCount = Number.isInteger(rawCount) ? Math.min(packSize, Math.max(0, rawCount)) : 0
  const lemonCount = packSize - chocolateCount
  return config.currency === 'AUD'
    ? `Fresh lemon zest icing ${lemonCount} / Dark couverture chocolate ${chocolateCount}`
    : `생레몬 제스트 아이싱 ${lemonCount}개 / 다크 커버춰 초콜릿 ${chocolateCount}개`
}

function getQuantity(reservation) {
  const quantity = Number(reservation.quantity || 1)
  if (!Number.isFinite(quantity)) return 1
  return Math.min(5, Math.max(1, Math.floor(quantity)))
}

function getReservationTotal(reservation) {
  if (reservation?.totalPriceCents !== undefined && reservation?.totalPriceCents !== null) {
    return Number(reservation.totalPriceCents || 0) / 100
  }
  return Number(reservation?.totalPrice || 0)
}

function formatCurrency(value, config) {
  if (config.currency === 'AUD') return `AUD ${Number(value || 0).toFixed(2)}`
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCreatedAt(value, config) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(config.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: config.timezone,
  }).format(date)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function readReservation(req) {
  const body = readRequestBody(req)
  if (!body) return null

  // Appwrite event payloads can arrive either as the document itself, or wrapped.
  return body.reservation || body.document || body.row || body.payload || body
}

function readRequestBody(req) {
  return req?.bodyJson && typeof req.bodyJson === 'object' ? req.bodyJson : parseBody(req?.bodyRaw)
}

function parseBody(bodyRaw) {
  if (!bodyRaw) return null
  try {
    return JSON.parse(bodyRaw)
  } catch {
    return null
  }
}

function isClassReservation(reservation) {
  if (reservation && Object.hasOwn(reservation, 'orderLinesJson')) return false
  return Boolean(reservation?.classType || reservation?.bookingType || reservation?.parentName || reservation?.childName)
}

function getBookingTypeText(reservation, config) {
  if (reservation.bookingType === 'year-1-2' && reservation.coursePlan && reservation.coursePlan !== 'basic') return 'Year 2'
  return config.bookingTypeLabels[reservation.bookingType] || reservation.bookingType || '-'
}

function getClassTypeText(reservation, config) {
  return config.classTypeLabels[reservation.classType] || reservation.classType || 'Basic Cake Class'
}

function getClassCoursePlanText(reservation) {
  if (reservation.coursePlan === 'advanced') return 'Advanced'
  if (reservation.coursePlan === 'basic-advanced-package') return 'Basic + Advanced Package'
  return 'Basic'
}

function getClassDurationText(value) {
  const duration = Number(value)
  return `${Number.isInteger(duration) && duration > 0 ? duration : 120} minutes`
}

function getClassExtensionText(value, config) {
  return Number(value) === 30 ? '30 minutes' : config.labels.none
}

function getClassPricingAudit(reservation, config) {
  const totalPriceCents = Number.isInteger(reservation.totalPriceCents)
    ? reservation.totalPriceCents
    : Math.round(getReservationTotal(reservation) * 100)
  const subtotalCents = Number.isInteger(reservation.subtotalCents) ? reservation.subtotalCents : totalPriceCents
  const discountCents = Number.isInteger(reservation.discountCents) ? reservation.discountCents : 0
  const discountPercent = Number.isInteger(reservation.discountPercent) ? reservation.discountPercent : 0
  return {
    subtotal: formatCurrency(subtotalCents / 100, config),
    discount: discountCents > 0
      ? `${discountPercent}% (-${formatCurrency(discountCents / 100, config)})`
      : config.labels.none,
    total: formatCurrency(totalPriceCents / 100, config),
  }
}

function getBooleanText(value, config) {
  return config.yesNoLabels[String(Boolean(value))] || String(Boolean(value))
}

function getSecondChildText(reservation, config) {
  if (reservation.bookingType !== '2-friends') return config.labels.none
  const parts = [reservation.secondChildName, reservation.secondChildAge ? `${reservation.secondChildAge}` : '', reservation.secondChildSchoolYear]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : config.labels.none
}

function readStoredCakeLines(reservation) {
  if (!reservation || !Object.hasOwn(reservation, 'orderLinesJson')) return null
  try {
    return parseStoredOrderLines(reservation)?.lines || null
  } catch {
    throw new Error('INVALID_STORED_ORDER')
  }
}

function cakeDetailRows(reservation, config, suffix = '') {
  const quantity = getQuantity(reservation)
  const label = (value) => `${value}${suffix}`
  const chocolateExtra = getChocolateExtraText(reservation, config)
  return [
    [label(config.labels.product), getProductName(reservation, config)],
    [label(config.labels.size), getCakeSizeText(reservation, config)],
    ...(isCreamLayerCake(reservation) ? [
      ...(reservation.productId === 'buttercream-cake' || isCurrentVanillaSelection(reservation)
        ? [
            [label(config.currency === 'AUD' ? 'Layers' : '시트'), config.currency === 'AUD'
              ? 'Signature Gâteau au Chocolat layers'
              : '시그니처 갸또 쇼콜라 시트'],
            [label(config.currency === 'AUD' ? 'Filling' : '필링'), getCreamCakeFillingText(reservation, config)],
          ]
        : [
            [label(config.labels.cakeSheet), getHistoricalVanillaCakeSheetText(reservation, config)],
            [label(config.labels.flavour), getHistoricalVanillaCakeFlavorText(reservation, config)],
          ]),
      [label(reservation.productId === 'buttercream-cake'
        ? config.currency === 'AUD' ? 'Cake colour' : '케이크 컬러'
        : config.currency === 'AUD' ? 'Point colour' : '포인트 컬러'), getVanillaCakePointColorText(reservation, config)],
    ] : []),
    [label(config.labels.chocolate), getChocolateText(reservation, config)],
    [label(config.labels.finish), getPoundAddonText(reservation, config)],
    [label(config.labels.icingMix), getIcingMixText(reservation, config)],
    ...(chocolateExtra ? [[label(config.currency === 'AUD' ? 'Chocolate extra' : '초콜릿 추가'), chocolateExtra]] : []),
    [label(config.labels.quantity), `${quantity}${config.quantityUnit}`],
    ...(reservation.individualPackaging === true ? [[
      label(config.currency === 'AUD' ? 'Individual packaging' : '개별 포장'),
      `${reservation.individualPackagingPieces || 0} ${config.currency === 'AUD' ? 'pieces' : '개'} · ${reservation.individualPackagingFeeCents === 0
        ? 'FREE'
        : formatCurrency(Number(reservation.individualPackagingFeeCents || 0) / 100, config)}`,
    ]] : []),
  ]
}

function buildCakeRows(reservation, config) {
  const storedLines = readStoredCakeLines(reservation)
  const lines = storedLines || [reservation]
  const detailRows = lines.length > 1
    ? lines.flatMap((line, index) => cakeDetailRows(line, config, ` ${index + 1}`))
    : cakeDetailRows({ ...reservation, ...lines[0] }, config)
  return [
    [config.labels.bookingNumber, reservation.reservationNumber],
    ...detailRows,
    [config.labels.customer, reservation.customerName],
    [config.labels.mobile, reservation.customerPhone],
    [config.labels.pickupDate, reservation.pickupDate],
    [config.labels.pickupTime, reservation.pickupTime],
    [config.labels.total, formatCurrency(getReservationTotal(reservation), config)],
    [config.labels.note, reservation.requestNote || config.labels.none],
    [config.labels.createdAt, formatCreatedAt(reservation.createdAt || reservation.$createdAt, config)],
  ]
}

function buildClassRows(reservation, config) {
  const pricing = getClassPricingAudit(reservation, config)
  const hasAdvancedSession = Boolean(reservation.advancedClassDate && reservation.advancedClassTime)
  return [
    [config.labels.bookingNumber, reservation.reservationNumber],
    [config.labels.coursePlan, getClassCoursePlanText(reservation)],
    [config.labels.className, getClassTypeText(reservation, config)],
    [config.labels.firstSession, [reservation.classDate, reservation.classTime].filter(Boolean).join(' ')],
    [config.labels.firstDuration, getClassDurationText(reservation.durationMinutes)],
    [config.labels.firstExtension, getClassExtensionText(reservation.extensionMinutes, config)],
    ...(hasAdvancedSession ? [
      [config.labels.advancedSession, `${reservation.advancedClassDate} ${reservation.advancedClassTime}`],
      [config.labels.advancedDuration, getClassDurationText(reservation.advancedDurationMinutes)],
      [config.labels.advancedExtension, getClassExtensionText(reservation.advancedExtensionMinutes, config)],
    ] : []),
    [config.labels.bookingType, getBookingTypeText(reservation, config)],
    [config.labels.parentName, reservation.parentName],
    [config.labels.parentPhone, reservation.parentPhone],
    [config.labels.parentEmail, reservation.parentEmail],
    [config.labels.childName, reservation.childName],
    [config.labels.childAge, reservation.childAge],
    [config.labels.schoolYear, reservation.schoolYear],
    [config.labels.secondChild, getSecondChildText(reservation, config)],
    [config.labels.allergyNote, reservation.allergyNote || config.labels.none],
    [config.labels.emergencyContact, reservation.emergencyContact],
    [config.labels.pickupPerson, reservation.pickupPerson],
    [config.labels.parentConsent, getBooleanText(reservation.parentConsent, config)],
    [config.labels.cancellationAgreement, getBooleanText(reservation.cancellationAgreement, config)],
    [config.labels.photoConsent, getBooleanText(reservation.photoConsent, config)],
    [config.labels.status, reservation.status],
    [config.labels.paymentStatus, reservation.paymentStatus],
    [config.labels.subtotal, pricing.subtotal],
    [config.labels.discount, pricing.discount],
    [config.labels.total, pricing.total],
    [config.labels.deposit, formatCurrency(reservation.depositAmount, config)],
    [config.labels.createdAt, formatCreatedAt(reservation.createdAt || reservation.$createdAt, config)],
  ]
}

export function buildClassNotificationRows(reservation) {
  return buildClassRows(reservation, getConfig(reservation))
}

export function buildCakeNotificationRows(reservation) {
  return buildCakeRows(reservation, getConfig(reservation))
}

function buildRows(reservation, config) {
  return isClassReservation(reservation) ? buildClassRows(reservation, config) : buildCakeRows(reservation, config)
}

function plainTextCell(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function getSubject(reservation, config) {
  const prefix = isClassReservation(reservation) ? config.classSubjectPrefix : config.subjectPrefix
  const safeReservationNumber = plainTextCell(reservation.reservationNumber).slice(0, 80)
  return `${prefix} ${safeReservationNumber}`
}

function getHeading(reservation, config) {
  return isClassReservation(reservation) ? config.classHeading : config.heading
}

function buildText(reservation, config) {
  return [
    getSubject(reservation, config),
    '',
    ...buildRows(reservation, config).map(([label, value]) => `${plainTextCell(label)}: ${plainTextCell(value)}`),
  ].join('\n')
}

export function buildNotificationText(reservation) {
  return buildText(reservation, getConfig(reservation))
}

function buildHtml(reservation, config) {
  const rows = buildRows(reservation, config)

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2a1710; line-height: 1.55;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(plainTextCell(getHeading(reservation, config)))}</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="width: 150px; padding: 10px 12px; border: 1px solid #e8ded5; background: #fbf6ef; text-align: left;">${escapeHtml(plainTextCell(label))}</th>
                  <td style="padding: 10px 12px; border: 1px solid #e8ded5;">${escapeHtml(plainTextCell(value))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

export function buildNotificationHtml(reservation) {
  return buildHtml(reservation, getConfig(reservation))
}

function customerCakeRows(reservation, config) {
  const storedLines = readStoredCakeLines(reservation)
  const lines = storedLines || [reservation]
  const detailRows = lines.length > 1
    ? lines.flatMap((line, index) => cakeDetailRows(line, config, ` ${index + 1}`))
    : cakeDetailRows({ ...reservation, ...lines[0] }, config)
  const note = plainTextCell(reservation.requestNote)
  return [
    ['Name', reservation.customerName],
    ['Booking number', reservation.reservationNumber],
    ...detailRows,
    ['Total', formatCurrency(getReservationTotal(reservation), config)],
    ['Pick-up date', reservation.pickupDate],
    ['Pick-up time', reservation.pickupTime],
    ...(note ? [['Your request', note]] : []),
    ['Pick-up location', 'Melrose Park, Sydney. We’ll share the exact meeting details with your final confirmation.'],
  ]
}

function customerClassRows(reservation, config) {
  const pricing = getClassPricingAudit(reservation, config)
  const hasAdvancedSession = Boolean(reservation.advancedClassDate && reservation.advancedClassTime)
  return [
    ['Parent name', reservation.parentName],
    ['Child name', reservation.childName],
    ['Booking number', reservation.reservationNumber],
    ['Course', getClassTypeText(reservation, config)],
    ['Plan', getClassCoursePlanText(reservation)],
    ['First session', [reservation.classDate, reservation.classTime].filter(Boolean).join(' ')],
    ...(hasAdvancedSession ? [['Advanced session', `${reservation.advancedClassDate} ${reservation.advancedClassTime}`]] : []),
    ['Total', pricing.total],
    ['Location', 'Melrose Park, Sydney. We’ll share the exact address with your final confirmation.'],
  ]
}

const CUSTOMER_EMAIL_KOREAN_LABELS = Object.freeze({
  Name: '예약자',
  'Booking number': '예약번호',
  Product: '주문 상품',
  Size: '사이즈',
  Layers: '케이크 시트',
  Filling: '필링',
  'Cake colour': '케이크 색상',
  'Point colour': '포인트 색상',
  Chocolate: '초콜릿',
  Finish: '마감',
  'Icing mix': '마감 구성',
  Quantity: '수량',
  'Individual packaging': '개별 포장',
  Total: '총 금액',
  'Pick-up date': '픽업 날짜',
  'Pick-up time': '픽업 시간',
  'Pick-up location': '픽업 장소',
  'Your request': '요청사항',
  'Parent name': '보호자',
  'Child name': '참가자',
  Course: '클래스',
  Plan: '과정',
  'First session': '첫 수업',
  'Advanced session': 'Advanced 세션',
  Location: '장소',
  Payment: '결제 안내',
  Preparation: '준비사항',
})

function customerEmailKoreanRows(rows) {
  return rows.map(([rawLabel, value]) => {
    const label = plainTextCell(rawLabel)
    const match = /^(.*?)(\s+\d+)$/.exec(label)
    const base = match ? match[1] : label
    return [`${CUSTOMER_EMAIL_KOREAN_LABELS[base] || base}${match ? match[2] : ''}`, value]
  })
}

function bilingualGreeting(section) {
  const name = plainTextCell(section.greetingName)
  return section.language === '한국어' ? `안녕하세요, ${name}님.` : `Hi ${name},`
}

function bilingualTextSection(section) {
  return [
    `[${section.language}]`,
    bilingualGreeting(section),
    '',
    plainTextCell(section.heading),
    '',
    plainTextCell(section.intro),
    '',
    plainTextCell(section.detailsHeading),
    ...section.rows.map(([label, value]) => `${plainTextCell(label)}: ${plainTextCell(value)}`),
    '',
    plainTextCell(section.followUp),
    '',
    ...section.signOff.map(plainTextCell),
  ].join('\n')
}

function bilingualHtmlRows(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <th style="width: 42%; padding: 10px 12px; border: 1px solid #e8ded5; background: #fbf6ef; text-align: left; vertical-align: top;">${escapeHtml(plainTextCell(label))}</th>
      <td style="padding: 10px 12px; border: 1px solid #e8ded5; vertical-align: top;">${escapeHtml(plainTextCell(value))}</td>
    </tr>`).join('')
}

function bilingualHtmlSection(section) {
  return `
    <section>
      <p style="margin: 0 0 8px; color: #6b4b3e; font-size: 13px; font-weight: 700;">[${escapeHtml(section.language)}]</p>
      <h1 style="font-size: 22px; line-height: 1.3; margin: 0 0 16px;">${escapeHtml(plainTextCell(section.heading))}</h1>
      <p style="margin: 0 0 16px;">${escapeHtml(bilingualGreeting(section))}</p>
      <p style="margin: 0 0 20px;">${escapeHtml(plainTextCell(section.intro))}</p>
      <div style="border: 1px solid #e8ded5; border-radius: 8px; overflow: hidden; margin: 0 0 20px;">
        <div style="padding: 12px; background: #5b2417; color: #ffffff; font-weight: 700;">${escapeHtml(plainTextCell(section.detailsHeading))}</div>
        <table style="border-collapse: collapse; width: 100%;"><tbody>${bilingualHtmlRows(section.rows)}</tbody></table>
      </div>
      <p style="margin: 0 0 16px;">${escapeHtml(plainTextCell(section.followUp))}</p>
      <p style="margin: 0;">${section.signOff.map((line) => escapeHtml(plainTextCell(line))).join('<br />')}</p>
    </section>`
}

function buildBilingualEmailText(korean, english) {
  return [bilingualTextSection(korean), '', '--------------------', '', bilingualTextSection(english)].join('\n')
}

function buildBilingualEmailHtml(korean, english) {
  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2a1710; line-height: 1.55; max-width: 640px; margin: 0 auto;">
      ${bilingualHtmlSection(korean)}
      <div style="border-top: 1px solid #e8ded5; margin: 28px 0;"></div>
      ${bilingualHtmlSection(english)}
    </div>`
}

function customerEmailCopy(reservation) {
  if (isClassReservation(reservation)) {
    return {
      subject: '[Verygood] 키즈 클래스 예약 요청이 접수됐어요 | Kids Class booking request received',
      korean: {
        language: '한국어', greetingName: reservation.parentName,
        heading: '키즈 클래스 예약 요청이 접수되었습니다',
        intro: '베리굿 키즈 클래스 예약 요청이 정상적으로 접수되었습니다.',
        detailsHeading: '예약 내역',
        followUp: '현재는 “예약 요청 접수” 상태입니다. 수업 및 결제 내용을 확인한 뒤 최종 확정 안내를 보내드릴게요. 수업 전 준비사항과 알러지 정보에 변경이 있으면 알려주세요.',
        signOff: ['감사합니다.', 'Verygood Chocolate Sydney'],
      },
      english: {
        language: 'English', greetingName: reservation.parentName,
        heading: 'Your kids class booking request has been received',
        intro: 'We’ve received your booking request. We’ll check the details and send payment details and final confirmation instructions next.',
        detailsHeading: 'Booking details',
        followUp: 'Please tell us promptly if allergy information changes. Your child may bring a favourite small figure, doll, LEGO, or toy if they would like to include it in the class.',
        signOff: ['Thank you,', 'Verygood Chocolate Sydney'],
      },
    }
  }
  return {
    subject: '[Verygood] 케이크 예약 요청이 접수됐어요 | Cake booking request received',
    korean: {
      language: '한국어', greetingName: reservation.customerName,
      heading: '케이크 예약 요청이 접수되었습니다',
      intro: '베리굿 초콜릿 시드니에 예약해주셔서 감사합니다. 예약 요청이 정상적으로 접수되었습니다.',
      detailsHeading: '예약 내역',
      followUp: '현재는 “예약 요청 접수” 상태입니다. 주문 내용을 확인한 뒤 최종 예약 확정 안내를 다시 보내드릴게요.',
      signOff: ['감사합니다.', 'Verygood Chocolate Sydney'],
    },
    english: {
      language: 'English', greetingName: reservation.customerName,
      heading: 'Your booking request has been received',
      intro: 'Thank you for booking with Verygood Chocolate Sydney. We’ve received your booking request.',
      detailsHeading: 'Booking details',
      followUp: 'Your booking is currently awaiting final confirmation. We’ll review the details and send you a final confirmation shortly.',
      signOff: ['Thank you,', 'Verygood Chocolate Sydney'],
    },
  }
}

function buildCustomerReceiptText(reservation, config) {
  const copy = customerEmailCopy(reservation)
  const rows = isClassReservation(reservation)
    ? customerClassRows(reservation, config)
    : customerCakeRows(reservation, config)
  return buildBilingualEmailText(
    { ...copy.korean, rows: customerEmailKoreanRows(rows) },
    { ...copy.english, rows },
  )
}

function buildCustomerReceiptHtml(reservation, config) {
  const copy = customerEmailCopy(reservation)
  const rows = isClassReservation(reservation)
    ? customerClassRows(reservation, config)
    : customerCakeRows(reservation, config)
  return buildBilingualEmailHtml(
    { ...copy.korean, rows: customerEmailKoreanRows(rows) },
    { ...copy.english, rows },
  )
}

function sourceIdForReservation(reservation) {
  const sourceId = reservation?.$id || reservation?.$rowId || reservation?.id
  if (!APPWRITE_RESOURCE_ID.test(sourceId || '')) throw new Error('INVALID_RESERVATION_SOURCE_ID')
  return sourceId
}

function sourceTypeForReservation(reservation) {
  return isClassReservation(reservation) ? 'class' : 'cake'
}

function safeHeaderValue(value, field) {
  const normalized = plainTextCell(value)
  if (!normalized) throw new Error(`INVALID_${field}`)
  return normalized
}

export function buildBookingDeliveryPayload({
  reservation,
  role,
  from,
  operatorRecipients,
  replyTo = null,
} = {}) {
  if (!reservation || (role !== 'operator' && role !== 'customer')) throw new Error('INVALID_BOOKING_DELIVERY_PAYLOAD')
  const sourceType = sourceTypeForReservation(reservation)
  const sourceId = sourceIdForReservation(reservation)
  const template = BOOKING_RECEIPT_TEMPLATES[role]
  const templateVersion = role === 'operator'
    ? BOOKING_OPERATOR_RECEIPT_TEMPLATE_VERSION
    : `${template}-${sourceType}-${BOOKING_CUSTOMER_RECEIPT_TEMPLATE_VERSION}`
  const to = role === 'operator'
    ? normalizeRecipientEmailSet(operatorRecipients)
    : [normalizeRecipientEmail(sourceType === 'cake' ? reservation.customerEmail : reservation.parentEmail)]
  const config = getConfig(reservation)
  const subject = role === 'operator' ? getSubject(reservation, config) : customerEmailCopy(reservation).subject
  const text = role === 'operator' ? buildText(reservation, config) : buildCustomerReceiptText(reservation, config)
  const html = role === 'operator' ? buildHtml(reservation, config) : buildCustomerReceiptHtml(reservation, config)
  const normalizedFrom = safeHeaderValue(from, 'RESEND_FROM_EMAIL')
  const normalizedReplyTo = replyTo === null || replyTo === undefined || !String(replyTo).trim()
    ? null
    : normalizeRecipientEmail(replyTo)
  const eventKey = buildEmailDeliveryEventKey({ template, sourceType, sourceId })
  const hashInput = {
    from: normalizedFrom,
    ...(role === 'operator' ? { recipientEmails: to } : { recipientEmail: to[0] }),
    replyTo: normalizedReplyTo,
    subject,
    text,
    html,
    template,
    templateVersion,
  }
  return {
    from: normalizedFrom,
    to,
    replyTo: normalizedReplyTo,
    subject,
    text,
    html,
    template,
    templateVersion,
    eventKey,
    sourceType,
    sourceId,
    recipientHash: role === 'operator' ? recipientHashForEmailSet(to) : recipientHashForEmail(to[0]),
    payloadHash: payloadHashForEmail(hashInput),
    idempotencyKey: resendIdempotencyKeyForEvent(eventKey),
  }
}

function confirmationCakeRows(reservation, config) {
  const rows = customerCakeRows(reservation, config)
  return rows.map(([label, value]) => label === 'Pick-up location'
    ? ['Pick-up location', CAKE_PICKUP_LOCATION]
    : [label, value])
}

function confirmationClassRows(reservation, config) {
  const rows = customerClassRows(reservation, config)
  return [
    ...rows.map(([label, value]) => label === 'Location' ? ['Location', CLASS_LOCATION] : [label, value]),
    ['Payment', 'We will contact you if any payment details still need attention.'],
    ['Preparation', 'Please arrive 5 minutes early. Tie back long hair; clothes may get chocolate or cream on them.'],
  ]
}

function confirmationEmailCopy(reservation, sourceType) {
  if (sourceType === 'class') {
    return {
      subject: '[Verygood] 키즈 클래스 예약이 확정됐어요 | Your class booking is confirmed',
      korean: {
        language: '한국어', greetingName: reservation.parentName,
        heading: '키즈 클래스 예약이 최종 확정되었습니다',
        intro: `${plainTextCell(reservation.childName)}님의 베리굿 키즈 클래스 예약이 최종 확정되었습니다. 수업 전 준비사항과 알러지 정보에 변경이 있으면 알려주세요.`,
        detailsHeading: '예약 내역',
        followUp: '수업 전 궁금한 점이 있으면 이 이메일 또는 기존 안내된 연락 방법으로 문의해주세요.',
        signOff: ['감사합니다.', 'Verygood Chocolate Sydney'],
      },
      english: {
        language: 'English', greetingName: reservation.parentName,
        heading: 'Your kids class booking is CONFIRMED',
        intro: 'Your Verygood Kids Class booking is confirmed. Please arrive ready for the session and let us know promptly if allergy information changes.',
        detailsHeading: 'Booking details',
        followUp: 'Reply to this email if you have a question before the class.',
        signOff: ['Thank you,', 'Verygood Chocolate Sydney'],
      },
    }
  }
  return {
    subject: '[Verygood] 케이크 예약이 확정됐어요 | Your cake booking is confirmed',
    korean: {
      language: '한국어', greetingName: reservation.customerName,
      heading: '예약이 최종 확정되었습니다',
      intro: '베리굿 초콜릿 예약이 최종 확정되었습니다. 픽업 때 뵙겠습니다.',
      detailsHeading: '예약 내역',
      followUp: '변경사항이나 문의가 있으시면 이 이메일 또는 기존 안내된 연락 방법으로 연락해주세요.',
      signOff: ['감사합니다.', 'Verygood Chocolate Sydney'],
    },
    english: {
      language: 'English', greetingName: reservation.customerName,
      heading: 'Your booking is CONFIRMED',
      intro: 'Your Verygood Chocolate booking is confirmed. We look forward to seeing you at collection.',
      detailsHeading: 'Booking details',
      followUp: 'Reply to this email if you have a question about your booking.',
      signOff: ['Thank you,', 'Verygood Chocolate Sydney'],
    },
  }
}

function confirmationRows(reservation, sourceType, config) {
  return sourceType === 'class'
    ? confirmationClassRows(reservation, config)
    : confirmationCakeRows(reservation, config)
}

function buildBookingConfirmationText(reservation, sourceType, config) {
  const copy = confirmationEmailCopy(reservation, sourceType)
  const rows = confirmationRows(reservation, sourceType, config)
  return buildBilingualEmailText(
    { ...copy.korean, rows: customerEmailKoreanRows(rows) },
    { ...copy.english, rows },
  )
}

function buildBookingConfirmationHtml(reservation, sourceType, config) {
  const copy = confirmationEmailCopy(reservation, sourceType)
  const rows = confirmationRows(reservation, sourceType, config)
  return buildBilingualEmailHtml(
    { ...copy.korean, rows: customerEmailKoreanRows(rows) },
    { ...copy.english, rows },
  )
}

export function buildBookingConfirmationPayload({ reservation, sourceType, from, replyTo = null } = {}) {
  if (!reservation || !['cake', 'class'].includes(sourceType) || sourceTypeForReservation(reservation) !== sourceType) {
    throw new Error('INVALID_BOOKING_CONFIRMATION_PAYLOAD')
  }
  const sourceId = sourceIdForReservation(reservation)
  const recipient = normalizeRecipientEmail(sourceType === 'cake' ? reservation.customerEmail : reservation.parentEmail)
  const config = getConfig(reservation)
  const copy = confirmationEmailCopy(reservation, sourceType)
  const normalizedFrom = safeHeaderValue(from, 'RESEND_FROM_EMAIL')
  const normalizedReplyTo = replyTo === null || replyTo === undefined || !String(replyTo).trim()
    ? null
    : normalizeRecipientEmail(replyTo)
  const templateVersion = `${BOOKING_CONFIRMATION_TEMPLATE}-${sourceType}-${BOOKING_CONFIRMATION_TEMPLATE_VERSION}`
  const eventKey = buildEmailDeliveryEventKey({ template: BOOKING_CONFIRMATION_TEMPLATE, sourceType, sourceId })
  const text = buildBookingConfirmationText(reservation, sourceType, config)
  const html = buildBookingConfirmationHtml(reservation, sourceType, config)
  return {
    from: normalizedFrom,
    to: [recipient],
    replyTo: normalizedReplyTo,
    subject: copy.subject,
    text,
    html,
    template: BOOKING_CONFIRMATION_TEMPLATE,
    templateVersion,
    eventKey,
    sourceType,
    sourceId,
    recipientHash: recipientHashForEmail(recipient),
    payloadHash: payloadHashForEmail({
      from: normalizedFrom,
      recipientEmail: recipient,
      replyTo: normalizedReplyTo,
      subject: copy.subject,
      text,
      html,
      template: BOOKING_CONFIRMATION_TEMPLATE,
      templateVersion,
    }),
    idempotencyKey: resendIdempotencyKeyForEvent(eventKey),
  }
}

export { ResendTransportError }

export function createResendTransport(options = {}) {
  return createSharedResendTransport({
    ...options,
    userAgent: 'verygood-reservation-notification/1.0',
  })
}

export function deliverBookingEmail(options = {}) {
  return deliverEmail({ ...options, logLabel: 'Booking email delivery' })
}

export function deliverBookingEmails(options = {}) {
  return deliverEmails({ ...options, logLabel: 'Booking email delivery' })
}

function runtimeResourceId(env, key, fallback) {
  const value = String(env[key] || fallback || '').trim()
  if (!APPWRITE_RESOURCE_ID.test(value)) throw new Error('EMAIL_DELIVERY_CONFIGURATION_ERROR')
  return value
}

export function createRuntimeEmailDeliveryRepository({ req, env = process.env, createDatabases } = {}) {
  const endpoint = String(env.APPWRITE_FUNCTION_API_ENDPOINT || '').trim()
  const projectId = String(env.APPWRITE_FUNCTION_PROJECT_ID || '').trim()
  const apiKey = req?.headers?.['x-appwrite-key']
  if (!endpoint || !projectId || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('EMAIL_DELIVERY_CONFIGURATION_ERROR')
  }
  const databases = createDatabases
    ? createDatabases({ endpoint, projectId, apiKey })
    : new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey))
  return createEmailDeliveryRepository({
    databases,
    databaseId: runtimeResourceId(env, 'APPWRITE_CAKE_DATABASE_ID'),
    collectionId: runtimeResourceId(env, 'APPWRITE_EMAIL_DELIVERIES_TABLE_ID', 'email_deliveries'),
  })
}

export function createRuntimeEmailDeliveryRetryClaimRepository({ req, env = process.env, createDatabases } = {}) {
  const endpoint = String(env.APPWRITE_FUNCTION_API_ENDPOINT || '').trim()
  const projectId = String(env.APPWRITE_FUNCTION_PROJECT_ID || '').trim()
  const apiKey = req?.headers?.['x-appwrite-key']
  if (!endpoint || !projectId || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('EMAIL_DELIVERY_RETRY_CONFIGURATION_ERROR')
  }
  const databases = createDatabases
    ? createDatabases({ endpoint, projectId, apiKey })
    : new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey))
  return createEmailDeliveryRetryClaimRepository({
    databases,
    databaseId: runtimeResourceId(env, 'APPWRITE_CAKE_DATABASE_ID'),
    collectionId: runtimeResourceId(env, 'APPWRITE_EMAIL_DELIVERY_RETRY_CLAIMS_TABLE_ID', 'email_delivery_retry_claims'),
  })
}

export function assertBookingConfirmationAdmin(headers = {}, env = process.env) {
  const userId = headers['x-appwrite-user-id']
  const allowlist = String(env.REVIEW_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)
  if (typeof userId !== 'string' || !allowlist.includes(userId)) {
    const error = new Error('BOOKING_CONFIRMATION_UNAUTHORIZED')
    error.code = 'BOOKING_CONFIRMATION_UNAUTHORIZED'
    throw error
  }
  return userId
}

export function createRuntimeReservationRepository({ req, env = process.env, createDatabases } = {}) {
  const endpoint = String(env.APPWRITE_FUNCTION_API_ENDPOINT || '').trim()
  const projectId = String(env.APPWRITE_FUNCTION_PROJECT_ID || '').trim()
  const apiKey = req?.headers?.['x-appwrite-key']
  if (!endpoint || !projectId || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('BOOKING_CONFIRMATION_CONFIGURATION_ERROR')
  }
  const databases = createDatabases
    ? createDatabases({ endpoint, projectId, apiKey })
    : new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey))
  if (typeof databases.getDocument !== 'function') throw new Error('BOOKING_CONFIRMATION_CONFIGURATION_ERROR')
  const cakeDatabaseId = runtimeResourceId(env, 'APPWRITE_CAKE_DATABASE_ID')
  const classDatabaseId = runtimeResourceId(env, 'APPWRITE_KIDS_DATABASE_ID', cakeDatabaseId)
  const cakeReservationsId = runtimeResourceId(env, 'APPWRITE_CAKE_RESERVATIONS_TABLE_ID', 'reservations')
  const classReservationsId = runtimeResourceId(env, 'APPWRITE_KIDS_RESERVATIONS_TABLE_ID', 'class_reservations')
  return {
    async getReservation(sourceType, reservationId) {
      if (!['cake', 'class'].includes(sourceType) || !APPWRITE_RESOURCE_ID.test(reservationId || '')) {
        throw new Error('BOOKING_CONFIRMATION_INVALID_RESERVATION')
      }
      return databases.getDocument({
        databaseId: sourceType === 'class' ? classDatabaseId : cakeDatabaseId,
        collectionId: sourceType === 'class' ? classReservationsId : cakeReservationsId,
        documentId: reservationId,
      })
    },
  }
}

function manualActionData(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (typeof body.action !== 'string') return null
  return body
}

function bookingEmailActionInput(body, { requireEmailKind = false } = {}) {
  const data = body?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { sourceType, reservationId, emailKind } = data
  if (!['cake', 'class'].includes(sourceType) || !APPWRITE_RESOURCE_ID.test(reservationId || '')) return null
  if (requireEmailKind && !BOOKING_EMAIL_KINDS.includes(emailKind)) return null
  return { sourceType, reservationId, ...(requireEmailKind ? { emailKind } : {}) }
}

function isReservationConfirmed(reservation, sourceType) {
  return reservation?.status === BOOKING_CONFIRMATION_ALLOWED_STATUSES[sourceType]
}

function maskRecipientEmail(value) {
  const email = normalizeRecipientEmail(value)
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

function confirmationResult(delivery, recipientMasked) {
  switch (delivery?.status) {
    case 'sent':
      return { status: 'sent', ...(delivery.sentAt ? { sentAt: delivery.sentAt } : {}), recipientMasked }
    case 'already_sent':
      return { status: 'already_sent', ...(delivery.sentAt ? { sentAt: delivery.sentAt } : {}), recipientMasked }
    case 'in_progress':
      return { status: 'pending', recipientMasked }
    case 'uncertain':
    case 'reconciliation_required':
      return { status: 'uncertain', recipientMasked }
    default:
      return { status: 'failed', recipientMasked }
  }
}

function confirmationStatusResult(delivery, recipientMasked) {
  const recipient = recipientMasked ? { recipientMasked } : {}
  if (!delivery) return { status: 'not_sent', ...recipient }
  if (delivery.status === 'sent') return { status: 'sent', ...(typeof delivery.sentAt === 'string' ? { sentAt: delivery.sentAt } : {}), ...recipient }
  if (delivery.status === 'pending') return { status: 'pending', ...recipient }
  if (delivery.status === 'uncertain') return { status: 'uncertain', ...recipient }
  return { status: 'failed', ...recipient }
}

function bookingEmailPayload({ reservation, sourceType, emailKind, env }) {
  if (emailKind === BOOKING_CONFIRMATION_TEMPLATE) {
    return buildBookingConfirmationPayload({
      reservation, sourceType, from: env.RESEND_FROM_EMAIL, replyTo: env.RESEND_REPLY_TO_EMAIL || null,
    })
  }
  return buildBookingDeliveryPayload({
    reservation,
    role: emailKind === BOOKING_RECEIPT_TEMPLATES.operator ? 'operator' : 'customer',
    from: env.RESEND_FROM_EMAIL,
    operatorRecipients: parseRecipients(env.RESEND_TO_EMAILS),
    replyTo: env.RESEND_REPLY_TO_EMAIL || null,
  })
}

function maskPayloadRecipient(payload) {
  return payload?.to?.length === 1 ? maskRecipientEmail(payload.to[0]) : null
}

function bookingEmailStatusResult(delivery, payload, retryClaim, now) {
  const decision = evaluateEmailDeliveryRetry({
    delivery,
    identity: payload,
    retryClaim,
    now,
  })
  return {
    status: decision.status,
    retry: decision.retry,
    ...(delivery?.sentAt && decision.status === 'sent' ? { sentAt: delivery.sentAt } : {}),
    ...(delivery?.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
    ...(decision.retryUntil ? { retryUntil: decision.retryUntil } : {}),
    ...(maskPayloadRecipient(payload) ? { recipientMasked: maskPayloadRecipient(payload) } : {}),
    ...(decision.safeErrorCode ? { safeErrorCode: decision.safeErrorCode } : {}),
  }
}

function bookingEmailRetryResult(delivery, recipientMasked) {
  return {
    status: delivery.status,
    ...(typeof delivery.sentAt === 'string' ? { sentAt: delivery.sentAt } : {}),
    ...(recipientMasked ? { recipientMasked } : {}),
  }
}

async function handleBookingEmailAction({
  body,
  req,
  res,
  env,
  createReservationRepository,
  createLedgerRepository,
  createRetryClaimRepository,
  createTransport,
  now,
  log,
  error,
}) {
  try {
    assertBookingConfirmationAdmin(req?.headers, env)
  } catch {
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_UNAUTHORIZED' })
  }
  const isLegacyConfirmationAction = ['send-booking-confirmation', 'get-booking-confirmation-status'].includes(body.action)
  const isGenericAction = ['get-booking-email-status', 'retry-booking-email'].includes(body.action)
  if (!isLegacyConfirmationAction && !isGenericAction) {
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_INVALID_ACTION' })
  }
  const input = bookingEmailActionInput(body, { requireEmailKind: isGenericAction })
  if (!input) return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_INVALID_REQUEST' })
  const emailKind = isGenericAction ? input.emailKind : BOOKING_CONFIRMATION_TEMPLATE

  let reservation
  try {
    const reservations = createReservationRepository({ req, env })
    reservation = await reservations.getReservation(input.sourceType, input.reservationId)
  } catch {
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_RESERVATION_UNAVAILABLE' })
  }
  if (!reservation || sourceTypeForReservation(reservation) !== input.sourceType) {
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_NOT_FOUND' })
  }

  if (body.action === 'get-booking-confirmation-status') {
    try {
      const eventKey = buildEmailDeliveryEventKey({
        template: BOOKING_CONFIRMATION_TEMPLATE,
        sourceType: input.sourceType,
        sourceId: sourceIdForReservation(reservation),
      })
      const repository = createLedgerRepository({ req, env })
      let recipientMasked = null
      try {
        recipientMasked = maskRecipientEmail(input.sourceType === 'cake' ? reservation.customerEmail : reservation.parentEmail)
      } catch {}
      return res.json({ ok: true, result: confirmationStatusResult(await repository.getByEventKey(eventKey), recipientMasked) })
    } catch {
      return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_STATUS_UNAVAILABLE' })
    }
  }

  if ((body.action === 'send-booking-confirmation' ||
       (body.action === 'retry-booking-email' && emailKind === BOOKING_CONFIRMATION_TEMPLATE)) &&
      !isReservationConfirmed(reservation, input.sourceType)) {
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_STATUS_INVALID' })
  }

  let payload
  let recipientMasked
  let repository
  let transport
  try {
    payload = bookingEmailPayload({ reservation, sourceType: input.sourceType, emailKind, env })
    recipientMasked = maskPayloadRecipient(payload)
    repository = createLedgerRepository({ req, env })
    transport = createTransport({ apiKey: env.RESEND_API_KEY })
  } catch {
    error(`Booking email configuration unavailable: ${input.sourceType}:${input.reservationId}:${emailKind}`)
    return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_UNAVAILABLE' })
  }

  if (body.action === 'get-booking-email-status') {
    try {
      const delivery = await repository.getByEventKey(payload.eventKey)
      let retryClaim = null
      if (delivery) {
        const claimRepository = createRetryClaimRepository({ req, env })
        retryClaim = await claimRepository.getByEventKey(payload.eventKey)
      }
      return res.json({ ok: true, result: bookingEmailStatusResult(delivery, payload, retryClaim, now()) })
    } catch {
      return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_STATUS_UNAVAILABLE' })
    }
  }

  if (body.action === 'retry-booking-email') {
    let retryClaimRepository
    let delivery
    try {
      delivery = await repository.getByEventKey(payload.eventKey)
      retryClaimRepository = createRetryClaimRepository({ req, env })
    } catch {
      return res.json({ ok: false, code: 'BOOKING_CONFIRMATION_RETRY_UNAVAILABLE' })
    }
    const deliveryResult = await retryEmail({
      payload,
      delivery,
      deliveryRepository: repository,
      retryClaimRepository,
      claimedByUserId: assertBookingConfirmationAdmin(req?.headers, env),
      transport,
      now: now(),
      log,
      error,
      logLabel: 'Booking email retry',
    })
    return res.json({ ok: true, result: bookingEmailRetryResult(deliveryResult, recipientMasked) })
  }

  const delivery = await deliverBookingEmail({ payload, repository, transport, now: now(), log, error })
  return res.json({ ok: true, result: confirmationResult(delivery, recipientMasked) })
}

export function createReservationNotificationHandler({
  env = process.env,
  createLedgerRepository = createRuntimeEmailDeliveryRepository,
  createRetryClaimRepository = createRuntimeEmailDeliveryRetryClaimRepository,
  createReservationRepository = createRuntimeReservationRepository,
  createTransport = createResendTransport,
  now = () => new Date(),
} = {}) {
  return async ({ req, res, log = () => {}, error = () => {} }) => {
    const body = readRequestBody(req)
    const actionRequest = manualActionData(body)
    if (actionRequest) {
      return handleBookingEmailAction({
        body: actionRequest, req, res, env, createReservationRepository, createLedgerRepository, createRetryClaimRepository, createTransport, now, log, error,
      })
    }
    const reservation = readReservation(req)
    const apiKey = env.RESEND_API_KEY
    const from = env.RESEND_FROM_EMAIL
    const operatorRecipients = parseRecipients(env.RESEND_TO_EMAILS)
    const replyTo = env.RESEND_REPLY_TO_EMAIL || null

    if (!reservation?.reservationNumber) {
      error('예약 알림 메일 발송 실패: 예약 데이터가 없습니다.')
      return res.json({ ok: false, reason: 'missing_reservation' })
    }
    if (!apiKey || !from || operatorRecipients.length === 0) {
      error('예약 알림 메일 발송 실패: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TO_EMAILS 설정을 확인하세요.')
      return res.json({ ok: false, reason: 'missing_config', reservationNumber: reservation.reservationNumber })
    }

    let operatorPayload
    try {
      operatorPayload = buildBookingDeliveryPayload({ reservation, role: 'operator', from, operatorRecipients, replyTo })
    } catch {
      error(`예약 알림 메일 발송 실패: ${plainTextCell(reservation.reservationNumber)}의 운영자 발송 구성이 유효하지 않습니다.`)
      return res.json({ ok: false, reason: 'invalid_operator_delivery', reservationNumber: reservation.reservationNumber })
    }

    let customerPayload = null
    try {
      customerPayload = buildBookingDeliveryPayload({ reservation, role: 'customer', from, operatorRecipients, replyTo })
    } catch {
      error(`예약 고객 이메일을 발송하지 않았습니다: ${plainTextCell(reservation.reservationNumber)}의 고객 이메일이 없습니다 또는 유효하지 않습니다.`)
    }

    let repository
    let transport
    try {
      repository = createLedgerRepository({ req, env })
      transport = createTransport({ apiKey })
    } catch {
      error(`예약 알림 메일 발송 실패: ${plainTextCell(reservation.reservationNumber)}의 delivery ledger 설정을 확인하세요.`)
      return res.json({ ok: false, reason: 'delivery_ledger_unavailable', reservationNumber: reservation.reservationNumber })
    }

    const [operator, customer] = await deliverBookingEmails({
      payloads: [operatorPayload, customerPayload], repository, transport, now: now(), log, error,
    })
    return res.json({
      ok: true,
      reservationNumber: reservation.reservationNumber,
      ...(operator.status === 'sent' ? { id: operator.providerMessageId } : {}),
      deliveries: { operator, customer },
    })
  }
}

export default createReservationNotificationHandler()
