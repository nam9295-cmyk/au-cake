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
  | 'fresh-lemon-cupcakes-4'
  | 'fresh-lemon-cupcakes-6'
  | 'fresh-lemon-cupcakes-8'
  | 'fresh-lemon-cupcakes-12'

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
  quantity: number
  pickupDate: string
  pickupTime: string
  cacaoPercent: CacaoPercent
  requestNote: string
  status: ReservationStatus
  paymentStatus: PaymentStatus
  totalPrice: number
  totalPriceCents?: number
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

export type ClassReservationStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled'

export type ClassPaymentStatus = 'Payment pending' | 'Pending deposit' | 'Deposit paid' | 'Fully paid' | 'Refund required'

export type ClassReservation = {
  id: string
  reservationNumber: string
  classType: 'school-holiday-private-cake-class'
  classDate: string
  classTime: string
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
  depositAmount: number
  adminMemo: string
  createdAt: string
  updatedAt: string
}

export type ClassReservationInput = Pick<
  ClassReservation,
  | 'classDate'
  | 'classTime'
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
  requestId?: string
  website?: string
}

export type ClassReservationFilters = {
  classDate: string
  status: string
  paymentStatus: string
  search: string
}
