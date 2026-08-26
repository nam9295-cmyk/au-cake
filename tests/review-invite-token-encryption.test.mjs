import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { ReviewApiError } from '../appwrite-functions/review-api/src/business.js'
import {
  buildReviewInviteTokenEnvelopeAad,
  decryptReviewInviteToken,
  encryptReviewInviteToken,
  resolveReviewInviteTokenEncryptionKey,
} from '../appwrite-functions/review-api/src/invite-token-envelope.js'

const encryptionKey = 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI'
const otherKey = 'MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM'
const inviteId = 'invite-encrypted-1'
const sourceType = 'cake'
const sourceReservationId = 'cake-reservation-1'
const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'
const fixedIv = Buffer.from('000102030405060708090a0b', 'hex')

function assertErrorCode(code) {
  return (error) => error instanceof Error && error.code === code
}

test('review invite token encryption key is canonical unpadded base64url of exactly 32 bytes', () => {
  assert.equal(resolveReviewInviteTokenEncryptionKey({ REVIEW_INVITE_TOKEN_ENCRYPTION_KEY: encryptionKey }, ReviewApiError).length, 32)
  for (const value of [undefined, '', 'short', 'A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(43)}=`, ` ${encryptionKey}`, `${encryptionKey} `]) {
    assert.throws(
      () => resolveReviewInviteTokenEncryptionKey({ REVIEW_INVITE_TOKEN_ENCRYPTION_KEY: value }, ReviewApiError),
      assertErrorCode('FUNCTION_CONFIGURATION_ERROR'),
    )
  }
})

test('AES-256-GCM review invite envelope is recoverable only with its exact invite and source AAD', () => {
  const key = resolveReviewInviteTokenEncryptionKey({ REVIEW_INVITE_TOKEN_ENCRYPTION_KEY: encryptionKey }, ReviewApiError)
  const envelope = encryptReviewInviteToken({ token, inviteId, sourceType, sourceReservationId, key, iv: fixedIv })

  assert.deepEqual(Object.keys(envelope).sort(), [
    'tokenAuthTag', 'tokenCiphertext', 'tokenEncryptionVersion', 'tokenIv',
  ])
  assert.equal(envelope.tokenEncryptionVersion, 1)
  assert.match(envelope.tokenCiphertext, /^[A-Za-z0-9_-]+$/)
  assert.match(envelope.tokenIv, /^[A-Za-z0-9_-]{16}$/)
  assert.match(envelope.tokenAuthTag, /^[A-Za-z0-9_-]{22}$/)
  assert.equal(JSON.stringify(envelope).includes(token), false)
  assert.equal(decryptReviewInviteToken({ envelope, inviteId, sourceType, sourceReservationId, key }), token)

  const wrongKey = resolveReviewInviteTokenEncryptionKey({ REVIEW_INVITE_TOKEN_ENCRYPTION_KEY: otherKey }, ReviewApiError)
  for (const input of [
    { envelope, inviteId, sourceType, sourceReservationId, key: wrongKey },
    { envelope, inviteId: 'invite-encrypted-other', sourceType, sourceReservationId, key },
    { envelope, inviteId, sourceType: 'class', sourceReservationId, key },
    { envelope, inviteId, sourceType, sourceReservationId: 'class-reservation-1', key },
    { envelope: { ...envelope, tokenEncryptionVersion: 2 }, inviteId, sourceType, sourceReservationId, key },
  ]) {
    assert.throws(() => decryptReviewInviteToken(input), assertErrorCode('INVALID_REVIEW_INVITE_ENVELOPE'))
  }

  assert.deepEqual(
    buildReviewInviteTokenEnvelopeAad({ inviteId, sourceType, sourceReservationId }).toString('utf8'),
    '["review-invite-token",1,"invite-encrypted-1","cake","cake-reservation-1"]',
  )
})
