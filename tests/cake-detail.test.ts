import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createCakeDetailSelection,
  getCakeDetailBySlug,
  getCakeDetailSelectionTotal,
  selectCakeDetailProduct,
} from '../src/lib/cake-detail.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'

test('seven public sale slugs resolve to independent reusable detail contracts', () => {
  const details = [
    getCakeDetailBySlug('pave-chocolate-cake', 'en'),
    getCakeDetailBySlug('vanilla-fresh-cream-cake', 'en'),
    getCakeDetailBySlug('buttercream-cake', 'en'),
    getCakeDetailBySlug('chocolate-cupcakes', 'en'),
    getCakeDetailBySlug('signature-gateau-au-chocolat', 'en'),
    getCakeDetailBySlug('lemon-cake', 'en'),
    getCakeDetailBySlug('brownie-cheesecake', 'en'),
  ]

  assert.deepEqual(details.map((detail) => detail?.slug), [
    'pave-chocolate-cake',
    'vanilla-fresh-cream-cake',
    'buttercream-cake',
    'chocolate-cupcakes',
    'signature-gateau-au-chocolat',
    'lemon-cake',
    'brownie-cheesecake',
  ])
  assert.deepEqual(details.map((detail) => detail?.gallery.length), [7, 2, 0, 2, 4, 4, 2])
  assert.deepEqual(details[0]?.gallery.slice(0, 4), ['pave-side', 'pave-quick-view', 'pave-previous', 'pave-hero'])
  assert.deepEqual(details[3]?.gallery, ['cupcake-side', 'cupcake-hero'])
  assert.deepEqual(details[4]?.gallery, ['signature-gateau-side', 'signature-gateau-quick-view', 'signature-gateau-previous', 'signature-gateau-hero'])
  assert.deepEqual(details[6]?.gallery, ['brownie-side', 'brownie-quick-view'])
  assert.equal(details[2]?.isPhotoComingSoon, true)
  assert.equal(details[6]?.isPhotoComingSoon, false)
  assert.equal(getCakeDetailBySlug('not-a-cake', 'en'), null)
})

test('Cupcake and Signature detail selections remain independent and normalize hidden options', () => {
  const initial = createCakeDetailSelection('chocolate-cupcakes')
  assert.ok(initial)
  assert.equal(initial.productId, 'cupcake-dozen')
  assert.equal((initial as unknown as { cupcakeFinish?: string }).cupcakeFinish, 'basic')

  const cupcakes = selectCakeDetailProduct({
    ...initial,
    poundAddon: 'extra-chocolate',
    chocolateType: 'milk',
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    cupcakeFinish: 'chocolate-buttercream',
    quantity: 3,
  } as CakeDetailSelection, 'cupcake-half-dozen' as CakeDetailSelection['productId']) as CakeDetailSelection & { cupcakeFinish?: string }

  assert.equal(cupcakes.productId, 'cupcake-half-dozen')
  assert.equal(cupcakes.poundAddon, 'none')
  assert.equal(cupcakes.chocolateType, 'dark')
  assert.equal(cupcakes.vanillaCreamCount, 0)
  assert.equal(cupcakes.partyDecorationCount, 0)
  assert.equal(cupcakes.cupcakeFinish, 'chocolate-buttercream')
  assert.equal(getCakeDetailSelectionTotal(cupcakes), 123)
  assert.equal(cupcakes.quantity, 3)

  const signature = createCakeDetailSelection('signature-gateau-au-chocolat')
  assert.equal(signature?.productId, 'pound-cake')
  assert.equal(getCakeDetailBySlug('chocolate-pound-cake-and-cupcakes', 'en')?.isLegacy, true)
  assert.equal(getCakeDetailBySlug('chocolatiers-basque-cheesecake', 'en')?.isLegacy, true)
})

test('cream cake details create plain chocolate-sheet selections and keep Buttercream point colours separate', () => {
  const vanilla = createCakeDetailSelection('vanilla-fresh-cream-cake')
  const buttercream = createCakeDetailSelection('buttercream-cake')
  assert.equal(vanilla?.vanillaCakeSheet, 'chocolate')
  assert.equal(vanilla?.vanillaCakeFlavor, 'plain')
  assert.equal(buttercream?.vanillaCakeSheet, 'chocolate')
  assert.equal(buttercream?.vanillaCakeFlavor, 'plain')

  const blueButtercream = selectCakeDetailProduct({
    ...buttercream!,
    vanillaCakePointColor: 'blue',
  }, 'buttercream-cake')
  assert.equal(blueButtercream.vanillaCakePointColor, 'blue')
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
