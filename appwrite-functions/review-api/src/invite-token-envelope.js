import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENCRYPTION_VERSION = 1
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const MAX_CIPHERTEXT_BASE64URL_LENGTH = 64
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const CANONICAL_BASE64URL = /^[A-Za-z0-9_-]+$/
const REVIEW_TOKEN = /^[A-Za-z0-9_-]{43}$/

function errorWithCode(ErrorClass, code, status) {
  const error = new ErrorClass(code, status)
  if (!(error instanceof Error)) return Object.assign(new Error(code), { code, status })
  if (!('code' in error)) error.code = code
  if (!('status' in error)) error.status = status
  return error
}

function fail(ErrorClass, code, status = 400) {
  throw errorWithCode(ErrorClass, code, status)
}

function canonicalBase64Url(value, { decodedBytes, minDecodedBytes = 1, maxEncodedLength = Infinity } = {}) {
  if (typeof value !== 'string' || !value || value.length > maxEncodedLength || !CANONICAL_BASE64URL.test(value)) return null
  let decoded
  try {
    decoded = Buffer.from(value, 'base64url')
  } catch {
    return null
  }
  if (decoded.length < minDecodedBytes || (decodedBytes !== undefined && decoded.length !== decodedBytes)) return null
  return decoded.toString('base64url') === value ? decoded : null
}

function exactKey(key, ErrorClass, code) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) fail(ErrorClass, code)
  return key
}

function validInviteIdentity({ inviteId, sourceType, sourceReservationId, version }, ErrorClass) {
  if (!APPWRITE_ID.test(inviteId || '') || !APPWRITE_ID.test(sourceReservationId || '') ||
      !['cake', 'class'].includes(sourceType) || version !== ENCRYPTION_VERSION) {
    fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  }
}

export function resolveReviewInviteTokenEncryptionKey(env = process.env, ErrorClass = Error) {
  const encoded = typeof env.REVIEW_INVITE_TOKEN_ENCRYPTION_KEY === 'string'
    ? env.REVIEW_INVITE_TOKEN_ENCRYPTION_KEY
    : ''
  const key = canonicalBase64Url(encoded, { decodedBytes: KEY_BYTES })
  if (!key) fail(ErrorClass, 'FUNCTION_CONFIGURATION_ERROR', 500)
  return key
}

export function buildReviewInviteTokenEnvelopeAad({
  inviteId,
  sourceType,
  sourceReservationId,
  version = ENCRYPTION_VERSION,
} = {}, ErrorClass = Error) {
  validInviteIdentity({ inviteId, sourceType, sourceReservationId, version }, ErrorClass)
  return Buffer.from(JSON.stringify(['review-invite-token', version, inviteId, sourceType, sourceReservationId]), 'utf8')
}

export function encryptReviewInviteToken({
  token,
  inviteId,
  sourceType,
  sourceReservationId,
  version = ENCRYPTION_VERSION,
  key,
  iv = randomBytes(IV_BYTES),
  ErrorClass = Error,
} = {}) {
  if (typeof token !== 'string' || !REVIEW_TOKEN.test(token)) fail(ErrorClass, 'INVALID_REVIEW_INVITE_TOKEN')
  exactKey(key, ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  const aad = buildReviewInviteTokenEnvelopeAad({ inviteId, sourceType, sourceReservationId, version }, ErrorClass)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return {
    tokenCiphertext: ciphertext.toString('base64url'),
    tokenIv: iv.toString('base64url'),
    tokenAuthTag: cipher.getAuthTag().toString('base64url'),
    tokenEncryptionVersion: version,
  }
}

export function decryptReviewInviteToken({
  envelope,
  inviteId,
  sourceType,
  sourceReservationId,
  key,
  ErrorClass = Error,
} = {}) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  }
  exactKey(key, ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  const version = envelope.tokenEncryptionVersion
  const ciphertext = canonicalBase64Url(envelope.tokenCiphertext, {
    minDecodedBytes: 1,
    maxEncodedLength: MAX_CIPHERTEXT_BASE64URL_LENGTH,
  })
  const iv = canonicalBase64Url(envelope.tokenIv, { decodedBytes: IV_BYTES })
  const authTag = canonicalBase64Url(envelope.tokenAuthTag, { decodedBytes: AUTH_TAG_BYTES })
  if (!ciphertext || !iv || !authTag || version !== ENCRYPTION_VERSION) {
    fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  }
  const aad = buildReviewInviteTokenEnvelopeAad({ inviteId, sourceType, sourceReservationId, version }, ErrorClass)
  let token
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(authTag)
    token = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  }
  if (!REVIEW_TOKEN.test(token)) fail(ErrorClass, 'INVALID_REVIEW_INVITE_ENVELOPE')
  return token
}
