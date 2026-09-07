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
