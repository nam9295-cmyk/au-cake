import type { CacaoPercent, CakeSize, ChocolateType, PaymentStatus, PoundAddon, ProductId, ReservationStatus, StoreSettings } from './types.js'

export type Market = 'KR' | 'AU'

type ProductConfig = {
  id: ProductId
  name: string
  description: string
  price: number
  priceNote: string
  usesCacaoOptions: boolean
  usesSizeOptions: boolean
  usesChocolateTypeOptions: boolean
  usesPoundAddonOptions: boolean
  sizePrices: Partial<Record<CakeSize, number>>
}

type CakeSizeConfig = {
  value: CakeSize
  label: string
  description: string
  price: number
}

type CacaoConfig = {
  value: CacaoPercent
  label: string
  title: string
  description: string
  extraPrice: number
}

type ChocolateTypeConfig = {
  value: ChocolateType
  label: string
  description: string
  extraPrice: number
}

type PoundAddonConfig = {
  value: PoundAddon
  label: string
  description: string
  extraPrice: number
}

type MarketCopy = {
  brandName: string
  productName: string
  homeTitle: string
  homeDescription: string
  reserveCta: string
  lookupNav: string
  adminNav: string
  productSectionTitle: string
  reservationGuideTitle: string
  paymentLabel: string
  paymentAmountLabel: string
  accountHolderLabel: string
  copyButton: string
  copiedButton: string
  quantityUnit: string
  phoneHelp: string
  phonePlaceholder: string
  requestPlaceholder: string
  privacyNotice: string
  reservationCompleteTitle: string
  reservationCompleteText: string
  paymentConfirmText: string
  noReservationText: string
  lookupTitle: string
  lookupPhoneLabel: string
  notFoundText: string
  smsFooter: string
}

type MarketConfig = {
  market: Market
  locale: string
  currency: string
  timezone: string
  currencyOptions: Intl.NumberFormatOptions
  phoneRegex: RegExp
  reservationCodePrefix: string
  products: Record<ProductId, ProductConfig>
  cakeSizeOptions: CakeSizeConfig[]
  cacaoOptions: CacaoConfig[]
  chocolateTypeOptions: ChocolateTypeConfig[]
  poundAddonOptions: PoundAddonConfig[]
  defaultSettings: StoreSettings
  copy: MarketCopy
  productCardFeatures: Record<ProductId, string[]>
  guideSteps: Array<{ title: string; text: string }>
  csvHeaders: string[]
  smsLabels: {
    title: string
    greeting: string
    body: string
    reservationNumber: string
    productName: string
    size: string
    cacao: string
    pickupDate: string
    pickupTime: string
    quantity: string
    customerName: string
    address: string
    contact: string
    thanks: string
  }
}

const KR_SETTINGS: StoreSettings = {
  price: 38000,
  bankName: '신한은행',
  bankAccount: '110-583-680821',
  accountHolder: '베리굿초콜릿컴퍼니(VCC))',
  weekdayOpen: '07:00',
  weekdayClose: '21:00',
  weekendOpen: '09:00',
  weekendClose: '22:00',
  dailyLimitText: '하루 5개 한정 제작',
  reservationNotice: '예약 신청 후 매장 확인 문자를 보내드립니다. 입금 확인 후 예약이 최종 확정됩니다.',
  pickupNotice: '운영시간 외 픽업을 원하시면 요청사항에 남겨주세요. 확인 후 연락드리겠습니다.',
  storeAddress: '대구 수성구 상록로11길 13 1층 베리굿초콜릿',
  storePhone: '070-7840-0717',
}

const AU_SETTINGS: StoreSettings = {
  price: 45,
  bankName: 'BSB 012263',
  bankAccount: 'Account 324999682',
  accountHolder: 'JEONGMIN CHEON',
  weekdayOpen: '10:00',
  weekdayClose: '20:00',
  weekendOpen: '10:00',
  weekendClose: '20:00',
  dailyLimitText: 'Small-batch cakes, limited daily availability',
  reservationNotice: 'We will confirm availability after your request. Payment details and final confirmation will follow by message.',
  pickupNotice: '',
  storeAddress: 'Street pick-up near 1 Bundil Blvd, Melrose Park. Small playground/seating nearby; Jenny will bring the cake down to you.',
  storePhone: '+61 mobile number TBC',
}

export const MARKET_CONFIG: Record<Market, MarketConfig> = {
  KR: {
    market: 'KR',
    locale: 'ko-KR',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    currencyOptions: { maximumFractionDigits: 0 },
    phoneRegex: /^0\d{1,2}-?\d{3,4}-?\d{4}$/,
    reservationCodePrefix: 'VG-C-KR',
    products: {
      'pave-cake': {
        id: 'pave-cake',
        name: '생초콜릿 파베 케이크',
        description: '초코 시트 사이에 파베초콜릿 가나슈를 4단으로 샌드한 원형 케이크입니다. 크림층 없이 초콜릿의 밀도와 부드러운 가나슈 질감이 또렷하게 느껴집니다.',
        price: 38000,
        priceNote: '농도, 사이즈 선택 가능',
        usesCacaoOptions: false,
        usesSizeOptions: true,
        usesChocolateTypeOptions: true,
        usesPoundAddonOptions: false,
        sizePrices: { '15cm': 65000, '17cm': 78000, '19cm': 92000, '22cm': 115000 },
      },
      'pound-cake': {
        id: 'pound-cake',
        name: '초코 파운드 케이크',
        description: '식빵틀에 구워 묵직하게 완성한 갸또 쇼콜라 위에 다크초콜릿을 듬뿍 부었습니다. 촉촉한 초코 반죽과 진한 초콜릿 코팅이 바로 느껴지는 오리지널 초코케이크입니다.',
        price: 29500,
        priceNote: '마감 옵션 선택 가능',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: true,
        sizePrices: {},
      },
      'cupcake-dozen': {
        id: 'cupcake-dozen',
        name: '초코 컵케이크 1다스',
        description: '초콜릿 베이스 컵케이크를 12개 한 세트로 준비하는 파티용 컵케이크입니다.',
        price: 55000,
        priceNote: '1다스 기준, 마감 옵션 선택 가능',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: true,
        sizePrices: {},
      },
      'choco-basque-cheesecake': {
        id: 'choco-basque-cheesecake',
        name: '초코 바스크 치즈케이크',
        description: '진한 초콜릿과 크림치즈를 높은 온도에서 구워낸 15cm 바스크 치즈케이크입니다.',
        price: 36000,
        priceNote: '6 inch / 15cm 고정 사이즈',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'pave-choco-basque-cheesecake': {
        id: 'pave-choco-basque-cheesecake',
        name: '파베초코 바스크 치즈케이크',
        description: '초코 바스크 치즈케이크 위에 파베 초콜릿을 더한 15cm 치즈케이크입니다.',
        price: 38000,
        priceNote: '6 inch / 15cm 고정 사이즈',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'eiffel-tower-basque-cheesecake': {
        id: 'eiffel-tower-basque-cheesecake',
        name: '에펠탑 초콜릿 바스크 치즈케이크',
        description: '파베 초콜릿으로 케이크 전체를 덮고 에펠탑 초콜릿 하나를 올린 15cm 치즈케이크입니다.',
        price: 40000,
        priceNote: '6 inch / 15cm 고정 사이즈',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'fresh-lemon-cupcakes-4': {
        id: 'fresh-lemon-cupcakes-4', name: '프레시 레몬 컵케이크 · 4개',
        description: '레몬 모양 케이크에 레몬 크림을 채우고 꽃무늬 장식으로 마무리한 시드니 전용 상품입니다.',
        price: 24000, priceNote: '4개 구성 · 레몬 크림과 꽃 장식 포함',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-6': {
        id: 'fresh-lemon-cupcakes-6', name: '프레시 레몬 컵케이크 · 6개',
        description: '레몬 모양 케이크에 레몬 크림을 채우고 꽃무늬 장식으로 마무리한 시드니 전용 상품입니다.',
        price: 36000, priceNote: '6개 구성 · Most Popular',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-8': {
        id: 'fresh-lemon-cupcakes-8', name: '프레시 레몬 컵케이크 · 8개',
        description: '레몬 모양 케이크에 레몬 크림을 채우고 꽃무늬 장식으로 마무리한 시드니 전용 상품입니다.',
        price: 45000, priceNote: '8개 구성 · 레몬 크림과 꽃 장식 포함',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-12': {
        id: 'fresh-lemon-cupcakes-12', name: '프레시 레몬 컵케이크 · 12개',
        description: '레몬 모양 케이크에 레몬 크림을 채우고 꽃무늬 장식으로 마무리한 시드니 전용 상품입니다.',
        price: 65000, priceNote: '12개 구성 · Most Popular',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-16': {
        id: 'fresh-lemon-cupcakes-16', name: '프레시 레몬 컵케이크 · 16개',
        description: '레몬 모양 케이크에 레몬 크림을 채우고 꽃무늬 장식으로 마무리한 시드니 전용 상품입니다.',
        price: 85000, priceNote: '16개 구성 · 레몬 크림과 꽃 장식 포함',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
    },
    cakeSizeOptions: [
      { value: '15cm', label: '6 inch / 15cm', description: '작게 즐기기 좋은 기본 사이즈', price: 45000 },
      { value: '17cm', label: '6.7 inch / 17cm', description: '조금 더 여유 있는 사이즈', price: 55000 },
      { value: '19cm', label: '7.5 inch / 19cm', description: '나눠 먹기 좋은 사이즈', price: 65000 },
      { value: '22cm', label: '8.7 inch / 22cm', description: '여러 명이 나누기 좋은 큰 사이즈', price: 80000 },
    ],
    cacaoOptions: [
      { value: '기본', label: '기본 옵션', title: '부드러운 기본 밸런스', description: '아이와 함께 드시거나 처음 주문하시는 분께 추천합니다.', extraPrice: 0 },
      { value: '70', label: '70%', title: '덜 달고 진한 풍미', description: '커피와 함께 먹기 좋은 어른의 초콜릿 맛입니다.', extraPrice: 5000 },
      { value: '80.5', label: '80.5%', title: '깊고 쌉싸름한 여운', description: '조금 더 깊은 카카오의 맛을 느끼고 싶은 분께 추천합니다.', extraPrice: 8000 },
      { value: '100', label: '100% Cacao', title: '완전한 카카오 본연의 맛', description: '단맛 없이 카카오 본연의 쌉싸름한 향을 즐기는 분께 추천합니다.', extraPrice: 10000 },
    ],
    chocolateTypeOptions: [
      { value: 'dark', label: 'Dark chocolate', description: 'Deep and balanced chocolate profile', extraPrice: 0 },
      { value: 'milk', label: 'Milk chocolate', description: 'Softer and creamier chocolate profile', extraPrice: 0 },
    ],
    poundAddonOptions: [
      { value: 'none', label: '기본 마감', description: '기본 마감 옵션', extraPrice: 0 },
      { value: 'extra-chocolate', label: 'Extra chocolate', description: 'Add extra chocolate finish', extraPrice: 5000 },
      { value: 'vanilla-cream', label: 'Vanilla cream', description: 'Add vanilla cream finish', extraPrice: 5000 },
    ],
    defaultSettings: KR_SETTINGS,
    copy: {
      brandName: 'Verygood Chocolate',
      productName: 'Gâteau au Chocolat',
      homeTitle: '베리굿 초코케이크 예약',
      homeDescription: '생초콜릿 파베 케이크와 초코 파운드 케이크. 진짜 초콜릿의 밀도를 담은 베리굿의 갸또 쇼콜라.',
      reserveCta: '예약 신청하기',
      lookupNav: '예약 조회',
      adminNav: '관리자',
      productSectionTitle: '케이크 선택',
      reservationGuideTitle: '예약 안내',
      paymentLabel: '입금 계좌',
      paymentAmountLabel: '입금금액',
      accountHolderLabel: '예금주',
      copyButton: '복사하기',
      copiedButton: '복사됨',
      quantityUnit: '개',
      phoneHelp: '예: 01012345678',
      phonePlaceholder: '01012345678',
      requestPlaceholder: '운영시간 외 픽업 요청, 입금자명이 다를 경우, 기타 요청사항을 남겨주세요.',
      privacyNotice: '개인정보 수집 및 이용에 동의합니다. 예약 확인 및 운영자 알림을 위해 입력 정보가 이메일 알림 서비스로 전송될 수 있습니다.',
      reservationCompleteTitle: '예약 신청이 완료되었습니다.',
      reservationCompleteText: '매장에서 예약 가능 여부를 확인한 뒤 확정 안내 문자를 보내드립니다.',
      paymentConfirmText: '입금 확인 후 예약이 최종 확정됩니다.',
      noReservationText: '현재 화면에 표시할 예약 정보가 없습니다. 예약 조회를 이용해 주세요.',
      lookupTitle: '예약 조회',
      lookupPhoneLabel: '휴대폰 전체번호',
      notFoundText: '예약 정보를 찾을 수 없습니다.',
      smsFooter: '베리굿초콜릿',
    },
    productCardFeatures: {
      'pave-cake': ['4단 초코 시트와 파베 가나슈', '미니케이크, 1호사이즈', '농도, 사이즈 선택 가능'],
      'pound-cake': ['식빵틀에 구운 직사각형 케이크', '상단에 다크초콜릿 코팅', '케이크 포장 포함 29,500원'],
      'cupcake-dozen': ['12개 1다스 구성', '파티와 선물용 컵케이크', '마감 옵션 선택 가능'],
      'choco-basque-cheesecake': ['6 inch / 15cm 고정 사이즈', '진한 초코 바스크 치즈케이크', '부드럽고 꾸덕한 중심'],
      'pave-choco-basque-cheesecake': ['6 inch / 15cm 고정 사이즈', '초코 바스크 위 파베 초콜릿', '더 진한 초콜릿 마감'],
      'eiffel-tower-basque-cheesecake': ['6 inch / 15cm 고정 사이즈', '전체 파베 초콜릿 마감', '에펠탑 초콜릿 1개 장식'],
      'fresh-lemon-cupcakes-4': ['4개 구성', '레몬 크림', '꽃무늬 장식 포함'],
      'fresh-lemon-cupcakes-6': ['6개 구성', '레몬 크림', '꽃무늬 장식 포함'],
      'fresh-lemon-cupcakes-8': ['8개 구성', '레몬 크림', '꽃무늬 장식 포함'],
      'fresh-lemon-cupcakes-12': ['12개 구성', 'Most Popular', '레몬 크림과 꽃 장식 포함'],
      'fresh-lemon-cupcakes-16': ['16개 구성', '레몬 크림', '꽃무늬 장식 포함'],
    },
    guideSteps: [
      { title: '예약 신청', text: '원하는 케이크와 픽업 시간을 선택해 신청합니다.' },
      { title: '확인 문자', text: '매장에서 가능 여부를 확인한 뒤 안내 문자를 보내드립니다.' },
      { title: '입금 확정', text: '입금 확인 후 예약이 최종 확정됩니다. 온라인 결제는 제공하지 않습니다.' },
      { title: '픽업', text: '운영시간에 맞춰 매장에서 픽업합니다.' },
    ],
    csvHeaders: ['신청일시', '예약번호', '예약자명', '연락처', '제품명', '사이즈', '카카오 농도', '초콜릿', '마감', '아이싱 구성', '수량', '픽업일', '픽업시간', '요청사항', '예약상태', '입금상태', '총 가격', '관리자 메모'],
    smsLabels: {
      title: '[베리굿초콜릿 케이크 예약 안내]',
      greeting: '안녕하세요. 베리굿초콜릿입니다.',
      body: '예약 신청해주신 가또 쇼콜라 예약 내용 안내드립니다.',
      reservationNumber: '예약번호',
      productName: '제품명',
      size: '사이즈',
      cacao: '카카오 농도',
      pickupDate: '픽업일',
      pickupTime: '픽업시간',
      quantity: '수량',
      customerName: '예약자명',
      address: '주소',
      contact: '문의',
      thanks: '감사합니다.',
    },
  },
  AU: {
    market: 'AU',
    locale: 'en-AU',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    currencyOptions: { currencyDisplay: 'code' },
    phoneRegex: /^(?:04\d{8}|(?:\+?61|61)\s?4\d{8})$/,
    reservationCodePrefix: 'VG-C-AU',
    products: {
      'pave-cake': {
        id: 'pave-cake',
        name: 'Pave Chocolate Cake',
        description: 'A round chocolate cake layered with soft pave ganache and chocolate sponge. Dense, smooth and made for serious chocolate flavour.',
        price: 75,
        priceNote: 'Size and dark/milk chocolate options available',
        usesCacaoOptions: false,
        usesSizeOptions: true,
        usesChocolateTypeOptions: true,
        usesPoundAddonOptions: false,
        sizePrices: { '15cm': 75, '19cm': 95, '22cm': 115 },
      },
      'pound-cake': {
        id: 'pound-cake',
        name: 'Chocolate Pound Cake',
        description: 'A rich rectangular gateau chocolat finished with dark chocolate. Simple, compact and easy to share or gift.',
        price: 45,
        priceNote: 'Choose one finish option',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: true,
        sizePrices: {},
      },
      'cupcake-dozen': {
        id: 'cupcake-dozen',
        name: 'Chocolate Cupcakes (1 dozen)',
        description: 'A dozen small-batch chocolate cupcakes for sharing, parties and easy gifting.',
        price: 55,
        priceNote: 'Vanilla cream +AUD 0.50 each · Party decoration +AUD 1.00 each',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'choco-basque-cheesecake': {
        id: 'choco-basque-cheesecake',
        name: "Chocolatier's Basque Cheesecake",
        description: 'A 6 inch chocolate Basque cheesecake with a deeply baked top and a smooth, rich centre.',
        price: 55,
        priceNote: '6 inch / 15cm fixed size',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'pave-choco-basque-cheesecake': {
        id: 'pave-choco-basque-cheesecake',
        name: 'Pave chocolate on top',
        description: "Our 6 inch Chocolatier's Basque cheesecake finished with pave chocolate on top.",
        price: 65,
        priceNote: '6 inch / 15cm fixed size',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'eiffel-tower-basque-cheesecake': {
        id: 'eiffel-tower-basque-cheesecake',
        name: 'Cake finishing with Eiffel Tower',
        description: 'Our 6 inch Chocolatier’s Basque cheesecake covered with pave chocolate and finished with one Eiffel Tower chocolate.',
        price: 75,
        priceNote: '6 inch / 15cm fixed size',
        usesCacaoOptions: false,
        usesSizeOptions: false,
        usesChocolateTypeOptions: false,
        usesPoundAddonOptions: false,
        sizePrices: {},
      },
      'fresh-lemon-cupcakes-4': {
        id: 'fresh-lemon-cupcakes-4', name: 'Lemon Cake · 4 pieces',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        price: 24, priceNote: '4-piece box · lemon cream and floral finish included',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-6': {
        id: 'fresh-lemon-cupcakes-6', name: 'Lemon Cake · 6 pieces',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        price: 36, priceNote: '6-piece box · fresh lemon cream and floral finish included',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-8': {
        id: 'fresh-lemon-cupcakes-8', name: 'Lemon Cake · 8 pieces',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        price: 45, priceNote: '8-piece box · lemon cream and floral finish included',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-12': {
        id: 'fresh-lemon-cupcakes-12', name: 'Lemon Cake · 12 pieces',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        price: 65, priceNote: '12-piece box · Most Popular',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
      'fresh-lemon-cupcakes-16': {
        id: 'fresh-lemon-cupcakes-16', name: 'Lemon Cake · 16 pieces',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        price: 85, priceNote: '16-piece box · fresh lemon cream and floral finish included',
        usesCacaoOptions: false, usesSizeOptions: false, usesChocolateTypeOptions: false, usesPoundAddonOptions: false, sizePrices: {},
      },
    },
    cakeSizeOptions: [
      { value: '15cm', label: '6 inch / 15cm', description: 'A compact cake for a small gathering or gift', price: 75 },
      { value: '19cm', label: '7.5 inch / 19cm', description: 'A larger celebration size', price: 95 },
      { value: '22cm', label: '8.7 inch / 22cm', description: 'A generous party size', price: 115 },
    ],
    cacaoOptions: [
      { value: '기본', label: 'Classic', title: 'Smooth classic balance', description: 'Recommended for first orders or a gentler chocolate profile.', extraPrice: 0 },
      { value: '70', label: '70%', title: 'Less sweet, deeper cacao', description: 'A darker profile that pairs well with coffee.', extraPrice: 6 },
      { value: '80.5', label: '80.5%', title: 'Deep cacao finish', description: 'For a bolder and more lingering chocolate flavour.', extraPrice: 9 },
      { value: '100', label: '100% Cacao', title: 'Pure cacao intensity', description: 'A bitter, unsweetened cacao-forward option.', extraPrice: 12 },
    ],
    chocolateTypeOptions: [
      { value: 'dark', label: 'Dark chocolate', description: 'Deep and balanced chocolate profile', extraPrice: 0 },
      { value: 'milk', label: 'Milk chocolate', description: 'Softer and creamier chocolate profile', extraPrice: 0 },
    ],
    poundAddonOptions: [
      { value: 'none', label: 'Basic finish', description: 'Classic finish', extraPrice: 0 },
      { value: 'extra-chocolate', label: 'Extra chocolate', description: 'Add extra chocolate finish', extraPrice: 7 },
      { value: 'vanilla-cream', label: 'Vanilla cream', description: 'Add vanilla cream finish', extraPrice: 5 },
    ],
    defaultSettings: AU_SETTINGS,
    copy: {
      brandName: 'Verygood Chocolate',
      productName: 'Gâteau au Chocolat',
      homeTitle: 'Sydney Made-to-Order Cakes',
      homeDescription: 'Small-batch cakes made by Very Good Chocolate, available by pre-order for confirmed Melrose Park pick-up.',
      reserveCta: 'Order for next-day pick-up',
      lookupNav: 'Find booking',
      adminNav: 'Admin',
      productSectionTitle: 'Choose a cake',
      reservationGuideTitle: 'How to order',
      paymentLabel: 'Payment details',
      paymentAmountLabel: 'Amount due',
      accountHolderLabel: 'Account name',
      copyButton: 'Copy',
      copiedButton: 'Copied',
      quantityUnit: 'ea',
      phoneHelp: 'Example: 0412345678, 0412 345 678, or +61 412 345 678',
      phonePlaceholder: '0412345678',
      requestPlaceholder: 'Leave pick-up notes, a different payer name, or any other request.',
      privacyNotice: 'I agree that my name, contact details and order information may be stored in Appwrite for booking operations and sent through Resend for operator email notifications.',
      reservationCompleteTitle: 'Your cake request has been sent.',
      reservationCompleteText: 'We will check availability and send you a confirmation.',
      paymentConfirmText: 'Your order is confirmed after payment is received.',
      noReservationText: 'There is no booking to show here. Please use booking lookup.',
      lookupTitle: 'Find booking',
      lookupPhoneLabel: 'Full mobile number',
      notFoundText: 'We could not find that booking.',
      smsFooter: 'Verygood Chocolate',
    },
    productCardFeatures: {
      'pave-cake': ['Layered chocolate sponge and pave ganache', '6 inch, 7.5 inch, or 8.7 inch sizes', 'Dark or milk chocolate'],
      'pound-cake': ['Rectangular gateau chocolat', 'Fixed pound cake size', 'Basic, extra chocolate, or vanilla cream finish'],
      'cupcake-dozen': ['12 cupcakes in one dozen', 'Vanilla cream +AUD 0.50 each', 'Party decoration +AUD 1.00 each'],
      'choco-basque-cheesecake': ['6 inch / 15cm fixed size', "Chocolatier's Basque cheesecake", 'Smooth, rich centre'],
      'pave-choco-basque-cheesecake': ['6 inch / 15cm fixed size', 'Pave chocolate on top', 'AUD 10 finish upgrade'],
      'eiffel-tower-basque-cheesecake': ['6 inch / 15cm fixed size', 'Fully covered with pave chocolate', 'One Eiffel Tower chocolate on top'],
      'fresh-lemon-cupcakes-4': ['4 pieces', 'Fresh lemon cream', 'Floral decoration included'],
      'fresh-lemon-cupcakes-6': ['6 pieces', 'Fresh lemon cream', 'Floral decoration included'],
      'fresh-lemon-cupcakes-8': ['8 pieces', 'Fresh lemon cream', 'Floral decoration included'],
      'fresh-lemon-cupcakes-12': ['12 pieces', 'Most Popular', 'Fresh lemon cream and floral finish'],
      'fresh-lemon-cupcakes-16': ['16 pieces', 'Fresh lemon cream', 'Floral decoration included'],
    },
    guideSteps: [
      { title: 'Request', text: 'Choose your cake and preferred pick-up time.' },
      { title: 'Confirmation', text: 'We check availability and send payment details by message.' },
      { title: 'Payment', text: 'Your order is confirmed after payment. Online checkout is not available yet.' },
      { title: 'Pick-up', text: 'Collect your cake during the confirmed pick-up window.' },
    ],
    csvHeaders: ['Created at', 'Booking number', 'Customer name', 'Mobile', 'Product', 'Size', 'Cacao', 'Chocolate', 'Finish', 'Finishing mix', 'Quantity', 'Pick-up date', 'Pick-up time', 'Request note', 'Booking status', 'Payment status', 'Total price', 'Admin memo'],
    smsLabels: {
      title: '[Verygood Chocolate SYD]',
      greeting: 'Hello, this is Verygood Chocolate.',
      body: 'Here are the details of your cake request.',
      reservationNumber: 'Booking number',
      productName: 'Product',
      size: 'Size',
      cacao: 'Cacao option',
      pickupDate: 'Pick-up date',
      pickupTime: 'Pick-up time',
      quantity: 'Quantity',
      customerName: 'Customer name',
      address: 'Pick-up address',
      contact: 'Contact',
      thanks: 'Thank you:)',
    },
  },
}

const nodeEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env
const envMarket = String(
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_MARKET ||
    nodeEnv?.VITE_MARKET ||
    '',
).toUpperCase()

export const MARKET: Market = envMarket === 'AU' ? 'AU' : 'KR'

export const marketConfig = MARKET_CONFIG[MARKET]

export const RESERVATION_STATUSES: ReservationStatus[] = ['예약신청', '예약확정', '픽업완료', '취소']

export const PAYMENT_STATUSES: PaymentStatus[] = ['입금대기', '입금확인', '현장결제', '환불필요']
