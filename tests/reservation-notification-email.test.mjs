import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBookingDeliveryPayload,
  createResendTransport,
  createReservationNotificationHandler,
  createRuntimeEmailDeliveryRepository,
  deliverBookingEmail,
  deliverBookingEmails,
  ResendTransportError,
} from '../appwrite-functions/reservation-notification/src/main.js'

const NOW = new Date('2026-08-26T01:02:03.000Z')
const FROM = 'Verygood Chocolate <hello@verygood.example>'
const OPERATOR_RECIPIENTS = ['owner@example.com', 'second-owner@example.com']

function cakeReservation(overrides = {}) {
  return {
    $id: 'cake-123',
    reservationNumber: 'VG-C-AU-20260826-123456789',
    customerName: 'Alice Customer',
    customerEmail: ' ALICE@example.com ',
    customerPhone: '0400000000',
    productId: 'pave-cake',
    cakeSize: '19cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 2,
    pickupDate: '2026-09-12',
    pickupTime: '10:30',
    requestNote: 'Please add a short note.',
    totalPriceCents: 15000,
    adminMemo: 'INTERNAL ADMIN NOTE',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function classReservation(overrides = {}) {
  return {
    $id: 'class-123',
    reservationNumber: 'VG-KC-AU-20260826-123456789',
    classType: 'school-holiday-private-cake-class',
    coursePlan: 'basic-advanced-package',
    classDate: '2026-09-12',
    classTime: '10:00',
    durationMinutes: 120,
    advancedClassDate: '2026-09-19',
    advancedClassTime: '13:00',
    advancedDurationMinutes: 150,
    parentName: 'Pat Parent',
    parentEmail: ' PARENT@example.com ',
    childName: 'Charlie Child',
    allergyNote: 'PRIVATE ALLERGY DETAIL',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    totalPriceCents: 28510,
    adminMemo: 'INTERNAL ADMIN NOTE',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function message(reservation, role, overrides = {}) {
  return buildBookingDeliveryPayload({
    reservation,
    role,
    from: FROM,
    operatorRecipients: OPERATOR_RECIPIENTS,
    replyTo: 'reply@verygood.example',
    ...overrides,
  })
}

function createMemoryRepository() {
  const records = new Map()
  let sequence = 0
  return {
    records,
    async getOrCreatePending(identity, now) {
      const existing = records.get(identity.eventKey)
      if (existing) {
        if (existing.recipientHash !== identity.recipientHash || existing.payloadHash !== identity.payloadHash) {
          return { kind: 'existing', delivery: existing, decision: { kind: 'identity_mismatch', reason: 'payload_hash' } }
        }
        return {
          kind: 'existing',
          delivery: existing,
          decision: existing.status === 'sent'
            ? { kind: 'already_sent' }
            : existing.status === 'failed'
              ? { kind: 'retryable' }
              : existing.status === 'uncertain'
                ? { kind: 'reconciliation_required' }
                : { kind: 'in_progress' },
        }
      }
      const delivery = {
        $id: `delivery-${++sequence}`,
        ...identity,
        status: 'pending',
        attempts: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      records.set(identity.eventKey, delivery)
      return { kind: 'created', delivery }
    },
    async markAttempt(delivery, now) {
      Object.assign(delivery, { attempts: delivery.attempts + 1, lastAttemptAt: now.toISOString(), updatedAt: now.toISOString() })
      return delivery
    },
    async markSent(delivery, { now, providerMessageId }) {
      Object.assign(delivery, { status: 'sent', providerMessageId, sentAt: now.toISOString(), updatedAt: now.toISOString(), lastErrorCode: null })
      return delivery
    },
    async markFailed(delivery, { now, errorCode }) {
      Object.assign(delivery, { status: 'failed', lastErrorCode: errorCode, updatedAt: now.toISOString() })
      return delivery
    },
    async markUncertain(delivery, { now, errorCode }) {
      Object.assign(delivery, { status: 'uncertain', lastErrorCode: errorCode, updatedAt: now.toISOString() })
      return delivery
    },
  }
}

test('cake operator and customer booking receipts are distinct, ledger-backed messages', () => {
  const operator = message(cakeReservation(), 'operator')
  const customer = message(cakeReservation(), 'customer')

  assert.deepEqual(operator.to, ['owner@example.com', 'second-owner@example.com'])
  assert.deepEqual(customer.to, ['alice@example.com'])
  assert.equal(operator.eventKey, 'booking-received-operator:cake:cake-123')
  assert.equal(customer.eventKey, 'booking-received-customer:cake:cake-123')
  assert.notEqual(operator.idempotencyKey, customer.idempotencyKey)
  assert.equal(operator.subject, '[Verygood Chocolate AU] New cake request VG-C-AU-20260826-123456789')
  assert.equal(customer.subject, 'We’ve received your Verygood Chocolate booking request')
  assert.match(customer.text, /booking request has been received/i)
  assert.match(customer.text, /final confirmation/i)
  assert.match(customer.text, /Pave Chocolate Cake/)
  assert.match(customer.text, /7\.5&quot;|7\.5" \| serves 14/)
  assert.match(customer.text, /Pick-up location: Melrose Park, Sydney/)
})

test('class customer booking receipt uses the parent email and includes both package sessions', () => {
  const operator = message(classReservation(), 'operator')
  const customer = message(classReservation(), 'customer')

  assert.deepEqual(operator.to, ['owner@example.com', 'second-owner@example.com'])
  assert.deepEqual(customer.to, ['parent@example.com'])
  assert.equal(operator.eventKey, 'booking-received-operator:class:class-123')
  assert.equal(customer.eventKey, 'booking-received-customer:class:class-123')
  assert.equal(customer.subject, 'We’ve received your Verygood Kids Class booking request')
  assert.match(customer.text, /Charlie Child/)
  assert.match(customer.text, /First session: 2026-09-12 10:00/)
  assert.match(customer.text, /Advanced session: 2026-09-19 13:00/)
  assert.match(customer.text, /payment details/i)
  assert.match(customer.text, /allergy information/i)
})

test('customer booking receipts are allowlisted and sanitize dynamic HTML and text values', () => {
  const payload = message(cakeReservation({
    customerName: 'Alice <b>\nFORGED',
    requestNote: 'Note\r\nTotal: AUD 0.00 <script>bad()</script>',
  }), 'customer')

  for (const forbidden of ['INTERNAL ADMIN NOTE', 'PRIVATE EMERGENCY CONTACT', 'private_database_id', '0400000000']) {
    assert.doesNotMatch(payload.text, new RegExp(forbidden))
    assert.doesNotMatch(payload.html, new RegExp(forbidden))
  }
  assert.doesNotMatch(payload.html, /<script>bad\(\)<\/script>/)
  assert.match(payload.html, /&lt;b&gt; FORGED/)
  assert.doesNotMatch(payload.text, /^Total: AUD 0\.00$/m)
  assert.match(payload.text, /Note Total: AUD 0\.00 <script>bad\(\)<\/script>/)

  const classPayload = message(classReservation(), 'customer')
  for (const forbidden of ['INTERNAL ADMIN NOTE', 'PRIVATE ALLERGY DETAIL', 'PRIVATE EMERGENCY CONTACT', 'private_database_id']) {
    assert.doesNotMatch(classPayload.text, new RegExp(forbidden))
    assert.doesNotMatch(classPayload.html, new RegExp(forbidden))
  }
})

test('only the first pending claim sends; existing sent, pending, failed, stale, and uncertain records are not retried', async () => {
  const payload = message(cakeReservation(), 'customer')
  const repository = createMemoryRepository()
  let sends = 0
  const transport = { async send() { sends += 1; return { kind: 'accepted', providerMessageId: 'email-123' } } }

  const [first, second] = await Promise.all([
    deliverBookingEmail({ payload, repository, transport, now: NOW }),
    deliverBookingEmail({ payload, repository, transport, now: NOW }),
  ])
  assert.equal(sends, 1)
  assert.deepEqual([first.status, second.status].sort(), ['in_progress', 'sent'])

  for (const status of ['sent', 'pending', 'failed', 'uncertain']) {
    repository.records.set(payload.eventKey, { ...repository.records.get(payload.eventKey), status })
    const result = await deliverBookingEmail({ payload, repository, transport, now: NOW })
    assert.notEqual(result.status, 'sent')
    assert.equal(sends, 1)
  }
})

test('payload identity changes fail closed before transport and response outcomes use the safe ledger states', async () => {
  const payload = message(cakeReservation(), 'customer')
  const repository = createMemoryRepository()
  let sends = 0
  const transport = { async send() { sends += 1; return { kind: 'accepted', providerMessageId: 'email-123' } } }
  await deliverBookingEmail({ payload, repository, transport, now: NOW })

  const changed = { ...payload, text: `${payload.text}\nchanged`, payloadHash: 'f'.repeat(64) }
  const mismatch = await deliverBookingEmail({ payload: changed, repository, transport, now: NOW })
  assert.equal(mismatch.status, 'identity_mismatch')
  assert.equal(sends, 1)

  const failedRepository = createMemoryRepository()
  const failed = await deliverBookingEmail({
    payload: message(cakeReservation({ $id: 'cake-124' }), 'customer'),
    repository: failedRepository,
    transport: { async send() { throw new ResendTransportError('failed', 'resend_http_422') } },
    now: NOW,
  })
  assert.equal(failed.status, 'failed')
  assert.equal([...failedRepository.records.values()][0].lastErrorCode, 'resend_http_422')

  const uncertainRepository = createMemoryRepository()
  const uncertain = await deliverBookingEmail({
    payload: message(cakeReservation({ $id: 'cake-125' }), 'customer'),
    repository: uncertainRepository,
    transport: { async send() { throw new Error('socket timeout') } },
    now: NOW,
  })
  assert.equal(uncertain.status, 'uncertain')
  assert.equal([...uncertainRepository.records.values()][0].lastErrorCode, 'resend_network_uncertain')
})

test('operator and customer delivery failures are independent', async () => {
  const repository = createMemoryRepository()
  const cake = cakeReservation()
  const outcomes = await deliverBookingEmails({
    payloads: [message(cake, 'operator'), message(cake, 'customer')],
    repository,
    transport: {
      async send(payload) {
        if (payload.template === 'booking-received-operator') throw new ResendTransportError('failed', 'resend_http_422')
        return { kind: 'accepted', providerMessageId: 'customer-message' }
      },
    },
    now: NOW,
  })
  assert.deepEqual(outcomes.map(({ status }) => status), ['failed', 'sent'])

  const reverseRepository = createMemoryRepository()
  const reverseOutcomes = await deliverBookingEmails({
    payloads: [message(cakeReservation(), 'operator'), message(cakeReservation(), 'customer')],
    repository: reverseRepository,
    transport: {
      async send(payload) {
        if (payload.template === 'booking-received-customer') throw new ResendTransportError('failed', 'resend_http_422')
        return { kind: 'accepted', providerMessageId: 'operator-message' }
      },
    },
    now: NOW,
  })
  assert.deepEqual(reverseOutcomes.map(({ status }) => status), ['sent', 'failed'])
})

test('stale pending and uncertain existing delivery records require reconciliation without an automatic resend', async () => {
  const payload = message(cakeReservation(), 'customer')
  let sends = 0
  const repository = {
    async getOrCreatePending() {
      return {
        kind: 'existing',
        delivery: { $id: 'delivery-1', status: 'pending' },
        decision: { kind: 'reconciliation_required', reason: 'stale_pending' },
      }
    },
  }
  const result = await deliverBookingEmail({
    payload,
    repository,
    transport: { async send() { sends += 1; return { kind: 'accepted', providerMessageId: 'must-not-send' } } },
    now: NOW,
  })
  assert.equal(result.status, 'reconciliation_required')
  assert.equal(sends, 0)
})

test('Resend transport sends separate requests with the documented deterministic idempotency header and no network fake', async () => {
  const payload = message(cakeReservation(), 'customer')
  let received
  const transport = createResendTransport({
    apiKey: 'test_resend_secret',
    post: async (url, body, headers) => {
      received = { url, body, headers }
      return { id: 'resend-message-123' }
    },
  })
  const result = await transport.send(payload)
  assert.deepEqual(result, { kind: 'accepted', providerMessageId: 'resend-message-123' })
  assert.equal(received.url, 'https://api.resend.com/emails')
  assert.equal(received.headers['Idempotency-Key'], payload.idempotencyKey)
  assert.equal(received.headers.Authorization, 'Bearer test_resend_secret')
  assert.deepEqual(received.body.to, ['alice@example.com'])
})

test('Resend transport records clear 4xx provider rejections as failed but keeps ambiguous outcomes uncertain', async () => {
  const payload = message(cakeReservation(), 'customer')
  for (const statusCode of [413, 415, 431]) {
    const transport = createResendTransport({
      apiKey: 'test_resend_secret',
      post: async () => { throw { statusCode } },
    })
    await assert.rejects(
      () => transport.send(payload),
      (error) => error instanceof ResendTransportError && error.kind === 'failed' && error.code === `resend_http_${statusCode}`,
    )
  }

  for (const statusCode of [408, 409]) {
    const transport = createResendTransport({
      apiKey: 'test_resend_secret',
      post: async () => { throw { statusCode } },
    })
    await assert.rejects(
      () => transport.send(payload),
      (error) => error instanceof ResendTransportError && error.kind === 'uncertain' && error.code === `resend_http_${statusCode}`,
    )
  }
})

test('runtime ledger client requires only the dynamic x-appwrite-key and handler keeps key and secrets out of logs', async () => {
  const seen = []
  const fakeDatabases = { listDocuments() {}, createDocument() {}, updateDocument() {} }
  const req = { headers: { 'x-appwrite-key': 'dynamic_function_key' } }
  const repository = createRuntimeEmailDeliveryRepository({
    req,
    env: {
      APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.example/v1',
      APPWRITE_FUNCTION_PROJECT_ID: 'project_id',
      APPWRITE_CAKE_DATABASE_ID: 'cake_db',
      APPWRITE_EMAIL_DELIVERIES_TABLE_ID: 'email_deliveries',
      APPWRITE_API_KEY: 'must_not_be_used',
    },
    createDatabases: ({ apiKey }) => {
      seen.push(apiKey)
      return fakeDatabases
    },
  })
  assert.equal(typeof repository.getOrCreatePending, 'function')
  assert.deepEqual(seen, ['dynamic_function_key'])
  assert.throws(
    () => createRuntimeEmailDeliveryRepository({ req: { headers: {} }, env: {} }),
    /EMAIL_DELIVERY_CONFIGURATION_ERROR/,
  )

  const logs = []
  const handler = createReservationNotificationHandler({
    env: {
      RESEND_API_KEY: 'test_resend_secret', RESEND_FROM_EMAIL: FROM, RESEND_TO_EMAILS: 'owner@example.com',
    },
    createLedgerRepository: () => createMemoryRepository(),
    createTransport: () => ({ async send() { return { kind: 'accepted', providerMessageId: 'message-123' } } }),
    now: () => NOW,
  })
  const response = await handler({
    req: { bodyJson: cakeReservation() },
    res: { json(value) { return value } },
    log(value) { logs.push(value) },
    error(value) { logs.push(value) },
  })
  assert.equal(response.ok, true)
  assert.equal(response.id, 'message-123')
  assert.equal(response.deliveries.operator.status, 'sent')
  assert.equal(response.deliveries.customer.status, 'sent')
  assert.equal(logs.join('\n').includes('test_resend_secret'), false)
  assert.equal(logs.join('\n').includes('dynamic_function_key'), false)
})

test('missing cake customerEmail and invalid class parentEmail never block the operator booking receipt', async () => {
  const handler = createReservationNotificationHandler({
    env: { RESEND_API_KEY: 'test_resend_secret', RESEND_FROM_EMAIL: FROM, RESEND_TO_EMAILS: 'owner@example.com' },
    createLedgerRepository: () => createMemoryRepository(),
    createTransport: () => ({ async send() { return { kind: 'accepted', providerMessageId: 'operator-message' } } }),
    now: () => NOW,
  })
  for (const reservation of [cakeReservation({ customerEmail: '' }), classReservation({ parentEmail: 'not-an-email' })]) {
    const response = await handler({
      req: { bodyJson: reservation },
      res: { json(value) { return value } },
      log() {},
      error() {},
    })
    assert.equal(response.ok, true)
    assert.equal(response.deliveries.operator.status, 'sent')
    assert.equal(response.deliveries.customer.status, 'skipped_invalid_recipient')
  }

  const repository = createMemoryRepository()
  const result = await deliverBookingEmails({
    payloads: [
      message(cakeReservation({ customerEmail: '' }), 'operator'),
      null,
    ],
    repository,
    transport: { async send() { return { kind: 'accepted', providerMessageId: 'operator-message' } } },
    now: NOW,
  })
  assert.deepEqual(result.map(({ status }) => status), ['sent', 'skipped_invalid_recipient'])
})
