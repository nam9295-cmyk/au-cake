import type { CakeSize, ChocolateType, PoundAddon, ProductId } from './types.js'
import { marketConfig } from './market.js'

export type Language = 'en' | 'ko'

export const DEFAULT_LANGUAGE: Language = 'en'

const LANGUAGE_STORAGE_KEY = 'au-cake-language'

export function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ko' ? 'ko' : DEFAULT_LANGUAGE
}

export function storeLanguage(language: Language) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}

type ProductText = {
  name: string
  description: string
  priceNote: string
}

const koProducts: Record<ProductId, ProductText> = {
  'pave-cake': {
    name: '파베 초콜릿 케이크',
    description: '초콜릿 시트 사이에 부드러운 파베 가나슈를 겹겹이 넣은 원형 케이크예요. 크림보다 초콜릿 맛이 먼저 오는 스타일입니다.',
    priceNote: '사이즈와 다크/밀크 선택 가능',
  },
  'pound-cake': {
    name: '초코 파운드 케이크',
    description: '묵직하게 구운 직사각형 초코 케이크에 다크초콜릿을 올렸어요. 작게 나눠 먹기 좋고 선물용으로도 편합니다.',
    priceNote: '마감 옵션 선택 가능',
  },
  'cupcake-dozen': {
    name: '초코 컵케이크 1다스',
    description: '나눠 먹기 편한 초콜릿 컵케이크 12개 세트예요. 파티, 모임, 아이들 선물용으로 준비하기 좋습니다.',
    priceNote: '12개 한 세트, 마감 옵션 선택 가능',
  },
}

const koProductFeatures: Record<ProductId, string[]> = {
  'pave-cake': ['초콜릿 시트와 파베 가나슈', '6 / 7.5 / 8.7 inch 사이즈', '다크 또는 밀크 선택'],
  'pound-cake': ['직사각형 갸또 쇼콜라', '고정 사이즈', '기본, 초콜릿 추가, 바닐라 크림 마감'],
  'cupcake-dozen': ['12개 1다스 구성', '작게 나눠 먹기 좋은 컵케이크', '기본, 초콜릿 추가, 바닐라 크림 마감'],
}

export function getProductText(productId: ProductId, language: Language): ProductText {
  const product = marketConfig.products[productId]
  if (language === 'ko') return koProducts[productId]
  return {
    name: product.name,
    description: product.description,
    priceNote: product.priceNote,
  }
}

export function getProductFeatures(productId: ProductId, language: Language) {
  if (language === 'ko') return koProductFeatures[productId]
  return marketConfig.productCardFeatures[productId]
}

const koCakeSizeDescriptions: Partial<Record<CakeSize, string>> = {
  '15cm': '작은 모임이나 선물용으로 좋아요',
  '19cm': '여럿이 나눠 먹기 좋은 사이즈예요',
  '22cm': '파티용으로 여유 있는 사이즈예요',
}

const koChocolateType: Record<ChocolateType, { label: string; description: string }> = {
  dark: { label: '다크 초콜릿', description: '진하고 깔끔한 초콜릿 맛' },
  milk: { label: '밀크 초콜릿', description: '조금 더 부드럽고 크리미한 맛' },
}

const koPoundAddon: Record<PoundAddon, { label: string; description: string }> = {
  none: { label: '기본 마감', description: '가장 깔끔한 기본 마감' },
  'extra-chocolate': { label: '초콜릿 추가', description: '초콜릿 맛을 조금 더 진하게' },
  'vanilla-cream': { label: '바닐라 크림', description: '부드러운 바닐라 크림 마감' },
}

export function getCakeSizeText(option: { value: CakeSize; label: string; description: string }, language: Language) {
  if (language === 'ko') return { label: option.label, description: koCakeSizeDescriptions[option.value] || option.description }
  return { label: option.label, description: option.description }
}

export function getChocolateTypeText(option: { value: ChocolateType; label: string; description: string }, language: Language) {
  if (language === 'ko') return koChocolateType[option.value]
  return { label: option.label, description: option.description }
}

export function getPoundAddonText(option: { value: PoundAddon; label: string; description: string }, language: Language) {
  if (language === 'ko') return koPoundAddon[option.value]
  return { label: option.label, description: option.description }
}

export function formatChocolateTypeText(chocolateType: ChocolateType | undefined, language: Language) {
  const option = marketConfig.chocolateTypeOptions.find((item) => item.value === chocolateType) || marketConfig.chocolateTypeOptions[0]
  return getChocolateTypeText(option, language).label
}

export function formatPoundAddonText(poundAddon: PoundAddon | undefined, language: Language) {
  const option = marketConfig.poundAddonOptions.find((item) => item.value === poundAddon) || marketConfig.poundAddonOptions[0]
  return getPoundAddonText(option, language).label
}

export function cakeCopy(language: Language) {
  if (language === 'ko') {
    return {
      languageLabel: 'Language',
      englishLabel: 'English',
      koreanLabel: '한국어',
      languageHelp: '한국어로 보기',
      announcement: '오늘부터 픽업 주문 가능',
      brandName: 'Verygood Chocolate',
      homeTitle: '시드니 초콜릿 케이크 주문',
      homeDescription: '베리굿초콜릿의 진한 초콜릿 맛을 시드니에서도 예약 주문으로 만나보세요. 픽업은 Melrose Park에서 진행됩니다.',
      reserveCta: '케이크 주문하기',
      lookupNav: '주문 조회',
      adminNav: 'Admin',
      kidsNav: 'Kids Class',
      productSectionTitle: '케이크 선택',
      reservationGuideTitle: '주문 방법',
      dailyLimitText: '매일 소량으로 준비합니다',
      price: '가격',
      options: '옵션',
      pickupLocationKicker: '픽업 장소',
      pickupLocationTitle: 'Google Maps에서 확인하기',
      pickupLocationText: '픽업은 Pulse - Melrose Park 근처에서 진행됩니다. 정확한 전달 방법은 Jenny가 주문 확정 후 안내드려요.',
      openMap: 'Google Maps 열기',
      guideSteps: [
        { title: '주문 신청', text: '원하는 케이크와 픽업 시간을 선택해 주세요.' },
        { title: '확인 메시지', text: 'Jenny가 가능 여부를 확인한 뒤 결제 안내를 보내드립니다.' },
        { title: '결제 후 확정', text: '입금 확인 후 주문이 확정됩니다. 온라인 결제는 아직 없어요.' },
        { title: '픽업', text: '확정된 시간에 Melrose Park에서 픽업합니다.' },
      ],
      pickupHours: ['픽업 시간 10:00-20:00', '목요일 휴무'],
      paymentLabel: '결제 정보',
      paymentAmountLabel: '결제 금액',
      accountHolderLabel: '계좌명',
      copyButton: '복사',
      copiedButton: '복사됨',
      quantityUnit: '개',
      phoneHelp: '예: 0412345678 또는 +61 412 345 678',
      phonePlaceholder: '0412345678',
      requestPlaceholder: '픽업 관련 요청, 입금자명이 다른 경우, 기타 요청사항을 적어주세요.',
      privacyNotice: '주문 확인과 안내를 위해 입력한 정보를 사용하는 데 동의합니다.',
      reservationCompleteTitle: '주문 신청이 접수됐어요.',
      reservationCompleteText: 'Jenny가 가능 여부를 확인한 뒤 확정 메시지를 보내드립니다.',
      paymentConfirmText: '입금 확인 후 주문이 최종 확정됩니다.',
      noReservationText: '보여드릴 주문 정보가 없어요. 주문 조회를 이용해 주세요.',
      lookupTitle: '주문 조회',
      lookupPhoneLabel: '휴대폰 번호 또는 뒤 4자리',
      notFoundText: '주문 정보를 찾지 못했어요.',
      home: '처음으로',
      back: '돌아가기',
      title: '케이크 주문',
      product: '제품',
      totalPrice: '총 금액',
      quantity: '수량',
      size: '사이즈',
      production: '제작',
      cakeSelect: '케이크 선택',
      changeCake: '케이크 변경',
      selectedCake: '선택됨',
      sizeSelect: '사이즈 선택',
      cacaoSelect: '농도 선택',
      chocolateSelect: '초콜릿 선택',
      finishSelect: '마감 선택',
      finish: '마감',
      chocolate: '초콜릿',
      orderQuantity: '주문 수량',
      pickupDate: '픽업 날짜',
      pickupTime: '픽업 시간',
      customerName: '이름',
      phone: '휴대폰 번호',
      requestNote: '요청사항',
      promoCode: '프로모 코드',
      promoPlaceholder: '코드가 있으면 입력해 주세요',
      promoApplied: '프로모 코드 적용: 10% 할인',
      promoHint: '대소문자 구분 없이 적용돼요.',
      namePlaceholder: 'Jenny Kim',
      submitting: '신청 중',
      search: '조회하기',
      bookingNumber: '주문번호',
      bookingStatus: '주문 상태',
      paymentStatus: '결제 상태',
      pickUp: '픽업',
      mobile: '연락처',
      sizeHelp: '선택한 사이즈 기준으로 금액이 계산됩니다.',
      cacaoHelp: '카카오 옵션은 가나슈 맛 기준이며, 케이크 전체 당도와는 달라요.',
      finishHelp: '기본, 초콜릿 추가, 바닐라 크림 중 하나만 선택해 주세요.',
      quantityHelp: (unitPrice: string, max: number, unit: string) => `1${unit} 기준 ${unitPrice}, 최대 ${max}${unit}까지 주문할 수 있어요.`,
      quantityHelpCupcake: (unitPrice: string, max: number, unit: string) => `1다스 기준 ${unitPrice}, 최대 ${max}${unit}까지 주문할 수 있어요.`,
      errors: {
        name: '이름을 2자 이상 입력해 주세요.',
        phone: '휴대폰 번호를 확인해 주세요.',
        pickupDate: '픽업 날짜는 오늘부터 선택할 수 있어요.',
        pickupTime: '픽업 시간을 선택해 주세요.',
        quantity: (max: number) => `수량은 최대 ${max}개까지 선택할 수 있어요.`,
        privacy: '개인정보 이용에 동의해 주세요.',
        submit: '주문 신청 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
      },
    }
  }

  return {
    languageLabel: 'Language',
    englishLabel: 'English',
    koreanLabel: '한국어',
    languageHelp: 'View in Korean',
    announcement: 'Pick-up available from today',
    brandName: marketConfig.copy.brandName,
    homeTitle: marketConfig.copy.homeTitle,
    homeDescription: marketConfig.copy.homeDescription,
    reserveCta: marketConfig.copy.reserveCta,
    lookupNav: marketConfig.copy.lookupNav,
    adminNav: marketConfig.copy.adminNav,
    kidsNav: 'Kids Class',
    productSectionTitle: marketConfig.copy.productSectionTitle,
    reservationGuideTitle: marketConfig.copy.reservationGuideTitle,
    dailyLimitText: marketConfig.defaultSettings.dailyLimitText,
    price: 'Price',
    options: 'Options',
    pickupLocationKicker: 'Pick-up location',
    pickupLocationTitle: 'Find us on Google Maps',
    pickupLocationText: 'Pick-up is at Pulse - Melrose Park. Jenny will confirm the exact handoff details with your booking confirmation.',
    openMap: 'Open in Google Maps',
    guideSteps: marketConfig.guideSteps,
    pickupHours: ['Pick-up time 10:00-20:00 everyday', 'Thursday off'],
    paymentLabel: marketConfig.copy.paymentLabel,
    paymentAmountLabel: marketConfig.copy.paymentAmountLabel,
    accountHolderLabel: marketConfig.copy.accountHolderLabel,
    copyButton: marketConfig.copy.copyButton,
    copiedButton: marketConfig.copy.copiedButton,
    quantityUnit: marketConfig.copy.quantityUnit,
    phoneHelp: marketConfig.copy.phoneHelp,
    phonePlaceholder: marketConfig.copy.phonePlaceholder,
    requestPlaceholder: marketConfig.copy.requestPlaceholder,
    privacyNotice: marketConfig.copy.privacyNotice,
    reservationCompleteTitle: marketConfig.copy.reservationCompleteTitle,
    reservationCompleteText: marketConfig.copy.reservationCompleteText,
    paymentConfirmText: marketConfig.copy.paymentConfirmText,
    noReservationText: marketConfig.copy.noReservationText,
    lookupTitle: marketConfig.copy.lookupTitle,
    lookupPhoneLabel: marketConfig.copy.lookupPhoneLabel,
    notFoundText: marketConfig.copy.notFoundText,
    home: 'Home',
    back: 'Back',
    title: 'Cake request',
    product: 'Product',
    totalPrice: 'Total',
    quantity: 'Quantity',
    size: 'Size',
    production: 'Availability',
    cakeSelect: 'Choose cake',
    changeCake: 'Change cake',
    selectedCake: 'Selected cake',
    sizeSelect: 'Choose size',
    cacaoSelect: 'Choose cacao',
    chocolateSelect: 'Choose chocolate',
    finishSelect: 'Choose finish',
    finish: 'Finish',
    chocolate: 'Chocolate',
    orderQuantity: 'Order quantity',
    pickupDate: 'Pick-up date',
    pickupTime: 'Pick-up time',
    customerName: 'Name',
    phone: 'Mobile',
    requestNote: 'Request notes',
    promoCode: 'Promo code',
    promoPlaceholder: 'Enter promo code',
    promoApplied: 'Promo applied: 10% off',
    promoHint: 'Not case-sensitive.',
    namePlaceholder: 'Jenny Smith',
    submitting: 'Submitting',
    search: 'Search',
    bookingNumber: 'Booking number',
    bookingStatus: 'Booking status',
    paymentStatus: 'Payment status',
    pickUp: 'Pick-up',
    mobile: 'Phone',
    sizeHelp: 'The total is calculated from the selected size.',
    cacaoHelp: 'Cacao options describe the ganache profile, not the total sugar content of the cake.',
    finishHelp: 'Choose one finish only: basic, extra chocolate, or vanilla cream.',
    quantityHelp: (unitPrice: string, max: number, unit: string) => `${unitPrice} per cake, up to ${max}${unit}.`,
    quantityHelpCupcake: (unitPrice: string, max: number, unit: string) => `${unitPrice} per dozen, up to ${max}${unit}.`,
    errors: {
      name: 'Please enter your name (at least 2 characters).',
      phone: 'Please check the mobile number.',
      pickupDate: 'Please select a pick-up date from today onwards.',
      pickupTime: 'Please select a pick-up time.',
      quantity: (max: number) => `You can request up to ${max} cakes.`,
      privacy: 'Please agree to the privacy policy.',
      submit: 'An error occurred while submitting your cake request. Please try again.',
    },
  }
}
