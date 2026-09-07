import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import { databases } from '../src/lib/appwrite.js'
import { toReservation, updateReservation } from '../src/lib/repository.js'

const now = new Date('2099-07-01T00:00:00.000Z')
const baseInput = {
  customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com',
  pickupDate: '2099-07-11', pickupTime: '10:00', privacyConsent: true, promoCode: '', requestNote: '',
}

for (const [name, orderLines] of [
  ['Smore six', [{ productId: 'smore-stick', quantity: 6 }]],
  ['ordinary cake', [{ productId: 'pave-cake', cakeSize: '6in', quantity: 1 }]],
] as const) {
  test(`${name} status-only admin update omits unchanged prices from the actual Appwrite SDK payload`, async () => {
    const stored = {
      $id: `reservation-${name}`,
      ...buildCakeReservation({ ...baseInput, orderLines }, { now, reservationNumber: `VG-${name}` }),
    }
    const reservation = toReservation(stored as never)
    const update = buildAdminReservationUpdate(reservation, { status: '예약확정' })
    let payload: Record<string, unknown> | undefined
    const sdk = databases as unknown as {
      getDocument: (...args: unknown[]) => Promise<unknown>
      updateDocument: (...args: unknown[]) => Promise<unknown>
    }
    sdk.getDocument = async () => stored
    sdk.updateDocument = async (_databaseId, _collectionId, _id, data) => {
      payload = data as Record<string, unknown>
      return { ...stored, ...payload }
    }

    const result = await updateReservation(stored.$id, update)

    assert.ok(payload)
    assert.equal(payload.status, '예약확정')
    assert.equal(payload.quantity, stored.quantity)
    assert.equal(Object.hasOwn(payload, 'totalPrice'), false)
    assert.equal(Object.hasOwn(payload, 'totalPriceCents'), false)
    assert.equal(Object.hasOwn(payload, 'orderLinesJson'), false)
    assert.equal(result.totalPriceCents, stored.totalPriceCents)
    assert.equal(result.discountCents, stored.discountCents)
    assert.deepEqual(result.orderLines, reservation.orderLines)
  })
}

test('status, payment and memo-only Admin writes preserve every versioned pricing field', async () => {
  const stored = {
    $id: 'reservation-partial-update-integrity',
    ...buildCakeReservation({ ...baseInput, orderLines: [
      { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
      { productId: 'smore-stick', quantity: 6 },
    ] }, {
      now,
      reservationNumber: 'VG-PARTIAL-INTEGRITY',
      reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' },
    } as never),
  }
  const reservation = toReservation(stored as never)
  const changes = [
    { status: '예약확정' as const },
    { paymentStatus: '입금확인' as const },
    { adminMemo: 'verified without repricing' },
  ]
  for (const change of changes) {
    let payload: Record<string, unknown> | undefined
    const sdk = databases as unknown as {
      getDocument: (...args: unknown[]) => Promise<unknown>
      updateDocument: (...args: unknown[]) => Promise<unknown>
    }
    sdk.getDocument = async () => stored
    sdk.updateDocument = async (_databaseId, _collectionId, _id, data) => {
      payload = data as Record<string, unknown>
      return { ...stored, ...payload }
    }
    const result = await updateReservation(stored.$id, buildAdminReservationUpdate(reservation, change))
    assert.ok(payload)
    assert.equal(payload.quantity, stored.quantity)
    for (const key of ['totalPrice', 'totalPriceCents', 'orderLinesJson', 'subtotalCents', 'discountBasisCents', 'discountPercent', 'discountCents', 'appliedPromoCodeLast4', 'reviewCouponId']) {
      assert.equal(Object.hasOwn(payload, key), false, key)
    }
    assert.equal(result.quantity, stored.quantity)
    assert.equal(result.totalPriceCents, stored.totalPriceCents)
    assert.equal(result.discountCents, stored.discountCents)
    assert.equal(result.discountBasisCents, stored.discountBasisCents)
    assert.equal(result.promotionKind, 'review-reward')
    assert.deepEqual(result.orderLines, reservation.orderLines)
  }
})

test('partial versioned stored envelopes fail before the Admin SDK write boundary', async () => {
  const stored = {
    $id: 'reservation-corrupted-smores',
    ...buildCakeReservation({ ...baseInput, orderLines: [{ productId: 'smore-stick', quantity: 50 }] }, {
      now,
      reservationNumber: 'VG-CORRUPTED-SMORES',
    }),
  }
  const validReservation = toReservation(stored as never)
  const update = buildAdminReservationUpdate(validReservation, { status: '예약확정' })
  const validEnvelope = JSON.parse(stored.orderLinesJson)
  const corruptions: Array<[string, (row: Record<string, unknown>) => void]> = [
    ['null JSON', row => { row.orderLinesJson = null }],
    ['missing JSON', row => { delete row.orderLinesJson }],
    ['undefined JSON', row => { row.orderLinesJson = undefined }],
    ['malformed JSON', row => { row.orderLinesJson = '{' }],
    ['object JSON', row => { row.orderLinesJson = {} }],
    ['array JSON', row => { row.orderLinesJson = [] }],
    ['wrong version', row => { row.orderLinesJson = JSON.stringify({ ...validEnvelope, version: 2 }) }],
    ['truncated JSON', row => { row.orderLinesJson = stored.orderLinesJson.slice(0, -1) }],
    ['line count mismatch', row => { row.orderLineCount = 2 }],
    ['item count mismatch', row => { row.orderItemCount = 49 }],
    ['internally consistent duplicate lines', row => {
      const duplicateEnvelope = { ...validEnvelope, lines: [validEnvelope.lines[0], validEnvelope.lines[0]] }
      row.orderLinesJson = JSON.stringify(duplicateEnvelope)
      row.orderLineCount = 2
      row.orderItemCount = 100
      row.subtotalCents = 45000
      row.discountCents = 9000
      row.totalPriceCents = 36000
      row.totalPrice = 360
    }],
  ]
  for (const [name, mutate] of corruptions) {
    const corrupted = structuredClone(stored) as Record<string, unknown>
    mutate(corrupted)
    assert.throws(() => toReservation(corrupted as never), /INVALID_STORED_ORDER/, name)
    let updateCalls = 0
    const sdk = databases as unknown as {
      getDocument: (...args: unknown[]) => Promise<unknown>
      updateDocument: (...args: unknown[]) => Promise<unknown>
    }
    sdk.getDocument = async () => corrupted
    sdk.updateDocument = async () => { updateCalls += 1; return corrupted }
    await assert.rejects(updateReservation(stored.$id, update), /INVALID_STORED_ORDER/, name)
    assert.equal(updateCalls, 0, name)
  }
})

test('partial mixed stored envelope cannot downgrade while genuine nullable legacy remains readable', async () => {
  const mixed = {
    $id: 'reservation-corrupted-mixed',
    ...buildCakeReservation({ ...baseInput, orderLines: [
      { productId: 'pave-cake', cakeSize: '6in', quantity: 1 },
      { productId: 'smore-stick', quantity: 6 },
    ] }, { now, reservationNumber: 'VG-CORRUPTED-MIXED' }),
  }
  const mixedReservation = toReservation(mixed as never)
  const update = buildAdminReservationUpdate(mixedReservation, { paymentStatus: '입금확인', adminMemo: 'verified' })
  for (const mode of ['null', 'missing', 'reordered'] as const) {
    const corrupted: Record<string, unknown> = structuredClone(mixed)
    if (mode === 'null') corrupted.orderLinesJson = null
    else if (mode === 'missing') delete corrupted.orderLinesJson
    else {
      const envelope = JSON.parse(String(corrupted.orderLinesJson))
      envelope.lines.reverse()
      corrupted.orderLinesJson = JSON.stringify(envelope)
    }
    assert.throws(() => toReservation(corrupted as never), /INVALID_STORED_ORDER/)
    let updateCalls = 0
    const sdk = databases as unknown as {
      getDocument: (...args: unknown[]) => Promise<unknown>
      updateDocument: (...args: unknown[]) => Promise<unknown>
    }
    sdk.getDocument = async () => corrupted
    sdk.updateDocument = async () => { updateCalls += 1; return corrupted }
    await assert.rejects(updateReservation(mixed.$id, update), /INVALID_STORED_ORDER/)
    assert.equal(updateCalls, 0)
  }

  const legacy: Record<string, unknown> = {
    ...mixed,
    $id: 'reservation-genuine-legacy',
    productId: 'pave-cake',
    quantity: 5,
    totalPrice: 79,
    totalPriceCents: 7900,
    subtotalCents: 7900,
    discountPercent: 0,
    discountCents: 0,
    orderLinesJson: null,
    orderLineCount: null,
    orderItemCount: null,
    discountBasisCents: null,
  }
  const hydrated = toReservation(legacy as never)
  assert.equal(hydrated.orderLines, undefined)
  assert.equal(hydrated.quantity, 5)
})
