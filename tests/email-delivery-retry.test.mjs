import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createEmailDeliveryRetryClaimRepository,
} from '../appwrite-functions/shared/email-delivery-retry-claim-repository.js'
import { retryEmail } from '../appwrite-functions/shared/email-delivery-retry.js'

const NOW = new Date('2026-08-27T01:00:00.000Z')
const IDENTITY = {
  eventKey: 'booking-received-customer:cake:cake-123',
  sourceType: 'cake',
  sourceId: 'cake-123',
  template: 'booking-received-customer',
  recipientHash: 'a'.repeat(64),
  payloadHash: 'b'.repeat(64),
}

function payload() {
  return {
    ...IDENTITY,
    from: 'Verygood <hello@example.com>',
    to: ['customer@example.com'],
    replyTo: null,
    subject: 'Request received',
    text: 'Text',
    html: '<p>Text</p>',
    templateVersion: 'v1',
    idempotencyKey: 'verygood:retry-event',
  }
}

function failedDelivery(overrides = {}) {
  return {
    $id: 'delivery-1',
    ...IDENTITY,
    status: 'failed',
    attempts: 1,
    firstAttemptAt: '2026-08-27T00:00:00.000Z',
    lastAttemptAt: '2026-08-27T00:00:00.000Z',
    lastErrorCode: 'resend_invalid_api_key',
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    ...overrides,
  }
}

function documentsFake() {
  const documents = []
  return {
    documents,
    async listDocuments({ queries }) {
      const eventKey = JSON.parse(queries[0]).values[0]
      return { documents: documents.filter((record) => record.eventKey === eventKey) }
    },
    async createDocument({ documentId, data }) {
      if (documents.some((record) => record.eventKey === data.eventKey)) {
        throw Object.assign(new Error('unique conflict'), { code: 409 })
      }
      const created = { $id: documentId, ...data }
      documents.push(created)
      return created
    },
    async updateDocument({ documentId, data }) {
      const record = documents.find((value) => value.$id === documentId)
      Object.assign(record, data)
      return record
    },
  }
}

test('one unique retry claim wins and a concurrent caller receives the persisted claim', async () => {
  const databases = documentsFake()
  let id = 0
  const repository = createEmailDeliveryRetryClaimRepository({
    databases, databaseId: 'cake_db', collectionId: 'email_delivery_retry_claims', idFactory: () => 'claim-' + (++id),
  })

  const [first, second] = await Promise.all([
    repository.getOrCreateClaim({ ...IDENTITY, claimedByUserId: 'admin-1' }, NOW),
    repository.getOrCreateClaim({ ...IDENTITY, claimedByUserId: 'admin-2' }, NOW),
  ])

  assert.equal(first.kind, 'created')
  assert.equal(second.kind, 'existing')
  assert.equal(databases.documents.length, 1)
  assert.deepEqual(databases.documents[0], {
    $id: 'claim-1',
    eventKey: IDENTITY.eventKey,
    sourceType: 'cake',
    sourceId: 'cake-123',
    template: 'booking-received-customer',
    status: 'pending',
    claimedByUserId: 'admin-1',
    claimedAt: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  })
})

test('a created retry claim is the only caller that records attempt two and invokes transport', async () => {
  const delivery = failedDelivery()
  const attempts = []
  let sends = 0
  const result = await retryEmail({
    payload: payload(),
    delivery,
    deliveryRepository: {
      async markAttempt(record, now) {
        attempts.push(record)
        Object.assign(record, { attempts: record.attempts + 1, lastAttemptAt: now.toISOString(), updatedAt: now.toISOString() })
        return record
      },
      async markSent(record, { now, providerMessageId }) {
        Object.assign(record, { status: 'sent', sentAt: now.toISOString(), providerMessageId })
        return record
      },
      async markFailed() { throw new Error('must not fail') },
      async markUncertain() { throw new Error('must not be uncertain') },
    },
    retryClaimRepository: {
      async getOrCreateClaim() { return { kind: 'created', claim: { $id: 'claim-1', eventKey: IDENTITY.eventKey } } },
      async markCompleted() {},
    },
    claimedByUserId: 'admin-1',
    transport: { async send(message) { sends += 1; assert.equal(message.idempotencyKey, 'verygood:retry-event'); return { kind: 'accepted', providerMessageId: 'resend-1' } } },
    now: NOW,
  })

  assert.equal(sends, 1)
  assert.equal(attempts.length, 1)
  assert.equal(delivery.attempts, 2)
  assert.equal(delivery.firstAttemptAt, '2026-08-27T00:00:00.000Z')
  assert.deepEqual(result, { status: 'sent', retry: 'not_needed', sentAt: NOW.toISOString() })
})

test('claim conflict does not increment attempts or call the provider', async () => {
  const delivery = failedDelivery()
  let sends = 0
  const result = await retryEmail({
    payload: payload(),
    delivery,
    deliveryRepository: { async markAttempt() { throw new Error('must not mark attempt') } },
    retryClaimRepository: {
      async getOrCreateClaim() { return { kind: 'existing', claim: { eventKey: IDENTITY.eventKey, claimedAt: NOW.toISOString() } } },
    },
    claimedByUserId: 'admin-1',
    transport: { async send() { sends += 1 } },
    now: NOW,
  })

  assert.equal(sends, 0)
  assert.equal(delivery.attempts, 1)
  assert.equal(result.status, 'pending')
  assert.equal(result.retry, 'manual_fallback')
})
