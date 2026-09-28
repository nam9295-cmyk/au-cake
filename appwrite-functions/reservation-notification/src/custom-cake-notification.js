import { randomUUID } from 'node:crypto'
import { customCakeDocumentId } from '../shared/reservation-api/custom-cake-persistence.js'
import { buildEmailDeliveryEventKey, buildPendingEmailDelivery, decideEmailDelivery, CUSTOM_CAKE_EMAIL_IDENTITY_POLICY, normalizeRecipientEmail, normalizeRecipientEmailSet, payloadHashForEmail, recipientHashForEmail, recipientHashForEmailSet, resendIdempotencyKeyForEvent, EMAIL_DELIVERY_PENDING_LEASE_MS } from '../shared/email-delivery/email-delivery.js'
import { deliverEmail } from '../shared/email-delivery/email-delivery-sender.js'
import { retryEmail } from '../shared/email-delivery/email-delivery-retry.js'

const policy = Object.freeze({ identityPolicy: CUSTOM_CAKE_EMAIL_IDENTITY_POLICY })
const variants = Object.freeze({ 'custom-cake.received': 'requested', 'custom-cake.quoted': 'quoted', 'custom-cake.confirmed': 'confirmed', 'cake-order-v2.received': '예약신청' })
const eventFields = ['schemaVersion', 'eventType', 'requestId', 'requestNumber', 'quoteVersion', 'occurredAt', 'snapshot', 'explanation']
const clone = value => JSON.parse(JSON.stringify(value))
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const fail = () => { throw new Error('INVALID_CUSTOM_CAKE_EMAIL_EVENT') }
const instant = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const cents = n => Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0)
const money = n => { if (!cents(n)) fail(); return `AUD ${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}` }
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const label = key => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, c => c.toUpperCase())
const display = value => typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)
function operatorOrderSummary(snapshot) {
  if (snapshot.quote) {
    const paid = new Map(snapshot.paidSmoreLines.map(line => [line.lineId, line]))
    const lines = snapshot.lines.map(line => {
      if (line.kind === 'custom-cake') return `Custom Cake ${line.lineId}: ${line.tier} ${line.size} × ${line.quantity}; design: ${line.designNote || 'None'}; figurine: ${line.figurineSource}`
      const priced = paid.get(line.lineId)
      if (!priced) fail()
      return `Paid S’more ${line.lineId}: × ${line.quantity}; ${line.kind === 'cake-addon-smore' ? `add-on to ${line.parentCakeLineId}` : 'standalone'}; ${money(priced.totalCents)}`
    })
    lines.push(`Gift S’more: × ${snapshot.quote.giftSmoreQuantity}`)
    return lines
  }
  return snapshot.pricing.lines.flatMap(line => {
    if (line.kind !== 'cake') return [`Paid S’more ${line.lineId}: × ${line.quantity}; ${line.kind === 'cake-addon-smore' ? `add-on to ${line.parentCakeLineId}` : 'standalone'}; ${money(line.totalCents)}`]
    const selections = Object.entries(line.options).map(([key, value]) => `${label(key)}=${display(value)}`).join('; ')
    return [`Cake ${line.lineId}: ${line.productId} × ${line.quantity}; paid ${money(line.totalCents)}`, `Selections: ${selections}`]
  })
}
function readEvent(id, event) {
  if (!event || event.schemaVersion !== 1 || !Object.hasOwn(variants, event.eventType) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(event.requestId || '') || !instant(event.occurredAt) || !instant(event.dueAt) || !['pending', 'sent', 'manual'].includes(event.state) || typeof event.explanation !== 'string' || event.explanation.length > 1000 || event.explanation.trim() !== event.explanation || (event.eventType !== 'custom-cake.quoted' && event.explanation !== '')) fail()
  if (customCakeDocumentId('custom-cake-event-v1', `${event.requestId}/${event.eventType}/${event.quoteVersion}`) !== id) fail()
  const snapshot = event.snapshot, ordinary = event.eventType === 'cake-order-v2.received'
  if (!snapshot || snapshot.status !== variants[event.eventType] || snapshot.contractVersion !== (ordinary ? 'cake-order.v2' : 'custom-cake.v1') || event.requestNumber !== (ordinary ? snapshot.reservationNumber : snapshot.requestNumber) || typeof event.requestNumber !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(event.requestNumber)) fail()
  if (!snapshot.customer || typeof snapshot.customer.customerName !== 'string' || !snapshot.pickup || !/^\d{4}-\d\d-\d\d$/.test(snapshot.pickup.pickupDate) || !/^\d\d:\d\d$/.test(snapshot.pickup.pickupTime)) fail()
  normalizeRecipientEmail(snapshot.customer.customerEmail)
  if (ordinary) {
    const p = snapshot.pricing
    if (event.quoteVersion !== 0 || !p || p.currency !== 'AUD' || p.pricingPolicyVersion !== 'cake-order.2026-09.v2' || !instant(p.pricedAt) || !Array.isArray(p.lines) || !p.lines.length) fail()
    for (const field of ['subtotalCents', 'discountCents', 'individualPackagingFeeCents', 'totalCents']) {
      const total = p.lines.reduce((sum, l) => { const value = field === 'individualPackagingFeeCents' && l.kind !== 'cake' ? 0 : l[field]; if (!cents(value)) fail(); return sum + value }, 0)
      if (!cents(p[field]) || total !== p[field] || !cents(total)) fail()
    }
    if (p.totalCents !== p.subtotalCents - p.discountCents + p.individualPackagingFeeCents) fail()
  } else {
    const q = snapshot.quote
    if (!q || !Number.isSafeInteger(event.quoteVersion) || event.quoteVersion < 1 || event.quoteVersion !== q.quoteVersion || q.currency !== 'AUD' || q.pricingPolicyVersion !== 'custom-cake.2026-09.v1' || !instant(q.promotionEligibilityAt)) fail()
    for (const field of ['baseCents', 'cakeDiscountCents', 'paidSmoreQuantity', 'paidSmoreTotalCents', 'giftSmoreQuantity', 'knownTotalCents']) if (!cents(q[field])) fail()
    for (const field of ['designExtraCents', 'figurineExtraCents']) if (q[field] !== null && !cents(q[field])) fail()
    const total = q.baseCents - q.cakeDiscountCents + (q.designExtraCents ?? 0) + (q.figurineExtraCents ?? 0) + q.paidSmoreTotalCents
    const final = q.designExtraCents !== null && q.figurineExtraCents !== null
    if (!cents(total) || q.knownTotalCents !== total || q.isFinalQuote !== final || q.finalTotalCents !== (final ? total : null)) fail()
    if (event.eventType === 'custom-cake.received' && (q.quoteVersion !== 1 || q.designExtraCents !== null || q.figurineExtraCents !== null || snapshot.acceptance !== null)) fail()
    if (event.eventType === 'custom-cake.quoted' && q.quoteVersion < 2) fail()
    if (event.eventType === 'custom-cake.confirmed' && (!final || snapshot.acceptance?.acceptedQuoteVersion !== q.quoteVersion || !instant(snapshot.acceptance?.acceptedAt))) fail()
  }
  return event
}
const rolesFor = event => event.eventType.endsWith('.received') ? ['customer', 'operator'] : ['customer']
export function buildCustomCakeEmailPayload({ id, event, from, replyTo = null, role = 'customer', operatorRecipients }) {
  readEvent(id, event)
  if (!rolesFor(event).includes(role)) fail()
  if (typeof from !== 'string' || !from.trim() || /[\r\n]/.test(from) || (replyTo !== null && (typeof replyTo !== 'string' || /[\r\n]/.test(replyTo)))) fail()
  const s = event.snapshot, q = s.quote
  const recipientEmail = normalizeRecipientEmail(s.customer.customerEmail)
  const recipients = role === 'operator' ? normalizeRecipientEmailSet(operatorRecipients) : [recipientEmail]
  const title = event.eventType.endsWith('.received') ? 'Request received' : event.eventType.endsWith('.quoted') ? `Custom Cake quote ${event.quoteVersion}` : 'Custom Cake confirmed'
  const details = [title, `Reference: ${event.requestNumber}`, `Customer: ${s.customer.customerName}`, `Pickup: ${s.pickup.pickupDate} ${s.pickup.pickupTime} (Sydney)`]
  if (role === 'operator') details.push(`Contact phone: ${s.customer.customerPhone}`, `Contact email: ${recipientEmail}`, ...operatorOrderSummary(s))
  if (q) {
    details.push(`Quote version: ${q.quoteVersion}`, `Base: ${money(q.baseCents)}`, `Cake discount: ${money(q.cakeDiscountCents)}`, `Design extra: ${q.designExtraCents === null ? 'Not agreed' : money(q.designExtraCents)}`, `Figurine extra: ${q.figurineExtraCents === null ? 'Not agreed' : money(q.figurineExtraCents)}`, `Paid S’more: ${q.paidSmoreQuantity} — ${money(q.paidSmoreTotalCents)}`, `Gift S’more: ${q.giftSmoreQuantity}`, `${q.isFinalQuote ? 'Final quote' : 'Known amount (extras not yet agreed)'}: ${money(q.knownTotalCents)}`)
  } else details.push(`Total: ${money(s.pricing.totalCents)}`)
  if (event.explanation) details.push(`Quote explanation: ${event.explanation}`)
  if (event.eventType !== 'custom-cake.confirmed') details.push('This request is not a confirmed booking. Receipt or a quote does not guarantee production or pickup, and does not authorize payment.')
  const template = event.eventType, sourceType = q ? 'custom-cake' : 'cake-order-v2', sourceId = id
  const eventKey = buildEmailDeliveryEventKey({ template, sourceType, sourceId, occurrence: role }, policy)
  const text = details.join('\n')
  const payload = { eventKey, template, templateVersion: 'v1', sourceType, sourceId, occurrence: role, from: from.trim(), replyTo, ...(role === 'operator' ? { recipientEmails: recipients } : { recipientEmail }), to: recipients, subject: `[Very Good Chocolate] ${title} · ${event.requestNumber}`, text, html: `<div>${details.map(line => `<p>${escape(line)}</p>`).join('')}</div>`, recipientHash: role === 'operator' ? recipientHashForEmailSet(recipients) : recipientHashForEmail(recipientEmail), idempotencyKey: resendIdempotencyKeyForEvent(eventKey) }
  return { ...payload, payloadHash: payloadHashForEmail(payload, policy) }
}
function validatePayload(id, event, payload, role) {
  if (!payload || payload.occurrence !== role || !rolesFor(event).includes(role) || payload.sourceId !== id || payload.template !== event.eventType || payload.sourceType !== (event.eventType === 'cake-order-v2.received' ? 'cake-order-v2' : 'custom-cake') || payload.eventKey !== buildEmailDeliveryEventKey(payload, policy) || payload.payloadHash !== payloadHashForEmail(payload, policy) || payload.idempotencyKey !== resendIdempotencyKeyForEvent(payload.eventKey)) fail()
  if (role === 'operator') {
    if (!equal(payload.to, normalizeRecipientEmailSet(payload.recipientEmails)) || payload.recipientHash !== recipientHashForEmailSet(payload.to)) fail()
  } else if (payload.recipientEmail !== normalizeRecipientEmail(event.snapshot.customer.customerEmail) || !equal(payload.to, [payload.recipientEmail]) || payload.recipientHash !== recipientHashForEmail(payload.recipientEmail)) fail()
}
/** The private event itself is the transaction fence and delivery/retry ledger. */
export function createCustomCakeNotificationDispatcher({ repository, from, replyTo = null, operatorRecipients }) {
  async function mutate(id, work, role) {
    return repository.atomic(`custom-cake-mail/${id}/${randomUUID()}`, async tx => {
      const before = readEvent(id, await tx.get('outbox', id)), next = clone(before)
      for (const r of rolesFor(before)) if (before.emailByRole?.[r]?.emailPayload) validatePayload(id, before, before.emailByRole[r].emailPayload, r)
      next.emailByRole ||= {}
      next.emailByRole[role] ||= { state: 'pending', dueAt: next.occurredAt }
      const result = await work(next.emailByRole[role])
      const states = rolesFor(next).map(r => next.emailByRole[r]?.state || 'pending')
      next.state = states.includes('pending') ? 'pending' : states.includes('manual') ? 'manual' : 'sent'
      next.dueAt = rolesFor(next).filter(r => !next.emailByRole[r] || next.emailByRole[r].state === 'pending').map(r => next.emailByRole[r]?.dueAt || next.occurredAt).sort()[0] || next.dueAt
      for (const key of eventFields) if (!equal(before[key], next[key])) fail()
      for (const r of rolesFor(before)) if (before.emailByRole?.[r]?.emailPayload && !equal(before.emailByRole[r].emailPayload, next.emailByRole[r]?.emailPayload)) fail()
      if (equal(before, next)) return tx.readOnly(result)
      await tx.replace('outbox', id, next)
      return result
    })
  }
  function ledgers(id, payload, role) {
    const update = (id, work) => mutate(id, work, role)
    const currentDelivery = event => { if (!event.emailDelivery || event.emailDelivery.eventKey !== payload.eventKey || event.emailDelivery.recipientHash !== payload.recipientHash || event.emailDelivery.payloadHash !== payload.payloadHash) fail(); return event.emailDelivery }
    const deliveryRepository = {
      getOrCreatePending: (identity, now) => update(id, event => {
        if (event.emailDelivery) return { kind: 'existing', delivery: event.emailDelivery, decision: decideEmailDelivery(event.emailDelivery, identity, now, policy) }
        if (event.emailPayload && !equal(event.emailPayload, payload)) fail()
        event.emailPayload = clone(payload)
        event.emailDelivery = buildPendingEmailDelivery(identity, now, policy)
        event.dueAt = new Date(now.getTime() + EMAIL_DELIVERY_PENDING_LEASE_MS).toISOString()
        return { kind: 'created', delivery: event.emailDelivery }
      }),
      markAttempt: (delivery, now) => update(id, event => {
        const d = currentDelivery(event)
        if (d.status === 'sent' || d.attempts !== delivery.attempts) fail()
        d.attempts++; d.firstAttemptAt ||= now.toISOString(); d.lastAttemptAt = now.toISOString(); d.updatedAt = now.toISOString()
        return d
      }),
      markSent: (delivery, { now, providerMessageId }) => update(id, event => {
        const d = currentDelivery(event)
        if (typeof providerMessageId !== 'string' || !providerMessageId.trim() || providerMessageId.length > 128) fail()
        if (d.status !== 'sent') Object.assign(d, { status: 'sent', providerMessageId, sentAt: now.toISOString(), lastErrorCode: null, updatedAt: now.toISOString() })
        event.state = 'sent'; return d
      }),
    }
    for (const [method, status] of [['markFailed', 'failed'], ['markUncertain', 'uncertain']]) deliveryRepository[method] = (delivery, { now, errorCode }) => update(id, event => {
      const d = currentDelivery(event)
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(errorCode)) fail()
      if (d.status !== 'sent') { Object.assign(d, { status, lastErrorCode: errorCode, updatedAt: now.toISOString() }); event.state = 'pending'; event.dueAt = new Date(now.getTime() + EMAIL_DELIVERY_PENDING_LEASE_MS).toISOString() }
      return d
    })
    const retryClaimRepository = {
      getByEventKey: async key => { if (key !== payload.eventKey) fail(); return (await repository.get('outbox', id))?.emailByRole?.[role]?.emailRetryClaim || null },
      getOrCreateClaim: (identity, now) => update(id, event => {
        currentDelivery(event)
        if (identity.eventKey !== payload.eventKey || identity.payloadHash !== payload.payloadHash || identity.recipientHash !== payload.recipientHash || buildEmailDeliveryEventKey(identity, policy) !== payload.eventKey) fail()
        if (event.emailRetryClaim) return { kind: 'existing', claim: event.emailRetryClaim }
        event.emailRetryClaim = { eventKey: identity.eventKey, claimedByUserId: 'custom-cake-dispatcher', status: 'pending', claimedAt: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() }
        return { kind: 'created', claim: event.emailRetryClaim }
      }),
      markCompleted: (claim, { status, now, errorCode }) => update(id, event => {
        if (event.emailRetryClaim?.eventKey !== claim.eventKey || !['sent', 'failed', 'uncertain'].includes(status)) fail()
        if (event.emailRetryClaim.status !== 'sent') Object.assign(event.emailRetryClaim, { status, completedAt: now.toISOString(), updatedAt: now.toISOString(), lastErrorCode: errorCode || null })
        return event.emailRetryClaim
      }),
    }
    return { deliveryRepository, retryClaimRepository }
  }
  async function deliverRole(id, { transport, now = new Date(), log = () => {}, error = () => {}, role }) {
    const event = readEvent(id, await repository.get('outbox', id))
    const saved = event.emailByRole?.[role] || {}
    const payload = saved.emailPayload || buildCustomCakeEmailPayload({ id, event, from, replyTo, role, operatorRecipients })
    validatePayload(id, event, payload, role)
    const { deliveryRepository, retryClaimRepository } = ledgers(id, payload, role)
    if (!saved.emailDelivery) return deliverEmail({ payload, repository: deliveryRepository, transport, now, log, error, logLabel: 'Cake event' })
    const decision = decideEmailDelivery(saved.emailDelivery, payload, now, policy)
    if (decision.kind === 'already_sent') return { status: 'already_sent' }
    const result = await retryEmail({ payload, delivery: saved.emailDelivery, deliveryRepository, retryClaimRepository, claimedByUserId: 'custom-cake-dispatcher', transport, now, log, error, ...policy })
    if (!['not_needed', 'wait', 'eligible'].includes(result.retry)) await mutate(id, current => { if (current.emailDelivery?.status !== 'sent') current.state = 'manual'; return { state: current.state } }, role)
    return result
  }
  return { async deliver(id, options) {
    const event = readEvent(id, await repository.get('outbox', id))
    const roles = options.role ? [options.role] : rolesFor(event)
    if (roles.some(role => !rolesFor(event).includes(role))) fail()
    if (roles.length === 1) return deliverRole(id, { ...options, role: roles[0] })
    const results = []
    for (const role of roles) {
      try { results.push(await deliverRole(id, { ...options, role })) } catch { results.push({ status: 'configuration_error' }) }
    }
    const failed = results.find(result => !['sent', 'already_sent'].includes(result.status))
    return failed || { status: results.some(result => result.status === 'sent') ? 'sent' : 'already_sent' }
  } }
}
