import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createCakeDetailSelection,
  getCakeDetailBySlug,
  getCakeDetailSelectionEstimatedTotal,
  getCakeDetailSelectionTotal,
  selectCakeDetailProduct,
} from '../src/lib/cake-detail.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'
import { getAuCakeCatalogCards } from '../src/lib/cake-catalog.js'
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'

test('eight public sale slugs resolve to independent reusable detail contracts', () => {
  const details = [
    getCakeDetailBySlug('pave-chocolate-cake', 'en'),
    getCakeDetailBySlug('buttercream-cake', 'en'),
    getCakeDetailBySlug('fresh-strawberry-vanilla-cream-cake', 'en'),
    getCakeDetailBySlug('fresh-strawberry-chocolate-cream-cake', 'en'),
    getCakeDetailBySlug('chocolate-cupcakes', 'en'),
    getCakeDetailBySlug('signature-gateau-au-chocolat', 'en'),
    getCakeDetailBySlug('lemon-cake', 'en'),
    getCakeDetailBySlug('brownie-cheesecake', 'en'),
  ]

  assert.deepEqual(details.map((detail) => detail?.slug), [
    'pave-chocolate-cake',
    'buttercream-cake',
    'fresh-strawberry-vanilla-cream-cake',
    'fresh-strawberry-chocolate-cream-cake',
    'chocolate-cupcakes',
    'signature-gateau-au-chocolat',
    'lemon-cake',
    'brownie-cheesecake',
  ])
  assert.deepEqual(details.map((detail) => detail?.gallery.length), [7, 3, 0, 0, 3, 5, 4, 3])
  assert.deepEqual(details[0]?.gallery.slice(0, 4), ['pave-side', 'pave-quick-view', 'pave-previous', 'pave-hero'])
  assert.deepEqual(details[1]?.gallery, ['buttercream-side', 'buttercream-detail', 'buttercream-quick-view'])
  assert.deepEqual(details[4]?.gallery, ['cupcake-side', 'cupcake-detail', 'cupcake-hero'])
  assert.deepEqual(details[5]?.gallery, ['signature-gateau-side', 'signature-gateau-detail', 'signature-gateau-quick-view', 'signature-gateau-previous', 'signature-gateau-hero'])
  assert.deepEqual(details[7]?.gallery, ['brownie-side', 'brownie-detail', 'brownie-quick-view'])
  assert.equal(details[2]?.isPhotoComingSoon, true)
  assert.equal(details[3]?.isPhotoComingSoon, true)
  assert.equal(details[7]?.isPhotoComingSoon, false)
  assert.equal(getCakeDetailBySlug('not-a-cake', 'en'), null)
})

test('sale detail badges mirror the first three Quick View features', () => {
  for (const language of ['en', 'ko'] as const) {
    for (const card of getAuCakeCatalogCards(language)) {
      const detail = getCakeDetailBySlug(card.slug, language)
      assert.ok(detail, card.slug)
      assert.deepEqual(detail.trustPoints, card.features.slice(0, 3), card.slug)
    }
  }

  assert.deepEqual(getCakeDetailBySlug('brownie-cheesecake', 'en')?.trustPoints, [
    'Dark chocolate brownie base',
    'Basque cheesecake on top',
    'Two desserts in one',
  ])
})

test('Brownie Cheesecake keeps its 15cm three-finish sales contract while customer copy explains the baked two-layer dessert', () => {
  const english = getCakeDetailBySlug('brownie-cheesecake', 'en')
  const korean = getCakeDetailBySlug('brownie-cheesecake', 'ko')

  assert.equal(
    english?.description,
    'A rich dark chocolate brownie base topped with a baked Basque-style cheesecake layer. Two contrasting textures come together in one chocolate-and-cheesecake dessert.',
  )
  assert.equal(
    korean?.description,
    '진한 다크초콜릿 브라우니 베이스 위에 부드럽게 구운 바스크 치즈케이크를 올린 2층 디저트입니다. 브라우니와 치즈케이크의 서로 다른 매력을 한 조각에서 함께 즐길 수 있습니다.',
  )
  assert.deepEqual(english?.productIds, ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'])
  assert.equal(english?.optionLabel, 'Three finishing options')
  assert.equal(korean?.optionLabel, '6" | serves 8')
  assert.equal(english?.gallery.join(','), 'brownie-side,brownie-detail,brownie-quick-view')
})

test('Cupcake and Signature detail selections remain independent and normalize hidden options', () => {
  const initial = createCakeDetailSelection('chocolate-cupcakes')
  assert.ok(initial)
  assert.equal(initial.productId, 'cupcake-dozen')
  assert.equal((initial as unknown as { cupcakeFinish?: string }).cupcakeFinish, 'basic')
  assert.equal(initial.individualPackaging, false)

  const cupcakes = selectCakeDetailProduct({
    ...initial,
    poundAddon: 'extra-chocolate',
    chocolateType: 'milk',
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    cupcakeFinish: 'chocolate-buttercream',
    individualPackaging: true,
    quantity: 3,
  } as CakeDetailSelection, 'cupcake-half-dozen' as CakeDetailSelection['productId']) as CakeDetailSelection & { cupcakeFinish?: string }

  assert.equal(cupcakes.productId, 'cupcake-half-dozen')
  assert.equal(cupcakes.poundAddon, 'none')
  assert.equal(cupcakes.chocolateType, 'dark')
  assert.equal(cupcakes.vanillaCreamCount, 0)
  assert.equal(cupcakes.partyDecorationCount, 0)
  assert.equal(cupcakes.cupcakeFinish, 'chocolate-buttercream')
  assert.equal(getCakeDetailSelectionTotal(cupcakes), 123)
  assert.equal(getCakeDetailSelectionEstimatedTotal(cupcakes), 123)
  assert.equal(cupcakes.quantity, 3)

  const signature = createCakeDetailSelection('signature-gateau-au-chocolat')
  assert.equal(signature?.productId, 'pound-cake')
  assert.equal(selectCakeDetailProduct({ ...signature!, individualPackaging: true }, 'pound-cake').individualPackaging, false)
  assert.equal(getCakeDetailBySlug('chocolate-pound-cake-and-cupcakes', 'en')?.isLegacy, true)
  assert.equal(getCakeDetailBySlug('chocolatiers-basque-cheesecake', 'en')?.isLegacy, true)
})

test('current Strawberry cakes create inch selections and keep Buttercream cake colours separate', () => {
  const strawberryVanilla = createCakeDetailSelection('fresh-strawberry-vanilla-cream-cake')
  const strawberryChocolate = createCakeDetailSelection('fresh-strawberry-chocolate-cream-cake')
  const buttercream = createCakeDetailSelection('buttercream-cake')
  assert.equal(strawberryVanilla?.productId, 'fresh-strawberry-vanilla-cream-cake')
  assert.equal(strawberryChocolate?.productId, 'fresh-strawberry-chocolate-cream-cake')
  assert.equal(strawberryVanilla?.cakeSize, '6in')
  assert.equal(strawberryChocolate?.cakeSize, '6in')
  assert.equal(buttercream?.cakeSize, '6in')

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
    individualPackaging: true,
    quantity: 2,
  }

  assert.equal(getCakeDetailSelectionTotal(selection), 75)
  assert.equal(getCakeDetailSelectionEstimatedTotal(selection), 81)

  const reservation = buildCakeReservation({
    customerName: 'Lemon Quantity',
    customerPhone: '0412345678',
    customerEmail: 'lemon@example.com',
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
  assert.equal(reservation.individualPackagingPieces, 12)
  assert.equal(reservation.individualPackagingFeeCents, 600)
  assert.equal(reservation.totalPriceCents, 8100)
})
