import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addSydneyCalendarDays,
  formatSydneyDateKey,
  isSydneyReminderWindow,
} from '../appwrite-functions/shared/sydney-calendar.js'
import {
  buildBookingReminderEventKey,
  buildCakeReminderPayload,
  buildClassReminderPayload,
  createBookingReminderRunner,
} from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import {
  createBookingReminderHandler,
  createRuntimeBookingReminderRepository,
} from '../appwrite-functions/booking-reminder/src/main.js'
import { ResendTransportError } from '../appwrite-functions/shared/resend-transport.js'

const FROM = 'Verygood Chocolate <hello@verygood.example>'

function cakeReservation(overrides = {}) {
  return {
    $id: 'cake-123',
    status: '예약확정',
    reservationNumber: 'VG-C-AU-20260827-123456789',
    customerName: 'Alice <b>\nFORGED',
    customerEmail: ' ALICE@example.com ',
    productId: 'pave-cake',
    cakeSize: '19cm',
    quantity: 2,
    pickupDate: '2026-08-28',
    pickupTime: '10:30',
    requestNote: 'PRIVATE NOTE',
    adminMemo: 'PRIVATE ADMIN MEMO',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function classReservation(overrides = {}) {
  return {
    $id: 'class-123',
    status: 'Confirmed',
    reservationNumber: 'VG-KC-AU-20260827-123456789',
    parentName: 'Pat Parent',
    parentEmail: ' PARENT@example.com ',
    childName: 'Charlie Child',
    classType: 'school-holiday-private-cake-class',
    coursePlan: 'basic-advanced-package',
    classDate: '2026-08-28',
    classTime: '10:00',
    advancedClassDate: '2026-09-04',
    advancedClassTime: '13:00',
    allergyNote: 'PRIVATE ALLERGY DETAIL',
    emergencyContact: 'PRIVATE EMERGENCY CONTACT',
    adminMemo: 'PRIVATE ADMIN MEMO',
    $databaseId: 'private_database_id',
    ...overrides,
  }
}

function createMemoryDeliveryRepository() {
  const records = new Map()
  return {
    records,
    async getOrCreatePending(identity, now) {
      const existing = records.get(identity.eventKey)
      if (existing) return {
        kind: 'existing', delivery: existing,
        decision: existing.status === 'sent' ? { kind: 'already_sent' } : { kind: 'in_progress' },
      }
      const delivery = { $id: `delivery-${records.size + 1}`, ...identity, status: 'pending', attempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() }
      records.set(identity.eventKey, delivery)
      return { kind: 'created', delivery }
    },
    async markAttempt(delivery, now) {
      Object.assign(delivery, {
        attempts: delivery.attempts + 1,
        firstAttemptAt: delivery.firstAttemptAt || now.toISOString(),
        lastAttemptAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      return delivery
    },
    async markSent(delivery, { now, providerMessageId }) {
      Object.assign(delivery, { status: 'sent', sentAt: now.toISOString(), providerMessageId, updatedAt: now.toISOString() })
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

test('Sydney reminder scan gate permits only the complete local 10:00 hour', () => {
  assert.equal(isSydneyReminderWindow(new Date('2026-08-26T23:59:59.000Z')), false)
  assert.equal(isSydneyReminderWindow(new Date('2026-08-27T00:00:00.000Z')), true)
  assert.equal(isSydneyReminderWindow(new Date('2026-08-27T00:30:00.000Z')), true)
  assert.equal(isSydneyReminderWindow(new Date('2026-08-27T00:59:59.999Z')), true)
  assert.equal(isSydneyReminderWindow(new Date('2026-08-27T01:00:00.000Z')), false)
})

test('Sydney tomorrow retains a calendar day across normal and DST boundaries', () => {
  assert.equal(formatSydneyDateKey(addSydneyCalendarDays(new Date('2026-08-26T00:30:00.000Z'), 1)), '2026-08-27')
  assert.equal(formatSydneyDateKey(addSydneyCalendarDays(new Date('2026-10-03T15:30:00.000Z'), 1)), '2026-10-05')
  assert.equal(formatSydneyDateKey(addSydneyCalendarDays(new Date('2027-04-03T14:30:00.000Z'), 1)), '2027-04-05')
})

test('D-1 event keys include the scheduled date and fixed class session kind', () => {
  assert.equal(
    buildBookingReminderEventKey({ sourceType: 'cake', reservationId: 'cake-123', scheduledDate: '2026-08-28' }),
    'booking-reminder-d1-customer:cake:cake-123:2026-08-28',
  )
  assert.equal(
    buildBookingReminderEventKey({ sourceType: 'class', reservationId: 'class-123', sessionKind: 'first', scheduledDate: '2026-08-28' }),
    'booking-reminder-d1-customer:class:class-123:first:2026-08-28',
  )
  assert.equal(
    buildBookingReminderEventKey({ sourceType: 'class', reservationId: 'class-123', sessionKind: 'advanced', scheduledDate: '2026-09-04' }),
    'booking-reminder-d1-customer:class:class-123:advanced:2026-09-04',
  )
  assert.throws(
    () => buildBookingReminderEventKey({ sourceType: 'class', reservationId: 'class-123', sessionKind: 'forged:kind', scheduledDate: '2026-08-28' }),
    /INVALID_BOOKING_REMINDER_EVENT/,
  )
})

test('outside the Sydney window is a no-op before reservation queries', async () => {
  let queried = false
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T01:00:00.000Z'),
    repository: {
      async listCakeCandidates() { queried = true; return [] },
      async listClassFirstCandidates() { queried = true; return [] },
      async listClassAdvancedCandidates() { queried = true; return [] },
    },
  })

  assert.deepEqual(await runner.run(), { ok: true, skipped: 'outside_sydney_reminder_window' })
  assert.equal(queried, false)
})

test('scheduled entry returns the outside-window no-op before runtime repository or dynamic-key access', async () => {
  let repositoryCreated = false
  let response
  const handler = createBookingReminderHandler({
    now: () => new Date('2026-08-27T01:00:00.000Z'),
    createReservationRepository() { repositoryCreated = true; throw new Error('must not run outside window') },
  })
  await handler({ req: { headers: {} }, res: { json(value) { response = value } } })
  assert.equal(repositoryCreated, false)
  assert.deepEqual(response, { ok: true, skipped: 'outside_sydney_reminder_window' })
})

test('runtime candidate access fails closed without the dynamic Function key', () => {
  assert.throws(
    () => createRuntimeBookingReminderRepository({
      req: { headers: {} },
      env: { APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.example.test/v1', APPWRITE_FUNCTION_PROJECT_ID: 'project_au', APPWRITE_CAKE_DATABASE_ID: 'cake_db' },
      createDatabases() { throw new Error('must not construct without the dynamic key') },
    }),
    /BOOKING_REMINDER_CONFIGURATION_ERROR/,
  )
})

test('invalid reminder mode returns a safe configuration response without reading reservations', async () => {
  let repositoryCreated = false
  let response
  const handler = createBookingReminderHandler({
    env: { BOOKING_REMINDER_MODE: 'send-everything' },
    now: () => new Date('2026-08-27T00:30:00.000Z'),
    createReservationRepository() { repositoryCreated = true; throw new Error('must not read reservations') },
  })

  await handler({ req: { headers: {} }, res: { json(value) { response = value } }, error() {} })
  assert.equal(repositoryCreated, false)
  assert.deepEqual(response, { ok: false, reason: 'booking_reminder_unavailable' })
})

test('Cake and Class D-1 payloads are Korean-first bilingual allowlists with persistent reminder identities', () => {
  const cake = buildCakeReminderPayload({ reservation: cakeReservation(), from: FROM })
  assert.equal(cake.subject, '[Verygood] 내일 픽업 예정이에요 | Your cake pickup is tomorrow')
  assert.equal(cake.template, 'booking-reminder-d1-customer')
  assert.equal(cake.templateVersion, 'booking-reminder-d1-customer-cake-v1')
  assert.equal(cake.eventKey, 'booking-reminder-d1-customer:cake:cake-123:2026-08-28')
  assert.equal(cake.occurrence, '2026-08-28')
  assert.deepEqual(cake.to, ['alice@example.com'])
  assert.ok(cake.text.indexOf('[한국어]') < cake.text.indexOf('[English]'))
  assert.ok(cake.html.indexOf('[한국어]') < cake.html.indexOf('[English]'))
  assert.match(cake.text, /https:\/\/maps\.app\.goo\.gl\/bSVbF8M5BCdxJeDRA/)
  assert.doesNotMatch(cake.text, /PRIVATE NOTE|PRIVATE ADMIN MEMO|PRIVATE EMERGENCY CONTACT|private_database_id/)
  assert.match(cake.html, /Alice &lt;b&gt; FORGED/)
  assert.doesNotMatch(cake.html, /<b>/)

  const first = buildClassReminderPayload({ reservation: classReservation(), sessionKind: 'first', from: FROM })
  const advanced = buildClassReminderPayload({ reservation: classReservation(), sessionKind: 'advanced', from: FROM })
  assert.equal(first.subject, '[Verygood] 내일 키즈 클래스가 있어요 | Your Kids Class is tomorrow')
  assert.equal(first.templateVersion, 'booking-reminder-d1-customer-class-v1')
  assert.equal(first.eventKey, 'booking-reminder-d1-customer:class:class-123:first:2026-08-28')
  assert.equal(advanced.eventKey, 'booking-reminder-d1-customer:class:class-123:advanced:2026-09-04')
  assert.notEqual(first.eventKey, advanced.eventKey)
  assert.match(first.text, /첫 수업/)
  assert.match(advanced.text, /Advanced 세션/)
  assert.ok(first.text.indexOf('[한국어]') < first.text.indexOf('[English]'))
  assert.doesNotMatch(first.text, /PRIVATE ALLERGY DETAIL|PRIVATE EMERGENCY CONTACT|PRIVATE ADMIN MEMO|private_database_id/)
})

test('Cake reminder uses the canonical stored multi-line order projection without leaking stored private fields', () => {
  const lines = [
    { productId: 'pound-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 4500, subtotalCents: 4500, discountPercent: 0, discountCents: 0, totalPriceCents: 4500 },
    { productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 7500, subtotalCents: 7500, discountPercent: 0, discountCents: 0, totalPriceCents: 7500 },
  ]
  const payload = buildCakeReminderPayload({
    reservation: cakeReservation({
      customerPhone: '0400000000',
      productId: 'pound-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
      chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1,
      orderLinesJson: JSON.stringify({ version: 1, lines }),
      subtotalCents: 12000, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
      totalPriceCents: 12000, totalPrice: 120, orderLineCount: 2, orderItemCount: 2,
      privateCustomerPhone: '0400000000',
    }),
    from: FROM,
  })
  assert.match(payload.text, /Signature Gâteau au Chocolat/)
  assert.match(payload.text, /Pave Chocolate Cake/)
  assert.doesNotMatch(payload.text, /0400000000/)
})

test('send mode re-reads candidates, delivers valid Cake and Class sessions once, and isolates invalid rows', async () => {
  const cake = cakeReservation()
  const first = classReservation()
  const advanced = classReservation({ $id: 'class-124', classDate: '2026-09-03', advancedClassDate: '2026-08-28' })
  const invalid = cakeReservation({ $id: 'cake-124', customerEmail: 'not-an-email' })
  const deliveryRepository = createMemoryDeliveryRepository()
  const calls = []
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'),
    mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: [cake, invalid] } },
      async listClassFirstCandidates() { return { documents: [first] } },
      async listClassAdvancedCandidates() { return { documents: [advanced] } },
      async getCakeReservation(id) { return id === cake.$id ? cake : invalid },
      async getClassReservation(id) { return id === first.$id ? first : advanced },
    },
    deliveryRepository,
    transport: { async send(payload) { calls.push(payload); return { kind: 'accepted', providerMessageId: `message-${calls.length}` } } },
  })

  const result = await runner.run()
  assert.deepEqual(result, {
    ok: true, targetDate: '2026-08-28', cakeCandidates: 2, classSessionCandidates: 2,
    sent: 3, alreadySent: 0, skipped: 1, failed: 0, uncertain: 0, ledgerErrors: 0,
  })
  assert.equal(calls.length, 3)
  assert.equal(deliveryRepository.records.size, 3)
  assert.ok([...deliveryRepository.records.values()].every((delivery) => delivery.firstAttemptAt && delivery.attempts === 1 && delivery.status === 'sent'))

  const rerun = await runner.run()
  assert.equal(rerun.alreadySent, 3)
  assert.equal(calls.length, 3)
})

test('dry-run mode is the default and never calls provider or creates a delivery row', async () => {
  const cake = cakeReservation()
  const deliveryRepository = createMemoryDeliveryRepository()
  let providerCalls = 0
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: [cake] } },
      async listClassFirstCandidates() { return { documents: [] } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation() { return cake },
    },
    deliveryRepository,
    transport: { async send() { providerCalls += 1; return { kind: 'accepted', providerMessageId: 'unexpected' } } },
  })

  assert.deepEqual(await runner.run(), {
    ok: true, targetDate: '2026-08-28', cakeCandidates: 1, classSessionCandidates: 0,
    wouldSend: 1, skipped: 0, failed: 0, uncertain: 0, ledgerErrors: 0,
  })
  assert.equal(providerCalls, 0)
  assert.equal(deliveryRepository.records.size, 0)
})

test('latest re-read skips a rescheduled Cake or Class session with a missing time before any ledger claim', async () => {
  const cake = cakeReservation({ pickupDate: '2026-08-29' })
  const classRow = classReservation({ classTime: '', advancedClassDate: '2026-08-29' })
  const deliveryRepository = createMemoryDeliveryRepository()
  let providerCalls = 0
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: [cakeReservation()] } },
      async listClassFirstCandidates() { return { documents: [classReservation()] } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation() { return cake },
      async getClassReservation() { return classRow },
    },
    deliveryRepository,
    transport: { async send() { providerCalls += 1; return { kind: 'accepted', providerMessageId: 'unexpected' } } },
  })
  assert.deepEqual(await runner.run(), {
    ok: true, targetDate: '2026-08-28', cakeCandidates: 1, classSessionCandidates: 1,
    sent: 0, alreadySent: 0, skipped: 2, failed: 0, uncertain: 0, ledgerErrors: 0,
  })
  assert.equal(providerCalls, 0)
  assert.equal(deliveryRepository.records.size, 0)
})

test('latest reread skips cancelled, completed, and invalid-recipient Cake and Class candidates', async () => {
  const staleCakeRows = [
    cakeReservation({ $id: 'cake-requested' }),
    cakeReservation({ $id: 'cake-cancelled' }),
    cakeReservation({ $id: 'cake-completed' }),
  ]
  const staleClassRows = [
    classReservation({ $id: 'class-requested' }),
    classReservation({ $id: 'class-cancelled' }),
    classReservation({ $id: 'class-completed' }),
    classReservation({ $id: 'class-invalid-email' }),
  ]
  const latestCake = new Map([
    ['cake-requested', cakeReservation({ $id: 'cake-requested', status: '예약신청' })],
    ['cake-cancelled', cakeReservation({ $id: 'cake-cancelled', status: '예약취소' })],
    ['cake-completed', cakeReservation({ $id: 'cake-completed', status: '픽업완료' })],
  ])
  const latestClass = new Map([
    ['class-requested', classReservation({ $id: 'class-requested', status: 'Requested' })],
    ['class-cancelled', classReservation({ $id: 'class-cancelled', status: 'Cancelled' })],
    ['class-completed', classReservation({ $id: 'class-completed', status: 'Completed' })],
    ['class-invalid-email', classReservation({ $id: 'class-invalid-email', parentEmail: 'not-an-email' })],
  ])
  let providerCalls = 0
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: staleCakeRows } },
      async listClassFirstCandidates() { return { documents: staleClassRows } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation(id) { return latestCake.get(id) },
      async getClassReservation(id) { return latestClass.get(id) },
    },
    deliveryRepository: createMemoryDeliveryRepository(),
    transport: { async send() { providerCalls += 1; return { kind: 'accepted', providerMessageId: 'unexpected' } } },
  })

  const result = await runner.run()
  assert.equal(result.skipped, 7)
  assert.equal(result.sent, 0)
  assert.equal(providerCalls, 0)
})

test('one reminder transport failure is recorded without stopping later reminder candidates', async () => {
  const failed = cakeReservation({ $id: 'cake-failed' })
  const uncertain = cakeReservation({ $id: 'cake-uncertain' })
  const sent = cakeReservation({ $id: 'cake-sent' })
  const rows = [failed, uncertain, sent]
  let providerCalls = 0
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: rows } },
      async listClassFirstCandidates() { return { documents: [] } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation(id) { return rows.find((row) => row.$id === id) },
    },
    deliveryRepository: createMemoryDeliveryRepository(),
    transport: {
      async send(payload) {
        providerCalls += 1
        if (payload.eventKey.includes('cake-failed')) throw new ResendTransportError('failed', 'resend_validation_error_400')
        if (payload.eventKey.includes('cake-uncertain')) throw new ResendTransportError('uncertain', 'resend_http_500')
        return { kind: 'accepted', providerMessageId: 'message-sent' }
      },
    },
  })

  const result = await runner.run()
  assert.equal(providerCalls, 3)
  assert.equal(result.failed, 1)
  assert.equal(result.uncertain, 1)
  assert.equal(result.sent, 1)
})

test('concurrent scans for the same reminder leave the first-send claim as the single provider caller', async () => {
  const cake = cakeReservation()
  const deliveryRepository = createMemoryDeliveryRepository()
  let providerCalls = 0
  const createRunner = () => createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates() { return { documents: [cake] } },
      async listClassFirstCandidates() { return { documents: [] } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation() { return cake },
    },
    deliveryRepository,
    transport: { async send() { providerCalls += 1; return { kind: 'accepted', providerMessageId: 'message' } } },
  })

  const [first, second] = await Promise.all([createRunner().run(), createRunner().run()])
  assert.equal(providerCalls, 1)
  assert.equal(first.sent + second.sent, 1)
  assert.equal(first.skipped + second.skipped, 1)
})

test('pagination processes more than 50 Cake candidates with no more than three in-flight deliveries', async () => {
  const rows = Array.from({ length: 51 }, (_, index) => cakeReservation({
    $id: `cake-${String(index + 1).padStart(3, '0')}`,
    reservationNumber: `VG-C-${index + 1}`,
  }))
  const deliveryRepository = createMemoryDeliveryRepository()
  let inFlight = 0
  let peak = 0
  const runner = createBookingReminderRunner({
    now: () => new Date('2026-08-27T00:30:00.000Z'), mode: 'send', from: FROM,
    repository: {
      async listCakeCandidates({ cursor }) {
        return { documents: cursor ? rows.slice(50) : rows.slice(0, 50) }
      },
      async listClassFirstCandidates() { return { documents: [] } },
      async listClassAdvancedCandidates() { return { documents: [] } },
      async getCakeReservation(id) { return rows.find((row) => row.$id === id) },
    },
    deliveryRepository,
    transport: {
      async send() {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await Promise.resolve()
        inFlight -= 1
        return { kind: 'accepted', providerMessageId: 'message' }
      },
    },
  })
  const result = await runner.run()
  assert.equal(result.sent, 51)
  assert.equal(result.cakeCandidates, 51)
  assert.ok(peak <= 3)
})
