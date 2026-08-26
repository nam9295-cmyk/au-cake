import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  ReviewApiError,
  addSydneyCalendarDays,
  getReviewInviteLifecycle,
  hashSecret,
  issueReviewInvite,
} from '../appwrite-functions/review-api/src/business.js'
import {
  decryptReviewInviteToken,
  encryptReviewInviteToken,
  resolveReviewInviteTokenEncryptionKey,
} from '../appwrite-functions/review-api/src/invite-token-envelope.js'

const now = new Date('2026-07-19T00:00:00.000Z')
const encryptionKey = resolveReviewInviteTokenEncryptionKey({
  REVIEW_INVITE_TOKEN_ENCRYPTION_KEY: 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI',
}, ReviewApiError)
const existingToken = 'B'.repeat(43)
const newToken = 'C'.repeat(43)

function completedCake() {
  return { $id: 'cake-1', reservationNumber: 'VG-C-1', status: '픽업완료', customerEmail: 'jenny@example.com' }
}

function makeRepository(existingInvite = null) {
  const calls = []
  return {
    calls,
    async beginTransaction() { calls.push(['begin']); return { id: 'tx-1' } },
    async getSource() { calls.push(['source']); return completedCake() },
    async findInviteBySource() { calls.push(['findInvite']); return existingInvite },
    async findReviewBySource() { calls.push(['findReview']); return null },
    async createInvite(data, _transaction, id) { calls.push(['create', data, id]); return { $id: id, ...data } },
    async updateInvite(id, data) { calls.push(['update', id, data]); return { $id: id, ...data } },
    async getInvite() { return existingInvite },
    async commitTransaction() { calls.push(['commit']) },
    async rollbackTransaction() { calls.push(['rollback']) },
  }
}

test('new review invite persists an encrypted recovery envelope and keeps the 30 Sydney-calendar-day expiry', async () => {
  const repository = makeRepository()
  const result = await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now,
    tokenFactory: () => newToken,
    idFactory: () => 'invite-new',
    tokenEncryptionKey: encryptionKey,
  })

  assert.deepEqual(result, { token: newToken, expiresAt: addSydneyCalendarDays(now, 30).toISOString() })
  const persisted = repository.calls.find(([name]) => name === 'create')[1]
  assert.equal(persisted.tokenHash, hashSecret(newToken))
  assert.equal(JSON.stringify(persisted).includes(newToken), false)
  assert.equal(persisted.tokenEncryptionVersion, 1)
  assert.equal(decryptReviewInviteToken({
    envelope: persisted,
    inviteId: 'invite-new',
    sourceType: 'cake',
    sourceReservationId: 'cake-1',
    key: encryptionKey,
  }), newToken)
})

test('an active recoverable invite returns its original token without an update or token rotation', async () => {
  const envelope = encryptReviewInviteToken({
    token: existingToken,
    inviteId: 'invite-existing',
    sourceType: 'cake',
    sourceReservationId: 'cake-1',
    key: encryptionKey,
  })
  const repository = makeRepository({
    $id: 'invite-existing',
    sourceType: 'cake',
    sourceReservationId: 'cake-1',
    tokenHash: hashSecret(existingToken),
    expiresAt: '2026-08-18T00:00:00.000Z',
    ...envelope,
  })

  const result = await issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
    now,
    tokenFactory: () => newToken,
    tokenEncryptionKey: encryptionKey,
  })

  assert.deepEqual(result, { token: existingToken, expiresAt: '2026-08-18T00:00:00.000Z' })
  assert.equal(repository.calls.some(([name]) => name === 'update' || name === 'create'), false)
})

test('used, expired, and legacy hash-only invites fail closed without generating a replacement token', async () => {
  const cases = [
    [{ $id: 'invite-used', usedAt: now.toISOString(), expiresAt: '2026-08-18T00:00:00.000Z' }, 'REVIEW_ALREADY_SUBMITTED'],
    [{ $id: 'invite-expired', expiresAt: now.toISOString() }, 'REVIEW_INVITE_EXPIRED'],
    [{ $id: 'invite-legacy', expiresAt: '2026-08-18T00:00:00.000Z', tokenHash: hashSecret(existingToken) }, 'REVIEW_INVITE_UNRECOVERABLE'],
  ]

  for (const [invite, expectedCode] of cases) {
    const repository = makeRepository(invite)
    let generated = 0
    await assert.rejects(
      () => issueReviewInvite(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
        now,
        tokenFactory: () => { generated += 1; return newToken },
        tokenEncryptionKey: encryptionKey,
      }),
      (error) => error instanceof ReviewApiError && error.code === expectedCode,
    )
    assert.equal(generated, 0)
    assert.equal(repository.calls.some(([name]) => name === 'update' || name === 'create'), false)
  }
})

test('invite lifecycle reports only safe active, used, expired, and legacy recovery states', async () => {
  const recoverable = encryptReviewInviteToken({
    token: existingToken,
    inviteId: 'invite-lifecycle',
    sourceType: 'cake',
    sourceReservationId: 'cake-1',
    key: encryptionKey,
  })
  const cases = [
    [null, null, 'not_sent'],
    [{ $id: 'invite-lifecycle', tokenHash: hashSecret(existingToken), expiresAt: '2026-08-18T00:00:00.000Z', ...recoverable }, null, 'active'],
    [{ $id: 'invite-used', usedAt: now.toISOString(), expiresAt: '2026-08-18T00:00:00.000Z' }, null, 'used'],
    [{ $id: 'invite-expired', expiresAt: now.toISOString() }, null, 'expired'],
    [{ $id: 'invite-legacy', tokenHash: hashSecret(existingToken), expiresAt: '2026-08-18T00:00:00.000Z' }, null, 'legacy_invite_unrecoverable'],
    [null, { $id: 'review-1' }, 'used'],
  ]
  for (const [invite, review, state] of cases) {
    const repository = makeRepository(invite)
    repository.findReviewBySource = async () => review
    assert.equal((await getReviewInviteLifecycle(repository, { sourceType: 'cake', sourceReservationId: 'cake-1' }, {
      now,
      tokenEncryptionKey: encryptionKey,
    })).state, state)
  }
})
