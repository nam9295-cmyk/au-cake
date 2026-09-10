import type { CakeWireCapabilities } from './cake-wire-types.js'
import type { CustomCakeAdminListResponse, CustomCakeCreateResponse, CustomCakeLookupResponse, CustomCakeMutationResponse, CustomCakeQuote, QuoteAcceptance, CustomCakeLine } from './custom-cake-contract.js'
import type { CakeOrderV2CreateResponse, CakeOrderV2LookupResponse, CakeOrderV2Pricing, CakePricedLineV2 } from './cake-order-v2-contract.js'
import type { SmorePricedLine } from './cake-wire-types.js'
import type { PhotoSessionResponse, PhotoUploadResponse, PhotoReadResponse, PhotoDeleteResponse } from './custom-cake-photo-contract.js'

// Browser-only wire validation. Saved amounts are checked, never rebuilt from a catalogue.
type Check = (value: unknown) => boolean
const fail = (): never => { throw new Error('CAKE_WIRE_INVALID_RESPONSE') }
const literal = (...values: unknown[]): Check => value => values.includes(value)
const integer: Check = v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0)
const positive: Check = v => integer(v) && Number(v) > 0
const cakeQuantity: Check = v => positive(v) && Number(v) <= 5
const bool: Check = v => typeof v === 'boolean'
const string = (min: number, max: number, pattern?: RegExp): Check => v => typeof v === 'string' && v.length >= min && v.length <= max && v.trim() === v && (!pattern || pattern.test(v))
const id = string(1, 64, /^[A-Za-z0-9_-]+$/)
const requestId = string(36, 36, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
const timestamp: Check = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const array = (check: Check): Check => v => Array.isArray(v) && Object.keys(v).length === v.length && v.every(check)
const object = (fields: Record<string, Check>): Check => v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === Object.keys(fields).length && Object.entries(fields).every(([k, check]) => Object.hasOwn(v, k) && check((v as Record<string, unknown>)[k]))
const nullable = (check: Check): Check => v => v === null || check(v)
const either = (...checks: Check[]): Check => v => checks.some(check => check(v))
const guard = (parse: (value: unknown) => unknown): Check => value => { try { parse(value); return true } catch { return false } }
function checked<T>(value: unknown, check: Check, refinement: (v: T) => boolean = () => true): T {
  if (!check(value) || !refinement(value as T)) fail()
  return structuredClone(value) as T
}
const sum = (values: number[]) => { const total = values.reduce((a, b) => a + b, 0); if (!integer(total)) fail(); return total }
const contact = object({ customerName: string(2, 80), customerPhone: string(10, 10, /^04\d{8}$/), customerEmail: v => string(3, 120, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)(v) && v === String(v).toLowerCase() })
const pickup = object({ pickupDate: v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00.000Z`)) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v, pickupTime: string(5, 5, /^([01]\d|2[0-3]):[0-5]\d$/) })
const base64: Check = value => {
  if (typeof value !== 'string' || value.length < 4 || value.length > 13981016 || value.length % 4 !== 0) return false
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  for (let index = 0; index < value.length - padding; index++) {
    const code = value.charCodeAt(index)
    if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 43 || code === 47)) return false
  }
  return padding === 0 || !value.slice(0, -padding).includes('=')
}
const smoreFields = { kind: literal('standalone-smore', 'cake-addon-smore'), lineId: id, productId: literal('smore-stick'), quantity: positive, parentCakeLineId: nullable(id) }
const smoreRequest: Check = v => object(smoreFields)(v) && ((v as SmorePricedLine).kind === 'standalone-smore' ? (v as SmorePricedLine).parentCakeLineId === null : id((v as SmorePricedLine).parentCakeLineId))
const moneyFields = { unitPriceCents: integer, subtotalCents: integer, discountPercent: integer, discountCents: integer, totalCents: integer }
const smorePriced = guard(v => checked<SmorePricedLine>(v, object({ ...smoreFields, ...moneyFields }), line =>
  (line.kind === 'standalone-smore' ? line.parentCakeLineId === null : id(line.parentCakeLineId)) &&
  line.unitPriceCents === 450 && line.subtotalCents === sum([450 * line.quantity]) &&
  line.discountPercent === (line.kind === 'cake-addon-smore' ? 30 : 0) &&
  line.discountCents === (line.kind === 'cake-addon-smore' ? sum([135 * line.quantity]) : 0) && line.totalCents === line.subtotalCents - line.discountCents))
const customLine = guard(v => checked<CustomCakeLine>(v, object({ kind: literal('custom-cake'), lineId: id, productId: literal('custom-cake'), parentCakeLineId: literal(null), quantity: cakeQuantity, tier: literal('single', 'double'), size: string(1, 16), designNote: string(0, 1000), figurineSource: literal('none', 'customer', 'shop'), photoRefs: array(id) }), line =>
  (line.tier === 'single' ? ['6in', '8in', '10in'] : ['4in+6in', '6in+8in', '8in+10in']).includes(line.size) && new Set(line.photoRefs).size === line.photoRefs.length))
const acceptance = object({ acceptedQuoteVersion: positive, acceptedAt: timestamp })
function parseQuote(value: unknown): CustomCakeQuote {
  return checked<CustomCakeQuote>(value, object({ quoteVersion: positive, currency: literal('AUD'), pricingPolicyVersion: literal('custom-cake.2026-09.v1'), promotionEligibilityAt: timestamp, baseCents: integer, cakeDiscountCents: integer, designExtraCents: nullable(integer), figurineExtraCents: nullable(integer), paidSmoreQuantity: integer, paidSmoreTotalCents: integer, giftSmoreQuantity: integer, knownTotalCents: integer, isFinalQuote: bool, finalTotalCents: nullable(integer) }), q =>
    q.cakeDiscountCents <= q.baseCents && q.knownTotalCents === sum([q.baseCents - q.cakeDiscountCents, q.designExtraCents ?? 0, q.figurineExtraCents ?? 0, q.paidSmoreTotalCents]) &&
    q.isFinalQuote === (q.designExtraCents !== null && q.figurineExtraCents !== null) && q.finalTotalCents === (q.isFinalQuote ? q.knownTotalCents : null))
}
type GraphLine = { lineId: string; kind: string; parentCakeLineId: string | null }
function graph(lines: GraphLine[], parentKind: string, requireCake: boolean): boolean {
  const ids = new Map(lines.map(line => [line.lineId, line]))
  return lines.length > 0 && ids.size === lines.length && (!requireCake || lines.some(line => line.kind === parentKind)) && lines.every(line => line.kind !== 'cake-addon-smore' || (line.parentCakeLineId !== null && line.parentCakeLineId !== line.lineId && ids.get(line.parentCakeLineId)?.kind === parentKind))
}
function paid(q: CustomCakeQuote, lines: SmorePricedLine[]) {
  const ids = new Set(lines.map(l => l.lineId))
  return ids.size === lines.length && lines.every(l => l.kind !== 'cake-addon-smore' || !ids.has(l.parentCakeLineId)) && q.paidSmoreQuantity === sum(lines.map(l => l.quantity)) && q.paidSmoreTotalCents === sum(lines.map(l => l.totalCents))
}
const customFields = { contractVersion: literal('custom-cake.v1'), requestNumber: string(1, 128), quote: guard(parseQuote), paidSmoreLines: array(smorePriced), acceptance: nullable(acceptance) }
export function parseCustomCakeCreateResponse(value: unknown): CustomCakeCreateResponse {
  return checked<CustomCakeCreateResponse>(value, object({ ...customFields, requestId, status: literal('requested') }), v =>
    v.acceptance === null && v.quote.quoteVersion === 1 && v.quote.designExtraCents === null && v.quote.figurineExtraCents === null && paid(v.quote, v.paidSmoreLines))
}
function validHistory(v: CustomCakeLookupResponse) {
  let previous: QuoteAcceptance | null = null
  for (const entry of v.acceptanceHistory) {
    if (entry.acceptedQuoteVersion > v.quote.quoteVersion || entry.acceptedQuoteVersion < 2 || entry.acceptedAt < v.quote.promotionEligibilityAt || (previous && (entry.acceptedQuoteVersion <= previous.acceptedQuoteVersion || entry.acceptedAt < previous.acceptedAt))) return false
    previous = entry
  }
  if (v.acceptance === null ? previous !== null : !previous || previous.acceptedAt !== v.acceptance.acceptedAt || previous.acceptedQuoteVersion !== v.acceptance.acceptedQuoteVersion) return false
  if (v.acceptance?.acceptedQuoteVersion === v.quote.quoteVersion && !v.quote.isFinalQuote) return false
  if (v.status === 'confirmed' || v.status === 'completed') return v.quote.isFinalQuote && v.acceptance?.acceptedQuoteVersion === v.quote.quoteVersion
  return true
}
export function parseCustomCakeLookupResponse(value: unknown): CustomCakeLookupResponse {
  return checked<CustomCakeLookupResponse>(value, object({ ...customFields, status: literal('requested', 'quoted', 'confirmed', 'completed', 'cancelled'), customer: contact, pickup, lines: array(either(customLine, smoreRequest)), acceptanceHistory: array(acceptance) }), v => {
    if (!graph(v.lines, 'custom-cake', true) || !paid(v.quote, v.paidSmoreLines) || !validHistory(v)) return false
    if (v.status === 'requested' && (v.quote.quoteVersion !== 1 || v.quote.designExtraCents !== null || v.quote.figurineExtraCents !== null || v.acceptance !== null)) return false
    if (v.status === 'quoted' && v.quote.quoteVersion < 2) return false
    const photos = v.lines.flatMap(l => l.kind === 'custom-cake' ? l.photoRefs : [])
    if (photos.length > 5 || new Set(photos).size !== photos.length) return false
    const requested = v.lines.filter(l => l.kind !== 'custom-cake')
    return requested.length === v.paidSmoreLines.length && requested.every(l => v.paidSmoreLines.some(p => Object.keys(smoreFields).every(k => l[k as keyof typeof l] === p[k as keyof typeof p])))
  })
}
export function parseCustomCakeMutationResponse(value: unknown): CustomCakeMutationResponse { return parseCustomCakeLookupResponse(value) }
export function parseCustomCakeAdminListResponse(value: unknown): CustomCakeAdminListResponse {
  return checked(value, object({ requests: array(guard(parseCustomCakeLookupResponse)) }))
}
function allocatedDiscount(line: CakePricedLineV2): boolean {
  const numerator = BigInt(line.subtotalCents) * BigInt(line.discountPercent)
  const discount = BigInt(line.discountCents)
  return discount >= numerator / 100n && discount <= (numerator + 99n) / 100n
}
function savedDiscountAllocations(lines: CakeOrderV2Pricing['lines']): boolean {
  // This is the saved option identity order used by the existing allocator,
  // independent of object insertion order and today's product catalogue.
  const identityOptions = ['cakeSize', 'chocolateType', 'poundAddon', 'cupcakeFinish', 'chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount', 'vanillaCakeSheet', 'vanillaCakeFlavor', 'vanillaCakePointColor', 'chocolateExtra', 'brownieCreamOption', 'individualPackaging'] as const
  const cakes = lines.filter((line): line is CakePricedLineV2 => line.kind === 'cake')
  for (const rate of [5, 10]) {
    const ranked = cakes.filter(line => line.discountPercent === rate).map(line => {
      const numerator = BigInt(line.subtotalCents) * BigInt(rate)
      return { line, numerator, floor: numerator / 100n, remainder: numerator % 100n, identity: JSON.stringify([line.productId, ...identityOptions.map(key => line.options[key])]) }
    }).sort((a, b) => a.remainder !== b.remainder ? (a.remainder > b.remainder ? -1 : 1)
      : a.identity !== b.identity ? (a.identity < b.identity ? -1 : 1) : a.line.lineId < b.line.lineId ? -1 : 1)
    const rounded = (ranked.reduce((total, item) => total + item.numerator, 0n) + 50n) / 100n
    let remaining = rounded - ranked.reduce((total, item) => total + item.floor, 0n)
    for (const item of ranked) {
      const expected = item.floor + (remaining > 0n ? 1n : 0n)
      if (remaining > 0n) remaining--
      if (BigInt(item.line.discountCents) !== expected) return false
    }
  }
  return true
}
const options = object({ cakeSize: literal('6in', '8in', '10in', '15cm'), chocolateType: literal('dark', 'milk'), poundAddon: literal('none', 'extra-chocolate', 'vanilla-cream'), cupcakeFinish: literal('basic', 'vanilla-fresh-cream', 'chocolate-buttercream'), chocolateIcingCount: integer, chocolateExtra: literal('none', 'eiffel-6', 'pave-100g', 'combo'), brownieCreamOption: literal('none', 'fresh-cream'), vanillaCreamCount: literal(0), partyDecorationCount: literal(0), vanillaCakeSheet: literal('vanilla', 'chocolate'), vanillaCakeFlavor: literal('plain', 'triple-berry'), vanillaCakePointColor: literal('pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'), individualPackaging: bool })
const cakePriced = guard(v => checked<CakePricedLineV2>(v, object({ kind: literal('cake'), lineId: id, parentCakeLineId: literal(null), productId: literal('pave-cake', 'buttercream-cake', 'fresh-strawberry-vanilla-cream-cake', 'fresh-strawberry-chocolate-cream-cake', 'pound-cake', 'cupcake-half-dozen', 'cupcake-dozen', 'fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16', 'brownie-cheesecake', 'pave-brownie-cheesecake'), quantity: cakeQuantity, options, ...moneyFields, discountPercent: literal(0, 5, 10), chocolateExtraCents: integer, individualPackagingPieces: integer, individualPackagingFeeCents: integer }), l =>
  l.subtotalCents === sum([l.unitPriceCents * l.quantity, l.chocolateExtraCents]) && l.discountCents <= l.subtotalCents && allocatedDiscount(l) && l.totalCents === sum([l.subtotalCents - l.discountCents, l.individualPackagingFeeCents])))
function parsePricing(value: unknown): CakeOrderV2Pricing {
  return checked<CakeOrderV2Pricing>(value, object({ currency: literal('AUD'), pricingPolicyVersion: literal('cake-order.2026-09.v2'), pricedAt: timestamp, lines: array(either(cakePriced, smorePriced)), subtotalCents: integer, discountCents: integer, individualPackagingFeeCents: integer, totalCents: integer }), p =>
    graph(p.lines, 'cake', false) && savedDiscountAllocations(p.lines) && p.subtotalCents === sum(p.lines.map(l => l.subtotalCents)) && p.discountCents === sum(p.lines.map(l => l.discountCents)) && p.individualPackagingFeeCents === sum(p.lines.map(l => l.kind === 'cake' ? l.individualPackagingFeeCents : 0)) && p.totalCents === sum(p.lines.map(l => l.totalCents)) && p.totalCents === sum([p.subtotalCents - p.discountCents, p.individualPackagingFeeCents]))
}
const v2Fields = { contractVersion: literal('cake-order.v2'), reservationNumber: string(1, 128), pricing: guard(parsePricing) }
export function parseCakeOrderV2CreateResponse(value: unknown): CakeOrderV2CreateResponse { return checked(value, object({ ...v2Fields, requestId, status: literal('예약신청') })) }
export function parseCakeOrderV2LookupResponse(value: unknown): CakeOrderV2LookupResponse { return checked(value, object({ ...v2Fields, status: literal('예약신청', '예약확정', '픽업완료', '취소'), customer: contact, pickup })) }
export function parseCakeWireCapabilities(value: unknown): CakeWireCapabilities { return checked(value, object({ contractVersion: literal('cake-capabilities.v1'), status: literal('ready'), customCakeV1: bool, cakeOrderV2: bool, legacyNewSubmissions: literal('compat', 'required') })) }
const photoVersion = literal('custom-cake-photo.v1')
const photoDimensions = { width: v => positive(v) && Number(v) <= 2560, height: v => positive(v) && Number(v) <= 2560, byteLength: v => positive(v) && Number(v) <= 10485760 } satisfies Record<string, Check>
export function parsePhotoSessionResponse(value: unknown): PhotoSessionResponse {
  return checked(value, object({ contractVersion: photoVersion, requestId, uploadSessionId: id, uploadToken: string(43, 512, /^[A-Za-z0-9_-]+$/), expiresAt: timestamp, limits: object({ maxPhotosPerRequest: literal(5), maxInputBytes: literal(10485760), maxDecodedPixels: literal(20000000), maxStoredDimension: literal(2560), allowedMimeTypes: v => Array.isArray(v) && v.length === 3 && v[0] === 'image/jpeg' && v[1] === 'image/png' && v[2] === 'image/webp', storedMimeType: literal('image/webp'), maxFrames: literal(1) }) }))
}
export function parsePhotoUploadResponse(value: unknown): PhotoUploadResponse { return checked(value, object({ contractVersion: photoVersion, requestId, photoRef: id, state: literal('staged'), mimeType: literal('image/webp'), ...photoDimensions })) }
export function parsePhotoReadResponse(value: unknown): PhotoReadResponse {
  return checked<PhotoReadResponse>(value, object({ contractVersion: photoVersion, photoRef: id, mimeType: literal('image/webp'), base64, ...photoDimensions }), v => {
    const bytes = atob(v.base64)
    return bytes.length === v.byteLength && btoa(bytes) === v.base64
  })
}
export function parsePhotoDeleteResponse(value: unknown): PhotoDeleteResponse { return checked(value, object({ contractVersion: photoVersion, photoRef: id, state: literal('deletion-pending', 'deleted') })) }
