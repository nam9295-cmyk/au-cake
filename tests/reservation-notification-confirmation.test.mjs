import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBookingConfirmationPayload,
  buildBookingDeliveryPayload,
  createReservationNotificationHandler,
  createRuntimeReservationRepository,
  ResendTransportError,
} from '../appwrite-functions/reservation-notification/src/main.js'

const NOW = new Date('2026-08-26T01:02:03.000Z')
const FROM = 'Verygood Chocolate <hello@verygood.example>'
const ENV = {
  RESEND_API_KEY: 'test_resend_secret',
  RESEND_FROM_EMAIL: FROM,
  RESEND_TO_EMAILS: 'owner@example.com',
  REVIEW_ADMIN_USER_IDS: 'admin-1,admin-2',
}

function cake(overrides = {}) {
  return {
    $id: 'cake-123', reservationNumber: 'VG-C-AU-20260826-123456789',
    customerName: 'Alice Customer', customerEmail: ' ALICE@example.com ',
    customerPhone: '0400000000', productId: 'pave-cake', cakeSize: '19cm',
    chocolateType: 'dark', poundAddon: 'none', quantity: 2,
    pickupDate: '2026-09-12', pickupTime: '10:30', totalPriceCents: 15000,
    requestNote: 'Please add a short note.', status: '예약확정',
    adminMemo: 'INTERNAL ADMIN NOTE', emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function classReservation(overrides = {}) {
  return {
    $id: 'class-123', reservationNumber: 'VG-KC-AU-20260826-123456789',
    classType: 'school-holiday-private-cake-class', coursePlan: 'basic-advanced-package',
    classDate: '2026-09-12', classTime: '10:00', durationMinutes: 120,
    advancedClassDate: '2026-09-19', advancedClassTime: '13:00', advancedDurationMinutes: 150,
    parentName: 'Pat Parent', parentEmail: ' PARENT@example.com ', childName: 'Charlie Child',
    allergyNote: 'PRIVATE ALLERGY DETAIL', emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    totalPriceCents: 28510, status: 'Confirmed', adminMemo: 'INTERNAL ADMIN NOTE',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function memoryLedger() {
  const records = new Map()
  let sequence = 0
  const decision = (record, identity) => {
    if (record.recipientHash !== identity.recipientHash || record.payloadHash !== identity.payloadHash) return { kind: 'identity_mismatch' }
    if (record.status === 'sent') return { kind: 'already_sent' }
    if (record.status === 'failed') return { kind: 'retryable' }
    if (record.status === 'uncertain') return { kind: 'reconciliation_required' }
    return { kind: 'in_progress' }
  }
  return {
    records,
    async getByEventKey(eventKey) { return records.get(eventKey) || null },
    async getOrCreatePending(identity, now) {
      const existing = records.get(identity.eventKey)
      if (existing) return { kind: 'existing', delivery: existing, decision: decision(existing, identity) }
      const delivery = { $id: `delivery-${++sequence}`, ...identity, status: 'pending', attempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() }
      records.set(identity.eventKey, delivery)
      return { kind: 'created', delivery }
    },
    async markAttempt(delivery, now) { Object.assign(delivery, {
      attempts: delivery.attempts + 1,
      ...(delivery.firstAttemptAt ? {} : { firstAttemptAt: now.toISOString() }),
      lastAttemptAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }); return delivery },
    async markSent(delivery, { now, providerMessageId }) { Object.assign(delivery, { status: 'sent', sentAt: now.toISOString(), updatedAt: now.toISOString(), providerMessageId, lastErrorCode: null }); return delivery },
    async markFailed(delivery, { now, errorCode }) { Object.assign(delivery, { status: 'failed', updatedAt: now.toISOString(), lastErrorCode: errorCode }); return delivery },
    async markUncertain(delivery, { now, errorCode }) { Object.assign(delivery, { status: 'uncertain', updatedAt: now.toISOString(), lastErrorCode: errorCode }); return delivery },
  }
}

function request(action, sourceType, reservationId, headers = { 'x-appwrite-user-id': 'admin-1' }, emailKind) {
  return { bodyJson: { action, data: { sourceType, reservationId, ...(emailKind ? { emailKind } : {}) } }, headers }
}

function response() { return { json(value) { return value } } }

function handler({
  reservations,
  ledger = memoryLedger(),
  retryClaims = { async getByEventKey() { return null }, async getOrCreateClaim(identity) { return { kind: 'created', claim: { $id: 'claim-1', ...identity } } }, async markCompleted() {} },
  send = async () => ({ kind: 'accepted', providerMessageId: 'message-123' }),
  env = ENV,
} = {}) {
  const reads = []
  return {
    reads,
    ledger,
    handle: createReservationNotificationHandler({
      env,
      now: () => NOW,
      createReservationRepository: () => ({
        async getReservation(sourceType, reservationId) {
          reads.push({ sourceType, reservationId })
          return reservations?.[`${sourceType}:${reservationId}`] || null
        },
      }),
      createLedgerRepository: () => ledger,
      createRetryClaimRepository: () => retryClaims,
      createTransport: () => ({ send }),
    }),
  }
}

test('confirmation payloads are separate, customer-safe final confirmations', () => {
  const cakePayload = buildBookingConfirmationPayload({ reservation: cake(), sourceType: 'cake', from: FROM })
  const classPayload = buildBookingConfirmationPayload({ reservation: classReservation(), sourceType: 'class', from: FROM })
  assert.equal(cakePayload.eventKey, 'booking-confirmed-customer:cake:cake-123')
  assert.equal(classPayload.eventKey, 'booking-confirmed-customer:class:class-123')
  assert.notEqual(cakePayload.idempotencyKey, classPayload.idempotencyKey)
  assert.equal(cakePayload.subject, 'Your Verygood Chocolate booking is confirmed')
  assert.equal(classPayload.subject, 'Your Verygood Kids Class booking is confirmed')
  assert.match(cakePayload.text, /CONFIRMED/)
  assert.match(cakePayload.text, /https:\/\/maps\.app\.goo\.gl\/bSVbF8M5BCdxJeDRA/)
  assert.match(classPayload.text, /1 Bundil Blvd, Melrose Park, Sydney/)
  assert.match(classPayload.text, /Advanced session: 2026-09-19 13:00/)
  assert.match(classPayload.text, /Please arrive 5 minutes early/)
  for (const payload of [cakePayload, classPayload]) {
    for (const forbidden of ['INTERNAL ADMIN NOTE', 'PRIVATE EMERGENCY CONTACT', 'PRIVATE ALLERGY DETAIL', 'private_database_id']) {
      assert.doesNotMatch(payload.text, new RegExp(forbidden))
      assert.doesNotMatch(payload.html, new RegExp(forbidden))
    }
  }

  const sanitized = buildBookingConfirmationPayload({
    reservation: cake({ customerName: 'Alice <b>\nFORGED', requestNote: 'Note\r\nTotal: AUD 0.00 <script>bad()</script>' }),
    sourceType: 'cake', from: FROM,
  })
  assert.match(sanitized.html, /&lt;b&gt; FORGED/)
  assert.doesNotMatch(sanitized.html, /<script>bad\(\)<\/script>/)
  assert.doesNotMatch(sanitized.text, /^Total: AUD 0\.00$/m)
})

test('admin safe-retry reuses the existing booking confirmation event only after a retryable first failure', async () => {
  let sends = 0
  const keys = []
  const subject = handler({
    reservations: { 'cake:cake-123': cake() },
    send: async (payload) => {
      sends += 1
      keys.push(payload.idempotencyKey)
      if (sends === 1) throw new ResendTransportError('failed', 'resend_invalid_api_key')
      return { kind: 'accepted', providerMessageId: 'message-123' }
    },
  })
  const first = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
  assert.equal(first.result.status, 'failed')
  const retry = await subject.handle({
    req: request('retry-booking-email', 'cake', 'cake-123', undefined, 'booking-confirmed-customer'),
    res: response(),
  })
  assert.deepEqual(retry, { ok: true, result: { status: 'sent', sentAt: NOW.toISOString(), recipientMasked: 'a***@example.com' } })
  assert.equal(sends, 2)
  assert.equal(keys[0], keys[1])
  const delivery = subject.ledger.records.get('booking-confirmed-customer:cake:cake-123')
  assert.equal(delivery.attempts, 2)
  assert.equal(delivery.firstAttemptAt, NOW.toISOString())
})

test('generic booking status and retry actions are admin-only and never trust a client event key or recipient', async () => {
  const subject = handler({ reservations: { 'cake:cake-123': cake() } })
  const unauthenticated = await subject.handle({
    req: request('get-booking-email-status', 'cake', 'cake-123', {}, 'booking-received-customer'), res: response(),
  })
  assert.deepEqual(unauthenticated, { ok: false, code: 'BOOKING_CONFIRMATION_UNAUTHORIZED' })
  const requestBody = request('get-booking-email-status', 'cake', 'cake-123', undefined, 'booking-received-customer')
  requestBody.bodyJson.data.eventKey = 'booking-confirmed-customer:cake:attacker'
  requestBody.bodyJson.data.recipient = 'attacker@example.com'
  const status = await subject.handle({ req: requestBody, res: response() })
  assert.deepEqual(status, { ok: true, result: { status: 'not_sent', retry: 'not_needed', recipientMasked: 'a***@example.com' } })
})

test('operator receipt retry is server-only, keeps its canonical recipient set, and has no drawer state', async () => {
  const reservation = cake({ status: '예약신청' })
  const payload = buildBookingDeliveryPayload({ reservation, role: 'operator', from: FROM, operatorRecipients: ['second@example.com', 'owner@example.com'] })
  const ledger = memoryLedger()
  ledger.records.set(payload.eventKey, {
    $id: 'delivery-operator', ...payload, status: 'failed', attempts: 1,
    firstAttemptAt: '2026-08-26T00:00:00.000Z', lastErrorCode: 'resend_rate_limit_exceeded',
  })
  let sent
  const subject = handler({
    reservations: { 'cake:cake-123': reservation }, ledger, env: { ...ENV, RESEND_TO_EMAILS: 'owner@example.com,second@example.com' },
    send: async (message) => { sent = message; return { kind: 'accepted', providerMessageId: 'message-operator' } },
  })
  const result = await subject.handle({
    req: request('retry-booking-email', 'cake', 'cake-123', undefined, 'booking-received-operator'), res: response(),
  })
  assert.equal(result.ok, true)
  assert.equal(result.result.status, 'sent')
  assert.deepEqual(sent.to, ['owner@example.com', 'second@example.com'])
  assert.equal(sent.idempotencyKey, payload.idempotencyKey)
})

test('booking retry fails closed without a provider call if stored recipient or payload identity has changed', async () => {
  for (const patch of [{ pickupTime: '14:00' }, { customerEmail: 'changed@example.com' }]) {
    const original = cake()
    const payload = buildBookingConfirmationPayload({ reservation: original, sourceType: 'cake', from: FROM })
    const ledger = memoryLedger()
    ledger.records.set(payload.eventKey, {
      $id: 'delivery-1', ...payload, status: 'uncertain', attempts: 1,
      firstAttemptAt: '2026-08-26T00:00:00.000Z',
    })
    let calls = 0
    const subject = handler({
      reservations: { 'cake:cake-123': cake(patch) }, ledger,
      send: async () => { calls += 1; return { kind: 'accepted', providerMessageId: 'message-123' } },
    })
    const status = await subject.handle({
      req: request('get-booking-email-status', 'cake', 'cake-123', undefined, 'booking-confirmed-customer'), res: response(),
    })
    assert.equal(status.ok, true)
    assert.equal(status.result.retry, patch.pickupTime ? 'payload_changed' : 'recipient_changed')
    const retry = await subject.handle({
      req: request('retry-booking-email', 'cake', 'cake-123', undefined, 'booking-confirmed-customer'), res: response(),
    })
    assert.equal(retry.result.status, 'uncertain')
    assert.equal(calls, 0)
  }
})

test('runtime reservation reads use only the dynamic x-appwrite-key and the selected source table', async () => {
  const seen = []
  const calls = []
  const repository = createRuntimeReservationRepository({
    req: { headers: { 'x-appwrite-key': 'dynamic_function_key' } },
    env: {
      APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.example/v1', APPWRITE_FUNCTION_PROJECT_ID: 'project_id',
      APPWRITE_CAKE_DATABASE_ID: 'cake_db', APPWRITE_KIDS_DATABASE_ID: 'kids_db',
      APPWRITE_CAKE_RESERVATIONS_TABLE_ID: 'reservations', APPWRITE_KIDS_RESERVATIONS_TABLE_ID: 'class_reservations',
      APPWRITE_API_KEY: 'must_not_be_used',
    },
    createDatabases: ({ apiKey }) => {
      seen.push(apiKey)
      return { async getDocument(input) { calls.push(input); return cake() } }
    },
  })
  await repository.getReservation('class', 'class-123')
  assert.deepEqual(seen, ['dynamic_function_key'])
  assert.deepEqual(calls, [{ databaseId: 'kids_db', collectionId: 'class_reservations', documentId: 'class-123' }])
  assert.throws(() => createRuntimeReservationRepository({ req: { headers: {} }, env: {} }), /BOOKING_CONFIRMATION_CONFIGURATION_ERROR/)
})

test('only an allowlisted administrator can send a confirmation before any reservation read', async () => {
  const subject = handler({ reservations: { 'cake:cake-123': cake() } })
  for (const headers of [{}, { 'x-appwrite-user-id': 'customer-1' }]) {
    const result = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123', headers), res: response() })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'BOOKING_CONFIRMATION_UNAUTHORIZED')
  }
  assert.deepEqual(subject.reads, [])
})

test('admin confirmation re-reads the authoritative reservation and ignores spoofed recipient, status, and order details', async () => {
  const stored = cake({ totalPriceCents: 32100, pickupDate: '2026-10-14', status: '예약확정' })
  let sent
  const subject = handler({
    reservations: { 'cake:cake-123': stored },
    send: async (payload) => { sent = payload; return { kind: 'accepted', providerMessageId: 'message-123' } },
  })
  const req = request('send-booking-confirmation', 'cake', 'cake-123')
  req.bodyJson.data.customerEmail = 'attacker@example.com'
  req.bodyJson.data.status = '예약신청'
  req.bodyJson.data.totalPriceCents = 1
  const result = await subject.handle({ req, res: response() })
  assert.deepEqual(subject.reads, [{ sourceType: 'cake', reservationId: 'cake-123' }])
  assert.equal(result.ok, true)
  assert.equal(result.result.status, 'sent')
  assert.equal(result.result.recipientMasked, 'a***@example.com')
  assert.equal(sent.to[0], 'alice@example.com')
  assert.match(sent.text, /AUD 321\.00/)
  assert.match(sent.text, /2026-10-14/)
  assert.doesNotMatch(sent.text, /attacker@example\.com/)
})

test('only actual confirmed statuses with valid stored recipients can send', async () => {
  for (const [sourceType, reservation] of [
    ['cake', cake({ status: '예약신청' })], ['cake', cake({ status: '취소' })], ['cake', cake({ status: '픽업완료' })],
    ['class', classReservation({ status: 'Requested' })], ['class', classReservation({ status: 'Cancelled' })], ['class', classReservation({ status: 'Completed' })],
    ['cake', cake({ customerEmail: '' })], ['class', classReservation({ parentEmail: 'invalid-email' })],
  ]) {
    const subject = handler({ reservations: { [`${sourceType}:${reservation.$id}`]: reservation } })
    const result = await subject.handle({ req: request('send-booking-confirmation', sourceType, reservation.$id), res: response() })
    assert.equal(result.ok, false)
    assert.equal(subject.ledger.records.size, 0)
  }
})

test('sent confirmations cannot be duplicated; pending, failed, uncertain, and identity mismatch never auto-resend', async () => {
  const stored = cake()
  const subject = handler({ reservations: { 'cake:cake-123': stored } })
  const first = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
  const second = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
  assert.equal(first.result.status, 'sent')
  assert.equal(second.result.status, 'already_sent')
  assert.equal(second.result.sentAt, NOW.toISOString())
  const record = subject.ledger.records.get('booking-confirmed-customer:cake:cake-123')
  for (const status of ['pending', 'failed', 'uncertain']) {
    record.status = status
    const result = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
    assert.notEqual(result.result.status, 'sent')
  }
  record.status = 'sent'
  record.payloadHash = 'f'.repeat(64)
  const mismatch = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
  assert.equal(mismatch.result.status, 'failed')
})

test('confirmation delivery failures preserve reservation data and report failed or uncertain without an automatic retry', async () => {
  const stored = cake()
  const original = structuredClone(stored)
  for (const failure of [new ResendTransportError('failed', 'resend_http_422'), new ResendTransportError('uncertain', 'resend_timeout')]) {
    const subject = handler({
      reservations: { 'cake:cake-123': stored },
      send: async () => { throw failure },
    })
    const result = await subject.handle({ req: request('send-booking-confirmation', 'cake', 'cake-123'), res: response() })
    assert.equal(result.ok, true)
    assert.equal(result.result.status, failure.kind)
    assert.deepEqual(stored, original)
  }
})

test('admin-only confirmation status query returns a minimal DTO and never a raw ledger row', async () => {
  const subject = handler({ reservations: { 'class:class-123': classReservation() } })
  const missing = await subject.handle({ req: request('get-booking-confirmation-status', 'class', 'class-123', {}), res: response() })
  assert.equal(missing.ok, false)
  const first = await subject.handle({ req: request('send-booking-confirmation', 'class', 'class-123'), res: response() })
  assert.equal(first.result.status, 'sent')
  const status = await subject.handle({ req: request('get-booking-confirmation-status', 'class', 'class-123'), res: response() })
  assert.deepEqual(status, { ok: true, result: { status: 'sent', sentAt: NOW.toISOString(), recipientMasked: 'p***@example.com' } })
  assert.doesNotMatch(JSON.stringify(status), /payloadHash|recipientHash|providerMessageId|delivery-/)
})

test('manual confirmation actions are never interpreted as reservation-created events', async () => {
  const subject = handler({ reservations: { 'cake:cake-123': cake() } })
  const result = await subject.handle({ req: request('unsupported-action', 'cake', 'cake-123'), res: response() })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'BOOKING_CONFIRMATION_INVALID_ACTION')
  assert.deepEqual(subject.reads, [])
})
