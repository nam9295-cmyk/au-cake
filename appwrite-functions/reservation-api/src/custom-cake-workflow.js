import { randomBytes, randomUUID } from 'node:crypto'
import { normalizeCustomCakeV1Request, normalizeCakeOrderV2Request, fingerprintCustomCakeV1Request, fingerprintCakeOrderV2Request, validateNewCakeWirePickup } from './cake-order-input.js'
import { buildCustomCakeV1Data, buildCakeOrderV2Data } from './cake-order-data.js'
import { reviseCustomCakeV1Quote } from './cake-order-pricing.js'
import { customCakeDocumentId } from './custom-cake-persistence.js'

export const cakeWireFail = code => { throw Object.assign(new Error(code), { code }) }
export function exactCakeObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) cakeWireFail('INVALID_REQUEST')
}
const numberValid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)
const versionValid = v => Number.isSafeInteger(v) && v > 0
const centsValid = v => v === null || (Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0))
const mutationKeys = {
  quote: ['expectedQuoteVersion', 'designExtraCents', 'figurineExtraCents', 'explanation'],
  accept: ['quoteVersion', 'customerConsent'], confirm: ['expectedQuoteVersion'],
  complete: ['expectedStatus', 'expectedQuoteVersion'], cancel: ['expectedStatus', 'expectedQuoteVersion'],
}

function validateMutation(action, input, actor) {
  if (!actor?.adminId) cakeWireFail('FORBIDDEN')
  if (!mutationKeys[action]) cakeWireFail('INVALID_REQUEST')
  exactCakeObject(input, ['contractVersion', 'requestNumber', ...mutationKeys[action]])
  if (input.contractVersion !== 'custom-cake.v1' || !numberValid(input.requestNumber) || !versionValid(action === 'accept' ? input.quoteVersion : input.expectedQuoteVersion)) cakeWireFail('INVALID_REQUEST')
  if (action === 'quote' && (!centsValid(input.designExtraCents) || !centsValid(input.figurineExtraCents) || typeof input.explanation !== 'string' || input.explanation.trim().length > 1000)) cakeWireFail('INVALID_REQUEST')
  if (action === 'accept' && input.customerConsent !== true) cakeWireFail('INVALID_REQUEST')
  if (action === 'complete' && input.expectedStatus !== 'confirmed') cakeWireFail('INVALID_REQUEST')
  if (action === 'cancel' && !['requested', 'quoted', 'confirmed'].includes(input.expectedStatus)) cakeWireFail('INVALID_REQUEST')
}

function transition(snapshot, action, input, actor, at) {
  const current = snapshot.lookupResponse, q = current.quote
  const v = action === 'accept' ? input.quoteVersion : input.expectedQuoteVersion
  if (action === 'complete' || action === 'cancel') {
    const target = action === 'complete' ? 'completed' : 'cancelled'
    if (current.status === target) {
      const exact = snapshot.transitionAudit.some(a => a.action === action && a.source === input.expectedStatus && a.target === target && a.quoteVersion === v)
      if (!exact) cakeWireFail('QUOTE_STATE_CONFLICT')
      if (q.quoteVersion !== v) cakeWireFail('QUOTE_VERSION_CONFLICT')
      return false
    }
    if (current.status !== input.expectedStatus) cakeWireFail('QUOTE_STATE_CONFLICT')
    if (q.quoteVersion !== v) cakeWireFail('QUOTE_VERSION_CONFLICT')
    snapshot.transitionAudit.push({ action, source: current.status, target, quoteVersion: v, adminId: actor.adminId, at })
    current.status = target
    return true
  }
  const sources = action === 'quote' ? ['requested', 'quoted'] : ['quoted', 'confirmed']
  if (!sources.includes(current.status)) cakeWireFail('QUOTE_STATE_CONFLICT')
  if (q.quoteVersion !== v) cakeWireFail('QUOTE_VERSION_CONFLICT')
  if (action === 'quote') {
    current.quote = reviseCustomCakeV1Quote(snapshot.creationResponse.quote, { quoteVersion: v + 1, designExtraCents: input.designExtraCents, figurineExtraCents: input.figurineExtraCents })
    current.status = 'quoted'
    snapshot.quoteHistory.push({ quote: structuredClone(current.quote), explanation: input.explanation.trim(), adminId: actor.adminId, at })
    return true
  }
  if (!q.isFinalQuote) cakeWireFail('QUOTE_NOT_FINAL')
  if (action === 'accept') {
    if (current.acceptance?.acceptedQuoteVersion === v) return false
    if (current.status !== 'quoted') cakeWireFail('QUOTE_STATE_CONFLICT')
    current.acceptance = { acceptedQuoteVersion: v, acceptedAt: at }
    current.acceptanceHistory.push(structuredClone(current.acceptance))
    return true
  }
  if (!current.acceptance?.acceptedAt) cakeWireFail('QUOTE_ACCEPTANCE_REQUIRED')
  if (current.acceptance.acceptedQuoteVersion !== v) cakeWireFail('QUOTE_VERSION_CONFLICT')
  if (current.status === 'confirmed') return false
  snapshot.transitionAudit.push({ action, source: 'quoted', target: 'confirmed', quoteVersion: v, adminId: actor.adminId, at })
  current.status = 'confirmed'
  return true
}

export async function persistCakeEvent(tx, snapshot, eventType, occurredAt, explanation = '') {
  const lookup = snapshot.lookupResponse, requestId = snapshot.request.requestId
  const custom = snapshot.request.contractVersion === 'custom-cake.v1'
  const quoteVersion = custom ? lookup.quote.quoteVersion : 0
  const id = customCakeDocumentId('custom-cake-event-v1', `${requestId}/${eventType}/${quoteVersion}`)
  await tx.create('outbox', id, { schemaVersion: 1, eventType, requestId, requestNumber: custom ? lookup.requestNumber : lookup.reservationNumber, quoteVersion, occurredAt, state: 'pending', dueAt: occurredAt, snapshot: structuredClone(lookup), explanation })
}

/** Authenticated transport is resolved by the route; no body-supplied actor is accepted. */
export function createCustomCakeWorkflow({ repository, fingerprintKey, promotionStartsAt, photos, coupons, assertLegacyAbsent, assertNewReady, smoreWritesEnabled, now = () => new Date() }) {
  async function find(number, wire = 'custom-cake.v1') {
    const rows = await repository.list('snapshots', { lookupKey: number, limit: 2 })
    if (rows.length !== 1 || rows[0].value.request.contractVersion !== wire) cakeWireFail('NOT_FOUND')
    return rows[0]
  }
  async function create(value, headers) {
    const custom = value?.contractVersion === 'custom-cake.v1'
    const request = custom ? normalizeCustomCakeV1Request(value) : normalizeCakeOrderV2Request(value)
    const fingerprint = (custom ? fingerprintCustomCakeV1Request : fingerprintCakeOrderV2Request)(request, fingerprintKey)
    const identity = { requestId: request.requestId, wire: request.contractVersion, creatorScope: `customer:${request.customer.customerPhone}`, fingerprint }
    const replay = await repository.findReplay(identity)
    if (replay) return replay
    if (assertNewReady) await assertNewReady()
    if (!smoreWritesEnabled && request.lines.some(line => line.productId === 'smore-stick')) cakeWireFail('CAPABILITY_UNAVAILABLE')
    try {
      return await repository.atomic(`create/${request.requestId}/${fingerprint}/${randomUUID()}`, async tx => {
        const prior = await tx.get('claims', request.requestId)
        if (prior) return (await tx.claimRequest(identity, null)).creationResponse
        await assertLegacyAbsent(request.requestId, tx.transactionId)
        const receivedAt = now()
        validateNewCakeWirePickup(request, receivedAt)
        const number = `${custom ? 'CUSTOM' : 'VG-C-AU'}-${randomBytes(12).toString('hex')}`
        const coupon = custom ? null : await coupons.resolve(request.promoCode, receivedAt, tx.transactionId)
        const built = custom ? buildCustomCakeV1Data(request, { now: receivedAt, requestNumber: number, promotionStartsAt }) : buildCakeOrderV2Data(request, { now: receivedAt, reservationNumber: number, reviewCoupon: coupon?.pricing })
        if (!custom) built.request.promoCode = ''
        const snapshot = { ...built, quoteHistory: [], transitionAudit: [], ...(coupon ? { couponAudit: coupon.audit } : {}) }
        await tx.claimRequest(identity, built.creationResponse)
        await tx.create('snapshots', request.requestId, snapshot)
        if (custom) await photos.attach(tx, { requestId: request.requestId, requestNumber: number, photoRefs: request.lines.flatMap(line => line.photoRefs || []), headers })
        if (coupon) await coupons.redeem(coupon, request.requestId, receivedAt, tx.transactionId)
        await persistCakeEvent(tx, snapshot, custom ? 'custom-cake.received' : 'cake-order-v2.received', receivedAt.toISOString())
        return built.creationResponse
      })
    } catch (error) {
      if (error.code === 'TRANSACTION_CONFLICT') {
        const committed = await repository.findReplay(identity)
        if (committed) return committed
      }
      throw error
    }
  }
  async function mutate(action, input, actor) {
    validateMutation(action, input, actor)
    const row = await find(input.requestNumber)
    const initial = structuredClone(row.value)
    if (!transition(initial, action, input, actor, now().toISOString())) return row.value.lookupResponse
    return repository.atomic(`mutation/${row.id}/${action}/${randomUUID()}`, async tx => {
      const snapshot = await tx.get('snapshots', row.id)
      if (!snapshot || snapshot.lookupResponse.requestNumber !== input.requestNumber) cakeWireFail('NOT_FOUND')
      const at = now().toISOString()
      if (!transition(snapshot, action, input, actor, at)) return snapshot.lookupResponse
      await tx.replace('snapshots', row.id, snapshot)
      if (action === 'quote' || action === 'confirm') await persistCakeEvent(tx, snapshot, `custom-cake.${action === 'quote' ? 'quoted' : 'confirmed'}`, at, action === 'quote' ? input.explanation.trim() : '')
      return snapshot.lookupResponse
    })
  }
  return { create, mutate, find }
}
