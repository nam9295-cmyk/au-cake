/** cake-order.v2 wire only; never widen the legacy v1 request or parser. */
import type { Cents, Contact, LineId, Pickup, RequestId, SmorePricedLine, SmoreRequestLine, UtcTimestamp } from './cake-wire-types.js'

export type CakeProductIdV2 =
  | 'pave-cake' | 'buttercream-cake'
  | 'fresh-strawberry-vanilla-cream-cake' | 'fresh-strawberry-chocolate-cream-cake'
  | 'pound-cake' | 'cupcake-half-dozen' | 'cupcake-dozen'
  | 'fresh-lemon-cupcakes-6' | 'fresh-lemon-cupcakes-8'
  | 'fresh-lemon-cupcakes-12' | 'fresh-lemon-cupcakes-16'
  | 'brownie-cheesecake' | 'pave-brownie-cheesecake'
/** Complete option shape. Product-specific acceptance remains server-owned. */
export type CakeOptionsV2 = {
  cakeSize: '6in' | '8in' | '10in' | '15cm'
  chocolateType: 'dark' | 'milk'
  poundAddon: 'none' | 'extra-chocolate' | 'vanilla-cream'
  cupcakeFinish: 'basic' | 'vanilla-fresh-cream' | 'chocolate-buttercream'
  chocolateIcingCount: number
  chocolateExtra: 'none' | 'eiffel-6' | 'pave-100g' | 'combo'
  brownieCreamOption: 'none' | 'fresh-cream'
  vanillaCreamCount: 0
  partyDecorationCount: 0
  vanillaCakeSheet: 'vanilla' | 'chocolate'
  vanillaCakeFlavor: 'plain' | 'triple-berry'
  vanillaCakePointColor: 'pink' | 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange' | 'white'
  individualPackaging: boolean
}
export type CakeRequestLineV2 = {
  kind: 'cake'
  lineId: LineId
  parentCakeLineId: null
  productId: CakeProductIdV2
  quantity: number
  options: CakeOptionsV2
}
export type CakeOrderV2Request = {
  contractVersion: 'cake-order.v2'
  requestId: RequestId
  customer: Contact
  pickup: Pickup
  requestNote: string
  privacyConsent: true
  promoCode: string // Empty means none; only existing eligible Cake lines use it.
  lines: (CakeRequestLineV2 | SmoreRequestLine)[]
}
export type CakePricedLineV2 = CakeRequestLineV2 & {
  unitPriceCents: Cents
  chocolateExtraCents: Cents
  subtotalCents: Cents
  discountPercent: 0 | 5 | 10
  discountCents: Cents
  individualPackagingPieces: number
  individualPackagingFeeCents: Cents
  totalCents: Cents
}
export type CakeOrderV2Pricing = {
  currency: 'AUD'
  pricingPolicyVersion: 'cake-order.2026-09.v2'
  pricedAt: UtcTimestamp
  lines: (CakePricedLineV2 | SmorePricedLine)[]
  subtotalCents: Cents
  discountCents: Cents
  individualPackagingFeeCents: Cents
  totalCents: Cents // Definitive ordinary-order total, unlike provisional custom quote.
}
export type CakeOrderV2CreateResponse = {
  contractVersion: 'cake-order.v2'
  requestId: RequestId
  reservationNumber: string
  status: '예약신청'
  pricing: CakeOrderV2Pricing
}
export type CakeOrderV2LookupRequest = {
  contractVersion: 'cake-order.v2'
  reservationNumber: string
  customerPhone: string
}
export type CakeOrderV2LookupResponse = {
  contractVersion: 'cake-order.v2'
  reservationNumber: string
  status: '예약신청' | '예약확정' | '픽업완료' | '취소'
  customer: Contact
  pickup: Pickup
  pricing: CakeOrderV2Pricing
}
