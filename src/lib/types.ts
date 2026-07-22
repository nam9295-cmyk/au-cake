export type CacaoPercent = '기본' | '70' | '80.5' | '100'

export type CakeSize = 'mini' | 'size-1' | '15cm' | '17cm' | '19cm' | '22cm'

export type ChocolateType = 'dark' | 'milk'

export type PoundAddon = 'none' | 'extra-chocolate' | 'vanilla-cream'

export type ProductId =
  | 'pave-cake'
  | 'pound-cake'
  | 'cupcake-dozen'
  | 'choco-basque-cheesecake'
  | 'pave-choco-basque-cheesecake'
  | 'eiffel-tower-basque-cheesecake'
  | 'fresh-lemon-cupcakes-4'
  | 'fresh-lemon-cupcakes-6'
  | 'fresh-lemon-cupcakes-8'
  | 'fresh-lemon-cupcakes-12'
  | 'fresh-lemon-cupcakes-16'

export type ReservationStatus = '예약신청' | '예약확정' | '픽업완료' | '취소'

export type PaymentStatus = '입금대기' | '입금확인' | '현장결제' | '환불필요'

export type Reservation = {
  id: string
  reservationNumber: string
  customerName: string
  customerPhone: string
  productId: ProductId
  cakeSize: CakeSize
  chocolateType: ChocolateType
  poundAddon: PoundAddon
  chocolateIcingCount?: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
  quantity: number
  pickupDate: string
  pickupTime: string
  cacaoPercent: CacaoPercent
  requestNote: string
  status: ReservationStatus
  paymentStatus: PaymentStatus
  totalPrice: number
  totalPriceCents?: number
  subtotalCents?: number
  discountPercent?: number
  discountCents?: number
  appliedPromoCodeLast4?: string
  promotionKind?: 'none' | 'static' | 'review-reward' | 'manual-coupon'
  reviewCouponId?: string
  adminMemo: string
  createdAt: string
  updatedAt: string
}

export type ReservationInput = {
  customerName: string
  customerPhone: string
  productId: ProductId
  cakeSize: CakeSize
  chocolateType: ChocolateType
  poundAddon: PoundAddon
  chocolateIcingCount: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
  quantity: number
  pickupDate: string
  pickupTime: string
  cacaoPercent: CacaoPercent
  requestNote: string
  promoCode?: string
  privacyConsent: boolean
  requestId?: string
  website?: string
}

export type PublicReservation = Pick<
  Reservation,
  | 'reservationNumber'
  | 'productId'
  | 'cakeSize'
  | 'chocolateType'
  | 'poundAddon'
  | 'chocolateIcingCount'
  | 'vanillaCreamCount'
  | 'partyDecorationCount'
  | 'quantity'
  | 'pickupDate'
  | 'pickupTime'
  | 'cacaoPercent'
  | 'status'
  | 'paymentStatus'
>

export type StoreSettings = {
  price: number
  bankName: string
  bankAccount: string
  accountHolder: string
  weekdayOpen: string
  weekdayClose: string
  weekendOpen: string
  weekendClose: string
  dailyLimitText: string
  reservationNotice: string
  pickupNotice: string
  storeAddress: string
  storePhone: string
}

export type ReservationFilters = {
  pickupDate: string
  status: string
  paymentStatus: string
  cacaoPercent: string
  search: string
}

export type ClassBookingType = 'year-1-2' | '1-child' | '2-friends'
export type ClassCoursePlan = 'basic' | 'advanced' | 'basic-advanced-package'
export type ClassType = 'school-holiday-private-cake-class' | 'cupcake-chocolate-class' | 'advanced-2-tier-cake-class'
export type ClassAgeGroup = 'kindy-year-2' | 'year-2' | 'year-3-6'
export type ClassPartySize = 1 | 2
export type ClassExtensionMinutes = 0 | 30

export type ClassReservationStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled'

export type ClassPaymentStatus = 'Payment pending' | 'Pending deposit' | 'Deposit paid' | 'Fully paid' | 'Refund required'

export type ClassReservation = {
  id: string
  reservationNumber: string
  classType: ClassType
  classDate: string
  classTime: string
  coursePlan?: ClassCoursePlan
  extensionMinutes?: ClassExtensionMinutes
  advancedClassDate?: string
  advancedClassTime?: string
  advancedExtensionMinutes?: ClassExtensionMinutes
  durationMinutes?: number
  advancedDurationMinutes?: number
  bookingType: ClassBookingType
  parentName: string
  parentPhone: string
  parentEmail: string
  childName: string
  childAge: number
  schoolYear: string
  secondChildName: string
  secondChildAge: number | null
  secondChildSchoolYear: string
  allergyNote: string
  emergencyContact: string
  pickupPerson: string
  parentConsent: boolean
  cancellationAgreement: boolean
  photoConsent: boolean
  status: ClassReservationStatus
  paymentStatus: ClassPaymentStatus
  totalPrice: number
  totalPriceCents?: number
  subtotalCents?: number
  discountPercent?: number
  discountCents?: number
  depositAmount: number
  adminMemo: string
  createdAt: string
  updatedAt: string
}

export type ClassReservationInput = Pick<
  ClassReservation,
  | 'classDate'
  | 'classTime'
  | 'coursePlan'
  | 'extensionMinutes'
  | 'advancedClassDate'
  | 'advancedClassTime'
  | 'advancedExtensionMinutes'
  | 'classType'
  | 'bookingType'
  | 'parentName'
  | 'parentPhone'
  | 'parentEmail'
  | 'childName'
  | 'childAge'
  | 'schoolYear'
  | 'secondChildName'
  | 'secondChildAge'
  | 'secondChildSchoolYear'
  | 'allergyNote'
  | 'emergencyContact'
  | 'pickupPerson'
  | 'parentConsent'
  | 'cancellationAgreement'
  | 'photoConsent'
> & {
  privacyConsent: boolean
  partySize?: ClassPartySize
  requestId?: string
  website?: string
}

export type ClassReservationFilters = {
  classDate: string
  status: string
  paymentStatus: string
  search: string
}

export type ReviewSourceType = 'cake' | 'class'
export type ReviewRewardPercent = 5 | 10
export type ReviewRating = 1 | 2 | 3 | 4 | 5
export type ReviewModerationStatus = 'pending' | 'published' | 'hidden'

export type Review = {
  id: string
  sourceType: ReviewSourceType
  sourceReservationId: string
  sourceReservationNumber: string
  rating: ReviewRating
  body: string
  photoFileId: string | null
  displayName: string | null
  publishConsent: boolean
  moderationStatus: ReviewModerationStatus
  rewardPercent: ReviewRewardPercent
  couponId: string
  createdAt: string
  updatedAt: string
}

export type PublicReview = Pick<Review, 'id' | 'sourceType' | 'rating' | 'body' | 'createdAt'> & {
  displayName: string
  photoUrl: string | null
  incentivised: true
}
