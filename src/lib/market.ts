import type { CacaoPercent, CakeSize, PaymentStatus, ProductId, ReservationStatus, StoreSettings } from './types'

export type Market = 'KR' | 'AU'

type ProductConfig = {
  id: ProductId
  name: string
  description: string
  price: number
  priceNote: string
  usesCacaoOptions: boolean
  usesSizeOptions: boolean
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
  price: 58,
  bankName: 'Payment details TBC',
  bankAccount: 'Confirm with Jenny',
  accountHolder: 'Verygood Chocolate',
  weekdayOpen: '10:00',
  weekdayClose: '17:00',
  weekendOpen: '10:00',
  weekendClose: '16:00',
  dailyLimitText: 'Small-batch cakes, limited daily availability',
  reservationNotice: 'We will confirm availability after your request. Payment details and final confirmation follow by message.',
  pickupNotice: 'For pickup outside listed hours, leave a note and we will confirm what is possible.',
  storeAddress: 'Sydney pickup address TBC',
  storePhone: '+61 phone number TBC',
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
        usesCacaoOptions: true,
        usesSizeOptions: true,
      },
      'pound-cake': {
        id: 'pound-cake',
        name: '초코 파운드 케이크',
        description: '식빵틀에 구워 묵직하게 완성한 갸또 쇼콜라 위에 다크초콜릿을 듬뿍 부었습니다. 촉촉한 초코 반죽과 진한 초콜릿 코팅이 바로 느껴지는 오리지널 초코케이크입니다.',
        price: 29500,
        priceNote: '케이크 포장 포함',
        usesCacaoOptions: false,
        usesSizeOptions: false,
      },
    },
    cakeSizeOptions: [
      { value: 'mini', label: '미니케이크', description: '작게 즐기기 좋은 기본 사이즈', price: 38000 },
      { value: 'size-1', label: '1호사이즈', description: '나눠 먹기 좋은 1호 사이즈', price: 46000 },
    ],
    cacaoOptions: [
      { value: '기본', label: '기본 옵션', title: '부드러운 기본 밸런스', description: '아이와 함께 드시거나 처음 주문하시는 분께 추천합니다.', extraPrice: 0 },
      { value: '70', label: '70%', title: '덜 달고 진한 풍미', description: '커피와 함께 먹기 좋은 어른의 초콜릿 맛입니다.', extraPrice: 5000 },
      { value: '80.5', label: '80.5%', title: '깊고 쌉싸름한 여운', description: '조금 더 깊은 카카오의 맛을 느끼고 싶은 분께 추천합니다.', extraPrice: 8000 },
      { value: '100', label: '100% Cacao', title: '완전한 카카오 본연의 맛', description: '단맛 없이 카카오 본연의 쌉싸름한 향을 즐기는 분께 추천합니다.', extraPrice: 10000 },
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
      lookupPhoneLabel: '연락처 또는 뒤 4자리',
      notFoundText: '예약 정보를 찾을 수 없습니다.',
      smsFooter: '베리굿초콜릿',
    },
    productCardFeatures: {
      'pave-cake': ['4단 초코 시트와 파베 가나슈', '미니케이크, 1호사이즈', '농도, 사이즈 선택 가능'],
      'pound-cake': ['식빵틀에 구운 직사각형 케이크', '상단에 다크초콜릿 코팅', '케이크 포장 포함 29,500원'],
    },
    guideSteps: [
      { title: '예약 신청', text: '원하는 케이크와 픽업 시간을 선택해 신청합니다.' },
      { title: '확인 문자', text: '매장에서 가능 여부를 확인한 뒤 안내 문자를 보내드립니다.' },
      { title: '입금 확정', text: '입금 확인 후 예약이 최종 확정됩니다. 온라인 결제는 제공하지 않습니다.' },
      { title: '픽업', text: '운영시간에 맞춰 매장에서 픽업합니다.' },
    ],
    csvHeaders: ['신청일시', '예약번호', '예약자명', '연락처', '제품명', '사이즈', '카카오 농도', '수량', '픽업일', '픽업시간', '요청사항', '예약상태', '입금상태', '총 가격', '관리자 메모'],
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
    currencyOptions: {},
    phoneRegex: /^(?:\+?61|0)[2-478](?:[ -]?\d){8}$/,
    reservationCodePrefix: 'VG-C-AU',
    products: {
      'pave-cake': {
        id: 'pave-cake',
        name: 'Pave Chocolate Cake',
        description: 'A round chocolate cake layered with soft pave ganache and chocolate sponge. Dense, smooth and made for serious chocolate flavour.',
        price: 58,
        priceNote: 'Size and cacao options available',
        usesCacaoOptions: true,
        usesSizeOptions: true,
      },
      'pound-cake': {
        id: 'pound-cake',
        name: 'Chocolate Pound Cake',
        description: 'A rich rectangular gateau chocolat finished with dark chocolate. Simple, compact and easy to share or gift.',
        price: 45,
        priceNote: 'Gift packaging included',
        usesCacaoOptions: false,
        usesSizeOptions: false,
      },
    },
    cakeSizeOptions: [
      { value: 'mini', label: 'Mini cake', description: 'A smaller cake for a simple treat or small gift', price: 58 },
      { value: 'size-1', label: 'No. 1 size', description: 'A larger cake for sharing', price: 72 },
    ],
    cacaoOptions: [
      { value: '기본', label: 'Classic', title: 'Smooth classic balance', description: 'Recommended for first orders or a gentler chocolate profile.', extraPrice: 0 },
      { value: '70', label: '70%', title: 'Less sweet, deeper cacao', description: 'A darker profile that pairs well with coffee.', extraPrice: 6 },
      { value: '80.5', label: '80.5%', title: 'Deep cacao finish', description: 'For a bolder and more lingering chocolate flavour.', extraPrice: 9 },
      { value: '100', label: '100% Cacao', title: 'Pure cacao intensity', description: 'A bitter, unsweetened cacao-forward option.', extraPrice: 12 },
    ],
    defaultSettings: AU_SETTINGS,
    copy: {
      brandName: 'Verygood Chocolate',
      productName: 'Gâteau au Chocolat',
      homeTitle: 'Sydney Chocolate Cake Reservations',
      homeDescription: 'Small-batch chocolate cakes with Verygood Chocolate depth, available by reservation for Sydney pickup.',
      reserveCta: 'Reserve a cake',
      lookupNav: 'Find reservation',
      adminNav: 'Admin',
      productSectionTitle: 'Choose a cake',
      reservationGuideTitle: 'Reservation guide',
      paymentLabel: 'Payment details',
      paymentAmountLabel: 'Amount due',
      accountHolderLabel: 'Account name',
      copyButton: 'Copy',
      copiedButton: 'Copied',
      quantityUnit: 'ea',
      phoneHelp: 'Example: 0412 345 678 or +61 412 345 678',
      phonePlaceholder: '0412 345 678',
      requestPlaceholder: 'Leave pickup notes, a different payer name, or any other request.',
      privacyNotice: 'I agree to collection and use of my details for reservation confirmation and operator notifications.',
      reservationCompleteTitle: 'Your reservation request has been sent.',
      reservationCompleteText: 'We will check availability and send confirmation details by message.',
      paymentConfirmText: 'Your reservation is final after payment confirmation.',
      noReservationText: 'There is no reservation to show here. Please use reservation lookup.',
      lookupTitle: 'Find reservation',
      lookupPhoneLabel: 'Phone number or last 4 digits',
      notFoundText: 'We could not find that reservation.',
      smsFooter: 'Verygood Chocolate',
    },
    productCardFeatures: {
      'pave-cake': ['Layered chocolate sponge and pave ganache', 'Mini and No. 1 sizes', 'Cacao and size options'],
      'pound-cake': ['Rectangular gateau chocolat', 'Dark chocolate finish', 'Gift packaging included'],
    },
    guideSteps: [
      { title: 'Request', text: 'Choose your cake and preferred pickup time.' },
      { title: 'Confirmation', text: 'We check availability and send payment details by message.' },
      { title: 'Payment', text: 'Your order is confirmed after payment. Online checkout is not available yet.' },
      { title: 'Pickup', text: 'Collect your cake during the confirmed pickup window.' },
    ],
    csvHeaders: ['Created at', 'Reservation number', 'Customer name', 'Phone', 'Product', 'Size', 'Cacao', 'Quantity', 'Pickup date', 'Pickup time', 'Request note', 'Reservation status', 'Payment status', 'Total price', 'Admin memo'],
    smsLabels: {
      title: '[Verygood Chocolate cake reservation]',
      greeting: 'Hello, this is Verygood Chocolate.',
      body: 'Here are the details of your cake reservation request.',
      reservationNumber: 'Reservation number',
      productName: 'Product',
      size: 'Size',
      cacao: 'Cacao option',
      pickupDate: 'Pickup date',
      pickupTime: 'Pickup time',
      quantity: 'Quantity',
      customerName: 'Customer name',
      address: 'Pickup address',
      contact: 'Contact',
      thanks: 'Thank you.',
    },
  },
}

const envMarket = String(import.meta.env.VITE_MARKET || '').toUpperCase()

export const MARKET: Market = envMarket === 'AU' ? 'AU' : 'KR'

export const marketConfig = MARKET_CONFIG[MARKET]

export const RESERVATION_STATUSES: ReservationStatus[] = ['예약신청', '예약확정', '픽업완료', '취소']

export const PAYMENT_STATUSES: PaymentStatus[] = ['입금대기', '입금확인', '현장결제', '환불필요']
