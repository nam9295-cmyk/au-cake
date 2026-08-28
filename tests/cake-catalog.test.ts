import { test } from 'node:test'
import * as assert from 'node:assert/strict'
// Reservation API business rules are deployed as JavaScript; this contract test imports the runtime module with --allowJs.
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import {
  getAuCakeCatalog,
  getAuCakeCatalogCards,
  getCakeCatalogEntryByProductId,
  getCakeCatalogEntryBySlug,
  getCakeCatalogUnitPrice,
} from '../src/lib/cake-catalog.js'
import { type ReservationPriceOptions } from '../src/lib/constants.js'
import { marketConfig } from '../src/lib/market.js'
import { getPublicCakePage } from '../src/lib/public-content.js'
import { getCakeServingProfile, getCurrentWholeCakeSizeOptions } from '../src/lib/cake-serving.js'
import type { ProductId } from '../src/lib/types.js'

const expectedCatalog = [
  {
    id: 'pave',
    slug: 'pave-chocolate-cake',
    defaultProductId: 'pave-cake',
    productIds: ['pave-cake'],
  },
  {
    id: 'buttercream',
    slug: 'buttercream-cake',
    defaultProductId: 'buttercream-cake',
    productIds: ['buttercream-cake'],
  },
  {
    id: 'fresh-strawberry-vanilla-cream',
    slug: 'fresh-strawberry-vanilla-cream-cake',
    defaultProductId: 'fresh-strawberry-vanilla-cream-cake',
    productIds: ['fresh-strawberry-vanilla-cream-cake'],
  },
  {
    id: 'fresh-strawberry-chocolate-cream',
    slug: 'fresh-strawberry-chocolate-cream-cake',
    defaultProductId: 'fresh-strawberry-chocolate-cream-cake',
    productIds: ['fresh-strawberry-chocolate-cream-cake'],
  },
  {
    id: 'cupcake',
    slug: 'chocolate-cupcakes',
    defaultProductId: 'cupcake-dozen',
    productIds: ['cupcake-half-dozen', 'cupcake-dozen'],
  },
  {
    id: 'signature-gateau',
    slug: 'signature-gateau-au-chocolat',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake'],
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
  },
  {
    id: 'brownie-cheesecake',
    slug: 'brownie-cheesecake',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'],
  },
] as const

test('AU sale catalogue exposes the final eight independent products in customer order', () => {
  const catalog = getAuCakeCatalog()

  assert.deepEqual(
    catalog.map(({ id, slug, defaultProductId, productIds }) => ({ id, slug, defaultProductId, productIds })),
    expectedCatalog,
  )

  assert.equal(getCakeCatalogEntryByProductId('cupcake-dozen')?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('cupcake-half-dozen' as ProductId)?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('pound-cake')?.id, 'signature-gateau')
  assert.equal(getCakeCatalogEntryBySlug('chocolatiers-basque-cheesecake'), null)
})

test('AU cake catalog owns eight unique public slugs and stable backend product IDs', () => {
  const catalog = getAuCakeCatalog()
  assert.deepEqual(
    catalog.map(({ id, slug, defaultProductId, productIds }) => ({ id, slug, defaultProductId, productIds })),
    expectedCatalog,
  )
  assert.equal(new Set(catalog.map((entry) => entry.slug)).size, catalog.length)
  assert.equal(getCakeCatalogEntryBySlug('pave-chocolate-cake')?.id, 'pave')
  assert.equal(getCakeCatalogEntryBySlug('missing-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('cupcake-dozen')?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('pound-cake')?.id, 'signature-gateau')
  assert.equal(getCakeCatalogEntryByProductId('buttercream-cake')?.id, 'buttercream')
  assert.equal(getCakeCatalogEntryByProductId('brownie-cheesecake')?.id, 'brownie-cheesecake')
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('choco-basque-cheesecake'), null)
})

test('catalog cards expose separated Cupcake and Signature names in English and Korean', () => {
  const english = getAuCakeCatalogCards('en')
  const korean = getAuCakeCatalogCards('ko')
  assert.deepEqual(english.map((card) => card.name), [
    'Pave Chocolate Cake', 'Buttercream Cake', 'Fresh Strawberry Vanilla Cream Cake',
    'Fresh Strawberry Chocolate Cream Cake', 'Chocolate Cupcakes', 'Signature Gâteau au Chocolat',
    'Lemon Cake', 'Brownie Cheesecake',
  ])
  assert.deepEqual(korean.map((card) => card.name), [
    '파베 초콜릿 케이크', '버터크림 케이크', '생딸기 바닐라 생크림 케이크',
    '생딸기 초코 생크림 케이크', '초콜릿 컵케이크', '시그니처 갸또 쇼콜라',
    '레몬 케이크', '브라우니 치즈케이크',
  ])
  assert.equal(english.find((card) => card.id === 'buttercream')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'buttercream')?.imagePath, '/products/buttercream-cake-sydney.webp')
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.imagePath, '/products/brownie-cheesecake-sydney.webp')
  assert.equal(english.find((card) => card.id === 'cupcake')?.imagePath, '/products/chocolate-cupcakes-sydney.webp')
  assert.equal(english.find((card) => card.id === 'signature-gateau')?.imagePath, '/products/signature-gateau-au-chocolat-sydney.webp')
  assert.deepEqual(
    english.map((card) => [card.id, card.priceLabel]),
    [
      ['pave', 'AUD 79.00'],
      ['buttercream', 'From AUD 75.00'],
      ['fresh-strawberry-vanilla-cream', 'From AUD 69.00'],
      ['fresh-strawberry-chocolate-cream', 'From AUD 72.00'],
      ['cupcake', 'From AUD 31.00'],
      ['signature-gateau', 'AUD 45.00'],
      ['fresh-lemon-cupcakes', 'From AUD 36.00'],
      ['brownie-cheesecake', 'From AUD 55.00'],
    ],
  )
})

test('AU catalogue cards use the canonical public image for every available photo', () => {
  for (const card of getAuCakeCatalogCards('en')) {
    const page = getPublicCakePage(card.slug)
    assert.ok(page, card.slug)
    assert.equal(card.imagePath, page.imagePath, card.slug)
    assert.equal(card.optionLabel, page.cardOptionLabel, card.slug)
    if (!card.isPhotoComingSoon) assert.notEqual(card.imagePath, '', card.slug)
  }
})

test('canonical Whole Cake statements match the selectable AU products', () => {
  const pave = getPublicCakePage('pave-chocolate-cake')
  const buttercream = getPublicCakePage('buttercream-cake')
  const strawberryVanilla = getPublicCakePage('fresh-strawberry-vanilla-cream-cake')
  const strawberryChocolate = getPublicCakePage('fresh-strawberry-chocolate-cream-cake')
  assert.equal(pave?.optionSummary, 'Choose a size · dark chocolate only')
  assert.equal(pave?.startingPrice, 79)
  assert.equal(pave?.description, 'A rich four-layer chocolate cake built for a dense, chocolate-forward bite. Instead of a light sponge-and-cream style, each layer is filled with smooth pave chocolate ganache, creating a substantial cake with deep chocolate flavour from the first slice to the last.')
  assert.doesNotMatch(pave?.optionSummary || '', /milk/i)
  assert.deepEqual(
    marketConfig.chocolateTypeOptions.map((option) => option.value),
    ['dark'],
  )
  assert.match(buttercream?.description || '', /Italian meringue/)
  assert.match(buttercream?.description || '', /real butter/)
  assert.match(buttercream?.description || '', /cocoa powder/)
  assert.match(strawberryVanilla?.description || '', /Real vanilla bean/)
  assert.match(strawberryVanilla?.description || '', /fresh strawberries/)
  assert.match(strawberryChocolate?.description || '', /chocolate fresh cream/)
  assert.equal(strawberryVanilla?.imagePath, '')
  assert.equal(strawberryChocolate?.imagePath, '')
})

const serverPriceCases: Array<{
  productId: ProductId
  options?: ReservationPriceOptions & { cupcakeFinish?: 'basic' | 'vanilla-fresh-cream' | 'chocolate-buttercream' }
}> = [
  { productId: 'pound-cake' },
  { productId: 'pound-cake', options: { poundAddon: 'extra-chocolate', chocolateType: 'milk' } },
  { productId: 'pound-cake', options: { poundAddon: 'vanilla-cream' } },
  { productId: 'cupcake-half-dozen' as ProductId, options: { cupcakeFinish: 'basic' } },
  { productId: 'cupcake-half-dozen' as ProductId, options: { cupcakeFinish: 'vanilla-fresh-cream' } },
  { productId: 'cupcake-half-dozen' as ProductId, options: { cupcakeFinish: 'chocolate-buttercream' } },
  { productId: 'cupcake-dozen', options: { cupcakeFinish: 'basic' } },
  { productId: 'cupcake-dozen', options: { cupcakeFinish: 'vanilla-fresh-cream' } },
  { productId: 'cupcake-dozen', options: { cupcakeFinish: 'chocolate-buttercream' } },
  { productId: 'brownie-cheesecake' },
  { productId: 'pave-brownie-cheesecake' },
  { productId: 'eiffel-tower-brownie-cheesecake' },
  { productId: 'fresh-lemon-cupcakes-6' },
  { productId: 'fresh-lemon-cupcakes-6', options: { chocolateIcingCount: 3 } },
  { productId: 'fresh-lemon-cupcakes-8' },
  { productId: 'fresh-lemon-cupcakes-12' },
  { productId: 'fresh-lemon-cupcakes-12', options: { chocolateIcingCount: 8 } },
  { productId: 'fresh-lemon-cupcakes-16' },
]

test('secondary catalogue prices stay equal to the deployed Reservation API source', () => {
  const now = new Date('2026-07-26T00:00:00.000Z')

  for (const { productId, options = {} } of serverPriceCases) {
    const serverReservation = buildCakeReservation({
      customerName: 'Catalog Contract',
      customerPhone: '0412345678',
      customerEmail: 'catalog@example.com',
      productId,
      cakeSize: options.cakeSize || '15cm',
      chocolateType: options.chocolateType || 'dark',
      poundAddon: options.poundAddon || 'none',
      chocolateIcingCount: options.chocolateIcingCount || 0,
      vanillaCreamCount: options.vanillaCreamCount || 0,
      partyDecorationCount: options.partyDecorationCount || 0,
      cupcakeFinish: options.cupcakeFinish,
      vanillaCakeSheet: 'chocolate',
      vanillaCakeFlavor: 'plain',
      quantity: 1,
      pickupDate: '2026-08-01',
      pickupTime: '10:00',
      requestNote: '',
      privacyConsent: true,
      website: '',
    }, { now, reservationNumber: 'VG-C-AU-CATALOG' })

    assert.equal(
      getCakeCatalogUnitPrice(productId, options),
      serverReservation.totalPrice,
      `${productId} ${JSON.stringify(options)}`,
    )
  }
})

test('current Whole Cake contract matches agreed backend product, size, price and serving values', async () => {
  const { getReservationUnitPrice } = await import('../src/lib/constants.js')

  assert.deepEqual(getAuCakeCatalog().map((entry) => entry.defaultProductId), [
    'pave-cake',
    'buttercream-cake',
    'fresh-strawberry-vanilla-cream-cake',
    'fresh-strawberry-chocolate-cream-cake',
    'cupcake-dozen',
    'pound-cake',
    'fresh-lemon-cupcakes-12',
    'brownie-cheesecake',
  ])
  assert.deepEqual(getCurrentWholeCakeSizeOptions('pave-cake'), ['6in', '8in', '10in'])
  assert.deepEqual(getCurrentWholeCakeSizeOptions('fresh-strawberry-vanilla-cream-cake'), ['6in', '8in', '10in'])
  assert.equal(getCakeServingProfile('pave-cake'), 'gateau')
  assert.equal(getCakeServingProfile('buttercream-cake'), 'gateau')
  assert.equal(getCakeServingProfile('fresh-strawberry-vanilla-cream-cake'), 'genoise')
  assert.equal(getCakeServingProfile('fresh-strawberry-chocolate-cream-cake'), 'genoise')
  assert.deepEqual([
    getReservationUnitPrice('pave-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('pave-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('pave-cake', { cakeSize: '10in' }),
    getReservationUnitPrice('buttercream-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('buttercream-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('buttercream-cake', { cakeSize: '10in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '10in' }),
    getReservationUnitPrice('fresh-strawberry-chocolate-cream-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('fresh-strawberry-chocolate-cream-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('fresh-strawberry-chocolate-cream-cake', { cakeSize: '10in' }),
  ], [79, 109, 159, 75, 99, 145, 69, 89, 129, 72, 95, 135])
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake'), null)
})
