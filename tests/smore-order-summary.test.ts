import assert from 'node:assert/strict'
import test from 'node:test'
import { formatOrderLineSummary } from '../src/lib/order-lines.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import type { Reservation } from '../src/lib/types.js'

const line = {
  productId: 'smore-stick', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
  quantity: 50, subtotalCents: 13500, unitPriceCents: 270,
  discountPercent: 0, discountCents: 0, totalPriceCents: 13500,
} as const

test('admin shared formatter presents the S’more set quantity and fixed total without cake options', () => {
  assert.equal(formatOrderLineSummary(line as never), "S'more Stick · x50 · AUD 135.00")
})

test('Smore status-only edit retains authoritative quantity and totals; repricing stays locked', () => {
  const reservation = {
    ...line, id: 'smore-status-fixture', totalPrice: 135, orderLines: [line],
    orderLineCount: 1, orderItemCount: 50, status: '예약신청', paymentStatus: '입금대기',
  } as unknown as Reservation
  const updated = buildAdminReservationUpdate(reservation, { status: '픽업완료' })
  assert.equal(updated.quantity, 50)
  assert.equal(Object.hasOwn(updated, 'totalPrice'), false)
  assert.equal(Object.hasOwn(updated, 'totalPriceCents'), false)
  assert.throws(() => buildAdminReservationUpdate(reservation, { quantity: 10 }), /MULTI_LINE_EDIT_UNAVAILABLE/)
})
