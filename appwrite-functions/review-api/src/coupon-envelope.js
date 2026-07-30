import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENCRYPTION_VERSION = 1
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const MAX_CIPHERTEXT_BASE64URL_LENGTH = 64
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const CANONICAL_BASE64URL = /^[A-Za-z0-9_-]+$/
const REVIEW_COUPON_CODE = /^(?:FOX|CAT|DOG|OWL|PIG|BEE|COW|CUB|EMU|HEN|KOI|PUP|RAM|YAK|APE)(?:KIWI|FIG|LIME|PEAR|PLUM|APPLE|GRAPE|GUAVA|LEMON|MANGO|MELON|PEACH)[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/

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

function exactCouponCode(code) {
  return typeof code === 'string' && REVIEW_COUPON_CODE.test(code)
}

export function resolveReviewCouponEncryptionKey(env = process.env, ErrorClass = Error) {
  const encoded = typeof env.REVIEW_COUPON_ENCRYPTION_KEY === 'string'
    ? env.REVIEW_COUPON_ENCRYPTION_KEY
    : ''
  const key = canonicalBase64Url(encoded, { decodedBytes: KEY_BYTES })
  if (!key) fail(ErrorClass, 'FUNCTION_CONFIGURATION_ERROR', 500)
  return key
}

export function buildReviewCouponEnvelopeAad({ couponId, reviewId, version = ENCRYPTION_VERSION }, ErrorClass = Error) {
  if (!APPWRITE_ID.test(couponId || '') || !APPWRITE_ID.test(reviewId || '') || version !== ENCRYPTION_VERSION) {
    fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  }
  return Buffer.from(JSON.stringify([version, couponId, reviewId]), 'utf8')
}

export function encryptReviewCouponCode({
  code,
  couponId,
  reviewId,
  version = ENCRYPTION_VERSION,
  key,
  iv = randomBytes(IV_BYTES),
  ErrorClass = Error,
}) {
  if (!exactCouponCode(code)) fail(ErrorClass, 'INVALID_COUPON_CODE')
  exactKey(key, ErrorClass, 'INVALID_COUPON_ENVELOPE')
  if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  const aad = buildReviewCouponEnvelopeAad({ couponId, reviewId, version }, ErrorClass)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
  return {
    codeCiphertext: ciphertext.toString('base64url'),
    codeIv: iv.toString('base64url'),
    codeAuthTag: cipher.getAuthTag().toString('base64url'),
    codeEncryptionVersion: version,
  }
}

export function decryptReviewCouponCode({ envelope, couponId, reviewId, key, ErrorClass = Error }) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  }
  exactKey(key, ErrorClass, 'INVALID_COUPON_ENVELOPE')
  const version = envelope.codeEncryptionVersion
  const ciphertext = canonicalBase64Url(envelope.codeCiphertext, {
    minDecodedBytes: 1,
    maxEncodedLength: MAX_CIPHERTEXT_BASE64URL_LENGTH,
  })
  const iv = canonicalBase64Url(envelope.codeIv, { decodedBytes: IV_BYTES })
  const authTag = canonicalBase64Url(envelope.codeAuthTag, { decodedBytes: AUTH_TAG_BYTES })
  if (!ciphertext || !iv || !authTag || version !== ENCRYPTION_VERSION) {
    fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  }
  const aad = buildReviewCouponEnvelopeAad({ couponId, reviewId, version }, ErrorClass)
  let code
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(authTag)
    code = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  }
  if (!exactCouponCode(code)) fail(ErrorClass, 'INVALID_COUPON_ENVELOPE')
  return code
}
