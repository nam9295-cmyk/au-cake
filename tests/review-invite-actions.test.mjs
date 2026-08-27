import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { hashSecret, ReviewApiError } from '../appwrite-functions/review-api/src/business.js'
import {
  copyReviewInviteRequest,
  getReviewInviteEmailStatus,
  sendReviewInviteEmail,
} from '../appwrite-functions/review-api/src/review-invite-actions.js'

const now = new Date('2026-07-19T00:00:00.000Z')
const encryptionKey = Buffer.from('IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI', 'base64url')
const token = 'A'.repeat(43)

function createReviewRepository(overrides = {}) {
  const state = { invite: overrides.invite || null, review: overrides.review || null }
  const calls = []
  const source = {
    $id: 'cake-123', reservationNumber: 'VG-C-123', status: '픽업완료',
    customerName: 'Stored Customer', customerEmail: 'stored@example.com',
    adminMemo: 'PRIVATE ADMIN MEMO', allergyNote: 'PRIVATE ALLERGY', emergencyContact: 'PRIVATE EMERGENCY',
    ...overrides.source,
  }
  return {
    state, calls, source,
    async beginTransaction() { calls.push(['begin']); return { id: 'tx-1' } },
    async rollbackTransaction() { calls.push(['rollback']) },
    async commitTransaction() { calls.push(['commit']) },
    async getSource(sourceType, id) { calls.push(['source', sourceType, id]); return id === 'cake-123' ? source : null },
    async findInviteBySource() { calls.push(['invite']); return state.invite },
    async findReviewBySource() { calls.push(['review']); return state.review },
    async createInvite(data, _transaction, id) { calls.push(['create', data, id]); state.invite = { $id: id, ...data }; return state.invite },
    async getInvite(id) { return state.invite?.$id === id ? state.invite : null },
  }
}

function createDeliveryRepository() {
  const records = new Map()
  return {
    records,
    async getByEventKey(eventKey) { return records.get(eventKey) || null },
    async getOrCreatePending(identity, at) {
      const existing = records.get(identity.eventKey)
      if (existing) {
        return { kind: 'existing', delivery: existing, decision: existing.status === 'sent'
          ? { kind: 'already_sent' }
          : existing.status === 'pending'
            ? { kind: 'in_progress' }
            : existing.status === 'failed'
              ? { kind: 'retryable' }
              : { kind: 'reconciliation_required' } }
      }
      const delivery = { $id: 'delivery-1', ...identity, status: 'pending', attempts: 0, createdAt: at.toISOString(), updatedAt: at.toISOString() }
      records.set(identity.eventKey, delivery)
      return { kind: 'created', delivery }
    },
    async markAttempt(delivery, at) { Object.assign(delivery, { attempts: delivery.attempts + 1, lastAttemptAt: at.toISOString() }); return delivery },
    async markSent(delivery, { now: at, providerMessageId }) { Object.assign(delivery, { status: 'sent', sentAt: at.toISOString(), providerMessageId }); return delivery },
    async markFailed(delivery, { errorCode }) { Object.assign(delivery, { status: 'failed', lastErrorCode: errorCode }); return delivery },
    async markUncertain(delivery, { errorCode }) { Object.assign(delivery, { status: 'uncertain', lastErrorCode: errorCode }); return delivery },
  }
}

function options(repository, deliveryRepository, overrides = {}) {
  return {
    repository,
    deliveryRepository,
    transport: { async send(payload) { overrides.onSend?.(payload); return { kind: 'accepted', providerMessageId: 'resend-123' } } },
    request: { sourceType: 'cake', sourceReservationId: 'cake-123', customerEmail: 'spoof@example.com', token: 'spoof-token' },
    createdByUserId: 'admin-1',
    tokenEncryptionKey: encryptionKey,
    from: 'Verygood Chocolate <hello@verygood.example>',
    reviewOrigin: 'https://au.verygood-chocolate.com',
    now,
    tokenFactory: () => token,
    idFactory: () => 'invite-123',
  }
}

test('send action re-reads the stored recipient, creates an encrypted token once, and returns a minimal masked result', async () => {
  const repository = createReviewRepository()
  const deliveries = createDeliveryRepository()
  let sentPayload
  const logs = []
  const result = await sendReviewInviteEmail({
    ...options(repository, deliveries, { onSend: (payload) => { sentPayload = payload } }),
    log: (line) => logs.push(line), error: (line) => logs.push(line),
  })

  assert.deepEqual(result, { status: 'sent', sentAt: now.toISOString(), recipientMasked: 's***@example.com' })
  assert.deepEqual(sentPayload.to, ['stored@example.com'])
  assert.equal(sentPayload.text.includes('PRIVATE ADMIN MEMO'), false)
  assert.equal(sentPayload.text.includes('PRIVATE ALLERGY'), false)
  assert.equal(sentPayload.text.includes('PRIVATE EMERGENCY'), false)
  assert.equal(repository.state.invite.tokenHash, hashSecret(token))
  assert.equal(JSON.stringify(repository.state.invite).includes(token), false)
  assert.equal(repository.calls.filter(([name]) => name === 'source').length >= 2, true)
  assert.equal(logs.join('\n').includes(token), false)
  assert.equal(logs.join('\n').includes('stored@example.com'), false)
})

test('send and copy reuse the exact same active token while a sent email never calls transport again', async () => {
  const repository = createReviewRepository()
  const deliveries = createDeliveryRepository()
  let sends = 0
  const first = await sendReviewInviteEmail(options(repository, deliveries, { onSend: () => { sends += 1 } }))
  const copied = await copyReviewInviteRequest({
    repository,
    request: { sourceType: 'cake', sourceReservationId: 'cake-123' },
    createdByUserId: 'admin-1', tokenEncryptionKey: encryptionKey,
    reviewOrigin: 'https://au.verygood-chocolate.com', now, tokenFactory: () => 'B'.repeat(43), idFactory: () => 'invite-other',
  })
  const second = await sendReviewInviteEmail(options(repository, deliveries, { onSend: () => { sends += 1 } }))

  assert.equal(first.status, 'sent')
  assert.equal(second.status, 'already_sent')
  assert.equal(sends, 1)
  assert.match(copied.message, new RegExp(`https://au\\.verygood-chocolate\\.com/review#${token}`))
  assert.equal(copied.message.includes('B'.repeat(43)), false)
})

test('copy before send reuses the same encrypted token and first-send claim allows only one concurrent provider call', async () => {
  const repository = createReviewRepository()
  const deliveries = createDeliveryRepository()
  const copied = await copyReviewInviteRequest({
    repository,
    request: { sourceType: 'cake', sourceReservationId: 'cake-123' },
    createdByUserId: 'admin-1', tokenEncryptionKey: encryptionKey,
    reviewOrigin: 'https://au.verygood-chocolate.com', now, tokenFactory: () => token, idFactory: () => 'invite-123',
  })
  let sends = 0
  const concurrent = await Promise.all([
    sendReviewInviteEmail(options(repository, deliveries, { onSend: () => { sends += 1 } })),
    sendReviewInviteEmail(options(repository, deliveries, { onSend: () => { sends += 1 } })),
  ])

  assert.match(copied.message, new RegExp(`review#${token}`))
  assert.equal(sends, 1)
  assert.deepEqual(new Set(concurrent.map((result) => result.status)), new Set(['sent', 'pending']))
})

test('missing stored email rejects before creating an invite and status hides all ledger internals', async () => {
  const repository = createReviewRepository({ source: { customerEmail: '' } })
  const deliveries = createDeliveryRepository()
  await assert.rejects(
    () => sendReviewInviteEmail(options(repository, deliveries)),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_EMAIL_MISSING',
  )
  assert.equal(repository.state.invite, null)

  const validRepository = createReviewRepository()
  const validDeliveries = createDeliveryRepository()
  await sendReviewInviteEmail(options(validRepository, validDeliveries))
  const status = await getReviewInviteEmailStatus({
    repository: validRepository,
    deliveryRepository: validDeliveries,
    request: { sourceType: 'cake', sourceReservationId: 'cake-123', recipientEmail: 'spoof@example.com' },
    tokenEncryptionKey: encryptionKey,
    now,
  })
  assert.deepEqual(status, { status: 'sent', sentAt: now.toISOString(), recipientMasked: 's***@example.com', recipientAvailable: true })
  for (const forbidden of ['eventKey', 'payloadHash', 'recipientHash', 'providerMessageId', 'tokenCiphertext', 'tokenHash']) {
    assert.equal(forbidden in status, false)
  }
})

test('status reports legacy unrecoverable, expired, and used without silently generating a new token', async () => {
  const cases = [
    [{ $id: 'invite-123', tokenHash: hashSecret(token), expiresAt: '2026-08-18T00:00:00.000Z' }, null, 'legacy_invite_unrecoverable'],
    [{ $id: 'invite-123', expiresAt: now.toISOString() }, null, 'expired'],
    [{ $id: 'invite-123', usedAt: now.toISOString(), expiresAt: '2026-08-18T00:00:00.000Z' }, null, 'used'],
    [null, { $id: 'review-123' }, 'used'],
  ]
  for (const [invite, review, expected] of cases) {
    const repository = createReviewRepository({ invite, review })
    const status = await getReviewInviteEmailStatus({
      repository,
      deliveryRepository: createDeliveryRepository(),
      request: { sourceType: 'cake', sourceReservationId: 'cake-123' },
      tokenEncryptionKey: encryptionKey,
      now,
    })
    assert.deepEqual(status, { status: expected, recipientAvailable: true })
  }
})

test('failed, uncertain, and identity-mismatched invite deliveries never auto-resend', async () => {
  for (const [storedStatus, expected] of [['failed', 'failed'], ['uncertain', 'uncertain']]) {
    const repository = createReviewRepository()
    const deliveries = createDeliveryRepository()
    const eventKey = 'review-invite-customer:cake:cake-123'
    deliveries.records.set(eventKey, {
      $id: 'delivery-1', eventKey, sourceType: 'cake', sourceId: 'cake-123', template: 'review-invite-customer',
      recipientHash: 'ignored-by-test', payloadHash: 'ignored-by-test', status: storedStatus,
    })
    let sends = 0
    const result = await sendReviewInviteEmail(options(repository, deliveries, { onSend: () => { sends += 1 } }))
    assert.equal(result.status, expected)
    assert.equal(sends, 0)
  }

  const repository = createReviewRepository()
  let sends = 0
  const mismatchedDeliveries = {
    async getOrCreatePending() {
      return { kind: 'existing', delivery: {}, decision: { kind: 'identity_mismatch', reason: 'payload_hash' } }
    },
  }
  await assert.rejects(
    () => sendReviewInviteEmail(options(repository, mismatchedDeliveries, { onSend: () => { sends += 1 } })),
    (error) => error instanceof ReviewApiError && error.code === 'REVIEW_INVITE_EMAIL_IDENTITY_MISMATCH',
  )
  assert.equal(sends, 0)
})

test('send rejects non-completed cake/class sources and preserves their reservation rows', async () => {
  for (const source of [
    { $id: 'cake-123', status: '예약확정' },
    { $id: 'class-123', status: 'Confirmed', parentEmail: 'stored@example.com' },
  ]) {
    const sourceType = source.$id.startsWith('class') ? 'class' : 'cake'
    const repository = createReviewRepository({ source })
    repository.getSource = async (_type, id) => id === source.$id ? repository.source : null
    const before = structuredClone(repository.source)
    await assert.rejects(
      () => sendReviewInviteEmail({ ...options(repository, createDeliveryRepository()), request: { sourceType, sourceReservationId: source.$id } }),
      (error) => error instanceof ReviewApiError && error.code === 'REVIEW_SOURCE_NOT_COMPLETED',
    )
    assert.deepEqual(repository.source, before)
    assert.equal(repository.state.invite, null)
  }
})
