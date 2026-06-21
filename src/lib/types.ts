export type CacaoPercent = '기본' | '70' | '80.5' | '100'

export type CakeSize = 'mini' | 'size-1'

export type ProductId = 'pave-cake' | 'pound-cake'

export type ReservationStatus = '예약신청' | '예약확정' | '픽업완료' | '취소'

export type PaymentStatus = '입금대기' | '입금확인' | '현장결제' | '환불필요'

export type Reservation = {
  id: string
  reservationNumber: string
  customerName: string
  customerPhone: string
  productId: ProductId
  cakeSize: CakeSize
  quantity: number
  pickupDate: string
  pickupTime: string
  cacaoPercent: CacaoPercent
  requestNote: string
  status: ReservationStatus
  paymentStatus: PaymentStatus
  totalPrice: number
  adminMemo: string
  createdAt: string
  updatedAt: string
}

export type ReservationInput = {
  customerName: string
  customerPhone: string
  productId: ProductId
  cakeSize: CakeSize
  quantity: number
  pickupDate: string
  pickupTime: string
  cacaoPercent: CacaoPercent
  requestNote: string
}

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
