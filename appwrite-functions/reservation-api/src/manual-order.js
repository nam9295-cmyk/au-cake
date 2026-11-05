// Operator-only storage contract. Never use this builder in a public write route.
// Item codes are a closed physical-piece vocabulary, NOT public catalog products.
import { ReservationApiError } from './reservation-error.js'

export const MANUAL_ORDER_VERSION = 'manual-order.v1'
export const MANUAL_ORDER_PRODUCT_ID = 'manual-order'
const names = Object.freeze({ 'gateau-cupcake-basic': 'Gâteau Cupcakes · Basic', 'smore-stick': 'S’more Sticks' })
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const invalid = () => { throw new ReservationApiError('INVALID_STORED_ORDER', 500) }
function exact(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Reflect.ownKeys(value).length === keys.length && keys.every(key => own(value, key))
}

// Detection is deliberately broader than validation. Corrupt/manual future versions
// must never fall through into catalog repricing, public projections or mail senders.
export function isManualOrderDocument(document) {
  if (!document || typeof document !== 'object') return false
  if (document.productId === MANUAL_ORDER_PRODUCT_ID || own(document, 'manualOrder')
    || String(document.contractVersion || '').startsWith('manual-order.')) return true
  try {
    const payload = JSON.parse(document.orderLinesJson)
    return typeof payload?.version === 'string' && payload.version.startsWith('manual-order.')
  } catch { return false }
}

// Snapshot descriptor values once: direct SDK-script callers cannot smuggle
// getters, inherited serialization hooks or overridden array traversal methods.
function snapshot(value, depth = 0) {
  if (depth > 6) invalid()
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (typeof value !== 'object') invalid()
  const array = Array.isArray(value)
  const proto = Object.getPrototypeOf(value)
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) invalid()
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (keys.length > 16 || keys.some(key => typeof key !== 'string' || !own(descriptors[key], 'value'))) invalid()
  if (array) {
    const length = descriptors.length?.value
    if (!Number.isInteger(length) || length < 1 || length > 2 || keys.length !== length + 1) invalid()
    return Array.from({ length }, (_, i) => {
      if (!own(descriptors, String(i))) invalid()
      return snapshot(descriptors[i].value, depth + 1)
    })
  }
  return Object.fromEntries(keys.map(key => [key, snapshot(descriptors[key].value, depth + 1)]))
}

export function validateManualOrder(input) {
  const value = snapshot(input)

  if (!exact(value, ['version', 'source', 'currency', 'reason', 'audit', 'lines', 'totalPriceCents'])
    || value.version !== MANUAL_ORDER_VERSION || value.source !== 'admin' || value.currency !== 'AUD'
    || value.reason !== 'owner-approved-off-menu'
    || !exact(value.audit, ['operatorId', 'reference', 'createdAt'])
    || ![value.audit.operatorId, value.audit.reference].every(v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v))
    || typeof value.audit.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.audit.createdAt)
    || !Number.isFinite(Date.parse(value.audit.createdAt)) || new Date(value.audit.createdAt).toISOString() !== value.audit.createdAt
    || !Number.isSafeInteger(value.totalPriceCents) || value.totalPriceCents < 1 || value.totalPriceCents > 100000000
    || !Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 2) invalid()
  const seen = new Set()
  for (const line of value.lines) {
    if (!exact(line, ['item', 'quantity']) || typeof line.item !== 'string' || !own(names, line.item) || seen.has(line.item)
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) invalid()
    seen.add(line.item)
  }
  return value
}

function projection(payload) {
  const count = payload.lines.reduce((sum, line) => sum + line.quantity, 0)
  return {
    productId: MANUAL_ORDER_PRODUCT_ID, cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cacaoPercent: '기본',
    quantity: count, subtotalCents: payload.totalPriceCents, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
    totalPriceCents: payload.totalPriceCents, totalPrice: Math.round(payload.totalPriceCents / 100),
    orderLineCount: payload.lines.length, orderItemCount: count, individualPackagingPieces: 0, individualPackagingFeeCents: 0,
  }
}

// Returns only existing storage columns. Caller supplies private contact, booking
// identity, operational fields and private permissions using an authenticated SDK.
export function buildManualOrderData(input) {
  const payload = validateManualOrder(input)
  return { ...projection(payload), orderLinesJson: JSON.stringify(payload) }
}

export function readManualOrder(document) {
  try {
    if (typeof document?.orderLinesJson !== 'string' || document.orderLinesJson.length > 4096) invalid()
    const payload = validateManualOrder(JSON.parse(document.orderLinesJson))
    for (const [key, expected] of Object.entries(projection(payload))) if (document[key] !== expected) invalid()
    for (const key of ['reviewCouponId', 'appliedPromoCodeLast4', 'customerUserId']) if (document[key] != null && document[key] !== '') invalid()
    for (const key of ['chocolateIcingCount', 'vanillaCreamCount', 'partyDecorationCount']) if (document[key] != null && document[key] !== 0) invalid()
    if (document.individualPackaging === true) invalid()
    return payload
  } catch { return invalid() }
}

export function manualLineSummary(line) {
  if (!exact(line, ['item', 'quantity']) || typeof line.item !== 'string' || !own(names, line.item)
    || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) invalid()
  return `${names[line.item]} ×${line.quantity}`
}
export function manualOrderSummary(order) {
  const payload = validateManualOrder(order)
  return `${payload.lines.map(manualLineSummary).join(' + ')} · AUD ${(payload.totalPriceCents / 100).toFixed(2)}`
}

export function manualReservationProjection(document) {
  const manualOrder = readManualOrder(document)
  return {
    ...document, id: document.$id, manualOrder,
    customerEmail: typeof document.customerEmail === 'string' ? document.customerEmail.trim().toLowerCase() : '',
    totalPrice: manualOrder.totalPriceCents / 100,
    requestNote: document.requestNote || '', adminMemo: document.adminMemo || '',
    // Internal display-only lines; deliberately no invented per-line prices.
    orderLines: manualOrder.lines.map(line => ({ productId: MANUAL_ORDER_PRODUCT_ID, quantity: line.quantity, manualLine: line })),
  }
}

export function assertNotManualOrder(document) {
  if (isManualOrderDocument(document)) throw new ReservationApiError('MANUAL_ORDER_ADMIN_ONLY', 403)
}
export function assertManualOrderEditAllowed(edits) {
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)
    || Reflect.ownKeys(edits).some(key => !['pickupDate', 'pickupTime', 'status', 'paymentStatus', 'adminMemo'].includes(key))) {
    throw new Error('MANUAL_ORDER_EDIT_UNAVAILABLE')
  }
}
