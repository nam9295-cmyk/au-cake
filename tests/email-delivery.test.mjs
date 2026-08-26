import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildEmailDeliveryEventKey,
  decideEmailDelivery,
  EMAIL_DELIVERY_PENDING_LEASE_MS,
  EmailDeliveryError,
  normalizeRecipientEmail,
  normalizeRecipientEmailSet,
  payloadHashForEmail,
  recipientHashForEmail,
  recipientHashForEmailSet,
  resendIdempotencyKeyForEvent,
} from '../appwrite-functions/shared/email-delivery.js'
import { createEmailDeliveryRepository } from '../appwrite-functions/shared/email-delivery-repository.js'

const NOW = new Date('2026-08-26T01:02:03.000Z')
const RECIPIENT_HASH = 'a'.repeat(64)
const PAYLOAD_HASH = 'b'.repeat(64)

function identity(overrides = {}) {
  return {
    eventKey: 'booking-received-customer:cake:cake-123',
    sourceType: 'cake',
    sourceId: 'cake-123',
    template: 'booking-received-customer',
    recipientHash: RECIPIENT_HASH,
    payloadHash: PAYLOAD_HASH,
    ...overrides,
  }
}

function delivery(status, overrides = {}) {
  return {
    $id: 'delivery-123',
    ...identity(),
    status,
    attempts: 0,
    createdAt: '2026-08-26T01:00:00.000Z',
    updatedAt: '2026-08-26T01:00:00.000Z',
    ...overrides,
  }
}

function payload(overrides = {}) {
  return {
    from: 'Verygood Chocolate <hello@verygood.example>',
    recipientEmail: ' TEST@Example.com ',
    replyTo: 'hello@verygood.example',
    subject: 'Your booking',
    text: 'Thanks for booking.',
    html: '<p>Thanks for booking.</p>',
    template: 'booking-received-customer',
    templateVersion: 'v1',
    ...overrides,
  }
}

test('event keys are deterministic and reserve distinct namespaces for every planned customer and operator event', () => {
  assert.equal(
    buildEmailDeliveryEventKey({ template: 'booking-received-operator', sourceType: 'cake', sourceId: 'cake-123' }),
    'booking-received-operator:cake:cake-123',
  )
  const keys = new Set([
    buildEmailDeliveryEventKey({ template: 'booking-received-operator', sourceType: 'cake', sourceId: 'cake-123' }),
    buildEmailDeliveryEventKey({ template: 'booking-received-customer', sourceType: 'cake', sourceId: 'cake-123' }),
    buildEmailDeliveryEventKey({ template: 'booking-received-operator', sourceType: 'class', sourceId: 'class-123' }),
    buildEmailDeliveryEventKey({ template: 'booking-received-customer', sourceType: 'class', sourceId: 'class-123' }),
    buildEmailDeliveryEventKey({ template: 'booking-confirmed-customer', sourceType: 'cake', sourceId: 'cake-123' }),
    buildEmailDeliveryEventKey({ template: 'booking-confirmed-customer', sourceType: 'class', sourceId: 'class-123' }),
    buildEmailDeliveryEventKey({ template: 'review-invite-customer', sourceType: 'cake', sourceId: 'cake-123' }),
    buildEmailDeliveryEventKey({ template: 'review-invite-customer', sourceType: 'class', sourceId: 'class-123' }),
    buildEmailDeliveryEventKey({ template: 'review-reward-customer', sourceType: 'review', sourceId: 'review-123' }),
  ])
  assert.equal(keys.size, 9)
  assert.throws(
    () => buildEmailDeliveryEventKey({ template: 'review-reward-customer', sourceType: 'cake', sourceId: 'cake-123' }),
    (error) => error instanceof EmailDeliveryError && error.code === 'INVALID_EMAIL_DELIVERY_EVENT',
  )
  assert.throws(
    () => buildEmailDeliveryEventKey({ template: 'booking-received-customer', sourceType: 'cake', sourceId: '../other' }),
    (error) => error instanceof EmailDeliveryError && error.code === 'INVALID_EMAIL_DELIVERY_SOURCE_ID',
  )
})

test('recipient identity trims and lowercases a valid email before SHA-256 hashing', () => {
  assert.equal(normalizeRecipientEmail(' TEST@Example.com '), 'test@example.com')
  assert.equal(
    recipientHashForEmail(' TEST@Example.com '),
    '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
  )
  assert.equal(recipientHashForEmail(' TEST@Example.com '), recipientHashForEmail('test@example.com'))
})

test('recipient identity rejects invalid, overlong, and non-string email input before hashing', () => {
  for (const value of ['', '  ', 'not-an-email', 'name@example', 'a'.repeat(110) + '@example.com', null, {}]) {
    assert.throws(
      () => recipientHashForEmail(value),
      (error) => error instanceof EmailDeliveryError && error.code === 'INVALID_RECIPIENT_EMAIL',
    )
  }
})

test('operator recipient identity canonicalizes an email set independently of input order', () => {
  assert.deepEqual(
    normalizeRecipientEmailSet([' SECOND@example.com ', 'first@example.com', 'second@example.com']),
    ['first@example.com', 'second@example.com'],
  )
  assert.equal(
    recipientHashForEmailSet([' SECOND@example.com ', 'first@example.com']),
    recipientHashForEmailSet(['first@example.com', 'second@example.com']),
  )
  assert.throws(
    () => normalizeRecipientEmailSet([]),
    (error) => error instanceof EmailDeliveryError && error.code === 'INVALID_RECIPIENT_EMAIL',
  )
})

test('provider payload hash includes a canonical multi-recipient set and event keys derive distinct safe idempotency keys', () => {
  const first = {
    ...payload(),
    recipientEmail: undefined,
    recipientEmails: ['owner@example.com', ' SECOND@example.com '],
  }
  const reordered = {
    ...payload(),
    recipientEmail: undefined,
    recipientEmails: ['second@example.com', 'owner@example.com'],
  }
  assert.equal(payloadHashForEmail(first), payloadHashForEmail(reordered))
  assert.notEqual(
    payloadHashForEmail(first),
    payloadHashForEmail({ ...reordered, recipientEmails: ['owner@example.com'] }),
  )

  const operatorKey = buildEmailDeliveryEventKey({ template: 'booking-received-operator', sourceType: 'cake', sourceId: 'cake-123' })
  const customerKey = buildEmailDeliveryEventKey({ template: 'booking-received-customer', sourceType: 'cake', sourceId: 'cake-123' })
  assert.match(resendIdempotencyKeyForEvent(operatorKey), /^verygood:[a-f0-9]{64}$/)
  assert.equal(resendIdempotencyKeyForEvent(operatorKey), resendIdempotencyKeyForEvent(operatorKey))
  assert.notEqual(resendIdempotencyKeyForEvent(operatorKey), resendIdempotencyKeyForEvent(customerKey))
})

test('provider payload hash is deterministic across property order and records every meaningful message field', () => {
  const first = payload()
  const reordered = {
    html: '<p>Thanks for booking.</p>',
    templateVersion: 'v1',
    subject: 'Your booking',
    recipientEmail: 'test@example.com',
    text: 'Thanks for booking.',
    replyTo: 'hello@verygood.example',
    from: 'Verygood Chocolate <hello@verygood.example>',
    template: 'booking-received-customer',
  }
  assert.equal(payloadHashForEmail(first), payloadHashForEmail(reordered))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ text: 'Changed text.' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ html: '<p>Changed HTML.</p>' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ subject: 'Changed subject' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ from: 'Other <hello@verygood.example>' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ replyTo: 'other@verygood.example' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ recipientEmail: 'other@example.com' })))
  assert.notEqual(payloadHashForEmail(first), payloadHashForEmail(payload({ templateVersion: 'v2' })))
})

test('delivery state decisions block duplicate sends and fail closed on identity changes', () => {
  assert.deepEqual(decideEmailDelivery(null, identity(), NOW), { kind: 'create_pending' })
  assert.deepEqual(decideEmailDelivery(delivery('sent'), identity(), NOW), { kind: 'already_sent' })
  assert.deepEqual(decideEmailDelivery(delivery('failed'), identity(), NOW), { kind: 'retryable' })
  assert.deepEqual(decideEmailDelivery(delivery('uncertain'), identity(), NOW), { kind: 'reconciliation_required' })
  assert.deepEqual(
    decideEmailDelivery(delivery('sent'), identity({ recipientHash: 'c'.repeat(64) }), NOW),
    { kind: 'identity_mismatch', reason: 'recipient_hash' },
  )
  assert.deepEqual(
    decideEmailDelivery(delivery('sent'), identity({ payloadHash: 'd'.repeat(64) }), NOW),
    { kind: 'identity_mismatch', reason: 'payload_hash' },
  )
})

test('fresh pending delivery remains in progress while stale pending requires reconciliation rather than a second send', () => {
  assert.equal(EMAIL_DELIVERY_PENDING_LEASE_MS, 300_000)
  assert.deepEqual(
    decideEmailDelivery(delivery('pending', { lastAttemptAt: '2026-08-26T00:59:00.000Z' }), identity(), NOW),
    { kind: 'in_progress' },
  )
  assert.deepEqual(
    decideEmailDelivery(delivery('pending', { lastAttemptAt: '2026-08-26T00:57:03.000Z' }), identity(), NOW),
    { kind: 'reconciliation_required', reason: 'stale_pending' },
  )
})

function createConcurrentDocumentsFake() {
  const documents = []
  let listCallsBeforeCreate = 0
  let releaseLists
  const bothListsStarted = new Promise((resolve) => { releaseLists = resolve })

  return {
    documents,
    async listDocuments({ queries }) {
      const eventKey = JSON.parse(queries[0]).values[0]
      if (documents.length === 0) {
        listCallsBeforeCreate += 1
        if (listCallsBeforeCreate === 2) releaseLists()
        await bothListsStarted
      }
      return { documents: documents.filter((entry) => entry.eventKey === eventKey) }
    },
    async createDocument({ documentId, data }) {
      if (documents.some((entry) => entry.eventKey === data.eventKey)) {
        throw Object.assign(new Error('duplicate event key'), { code: 409 })
      }
      const created = { $id: documentId, ...data }
      documents.push(created)
      return created
    },
    async updateDocument({ documentId, data }) {
      const current = documents.find((entry) => entry.$id === documentId)
      Object.assign(current, data)
      return current
    },
  }
}

test('concurrent unique event-key creation returns the stored delivery instead of creating a duplicate row', async () => {
  const databases = createConcurrentDocumentsFake()
  let nextId = 0
  const repository = createEmailDeliveryRepository({
    databases,
    databaseId: 'cake_db',
    collectionId: 'email_deliveries',
    idFactory: () => `delivery-${++nextId}`,
  })
  const [first, second] = await Promise.all([
    repository.getOrCreatePending(identity(), NOW),
    repository.getOrCreatePending(identity(), NOW),
  ])

  assert.equal(first.kind, 'created')
  assert.equal(second.kind, 'existing')
  assert.equal(second.decision.kind, 'in_progress')
  assert.equal(databases.documents.length, 1)
  assert.deepEqual(databases.documents[0], {
    $id: 'delivery-1',
    ...identity(),
    status: 'pending',
    attempts: 0,
    createdAt: '2026-08-26T01:02:03.000Z',
    updatedAt: '2026-08-26T01:02:03.000Z',
  })
})

test('repository transition helpers persist only delivery status metadata and never a raw recipient email', async () => {
  const databases = createConcurrentDocumentsFake()
  const repository = createEmailDeliveryRepository({
    databases,
    databaseId: 'cake_db',
    collectionId: 'email_deliveries',
    idFactory: () => 'delivery-1',
  })
  const created = await repository.createPending(identity(), NOW)
  const attempted = await repository.markAttempt(created, new Date('2026-08-26T01:03:03.000Z'))
  const failed = await repository.markFailed(attempted, { now: new Date('2026-08-26T01:03:04.000Z'), errorCode: 'provider_timeout' })
  const uncertain = await repository.markUncertain(failed, { now: new Date('2026-08-26T01:03:05.000Z'), errorCode: 'provider_unknown' })
  const sent = await repository.markSent(uncertain, { now: new Date('2026-08-26T01:03:06.000Z'), providerMessageId: 'email-123' })

  assert.deepEqual(sent, {
    $id: 'delivery-1',
    ...identity(),
    status: 'sent',
    attempts: 1,
    createdAt: '2026-08-26T01:02:03.000Z',
    updatedAt: '2026-08-26T01:03:06.000Z',
    lastAttemptAt: '2026-08-26T01:03:03.000Z',
    lastErrorCode: null,
    sentAt: '2026-08-26T01:03:06.000Z',
    providerMessageId: 'email-123',
  })
  assert.equal(Object.hasOwn(sent, 'recipientEmail'), false)
})
