import https from 'node:https'
import { parseStoredOrderLines } from '../shared/reservation-api/business.js'

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
  const body = req.bodyJson && typeof req.bodyJson === 'object' ? req.bodyJson : parseBody(req.bodyRaw)
  if (!body) return null

  // Appwrite event payloads can arrive either as the document itself, or wrapped.
  return body.reservation || body.document || body.row || body.payload || body
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

async function postJson(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          if (responseBody.length + chunk.length > 65_536) {
            request.destroy(new Error('Resend API response was too large.'))
            return
          }
          responseBody += chunk
        })
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody))
            } catch {
              resolve({})
            }
            return
          }

          reject(new Error(`Resend API failed: ${response.statusCode} ${responseBody}`))
        })
      },
    )

    request.setTimeout(10_000, () => request.destroy(new Error('Resend API request timed out.')))
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

async function sendResendEmail({ reservation, to, from, apiKey, config }) {
  return postJson(
    'https://api.resend.com/emails',
    {
      from,
      to,
      subject: getSubject(reservation, config),
      text: buildText(reservation, config),
      html: buildHtml(reservation, config),
    },
    {
      Authorization: `Bearer ${apiKey}`,
    },
  )
}

export default async ({ req, res, log, error }) => {
  const reservation = readReservation(req)
  const config = getConfig(reservation)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = parseRecipients(process.env.RESEND_TO_EMAILS)

  if (!reservation?.reservationNumber) {
    error('예약 알림 메일 발송 실패: 예약 데이터가 없습니다.')
    return res.json({ ok: false, reason: 'missing_reservation' })
  }

  if (!apiKey || !from || to.length === 0) {
    error('예약 알림 메일 발송 실패: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TO_EMAILS 설정을 확인하세요.')
    return res.json({ ok: false, reason: 'missing_config', reservationNumber: reservation.reservationNumber })
  }

  try {
    const result = await sendResendEmail({ reservation, to, from, apiKey, config })
    log(`예약 알림 메일 발송 완료: ${reservation.reservationNumber} -> ${to.join(', ')}`)
    return res.json({ ok: true, id: result.id, reservationNumber: reservation.reservationNumber })
  } catch (sendError) {
    error(`예약 알림 메일 발송 실패: ${reservation.reservationNumber}`)
    error(sendError?.message || String(sendError))
    return res.json({ ok: false, reason: 'send_failed', reservationNumber: reservation.reservationNumber })
  }
}
