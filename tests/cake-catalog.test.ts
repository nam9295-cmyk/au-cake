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
import {
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_SHEET_OPTIONS,
  type ReservationPriceOptions,
} from '../src/lib/constants.js'
import { marketConfig } from '../src/lib/market.js'
import { getPublicCakePage } from '../src/lib/public-content.js'
import type { ProductId } from '../src/lib/types.js'

const expectedCatalog = [
  {
    id: 'pave',
    slug: 'pave-chocolate-cake',
    defaultProductId: 'pave-cake',
    productIds: ['pave-cake'],
  },
  {
    id: 'vanilla-fresh-cream',
    slug: 'vanilla-fresh-cream-cake',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
  },
  {
    id: 'buttercream',
    slug: 'buttercream-cake',
    defaultProductId: 'buttercream-cake',
    productIds: ['buttercream-cake'],
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

test('AU sale catalogue exposes the final seven independent products in customer order', () => {
  const catalog = getAuCakeCatalog()

  assert.deepEqual(
    catalog.map(({ id, slug, defaultProductId, productIds }) => ({ id, slug, defaultProductId, productIds })),
    [
      { id: 'pave', slug: 'pave-chocolate-cake', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
      {
        id: 'vanilla-fresh-cream',
        slug: 'vanilla-fresh-cream-cake',
        defaultProductId: 'vanilla-fresh-cream-cake',
        productIds: ['vanilla-fresh-cream-cake'],
      },
      { id: 'buttercream', slug: 'buttercream-cake', defaultProductId: 'buttercream-cake', productIds: ['buttercream-cake'] },
      { id: 'cupcake', slug: 'chocolate-cupcakes', defaultProductId: 'cupcake-dozen', productIds: ['cupcake-half-dozen', 'cupcake-dozen'] },
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
    ],
  )

  assert.equal(getCakeCatalogEntryByProductId('cupcake-dozen')?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('cupcake-half-dozen' as ProductId)?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('pound-cake')?.id, 'signature-gateau')
  assert.equal(getCakeCatalogEntryBySlug('chocolatiers-basque-cheesecake'), null)
})

test('AU cake catalog owns seven unique public slugs and stable backend product IDs', () => {
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
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake')?.slug, 'vanilla-fresh-cream-cake')
  assert.equal(getCakeCatalogEntryByProductId('choco-basque-cheesecake'), null)
})

test('catalog cards expose separated Cupcake and Signature names in English and Korean', () => {
  const english = getAuCakeCatalogCards('en')
  const korean = getAuCakeCatalogCards('ko')
  assert.deepEqual(english.map((card) => card.name), [
    'Pave Chocolate Cake', 'Vanilla Fresh Cream Cake', 'Buttercream Cake', 'Chocolate Cupcakes',
    'Signature Gâteau au Chocolat', 'Lemon Cake', 'Brownie Cheesecake',
  ])
  assert.deepEqual(korean.map((card) => card.name), [
    '파베 초콜릿 케이크', '바닐라 생크림 케이크', '버터크림 케이크', '초콜릿 컵케이크',
    '시그니처 갸또 쇼콜라', '레몬 케이크', '브라우니 치즈케이크',
  ])
  assert.equal(english.find((card) => card.id === 'buttercream')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'buttercream')?.imagePath, '/products/buttercream-cake-sydney.webp')
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.imagePath, '/products/brownie-cheese-sydney.webp')
  assert.equal(english.find((card) => card.id === 'cupcake')?.imagePath, '/products/chocolate-cupcakes-sydney.webp')
  assert.deepEqual(
    english.map((card) => [card.id, card.priceLabel]),
    [
      ['pave', 'AUD 79.00'],
      ['vanilla-fresh-cream', 'From AUD 69.00'],
      ['buttercream', 'From AUD 74.00'],
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

test('canonical Pave and cream-cake statements match the selectable AU products', () => {
  const pave = getPublicCakePage('pave-chocolate-cake')
  const vanilla = getPublicCakePage('vanilla-fresh-cream-cake')
  const buttercream = getPublicCakePage('buttercream-cake')
  assert.equal(pave?.optionSummary, 'Choose a size · dark chocolate only')
  assert.equal(pave?.startingPrice, 79)
  assert.equal(pave?.description, 'A rich four-layer chocolate cake built for a dense, chocolate-forward bite. Instead of a light sponge-and-cream style, each layer is filled with smooth pave chocolate ganache, creating a substantial cake with deep chocolate flavour from the first slice to the last.')
  assert.doesNotMatch(pave?.optionSummary || '', /milk/i)
  assert.deepEqual(
    marketConfig.chocolateTypeOptions.map((option) => option.value),
    ['dark'],
  )
  assert.match(vanilla?.description || '', /Signature Gâteau au Chocolat/)
  assert.match(vanilla?.description || '', /100% fresh milk/)
  assert.match(vanilla?.description || '', /real vanilla bean/)
  assert.doesNotMatch(vanilla?.description || '', /Triple berry|Nutella/)
  assert.deepEqual(
    VANILLA_CAKE_SHEET_OPTIONS.map((option) => option.value),
    ['chocolate'],
  )
  assert.deepEqual(
    VANILLA_CAKE_FLAVOR_OPTIONS.map((option) => option.value),
    ['plain'],
  )
  assert.equal(vanilla?.imagePath, '/products/vanilla-cake-sydney.webp')
  assert.match(buttercream?.description || '', /Signature Gâteau au Chocolat/)
  assert.match(buttercream?.description || '', /organic cocoa/)
  assert.match(buttercream?.description || '', /not added chocolate flavouring/)
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
  { productId: 'pave-cake', options: { cakeSize: '15cm' } },
  { productId: 'pave-cake', options: { cakeSize: '19cm' } },
  { productId: 'pave-cake', options: { cakeSize: '22cm' } },
  { productId: 'buttercream-cake', options: { cakeSize: '15cm' } },
  { productId: 'buttercream-cake', options: { cakeSize: '19cm' } },
  { productId: 'buttercream-cake', options: { cakeSize: '22cm' } },
  { productId: 'brownie-cheesecake' },
  { productId: 'pave-brownie-cheesecake' },
  { productId: 'eiffel-tower-brownie-cheesecake' },
  { productId: 'fresh-lemon-cupcakes-6' },
  { productId: 'fresh-lemon-cupcakes-6', options: { chocolateIcingCount: 3 } },
  { productId: 'fresh-lemon-cupcakes-8' },
  { productId: 'fresh-lemon-cupcakes-12' },
  { productId: 'fresh-lemon-cupcakes-12', options: { chocolateIcingCount: 8 } },
  { productId: 'fresh-lemon-cupcakes-16' },
  { productId: 'vanilla-fresh-cream-cake', options: { cakeSize: '15cm' } },
  { productId: 'vanilla-fresh-cream-cake', options: { cakeSize: '19cm' } },
  { productId: 'vanilla-fresh-cream-cake', options: { cakeSize: '22cm' } },
]

test('catalog base, size and paid option prices stay equal to the Reservation API authoritative prices', () => {
  const now = new Date('2026-07-26T00:00:00.000Z')

  for (const { productId, options = {} } of serverPriceCases) {
    const serverReservation = buildCakeReservation({
      customerName: 'Catalog Contract',
      customerPhone: '0412345678',
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
