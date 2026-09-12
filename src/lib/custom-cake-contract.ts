/** custom-cake.v1 wire only. See docs/custom-cake-api-contract.md. */
import type { Cents, Contact, LineId, Pickup, RequestId, SmorePricedLine, SmoreRequestLine, UtcTimestamp } from './cake-wire-types.js'

export type CustomCakeSelection =
  | { tier: 'single'; size: '6in' | '8in' | '10in' }
  | { tier: 'double'; size: '4in+6in' | '6in+8in' | '8in+10in' }
export type CustomCakeLine = CustomCakeSelection & {
  kind: 'custom-cake'
  lineId: LineId
  parentCakeLineId: null
  productId: 'custom-cake'
  quantity: number
  designNote: string
  figurineSource: 'none' | 'customer' | 'shop'
  photoRefs: string[] // Validated opaque owned refs, not URLs or storage credentials.
}
export type CustomCakeCreateRequest = {
  contractVersion: 'custom-cake.v1'
  requestId: RequestId
  customer: Contact
  pickup: Pickup
  requestNote: string
  promoCode?: string
  privacyConsent: true
  lines: (CustomCakeLine | SmoreRequestLine)[]
}
export type QuoteAmounts = {
  quoteVersion: number
  currency: 'AUD'
  pricingPolicyVersion: 'custom-cake.2026-09.v1'
  promotionEligibilityAt: UtcTimestamp
  baseCents: Cents // Quantity-inclusive Custom Cake base subtotal.
  cakeDiscountCents: Cents
  paidSmoreQuantity: number
  paidSmoreTotalCents: Cents
  giftSmoreQuantity: number
  knownTotalCents: Cents
}
export type ProvisionalQuote = QuoteAmounts & {
  isFinalQuote: false
  finalTotalCents: null
} & (
  | { designExtraCents: null; figurineExtraCents: Cents | null }
  | { designExtraCents: Cents; figurineExtraCents: null }
)
export type FinalQuote = QuoteAmounts & {
  isFinalQuote: true
  designExtraCents: Cents
  figurineExtraCents: Cents
  finalTotalCents: Cents
}
export type CustomCakeQuote = ProvisionalQuote | FinalQuote
export type QuoteAcceptance = { acceptedQuoteVersion: number; acceptedAt: UtcTimestamp }
export type CustomCakeStatus = 'requested' | 'quoted' | 'confirmed' | 'completed' | 'cancelled'
export type CustomCakeCreateResponse = {
  contractVersion: 'custom-cake.v1'
  requestId: RequestId
  requestNumber: string
  status: 'requested'
  quote: ProvisionalQuote & { quoteVersion: 1; designExtraCents: null; figurineExtraCents: null }
  paidSmoreLines: SmorePricedLine[]
  acceptance: null
}
export type CustomCakeLookupRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  customerPhone: string
}
export type CustomCakeLookupResponse = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  customer: Contact
  pickup: Pickup
  lines: (CustomCakeLine | SmoreRequestLine)[]
  paidSmoreLines: SmorePricedLine[]
  acceptanceHistory: QuoteAcceptance[]
} & (
  | { status: 'requested' | 'quoted' | 'cancelled'; quote: CustomCakeQuote; acceptance: QuoteAcceptance | null }
  | { status: 'confirmed' | 'completed'; quote: FinalQuote & { quoteVersion: number }; acceptance: QuoteAcceptance }
)
export type CustomCakeAdminListResponse = {
  requests: CustomCakeLookupResponse[]
}
export type UpdateCustomCakeQuoteRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  expectedQuoteVersion: number
  designExtraCents: Cents | null
  figurineExtraCents: Cents | null
  explanation: string
}
export type AcceptCustomCakeQuoteRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  quoteVersion: number
  customerConsent: true
}
export type ConfirmCustomCakeRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  expectedQuoteVersion: number
}
/** Authenticated admin mutation result; same full public snapshot, no private audit. */
export type CustomCakeMutationResponse = CustomCakeLookupResponse

/** Terminal transitions: exact source status + quote CAS; no payment side effects. */
export type CompleteCustomCakeRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  expectedStatus: 'confirmed'
  expectedQuoteVersion: number
}
export type CancelCustomCakeRequest = {
  contractVersion: 'custom-cake.v1'
  requestNumber: string
  expectedStatus: 'requested' | 'quoted' | 'confirmed'
  expectedQuoteVersion: number
}
export type CustomCakeLifecycleAction =
  | { action: 'admin-complete-custom-cake-request'; data: CompleteCustomCakeRequest }
  | { action: 'admin-cancel-custom-cake-request'; data: CancelCustomCakeRequest }
