import { createHash } from 'node:crypto'

const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const SHA256_HEX = /^[a-f0-9]{64}$/
const RECIPIENT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EMAIL_DELIVERY_PENDING_LEASE_MS = 5 * 60 * 1000

export const EMAIL_DELIVERY_SOURCE_TYPES = Object.freeze(['cake', 'class', 'review', 'system'])

export const EMAIL_DELIVERY_TEMPLATES = Object.freeze([
  'booking-received-operator',
  'booking-received-customer',
  'booking-confirmed-customer',
  'review-invite-customer',
  'review-reward-customer',
])

export const EMAIL_DELIVERY_STATUSES = Object.freeze(['pending', 'sent', 'failed', 'uncertain'])

export const EMAIL_DELIVERY_REQUIRED_FUNCTION_SCOPES = Object.freeze([
  'databases.read',
  'databases.write',
  'documents.read',
  'documents.write',
])

const TEMPLATE_SOURCE_TYPES = Object.freeze({
  'booking-received-operator': Object.freeze(['cake', 'class']),
  'booking-received-customer': Object.freeze(['cake', 'class']),
  'booking-confirmed-customer': Object.freeze(['cake', 'class']),
  'review-invite-customer': Object.freeze(['cake', 'class']),
  'review-reward-customer': Object.freeze(['review']),
})

export class EmailDeliveryError extends Error {
  constructor(code) {
    super(code)
    this.name = 'EmailDeliveryError'
    this.code = code
  }
}

function fail(code) {
  throw new EmailDeliveryError(code)
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function exactString(value, code) {
  if (typeof value !== 'string') fail(code)
  return value
}

function exactDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) fail('INVALID_EMAIL_DELIVERY_TIME')
  return value
}

function templateAllowsSourceType(template, sourceType) {
  return TEMPLATE_SOURCE_TYPES[template]?.includes(sourceType) === true
}

function normalizedHeaderValue(value, code, { optional = false } = {}) {
  if ((value === undefined || value === null) && optional) return null
  const normalized = exactString(value, code).trim()
  if (!normalized) fail(code)
  return normalized
}

function requiredPayloadString(payload, key) {
  if (!Object.hasOwn(payload, key) || typeof payload[key] !== 'string') fail('INVALID_EMAIL_DELIVERY_PAYLOAD')
  return payload[key]
}

export function normalizeRecipientEmail(value) {
  if (typeof value !== 'string') fail('INVALID_RECIPIENT_EMAIL')
  const email = value.trim().toLowerCase()
  if (!email || email.length > 120 || !RECIPIENT_EMAIL.test(email)) fail('INVALID_RECIPIENT_EMAIL')
  return email
}

export function recipientHashForEmail(value) {
  return sha256(normalizeRecipientEmail(value))
}

export function normalizeRecipientEmailSet(values) {
  if (!Array.isArray(values) || values.length === 0) fail('INVALID_RECIPIENT_EMAIL')
  const normalized = values.map(normalizeRecipientEmail)
  return [...new Set(normalized)].sort()
}

export function recipientHashForEmailSet(values) {
  return sha256(normalizeRecipientEmailSet(values).join('\n'))
}

export function buildEmailDeliveryEventKey({ template, sourceType, sourceId } = {}) {
  if (!EMAIL_DELIVERY_TEMPLATES.includes(template) || !templateAllowsSourceType(template, sourceType)) {
    fail('INVALID_EMAIL_DELIVERY_EVENT')
  }
  if (!APPWRITE_ID.test(sourceId || '')) fail('INVALID_EMAIL_DELIVERY_SOURCE_ID')
  return `${template}:${sourceType}:${sourceId}`
}

export function resendIdempotencyKeyForEvent(eventKey) {
  if (typeof eventKey !== 'string' || !eventKey.trim() || eventKey.length > 128) {
    fail('INVALID_EMAIL_DELIVERY_EVENT')
  }
  return `verygood:${sha256(eventKey)}`
}

export function payloadHashForEmail(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_EMAIL_DELIVERY_PAYLOAD')
  const hasRecipientEmail = typeof payload.recipientEmail === 'string'
  const hasRecipientEmails = Array.isArray(payload.recipientEmails)
  if (hasRecipientEmail === hasRecipientEmails) fail('INVALID_EMAIL_DELIVERY_PAYLOAD')
  const canonical = {
    from: normalizedHeaderValue(payload.from, 'INVALID_EMAIL_DELIVERY_PAYLOAD'),
    recipients: hasRecipientEmail
      ? [normalizeRecipientEmail(payload.recipientEmail)]
      : normalizeRecipientEmailSet(payload.recipientEmails),
    replyTo: normalizedHeaderValue(payload.replyTo, 'INVALID_EMAIL_DELIVERY_PAYLOAD', { optional: true }),
    subject: requiredPayloadString(payload, 'subject'),
    text: requiredPayloadString(payload, 'text'),
    html: requiredPayloadString(payload, 'html'),
    template: requiredPayloadString(payload, 'template'),
    templateVersion: requiredPayloadString(payload, 'templateVersion'),
  }
  if (!EMAIL_DELIVERY_TEMPLATES.includes(canonical.template) || !canonical.templateVersion.trim()) {
    fail('INVALID_EMAIL_DELIVERY_PAYLOAD')
  }
  return sha256(JSON.stringify(canonical))
}

function hasValidHash(value) {
  return typeof value === 'string' && SHA256_HEX.test(value)
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) fail('INVALID_EMAIL_DELIVERY_IDENTITY')
  const eventKey = buildEmailDeliveryEventKey(identity)
  if (identity.eventKey !== eventKey || !hasValidHash(identity.recipientHash) || !hasValidHash(identity.payloadHash)) {
    fail('INVALID_EMAIL_DELIVERY_IDENTITY')
  }
  return identity
}

function timestampForPending(delivery) {
  const value = delivery?.lastAttemptAt || delivery?.updatedAt || delivery?.createdAt
  const timestamp = Date.parse(value || '')
  return Number.isFinite(timestamp) ? timestamp : null
}

function pendingIsFresh(delivery, now) {
  const timestamp = timestampForPending(delivery)
  return timestamp !== null && now.getTime() - timestamp >= 0 && now.getTime() - timestamp < EMAIL_DELIVERY_PENDING_LEASE_MS
}

export function decideEmailDelivery(existing, identity, now = new Date()) {
  validateIdentity(identity)
  exactDate(now)
  if (!existing) return { kind: 'create_pending' }
  if (existing.eventKey !== identity.eventKey) return { kind: 'identity_mismatch', reason: 'event_key' }
  if (existing.recipientHash !== identity.recipientHash) return { kind: 'identity_mismatch', reason: 'recipient_hash' }
  if (existing.payloadHash !== identity.payloadHash) return { kind: 'identity_mismatch', reason: 'payload_hash' }

  switch (existing.status) {
    case 'sent':
      return { kind: 'already_sent' }
    case 'failed':
      return { kind: 'retryable' }
    case 'uncertain':
      return { kind: 'reconciliation_required' }
    case 'pending':
      return pendingIsFresh(existing, now)
        ? { kind: 'in_progress' }
        : { kind: 'reconciliation_required', reason: 'stale_pending' }
    default:
      return { kind: 'reconciliation_required', reason: 'unknown_status' }
  }
}

export function buildPendingEmailDelivery(identity, now = new Date()) {
  validateIdentity(identity)
  exactDate(now)
  const timestamp = now.toISOString()
  return {
    eventKey: identity.eventKey,
    sourceType: identity.sourceType,
    sourceId: identity.sourceId,
    template: identity.template,
    status: 'pending',
    recipientHash: identity.recipientHash,
    payloadHash: identity.payloadHash,
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
