import { createHmac } from 'node:crypto'

const BASE64URL_SECRET = /^[A-Za-z0-9_-]{43,}$/

export function resolveReviewCouponHmacSecret(env = process.env, ErrorClass = Error) {
  const encoded = typeof env.REVIEW_COUPON_HMAC_SECRET === 'string'
    ? env.REVIEW_COUPON_HMAC_SECRET
    : ''
  let secret
  try {
    secret = BASE64URL_SECRET.test(encoded) ? Buffer.from(encoded, 'base64url') : null
  } catch {
    secret = null
  }
  if (!secret || secret.length < 32 || secret.toString('base64url') !== encoded) {
    const error = new ErrorClass('FUNCTION_CONFIGURATION_ERROR', 500)
    if (!(error instanceof Error)) throw new Error('FUNCTION_CONFIGURATION_ERROR')
    if (!('code' in error)) error.code = 'FUNCTION_CONFIGURATION_ERROR'
    if (!('status' in error)) error.status = 500
    throw error
  }
  return secret
}

export function digestReviewCouponCode(normalizedCode, secretValue, ErrorClass = Error) {
  const secret = Buffer.isBuffer(secretValue)
    ? secretValue
    : resolveReviewCouponHmacSecret({ REVIEW_COUPON_HMAC_SECRET: secretValue }, ErrorClass)
  return createHmac('sha256', secret).update(normalizedCode, 'utf8').digest('hex')
}
