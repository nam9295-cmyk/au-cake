/** Wire-only declarations. No runtime validation, pricing, routing or activation. */
export type Cents = number // Non-negative safe integer; checked by each consumer.
export type LineId = string // [A-Za-z0-9_-]{1,64}; case-sensitive stable identity.
export type UtcTimestamp = string // Canonical UTC ISO-8601 with milliseconds and Z.
export type RequestId = string // UUID v4, lowercase; generated once per submission intent.
export type WireVersion = 'custom-cake.v1' | 'cake-order.v2'
export type Contact = { customerName: string; customerPhone: string; customerEmail: string }
export type Pickup = { pickupDate: string; pickupTime: string }
export type SmoreRequestLine =
  | { kind: 'standalone-smore'; lineId: LineId; productId: 'smore-stick'; quantity: number; parentCakeLineId: null }
  | { kind: 'cake-addon-smore'; lineId: LineId; productId: 'smore-stick'; quantity: number; parentCakeLineId: LineId }
type SmoreLineMoney = {
  unitPriceCents: Cents
  subtotalCents: Cents
  discountCents: Cents
  totalCents: Cents
}
export type SmorePricedLine = SmoreLineMoney & (
  | (Extract<SmoreRequestLine, { kind: 'standalone-smore' }> & { discountPercent: 0 })
  | (Extract<SmoreRequestLine, { kind: 'cake-addon-smore' }> & { discountPercent: 30 })
)
export type ContractErrorCode =
  | 'INVALID_REQUEST' | 'INVALID_LINE_ID' | 'INVALID_LINE_REFERENCE'
  | 'INVALID_PHOTO_REFERENCE' | 'PROMO_CODE_INVALID' | 'REQUEST_ID_CONFLICT'
  | 'QUOTE_VERSION_CONFLICT' | 'QUOTE_NOT_FINAL' | 'QUOTE_ACCEPTANCE_REQUIRED' | 'QUOTE_STATE_CONFLICT'
  | 'FORBIDDEN' | 'NOT_FOUND' | 'CAPABILITY_UNAVAILABLE'
export type ContractError = { ok: false; contractVersion: WireVersion; code: ContractErrorCode }
export type LegacyCakeUpgradeError = { ok: false; code: 'CAKE_ORDER_UPGRADE_REQUIRED' }
export type WireSuccess<Result> = { ok: true; result: Result }
/** Opt-in new capability response; never appended to legacy health. */
export type CakeWireCapabilities = {
  contractVersion: 'cake-capabilities.v1'
  status: 'ready'
  customCakeV1: boolean
  cakeOrderV2: boolean
  legacyNewSubmissions: 'compat' | 'required'
}
