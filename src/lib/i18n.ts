import { VANILLA_CAKE_POINT_COLOR_OPTIONS } from './constants.js'
import type { CakeSize, ChocolateType, CupcakeFinish, PoundAddon, ProductId, VanillaCakePointColor } from './types.js'
import { AU_CAKE_SIZE_LABELS, marketConfig } from './market.js'

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

const koProducts: Partial<Record<ProductId, ProductText>> = {
  'pave-cake': {
    name: '파베 초콜릿 케이크',
    description: '가벼운 스펀지와 크림 중심의 케이크가 아니라, 묵직한 초콜릿 케이크 시트를 4단으로 쌓고 각 층을 부드러운 파베 초콜릿 가나슈로 채웠습니다. 처음부터 끝까지 진한 초콜릿의 밀도와 묵직한 식감을 느낄 수 있는 베리굿의 시그니처 초콜릿 케이크입니다.',
    priceNote: '사이즈 선택 · 다크 초콜릿만 사용',
  },
  'vanilla-fresh-cream-cake': {
    name: '바닐라 생크림 케이크',
    description: '베리굿의 시그니처 갸또 쇼콜라 시트 사이를 실제 바닐라빈을 넣은 바닐라 생크림으로 채웠습니다. 크림 속 작은 점들은 실제 바닐라빈이 들어간 자연스러운 흔적입니다.',
    priceNote: '사이즈 선택 · 실제 바닐라빈을 넣은 바닐라 생크림',
  },
  'buttercream-cake': {
    name: '버터크림 케이크',
    description: '베리굿의 시그니처 갸또 쇼콜라 시트 사이를 초콜릿 버터크림으로 채우고 전체를 마감합니다. 초코 향료가 아니라 유기농 코코아, 신선한 우유, 쇼콜라티에용 커버춰 초콜릿을 사용해 깊고 진한 초콜릿 맛을 냅니다.',
    priceNote: '사이즈와 케이크 컬러 선택 · 초콜릿 버터크림 포함',
  },
  'pound-cake': {
    name: '시그니처 갸또 쇼콜라',
    description: '묵직하게 구운 직사각형 초코 케이크에 다크초콜릿을 올렸어요. 작게 나눠 먹기 좋고 선물용으로도 편합니다.',
    priceNote: '마감 옵션 선택 가능',
  },
  'cupcake-dozen': {
    name: '초콜릿 컵케이크',
    description: '박스 전체를 같은 마감으로 완성하는 초콜릿 컵케이크예요.',
    priceNote: '더즌 · 12개와 박스 전체 마감 선택',
  },
  'cupcake-half-dozen': {
    name: '초콜릿 컵케이크',
    description: '박스 전체를 같은 마감으로 완성하는 초콜릿 컵케이크예요.',
    priceNote: '하프 더즌 · 6개와 박스 전체 마감 선택',
  },
  'choco-basque-cheesecake': {
    name: '쇼콜라티에 바스크 치즈케이크',
    description: `진한 초콜릿과 크림치즈를 높은 온도에서 구운 ${AU_CAKE_SIZE_LABELS['15cm']} 바스크 치즈케이크예요.`,
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'pave-choco-basque-cheesecake': {
    name: '파베 초콜릿 on top',
    description: `쇼콜라티에 바스크 치즈케이크 위에 파베 초콜릿을 올린 ${AU_CAKE_SIZE_LABELS['15cm']} 케이크예요.`,
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'eiffel-tower-basque-cheesecake': {
    name: '에펠탑 초콜릿 케이크 마감',
    description: `파베 초콜릿으로 케이크 전체를 덮고 에펠탑 초콜릿 하나를 올린 ${AU_CAKE_SIZE_LABELS['15cm']} 케이크예요.`,
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'brownie-cheesecake': {
    name: '브라우니 치즈케이크',
    description: '진한 다크초콜릿 브라우니 베이스 위에 부드럽게 구운 바스크 치즈케이크를 올린 2층 디저트입니다. 브라우니와 치즈케이크의 서로 다른 매력을 한 조각에서 함께 즐길 수 있습니다.',
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'pave-brownie-cheesecake': {
    name: '브라우니 치즈케이크 · 파베 초콜릿 on top',
    description: '다크초콜릿 브라우니와 바스크 스타일 치즈케이크 위에 부드러운 파베 초콜릿을 더해 마무리합니다.',
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'eiffel-tower-brownie-cheesecake': {
    name: '브라우니 치즈케이크 · 에펠탑 마감',
    description: '다크초콜릿 브라우니와 바스크 스타일 치즈케이크를 전체 파베 초콜릿과 에펠탑 초콜릿 하나로 마무리합니다.',
    priceNote: AU_CAKE_SIZE_LABELS['15cm'],
  },
  'fresh-lemon-cupcakes-4': {
    name: '레몬 케이크 · 4개', description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.', priceNote: '4개 구성 · 레몬 글레이즈와 꽃 장식 포함',
  },
  'fresh-lemon-cupcakes-6': {
    name: '레몬 케이크 · 6개', description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.', priceNote: '6개 구성 · 레몬 글레이즈와 꽃 장식 포함',
  },
  'fresh-lemon-cupcakes-8': {
    name: '레몬 케이크 · 8개', description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.', priceNote: '8개 구성 · 레몬 글레이즈와 꽃 장식 포함',
  },
  'fresh-lemon-cupcakes-12': {
    name: '레몬 케이크 · 12개', description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.', priceNote: '12개 구성 · Most Popular',
  },
  'fresh-lemon-cupcakes-16': {
    name: '레몬 케이크 · 16개', description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.', priceNote: '16개 구성 · 레몬 글레이즈와 꽃 장식 포함',
  },
}

const koProductFeatures: Partial<Record<ProductId, string[]>> = {
  'pave-cake': ['묵직한 초콜릿 케이크 4단', '각 층을 채운 파베 초콜릿 가나슈', '크림보다 초콜릿이 중심인 진한 맛', '6" · 7.5" · 9" 사이즈'],
  'vanilla-fresh-cream-cake': ['시그니처 갸또 쇼콜라 시트', '실제 바닐라빈을 넣은 바닐라 생크림', '눈에 보이는 실제 바닐라빈', '6" · 7.5" · 9" 사이즈'],
  'buttercream-cake': ['시그니처 갸또 쇼콜라 시트', '유기농 코코아·신선한 우유·쇼콜라티에용 커버춰 초콜릿 사용', '깊고 진한 맛을 내는 유기농 코코아', '신선한 우유', '쇼콜라티에용 커버춰 초콜릿', '케이크 컬러 선택'],
  'pound-cake': ['직사각형 갸또 쇼콜라', '고정 사이즈', '기본, 초콜릿 추가, 바닐라 크림 마감'],
  'cupcake-half-dozen': ['하프 더즌 · 6개', '박스 전체 동일 마감', '기본, 바닐라 생크림 또는 초콜릿 버터크림'],
  'cupcake-dozen': ['더즌 · 12개', '박스 전체 동일 마감', '기본, 바닐라 생크림 또는 초콜릿 버터크림'],
  'choco-basque-cheesecake': [AU_CAKE_SIZE_LABELS['15cm'], '쇼콜라티에 바스크 치즈케이크', '부드럽고 꾸덕한 중심'],
  'pave-choco-basque-cheesecake': [AU_CAKE_SIZE_LABELS['15cm'], '파베 초콜릿 마감', '+AUD 10.00 마감 추가'],
  'eiffel-tower-basque-cheesecake': [AU_CAKE_SIZE_LABELS['15cm'], '전체 파베 초콜릿 마감', '+AUD 15.00 마감 추가'],
  'brownie-cheesecake': ['다크초콜릿 브라우니 베이스', '위에는 바스크 치즈케이크', '두 가지 디저트를 한 번에', AU_CAKE_SIZE_LABELS['15cm'], '세 가지 마감 선택'],
  'pave-brownie-cheesecake': [AU_CAKE_SIZE_LABELS['15cm'], '파베 초콜릿 on top', '+AUD 10.00 마감 추가'],
  'eiffel-tower-brownie-cheesecake': [AU_CAKE_SIZE_LABELS['15cm'], '전체 파베 초콜릿 마감', '+AUD 15.00 마감 추가'],
  'fresh-lemon-cupcakes-4': ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
  'fresh-lemon-cupcakes-6': ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
  'fresh-lemon-cupcakes-8': ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
  'fresh-lemon-cupcakes-12': ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
  'fresh-lemon-cupcakes-16': ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
}

export function getProductText(productId: ProductId, language: Language): ProductText {
  const product = marketConfig.products[productId] || marketConfig.products['pave-cake']!
  if (language === 'ko' && marketConfig.market === 'AU') return koProducts[productId] || {
    name: product.name,
    description: product.description,
    priceNote: product.priceNote,
  }
  return {
    name: product.name,
    description: product.description,
    priceNote: product.priceNote,
  }
}

export function getProductFeatures(productId: ProductId, language: Language) {
  if (language === 'ko' && marketConfig.market === 'AU') {
    return koProductFeatures[productId] || marketConfig.productCardFeatures[productId] || marketConfig.productCardFeatures['pave-cake'] || []
  }
  return marketConfig.productCardFeatures[productId] || marketConfig.productCardFeatures['pave-cake'] || []
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

export function formatCupcakeFinishText(cupcakeFinish: CupcakeFinish | undefined, language: Language) {
  const finish = cupcakeFinish || 'basic'
  if (language === 'ko') {
    if (finish === 'vanilla-fresh-cream') return '바닐라 생크림'
    if (finish === 'chocolate-buttercream') return '초콜릿 버터크림'
    return '기본'
  }
  if (finish === 'vanilla-fresh-cream') return 'Vanilla Fresh Cream'
  if (finish === 'chocolate-buttercream') return 'Chocolate Buttercream'
  return 'Basic'
}

export function formatVanillaCakePointColorText(value: VanillaCakePointColor | undefined, language: Language) {
  const option = VANILLA_CAKE_POINT_COLOR_OPTIONS.find((item) => item.value === value) || VANILLA_CAKE_POINT_COLOR_OPTIONS[0]
  return language === 'ko' ? option.labelKo : option.label
}

const CLASS_PAGE_COPY = {
  en: {
    landing: {
      title: 'Kids Cake Decorating Classes Sydney',
      location: 'Melrose Park, Sydney',
      intro: 'Three limited Saturday cake class dates in Melrose Park, Sydney: 26 September, 3 and 10 October 2026, with sessions at 10:00, 13:00 and 16:00. Basic welcomes children from Kindy to Year 6; Advanced starts from Year 2.',
      requestSpot: 'Request a spot',
      courseSummary: 'Basic: Kindy–Year 6 · Advanced: Year 2–6 · Limited Saturday classes',
      heroImageAlt: 'Kids professional cake course hero',
      essentialsTitle: 'Class Essentials',
      essentials: [
        { title: 'Basic from Kindy', text: 'Kindy–Year 2 and Year 3–6 school groups' },
        { title: 'Professional-style course', text: 'Real studio guidance from planning to finishing' },
        { title: 'Basic and Advanced', text: 'Start with a 15cm cake or cupcakes, then progress to a 2-tier cake' },
        { title: 'Limited Saturday classes', text: '26 September, 3 and 10 October 2026 with our team' },
        { title: 'Max 2 kids per session', text: 'Private small group focus' },
      ],
      courseTitle: 'Choose a Course',
      courseCards: [
        { title: 'Basic Cake Class', text: 'Kindy–Year 6 · Plan, build, and finish one 15cm chocolate cake to take home.' },
        { title: 'Basic Cupcakes & Chocolate Class', text: 'Kindy–Year 6 · Make four cupcakes and enjoy a guided hands-on chocolate-making activity.' },
        { title: 'Advanced 2-Tier Cake Class', text: 'Year 2–6 · A 120-minute, one-child class for building and finishing a two-tier cake.' },
      ],
      stepsTitle: 'How it works',
      steps: [
        { title: 'Choose a course', text: 'Select the age group, date, and studio session time.' },
        { title: 'Imagine your cake', text: 'Sketch the cake from your imagination and plan the shape, colour, and finish.' },
        { title: 'Bring it to life', text: 'Build your chocolate cake with professional guidance from our team.' },
        { title: 'Box and take home', text: 'Pack your finished cake beautifully and take it home safely.' },
      ],
      galleryLabel: 'Kids class photos',
      processImageAlt: 'Kids class cake making process',
      processTitle: 'Studio process',
      processText: 'Plan, layer, cream, and finish with guided hands-on steps.',
      finishedImageAlt: 'Finished kids cake class chocolate cake',
      finishedTitle: 'Finished cake',
      finishedText: 'A real chocolate cake boxed beautifully to take home.',
      pricingSafetyLabel: 'Pricing and safety information',
      priceGuideTitle: 'Price Guide',
      baseRangeLabel: 'Base course/package range',
      basicYoungerLabel: 'Basic · Kindy–Year 2',
      basicOlderLabel: 'Basic · Year 3–6',
      advancedLabel: 'Advanced',
      oneChild: 'one child',
      packageSummary: 'A Basic + Advanced package covers two separate Spring Vacation sessions and receives 5% off the base class fees.',
      extensionSummary: 'A 30-minute extension is AUD 20.00 per participant, per class and is not discounted.',
      confirmationNote: '* Booking is completed after availability and full payment are confirmed by our team.',
      safetyTitle: 'Safety & Allergy Policy',
      safetyText: 'This is a short private cake decorating class, not childcare. Younger children may need a parent or guardian to stay nearby or join the session.',
      safetyPoints: [
        'All allergies and dietary requirements must be declared before booking confirmation',
        'Parent/guardian consent is required when submitting a booking request',
        'Detailed address shared after payment confirmation (Melrose Park, Sydney)',
      ],
      finalCtaLabel: 'Request class booking',
      finalCtaText: 'Limited Spring Saturday spots are handled manually so our team can confirm each class safely.',
    },
    reserve: {
      honeypot: 'Leave this field blank',
      backToClasses: 'Back to classes',
      title: 'Request a Kids Course',
      intro: 'Please fill out the details below. Our team will confirm availability and send full payment details.',
      planTitle: '1. Choose a Plan',
      coursePlans: {
        basic: { label: 'Basic', detail: 'Cake or cupcakes · 1–2 children' },
        advanced: { label: 'Advanced', detail: 'One child · 2-tier cake' },
        'basic-advanced-package': { label: 'Basic + Advanced Package', detail: 'One child · two Spring sessions' },
      },
      basicClassTitle: '2. Choose a Basic Class',
      classTypes: {
        'school-holiday-private-cake-class': { label: 'Basic Cake Class', detail: 'One 15cm chocolate cake' },
        'cupcake-chocolate-class': { label: 'Basic Cupcakes & Chocolate Class', detail: '4 cupcakes + chocolate making' },
        'advanced-2-tier-cake-class': { label: 'Advanced 2-Tier Cake Class', detail: 'One child · 2-tier cake' },
      },
      schoolGroupTitle: '3. Choose School Group',
      basicSchoolGroup: 'Basic · Kindy–Year 6',
      youngerGroup: 'Kindy–Year 2',
      youngerDetail: 'Younger students',
      olderGroup: 'Year 3–6',
      olderDetail: 'Primary students',
      advancedSchoolGroup: 'Advanced · Year 2–6 only',
      childrenTitle: '4. Number of Children',
      oneChildOnly: 'Advanced and package bookings are for one child only.',
      oneChildLabel: '1 child',
      oneChildDetail: 'Private session',
      twoChildrenLabel: '2 children / siblings / friends',
      twoChildrenDetail: 'Learn together',
      sessionTitle: (plan: string, minutes: number) => `5. ${plan} Spring Session · ${minutes} minutes`,
      preferredDate: 'Preferred Date',
      preferredTime: 'Preferred Session Time',
      dateUnavailable: 'This date is already booked. Please choose another date.',
      availabilityLoadError: 'Availability could not be loaded. Our team will double-check this session before confirming.',
      available: (times: string) => `Available: ${times}`,
      addMinutes: 'Add 30 minutes to this class',
      extensionWarning: 'Please consider your child’s focus and stamina before adding 30 minutes. For boys in particular, please choose this option carefully, as the longer session can feel demanding.',
      advancedSessionTitle: (minutes: number) => `Advanced Spring Session · ${minutes} minutes`,
      advancedDate: 'Advanced Date · 26 September, 3 or 10 October',
      advancedTime: 'Advanced Session Time',
      addAdvancedMinutes: 'Add 30 minutes to the Advanced class',
      parentDetails: 'Parent / Guardian Details',
      fullName: 'Full Name',
      fullNamePlaceholder: 'Parent or guardian name',
      emailAddress: 'Email Address',
      mobileNumber: 'Mobile Number',
      childDetails: 'Child Details',
      childOneName: 'Child 1 Name',
      childOneAge: 'Child 1 Age',
      childOneSchoolYear: 'Child 1 School Year',
      childTwoName: 'Child 2 Name',
      childTwoAge: 'Child 2 Age',
      childTwoSchoolYear: 'Child 2 School Year',
      chooseYear: 'Choose year',
      safetyTitle: 'Allergy & Safety Declarations',
      allergyNotes: 'Allergy declarations & safety notes',
      allergyPlaceholder: 'Please write known allergies, dietary notes, or none.',
      emergencyContact: 'Emergency Contact',
      emergencyPlaceholder: 'Name and mobile',
      pickupPerson: 'Pick-up Person',
      pickupPlaceholder: 'Who will pick up',
      consentTitle: 'Consent & Confirmation',
      parentConsent: 'I am the parent/guardian and consent to my child joining this class.',
      bookingConsent: 'I understand my booking is completed only after availability is confirmed and full payment is received.',
      privacyConsent: 'I agree that booking, contact, allergy and emergency details may be stored in Appwrite for class administration and sent through Resend for operator email notifications.',
      photoConsent: 'Photo Consent',
      photoYes: 'Yes, I consent to photos',
      photoNo: 'No, do not take photos',
      summaryLabel: 'Class request summary',
      summary: {
        plan: 'Plan', course: 'Course', schoolYear: 'School year', children: 'Children', firstSession: 'First session', advancedSession: 'Advanced session', subtotal: 'Subtotal', packageDiscount: 'Package discount', total: 'Total', payment: 'Payment', fullPayment: 'Full payment required',
      },
      sessionSummary: (date: string, time: string, minutes: number) => `${date} ${time} · ${minutes} min`,
      paymentNote: 'Use this account after our team confirms the session is available.',
      submitting: 'Submitting...',
      selectedDateUnavailable: 'Date unavailable',
      submit: 'Request booking',
      submitNote: 'Our team will confirm availability and send full payment details. Your booking is complete after payment is received.',
      errors: {
        names: 'Please enter parent and child name.',
        basicSchoolYear: 'Please choose a school year from Kindy to Year 6.',
        advancedSchoolYear: 'Advanced classes are available from Year 2 to Year 6.',
        phone: (help: string) => `Please check the mobile number. ${help}`,
        email: 'Please enter a valid email address.',
        basicDate: 'Please choose Saturday 26 September, 3 October or 10 October.',
        advancedDate: 'Please choose 26 September, 3 October or 10 October for the Advanced session.',
        classTime: 'Please choose an available class time.',
        advancedTime: 'Please choose a different available Advanced session.',
        secondChild: 'Please enter Child 2 name and choose a school year from Kindy to Year 6.',
        safety: 'Emergency contact and pick-up person are required.',
        agreements: 'Parent, privacy, and booking agreements are required.',
        unavailable: 'This session time is already booked. Please choose another time or date.',
        submit: 'An error occurred while submitting your class request. Please try again.',
      },
    },
    complete: {
      title: 'Booking Request Sent!',
      requestSent: (course: string) => `Your ${course} request has been sent.`,
      availability: 'Our team will check availability and confirm the session shortly.',
      payment: 'Your booking is complete once full payment has been received.',
      bookingId: 'Booking ID',
      summary: { plan: 'Plan', firstSession: 'First session', advancedSession: 'Advanced session', subtotal: 'Subtotal', packageDiscount: 'Package discount', total: 'Total' },
      sessionSummary: (date: string, time: string, minutes: number, extended: boolean) => `${date} ${time} · ${minutes} min${extended ? ' · +30 min extension' : ''}`,
      backToClasses: 'Back to Classes',
    },
  },
  ko: {
    landing: {
      title: '시드니 키즈 케이크 데코레이션 클래스',
      location: '시드니 멜로즈 파크',
      intro: '멜로즈 파크에서 진행하는 9월 26일, 10월 3일과 10일 토요일 한정 케이크 클래스입니다. 수업은 10:00, 13:00, 16:00에 진행됩니다. 기본 클래스는 Kindy부터 Year 6까지, 고급 클래스는 Year 2부터 참여할 수 있습니다.',
      requestSpot: '자리 요청하기',
      courseSummary: '기본: Kindy–Year 6 · 고급: Year 2–6 · 토요일 한정 클래스',
      heroImageAlt: '키즈 케이크 클래스 대표 이미지',
      essentialsTitle: '클래스 안내',
      essentials: [
        { title: 'Kindy부터 참여 가능', text: 'Kindy–Year 2와 Year 3–6 학년 그룹으로 진행합니다.' },
        { title: '실습 중심 수업', text: '케이크 구상부터 마무리까지 직접 만들어 봅니다.' },
        { title: '기본과 고급 과정', text: '15cm 케이크 또는 컵케이크로 시작해 2단 케이크 과정까지 이어집니다.' },
        { title: '한정 토요일 클래스', text: '베리굿 팀과 함께하는 9월 26일, 10월 3일과 10일 수업입니다.' },
        { title: '세션당 최대 2명', text: '소규모 프라이빗 수업으로 진행합니다.' },
      ],
      courseTitle: '클래스를 선택하세요',
      courseCards: [
        { title: '기본 케이크 클래스', text: 'Kindy–Year 6 · 15cm 초콜릿 케이크 한 개를 계획하고 만들고 마무리해 가져갑니다.' },
        { title: '기본 컵케이크 & 초콜릿 클래스', text: 'Kindy–Year 6 · 컵케이크 네 개를 만들고 초콜릿 만들기 활동을 함께합니다.' },
        { title: '고급 2단 케이크 클래스', text: 'Year 2–6 · 2단 케이크를 만들고 마무리하는 1인 120분 수업입니다.' },
      ],
      stepsTitle: '수업 진행 방식',
      steps: [
        { title: '클래스 선택', text: '학년 그룹, 날짜, 스튜디오 수업 시간을 선택합니다.' },
        { title: '케이크 구상', text: '상상한 케이크를 스케치하고 모양, 컬러, 마감을 계획합니다.' },
        { title: '직접 만들기', text: '베리굿 팀의 안내와 함께 초콜릿 케이크를 만듭니다.' },
        { title: '포장해 가져가기', text: '완성한 케이크를 예쁘게 포장해 안전하게 가져갑니다.' },
      ],
      galleryLabel: '키즈 클래스 사진',
      processImageAlt: '키즈 케이크 만들기 과정',
      processTitle: '만드는 과정',
      processText: '계획하고, 시트를 쌓고, 크림을 바르고, 직접 마무리합니다.',
      finishedImageAlt: '완성된 키즈 클래스 초콜릿 케이크',
      finishedTitle: '완성된 케이크',
      finishedText: '완성한 초콜릿 케이크를 예쁘게 포장해 가져갑니다.',
      pricingSafetyLabel: '가격과 안전 안내',
      priceGuideTitle: '가격 안내',
      baseRangeLabel: '기본 수업/패키지 범위',
      basicYoungerLabel: '기본 · Kindy–Year 2',
      basicOlderLabel: '기본 · Year 3–6',
      advancedLabel: '고급',
      oneChild: '1명',
      packageSummary: '기본 + 고급 패키지는 두 번의 봄방학 수업으로 구성되며, 기본 수업료에서 5% 할인이 적용됩니다.',
      extensionSummary: '수업당 30분 연장은 참가자 1명당 AUD 20.00이며 할인 대상이 아닙니다.',
      confirmationNote: '* 베리굿 팀이 가능 여부와 전체 결제를 확인한 뒤 예약이 확정됩니다.',
      safetyTitle: '안전 및 알레르기 안내',
      safetyText: '이 수업은 짧은 프라이빗 케이크 데코레이션 수업이며 돌봄 서비스가 아닙니다. 어린이는 보호자가 가까이 머물거나 함께 참여해야 할 수 있습니다.',
      safetyPoints: [
        '알레르기와 식이 요구사항은 예약 확정 전에 모두 알려주세요.',
        '예약 요청을 보낼 때 부모 또는 보호자의 동의가 필요합니다.',
        '정확한 주소는 결제 확인 후 안내합니다. (Melrose Park, Sydney)',
      ],
      finalCtaLabel: '클래스 예약 요청',
      finalCtaText: '베리굿 팀이 각 수업을 안전하게 확인할 수 있도록 봄방학 토요일 자리는 수동으로 안내합니다.',
    },
    reserve: {
      honeypot: '이 필드는 비워 두세요',
      backToClasses: '클래스 안내로 돌아가기',
      title: '키즈 클래스 예약 요청',
      intro: '아래 정보를 작성해 주세요. 베리굿 팀이 가능 여부를 확인한 뒤 전체 결제 정보를 안내합니다.',
      planTitle: '1. 수업 플랜 선택',
      coursePlans: {
        basic: { label: '기본', detail: '케이크 또는 컵케이크 · 1–2명' },
        advanced: { label: '고급', detail: '1명 · 2단 케이크' },
        'basic-advanced-package': { label: '기본 + 고급 패키지', detail: '1명 · 봄방학 수업 두 번' },
      },
      basicClassTitle: '2. 기본 클래스 선택',
      classTypes: {
        'school-holiday-private-cake-class': { label: '기본 케이크 클래스', detail: '15cm 초콜릿 케이크 한 개' },
        'cupcake-chocolate-class': { label: '기본 컵케이크 & 초콜릿 클래스', detail: '컵케이크 네 개 + 초콜릿 만들기' },
        'advanced-2-tier-cake-class': { label: '고급 2단 케이크 클래스', detail: '1명 · 2단 케이크' },
      },
      schoolGroupTitle: '3. 학년 그룹 선택',
      basicSchoolGroup: '기본 · Kindy–Year 6',
      youngerGroup: 'Kindy–Year 2',
      youngerDetail: '저학년 그룹',
      olderGroup: 'Year 3–6',
      olderDetail: '초등 고학년 그룹',
      advancedSchoolGroup: '고급 · Year 2–6만 가능',
      childrenTitle: '4. 참여 어린이 수',
      oneChildOnly: '고급과 패키지 예약은 어린이 1명만 가능합니다.',
      oneChildLabel: '어린이 1명',
      oneChildDetail: '프라이빗 세션',
      twoChildrenLabel: '어린이 2명 / 형제자매 / 친구',
      twoChildrenDetail: '함께 배우기',
      sessionTitle: (plan: string, minutes: number) => `5. ${plan} 봄방학 세션 · ${minutes}분`,
      preferredDate: '희망 날짜',
      preferredTime: '희망 수업 시간',
      dateUnavailable: '이 날짜는 이미 모두 예약되었습니다. 다른 날짜를 선택해 주세요.',
      availabilityLoadError: '예약 가능 시간을 불러오지 못했습니다. 베리굿 팀이 확정 전 다시 확인합니다.',
      available: (times: string) => `가능 시간: ${times}`,
      addMinutes: '이 수업에 30분 추가',
      extensionWarning: '30분 연장을 선택하기 전에 어린이의 집중력과 체력을 고려해 주세요. 긴 수업이 부담스러울 수 있으니 신중하게 선택해 주세요.',
      advancedSessionTitle: (minutes: number) => `고급 봄방학 세션 · ${minutes}분`,
      advancedDate: '고급 수업 날짜 · 9월 26일, 10월 3일 또는 10일',
      advancedTime: '고급 수업 시간',
      addAdvancedMinutes: '고급 수업에 30분 추가',
      parentDetails: '보호자 정보',
      fullName: '성함',
      fullNamePlaceholder: '부모 또는 보호자 성함',
      emailAddress: '이메일 주소',
      mobileNumber: '휴대폰 번호',
      childDetails: '어린이 정보',
      childOneName: '어린이 1 이름',
      childOneAge: '어린이 1 나이',
      childOneSchoolYear: '어린이 1 학년',
      childTwoName: '어린이 2 이름',
      childTwoAge: '어린이 2 나이',
      childTwoSchoolYear: '어린이 2 학년',
      chooseYear: '학년 선택',
      safetyTitle: '알레르기 및 안전 확인',
      allergyNotes: '알레르기와 안전 관련 메모',
      allergyPlaceholder: '알고 있는 알레르기, 식이 메모 또는 없음을 적어주세요.',
      emergencyContact: '비상 연락처',
      emergencyPlaceholder: '이름과 휴대폰 번호',
      pickupPerson: '픽업 예정자',
      pickupPlaceholder: '누가 픽업하나요?',
      consentTitle: '동의 및 확인',
      parentConsent: '저는 부모 또는 보호자이며, 자녀의 수업 참여에 동의합니다.',
      bookingConsent: '가능 여부 확인과 전체 결제가 완료된 뒤에만 예약이 확정된다는 점을 이해합니다.',
      privacyConsent: '클래스 운영을 위해 예약·연락처·알레르기·비상 정보를 Appwrite에 저장하고, 운영자 이메일 알림을 위해 Resend로 전송하는 데 동의합니다.',
      photoConsent: '사진 촬영 동의',
      photoYes: '네, 사진 촬영에 동의합니다',
      photoNo: '아니요, 사진을 촬영하지 마세요',
      summaryLabel: '클래스 예약 요청 요약',
      summary: {
        plan: '플랜', course: '수업', schoolYear: '학년', children: '어린이 수', firstSession: '첫 수업', advancedSession: '고급 수업', subtotal: '소계', packageDiscount: '패키지 할인', total: '총액', payment: '결제', fullPayment: '전체 결제 필요',
      },
      sessionSummary: (date: string, time: string, minutes: number) => `${date} ${time} · ${minutes}분`,
      paymentNote: '베리굿 팀이 수업 가능 여부를 확인한 뒤 이 계좌로 안내해 드립니다.',
      submitting: '요청 보내는 중...',
      selectedDateUnavailable: '날짜 예약 마감',
      submit: '예약 요청 보내기',
      submitNote: '베리굿 팀이 가능 여부와 전체 결제 정보를 안내합니다. 결제가 완료된 뒤 예약이 확정됩니다.',
      errors: {
        names: '보호자와 어린이 이름을 입력해 주세요.',
        basicSchoolYear: 'Kindy부터 Year 6 사이의 학년을 선택해 주세요.',
        advancedSchoolYear: '고급 클래스는 Year 2부터 Year 6까지 참여할 수 있습니다.',
        phone: (help: string) => `휴대폰 번호를 확인해 주세요. ${help}`,
        email: '올바른 이메일 주소를 입력해 주세요.',
        basicDate: '9월 26일, 10월 3일 또는 10일 토요일을 선택해 주세요.',
        advancedDate: '고급 수업은 9월 26일, 10월 3일 또는 10일을 선택해 주세요.',
        classTime: '예약 가능한 수업 시간을 선택해 주세요.',
        advancedTime: '다른 예약 가능한 고급 수업 시간을 선택해 주세요.',
        secondChild: '어린이 2의 이름과 Kindy부터 Year 6 사이의 학년을 입력해 주세요.',
        safety: '비상 연락처와 픽업 예정자를 입력해 주세요.',
        agreements: '보호자, 개인정보, 예약 동의가 모두 필요합니다.',
        unavailable: '이 수업 시간은 이미 예약되었습니다. 다른 시간 또는 날짜를 선택해 주세요.',
        submit: '클래스 예약 요청 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    },
    complete: {
      title: '예약 요청을 보냈습니다',
      requestSent: (course: string) => `${course} 예약 요청을 보냈습니다.`,
      availability: '베리굿 팀이 가능 여부를 확인한 뒤 곧 수업을 안내합니다.',
      payment: '전체 결제가 완료된 뒤 예약이 확정됩니다.',
      bookingId: '예약 번호',
      summary: { plan: '플랜', firstSession: '첫 수업', advancedSession: '고급 수업', subtotal: '소계', packageDiscount: '패키지 할인', total: '총액' },
      sessionSummary: (date: string, time: string, minutes: number, extended: boolean) => `${date} ${time} · ${minutes}분${extended ? ' · 30분 연장' : ''}`,
      backToClasses: '클래스 안내로 돌아가기',
    },
  },
} as const

export function getClassPageCopy(language: Language) {
  return CLASS_PAGE_COPY[language]
}

export function cakeCopy(language: Language) {
  if (language === 'ko') {
    return {
      languageLabel: '언어',
      englishLabel: 'English',
      koreanLabel: '한국어',
      languageHelp: '언어 선택',
      announcement: '케이크 픽업 · 매일 08:00–20:00',
      brandName: 'Verygood Chocolate',
      homeTitle: '시드니 주문 제작 케이크',
      homeDescription: 'Very Good Chocolate이 쇼콜라티에용 커버춰 초콜릿으로 만드는 케이크를 Melrose Park 픽업 예약으로 만나보세요.',
      reserveCta: '픽업 주문하기',
      lookupNav: '주문 조회',
      adminNav: 'Admin',
      kidsNav: '키즈 클래스',
      productSectionTitle: '케이크 선택',
      reservationGuideTitle: '주문 방법',
      dailyLimitText: '쇼콜라티에용 커버춰 초콜릿으로 주문 제작합니다',
      price: '가격',
      options: '옵션',
      pickupLocationKicker: '픽업 장소',
      pickupLocationTitle: 'Google Maps에서 확인하기',
      pickupLocationText: '매장 방문 판매 없이 Melrose Park에서 사전 약속 픽업으로 진행됩니다. 정확한 전달 장소와 방법은 베리굿 팀이 주문 확정 후 안내드려요.',
      openMap: 'Google Maps 열기',
      guideSteps: [
        { title: '주문 신청', text: '원하는 케이크와 픽업 시간을 선택해 주세요.' },
        { title: '확인 메시지', text: '베리굿 팀이 가능 여부를 확인한 뒤 결제 안내를 보내드립니다.' },
        { title: '결제 후 확정', text: '입금 확인 후 주문이 확정됩니다. 온라인 결제는 아직 없어요.' },
        { title: '픽업', text: '확정된 시간에 Melrose Park에서 픽업합니다.' },
      ],
      pickupHours: ['케이크 픽업 · 매일 08:00–20:00'],
      paymentLabel: '결제 정보',
      paymentAmountLabel: '결제 금액',
      accountHolderLabel: '계좌명',
      copyButton: '복사',
      copiedButton: '복사됨',
      quantityUnit: '개',
      phoneHelp: '예: 0412345678 또는 +61 412 345 678',
      phonePlaceholder: '0412345678',
      requestPlaceholder: '픽업 관련 요청, 입금자명이 다른 경우, 기타 요청사항을 적어주세요.',
      privacyNotice: '주문 확인과 운영을 위해 이름·연락처·주문 내용을 수집하여 Appwrite에 저장하고, 운영자 알림을 위해 Resend 이메일 서비스로 전송하는 데 동의합니다.',
      reservationCompleteTitle: '주문 신청이 접수됐어요.',
      reservationCompleteText: '베리굿 팀이 가능 여부를 확인한 뒤 확정 메시지를 보내드립니다.',
      paymentConfirmText: '입금 확인 후 주문이 최종 확정됩니다.',
      noReservationText: '보여드릴 주문 정보가 없어요. 주문 조회를 이용해 주세요.',
      lookupTitle: '주문 조회',
      lookupPhoneLabel: '휴대폰 전체번호',
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
      pickupLeadTimeHelp: '케이크 픽업은 매일 08:00–20:00에 가능합니다. 전날 오후 8시 이후 주문 시 다음 날 낮 12시부터 선택할 수 있어요.',
      pickupAvailabilityChecking: '픽업 가능 시간을 확인하고 있어요.',
      pickupAvailabilityError: '픽업 가능 시간을 확인하지 못했어요. 새로고침하거나 다시 시도해 주세요.',
      pickupAvailabilityRetry: '다시 확인',
      pickupAvailabilityNone: '선택한 날짜에는 케이크 픽업 가능한 시간이 없어요.',
      customerName: '이름',
      phone: '휴대폰 번호',
      requestNote: '요청사항',
      promoCode: '프로모 또는 후기 리워드 코드 (선택)',
      promoPlaceholder: '프로모 또는 후기 리워드 코드 입력',
      promoApplied: '코드 적용',
      promoHint: '프로모 코드는 상품 및 기간 조건이 적용되며, 리워드 코드는 서버 확인 후 최종 할인됩니다.',
      namePlaceholder: '김민지',
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
        pickupDate: '다음 날 이후의 픽업 날짜를 선택해 주세요.',
        pickupTime: '픽업 시간을 선택해 주세요.',
        pickupTimeUnavailable: '선택한 시간이 방금 마감됐어요. 다른 픽업 시간을 선택해 주세요.',
        pickupLeadTime: '오후 8시 이후 주문은 다음 날 낮 12시 이후 시간을 선택해 주세요.',
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
    announcement: 'Cake pick-up · Every day 08:00–20:00',
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
    pickupLocationText: 'This is a pre-arranged Melrose Park meeting point, not a walk-in shop. Our team confirms the exact handoff details with your booking confirmation.',
    openMap: 'Open in Google Maps',
    guideSteps: marketConfig.guideSteps,
    pickupHours: ['Cake pick-up · Every day 08:00–20:00'],
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
    pickupLeadTimeHelp: 'Cake pick-up is available every day from 08:00–20:00. Orders placed after 8pm can be picked up from 12pm the next day.',
    pickupAvailabilityChecking: 'Checking available pick-up times.',
    pickupAvailabilityError: "We couldn't check available pick-up times. Refresh the page or try again.",
    pickupAvailabilityRetry: 'Check again',
    pickupAvailabilityNone: 'No cake pick-up times are available on the selected date.',
    customerName: 'Name',
    phone: 'Mobile',
    requestNote: 'Request notes',
    promoCode: 'Promo or review reward code (optional)',
    promoPlaceholder: 'Enter promo or review reward code',
    promoApplied: 'Code applied',
    promoHint: 'Campaign terms apply. Reward discounts are final only after server validation.',
    namePlaceholder: 'Alex Smith',
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
      pickupDate: 'Please select a pick-up date from tomorrow onward.',
      pickupTime: 'Please select a pick-up time.',
      pickupTimeUnavailable: 'That pick-up time just became unavailable. Please choose another time.',
      pickupLeadTime: 'For orders from 8pm, please choose a time from 12pm tomorrow.',
      quantity: (max: number) => `You can request up to ${max} cakes.`,
      privacy: 'Please agree to the privacy policy.',
      submit: 'An error occurred while submitting your cake request. Please try again.',
    },
  }
}
