import { createCipheriv } from 'node:crypto'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { ReviewApiError } from '../functions/review-api/src/business.js'
import {
  buildReviewCouponEnvelopeAad,
  decryptReviewCouponCode,
  encryptReviewCouponCode,
  resolveReviewCouponEncryptionKey,
} from '../functions/review-api/src/coupon-envelope.js'

const encryptionKey = 'ERERERERERERERERERERERERERERERERERERERERERE'
const otherKey = 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI'
const couponId = 'coupon-encrypted-1'
const reviewId = 'review-encrypted-1'
const code = 'FOXKIWI7Q2MK'
const fixedIv = Buffer.from('000102030405060708090a0b', 'hex')

function assertErrorCode(codeValue) {
  return (error) => error instanceof Error && error.code === codeValue
}

function mutateCanonicalBase64Url(value) {
  const replacement = value[0] === 'A' ? 'B' : 'A'
  return `${replacement}${value.slice(1)}`
}

test('coupon encryption key is canonical unpadded base64url of exactly 32 bytes', () => {
  assert.equal(resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError).length, 32)
  for (const value of [
    undefined,
    '',
    'short',
    'A'.repeat(42),
    'A'.repeat(44),
    `${'A'.repeat(43)}=`,
    `${'A'.repeat(42)}+`,
    ` ${encryptionKey}`,
    `${encryptionKey} `,
  ]) {
    assert.throws(
      () => resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: value }, ReviewApiError),
      assertErrorCode('FUNCTION_CONFIGURATION_ERROR'),
    )
  }
})

test('AES-256-GCM coupon envelope is deterministic with an injected 12-byte IV and contains no raw code', () => {
  const key = resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  const first = encryptReviewCouponCode({ code, couponId, reviewId, key, iv: fixedIv })
  const second = encryptReviewCouponCode({ code, couponId, reviewId, key, iv: fixedIv })

  assert.deepEqual(first, second)
  assert.deepEqual(Object.keys(first).sort(), [
    'codeAuthTag', 'codeCiphertext', 'codeEncryptionVersion', 'codeIv',
  ])
  assert.equal(first.codeEncryptionVersion, 1)
  assert.match(first.codeIv, /^[A-Za-z0-9_-]{16}$/)
  assert.match(first.codeAuthTag, /^[A-Za-z0-9_-]{22}$/)
  assert.match(first.codeCiphertext, /^[A-Za-z0-9_-]+$/)
  assert.equal(JSON.stringify(first).includes(code), false)
  assert.equal(decryptReviewCouponCode({ envelope: first, couponId, reviewId, key }), code)
})

test('coupon envelope authentication fails closed for wrong key, exact AAD changes, and tampering', () => {
  const key = resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  const wrongKey = resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: otherKey }, ReviewApiError)
  const envelope = encryptReviewCouponCode({ code, couponId, reviewId, key, iv: fixedIv })

  for (const input of [
    { envelope, couponId, reviewId, key: wrongKey },
    { envelope, couponId: `${couponId}-other`, reviewId, key },
    { envelope, couponId, reviewId: `${reviewId}-other`, key },
    { envelope: { ...envelope, codeEncryptionVersion: 2 }, couponId, reviewId, key },
    { envelope: { ...envelope, codeCiphertext: mutateCanonicalBase64Url(envelope.codeCiphertext) }, couponId, reviewId, key },
    { envelope: { ...envelope, codeIv: mutateCanonicalBase64Url(envelope.codeIv) }, couponId, reviewId, key },
    { envelope: { ...envelope, codeAuthTag: mutateCanonicalBase64Url(envelope.codeAuthTag) }, couponId, reviewId, key },
  ]) {
    assert.throws(() => decryptReviewCouponCode(input), assertErrorCode('INVALID_COUPON_ENVELOPE'))
  }
})

test('coupon envelope rejects noncanonical encodings, invalid lengths, invalid IVs, and decrypted non-code plaintext', () => {
  const key = resolveReviewCouponEncryptionKey({ REVIEW_COUPON_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  const envelope = encryptReviewCouponCode({ code, couponId, reviewId, key, iv: fixedIv })

  for (const patch of [
    { codeCiphertext: `${envelope.codeCiphertext}=` },
    { codeIv: `${envelope.codeIv}=` },
    { codeAuthTag: `${envelope.codeAuthTag}=` },
    { codeIv: Buffer.alloc(11).toString('base64url') },
    { codeAuthTag: Buffer.alloc(15).toString('base64url') },
    { codeCiphertext: '' },
    { codeCiphertext: 'A'.repeat(65) },
  ]) {
    assert.throws(
      () => decryptReviewCouponCode({ envelope: { ...envelope, ...patch }, couponId, reviewId, key }),
      assertErrorCode('INVALID_COUPON_ENVELOPE'),
    )
  }
  assert.throws(
    () => encryptReviewCouponCode({ code, couponId, reviewId, key, iv: Buffer.alloc(11) }),
    assertErrorCode('INVALID_COUPON_ENVELOPE'),
  )
  assert.throws(
    () => encryptReviewCouponCode({ code: 'NOT-A-COUPON', couponId, reviewId, key, iv: fixedIv }),
    assertErrorCode('INVALID_COUPON_CODE'),
  )

  const invalidIv = Buffer.alloc(12, 9)
  const cipher = createCipheriv('aes-256-gcm', key, invalidIv)
  cipher.setAAD(buildReviewCouponEnvelopeAad({ couponId, reviewId, version: 1 }))
  const invalidCiphertext = Buffer.concat([cipher.update('NOT-A-COUPON', 'utf8'), cipher.final()])
  const invalidPlaintextEnvelope = {
    codeCiphertext: invalidCiphertext.toString('base64url'),
    codeIv: invalidIv.toString('base64url'),
    codeAuthTag: cipher.getAuthTag().toString('base64url'),
    codeEncryptionVersion: 1,
  }
  assert.throws(
    () => decryptReviewCouponCode({ envelope: invalidPlaintextEnvelope, couponId, reviewId, key }),
    assertErrorCode('INVALID_COUPON_ENVELOPE'),
  )
})
