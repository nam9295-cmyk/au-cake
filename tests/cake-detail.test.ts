import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createCakeDetailSelection,
  getCakeDetailBySlug,
  getCakeDetailSelectionTotal,
  selectCakeDetailProduct,
} from '../src/lib/cake-detail.js'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'

test('five public cake slugs resolve to one reusable detail data contract', () => {
  const details = [
    getCakeDetailBySlug('chocolate-pound-cake-and-cupcakes', 'en'),
    getCakeDetailBySlug('pave-chocolate-cake', 'en'),
    getCakeDetailBySlug('chocolatiers-basque-cheesecake', 'en'),
    getCakeDetailBySlug('lemon-cake', 'en'),
    getCakeDetailBySlug('vanilla-fresh-cream-cake', 'en'),
  ]

  assert.deepEqual(details.map((detail) => detail?.slug), [
    'chocolate-pound-cake-and-cupcakes',
    'pave-chocolate-cake',
    'chocolatiers-basque-cheesecake',
    'lemon-cake',
    'vanilla-fresh-cream-cake',
  ])
  assert.deepEqual(details.map((detail) => detail?.gallery.length), [6, 7, 4, 4, 0])
  assert.deepEqual(details[0]?.gallery.slice(0, 4), ['pound-side', 'pound-quick-view', 'pound-previous', 'pound-hero'])
  assert.deepEqual(details[1]?.gallery.slice(0, 4), ['pave-side', 'pave-quick-view', 'pave-previous', 'pave-hero'])
  assert.deepEqual(details[2]?.gallery, ['cheesecake-side', 'cheesecake-quick-view', 'cheesecake-previous', 'cheesecake-hero'])
  assert.deepEqual(details[3]?.gallery, ['lemon-side', 'lemon-quick-view', 'lemon-previous', 'lemon-hero'])
  assert.equal(details[4]?.isPhotoComingSoon, true)
  assert.equal(getCakeDetailBySlug('not-a-cake', 'en'), null)
})

test('detail selection swaps grouped products without carrying hidden options', () => {
  const initial = createCakeDetailSelection('chocolate-pound-cake-and-cupcakes')
  assert.ok(initial)
  assert.equal(initial.productId, 'pound-cake')

  const cupcakes = selectCakeDetailProduct({
    ...initial,
    poundAddon: 'extra-chocolate',
    chocolateType: 'milk',
    quantity: 3,
  }, 'cupcake-dozen')

  assert.equal(cupcakes.productId, 'cupcake-dozen')
  assert.equal(cupcakes.poundAddon, 'none')
  assert.equal(cupcakes.chocolateType, 'dark')
  assert.equal(cupcakes.quantity, 3)
})

test('Lemon Cake supports two or more identical packs with simple quantity multiplication', () => {
  const initial = createCakeDetailSelection('lemon-cake')
  assert.ok(initial)
  const selection = {
    ...selectCakeDetailProduct(initial, 'fresh-lemon-cupcakes-6'),
    chocolateIcingCount: 3,
    quantity: 2,
  }

  assert.equal(getCakeDetailSelectionTotal(selection), 75)

  const reservation = buildCakeReservation({
    customerName: 'Lemon Quantity',
    customerPhone: '0412345678',
    ...selection,
    pickupDate: '2026-08-01',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    privacyConsent: true,
    website: '',
  }, {
    now: new Date('2026-07-29T00:00:00.000Z'),
    reservationNumber: 'VG-C-AU-LEMON-QTY',
  })

  assert.equal(reservation.quantity, 2)
  assert.equal(reservation.totalPriceCents, 7500)
})
