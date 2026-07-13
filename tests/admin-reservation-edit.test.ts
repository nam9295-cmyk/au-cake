import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import type { Reservation } from '../src/lib/types.js'

const baseReservation: Reservation = {
  id: 'reservation-1',
  reservationNumber: 'VG-C-AU-1',
  customerName: 'Jenny',
  customerPhone: '0412345678',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'dark',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2026-07-20',
  pickupTime: '10:00',
  cacaoPercent: '기본',
  requestNote: '',
  status: '예약신청',
  paymentStatus: '입금대기',
  totalPrice: 75,
  totalPriceCents: 7500,
  adminMemo: '',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

test('admin reservation edits recalculate price when product, options, quantity and pickup change', () => {
  const update = buildAdminReservationUpdate(baseReservation, {
    productId: 'cupcake-dozen',
    poundAddon: 'extra-chocolate',
    chocolateType: 'milk',
    quantity: 2,
    pickupDate: '2026-07-22',
    pickupTime: '13:30',
    status: '예약확정',
    paymentStatus: '입금대기',
    adminMemo: 'Changed by Jenny request',
  })

  assert.deepEqual(update, {
    productId: 'cupcake-dozen',
    cakeSize: '15cm',
    chocolateType: 'milk',
    poundAddon: 'extra-chocolate',
    quantity: 2,
    pickupDate: '2026-07-22',
    pickupTime: '13:30',
    cacaoPercent: '기본',
    status: '예약확정',
    paymentStatus: '입금대기',
    totalPrice: 124,
    totalPriceCents: 12400,
    adminMemo: 'Changed by Jenny request',
  })
})

test('admin reservation edits normalise irrelevant options for selected product', () => {
  const update = buildAdminReservationUpdate(baseReservation, {
    productId: 'pound-cake',
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
    quantity: 1,
  })

  assert.equal(update.cakeSize, '15cm')
  assert.equal(update.chocolateType, 'dark')
  assert.equal(update.poundAddon, 'vanilla-cream')
  assert.equal(update.totalPrice, 50)
  assert.equal(update.totalPriceCents, 5000)
})

test('admin Fresh Lemon Cupcake edits keep one selected pack and ignore irrelevant options', () => {
  const update = buildAdminReservationUpdate(baseReservation, {
    productId: 'fresh-lemon-cupcakes-12',
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'extra-chocolate',
    quantity: 3,
  })

  assert.equal(update.productId, 'fresh-lemon-cupcakes-12')
  assert.equal(update.quantity, 1)
  assert.equal(update.cakeSize, '15cm')
  assert.equal(update.chocolateType, 'dark')
  assert.equal(update.poundAddon, 'none')
  assert.equal(update.totalPrice, 65)
  assert.equal(update.totalPriceCents, 6500)
})

test('admin edits preserve an audited promo discount and recalculate the discounted cents', () => {
  const promoReservation: Reservation = {
    ...baseReservation,
    requestNote: '[Promo verygoodSYD] 10% discount applied: 75.00 -> 67.50\nBirthday cake',
    totalPrice: 67.5,
    totalPriceCents: 6750,
  }

  const unchanged = buildAdminReservationUpdate(promoReservation, {})
  assert.equal(unchanged.totalPrice, 67.5)
  assert.equal(unchanged.totalPriceCents, 6750)

  const changed = buildAdminReservationUpdate(promoReservation, { cakeSize: '19cm', quantity: 2 })
  assert.equal(changed.totalPrice, 171)
  assert.equal(changed.totalPriceCents, 17100)
})

test('admin edits preserve a Lemoni discount across Fresh Lemon pack changes', () => {
  const lemonPromoReservation: Reservation = {
    ...baseReservation,
    productId: 'fresh-lemon-cupcakes-8',
    quantity: 1,
    requestNote: '[Promo lemoni] 10% discount applied: 45.00 -> 40.50',
    totalPrice: 40.5,
    totalPriceCents: 4050,
  }

  const unchanged = buildAdminReservationUpdate(lemonPromoReservation, {})
  assert.equal(unchanged.totalPrice, 40.5)
  assert.equal(unchanged.totalPriceCents, 4050)

  const changed = buildAdminReservationUpdate(lemonPromoReservation, { productId: 'fresh-lemon-cupcakes-12' })
  assert.equal(changed.totalPrice, 58.5)
  assert.equal(changed.totalPriceCents, 5850)
})

test('ordinary request text mentioning a promo does not change admin pricing', () => {
  const reservation = { ...baseReservation, requestNote: 'Can I use Promo verygoodSYD later?' }
  const update = buildAdminReservationUpdate(reservation, {})
  assert.equal(update.totalPrice, 75)
  assert.equal(update.totalPriceCents, 7500)
})

test('a forged promo-looking request note without the matching stored discount is ignored', () => {
  const reservation = {
    ...baseReservation,
    requestNote: '[Promo verygoodSYD] 10% discount applied: 75.00 -> 67.50',
  }
  const update = buildAdminReservationUpdate(reservation, {})
  assert.equal(update.totalPrice, 75)
  assert.equal(update.totalPriceCents, 7500)
})
