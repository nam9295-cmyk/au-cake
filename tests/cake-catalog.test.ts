import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as cakeCatalogModule from '../src/lib/cake-catalog.js'
// Reservation API business rules are deployed as JavaScript; this contract test imports the runtime module with --allowJs.
import { buildCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import {
  getAuCakeCatalog,
  getAuCakeCatalogCards,
  getAuCakeCatalogGroups,
  getCakeCatalogEntryByProductId,
  getCakeCatalogEntryBySlug,
  getCakeCatalogUnitPrice,
} from '../src/lib/cake-catalog.js'
import { type ReservationPriceOptions } from '../src/lib/constants.js'
import { marketConfig } from '../src/lib/market.js'
import { getPublicCakePage, isLegacyCakePublicPage } from '../src/lib/public-content.js'
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
    id: 'signature-gateau',
    slug: 'signature-gateau-au-chocolat',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake'],
  },
  {
    id: 'cupcake',
    slug: 'chocolate-cupcakes',
    defaultProductId: 'cupcake-dozen',
    productIds: ['cupcake-half-dozen', 'cupcake-dozen'],
  },
  {
    id: 'bento-cake',
    slug: 'bento-cake',
    defaultProductId: undefined,
    productIds: [],
  },
  {
    id: 'fresh-strawberry-vanilla-cream',
    slug: 'fresh-strawberry-vanilla-cream-cake',
    defaultProductId: 'fresh-strawberry-vanilla-cream-cake',
    productIds: ['fresh-strawberry-vanilla-cream-cake'],
  },
  {
    id: 'brownie-cheesecake',
    slug: 'brownie-cheesecake',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake'],
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
  },
  {
    id: 'smore-stick',
    slug: 'smore-stick',
    defaultProductId: 'smore-stick',
    productIds: ['smore-stick'],
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
  assert.equal(getCakeCatalogEntryByProductId('smore-stick')?.id, 'smore-stick')
  assert.equal(getCakeCatalogEntryBySlug('chocolatiers-basque-cheesecake'), null)
})

test('AU home hero prioritizes the two Strawberry cakes, Pave, then Brownie before the remaining catalogue', () => {
  const getAuHomeHeroCards = (cakeCatalogModule as unknown as {
    getAuHomeHeroCards?: (language: 'en' | 'ko') => readonly { id: string }[]
  }).getAuHomeHeroCards

  assert.equal(typeof getAuHomeHeroCards, 'function')
  if (!getAuHomeHeroCards) return

  assert.deepEqual(
    getAuHomeHeroCards('en').map((card) => card.id),
    [
      'fresh-strawberry-vanilla-cream',
      'pave',
      'brownie-cheesecake',
      'signature-gateau',
      'cupcake',
      'bento-cake',
      'fresh-lemon-cupcakes',
      'smore-stick',
    ],
  )
})

test('AU cake catalog owns eight unique public slugs and stable backend product IDs', () => {
  const catalog = getAuCakeCatalog()
  assert.deepEqual(
    catalog.map(({ id, slug, defaultProductId, productIds }) => ({ id, slug, defaultProductId, productIds })),
    expectedCatalog,
  )
  assert.equal(new Set(catalog.map((entry) => entry.slug)).size, catalog.length)
  assert.equal(getCakeCatalogEntryBySlug('pave-chocolate-cake')?.id, 'pave')
  assert.equal(getCakeCatalogEntryBySlug('signature-gateau-au-chocolat')?.id, 'signature-gateau')
  assert.equal(getCakeCatalogEntryBySlug('missing-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('cupcake-dozen')?.id, 'cupcake')
  assert.equal(getCakeCatalogEntryByProductId('pound-cake')?.id, 'signature-gateau')
  assert.equal(getCakeCatalogEntryByProductId('smore-stick')?.id, 'smore-stick')
  assert.equal(getCakeCatalogEntryByProductId('brownie-cheesecake')?.id, 'brownie-cheesecake')
  assert.equal(getCakeCatalogEntryByProductId('buttercream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('fresh-strawberry-chocolate-cream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('eiffel-tower-brownie-cheesecake'), null)
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('choco-basque-cheesecake'), null)
})

test('AU catalogue groups own the exact bilingual four-by-two presentation contract', () => {
  const english = getAuCakeCatalogGroups('en')
  const korean = getAuCakeCatalogGroups('ko')

  assert.deepEqual(
    english.map(({ id, number, title, description, cards }) => ({
      id,
      number,
      title,
      description,
      productIds: cards.map((card) => card.id),
    })),
    [
      {
        id: 'signature-gateau',
        number: '01',
        title: 'SIGNATURE GÂTEAU',
        description: 'Rich chocolate cakes built on our signature gâteau layers.',
        productIds: ['pave', 'signature-gateau'],
      },
      {
        id: 'gateau-sharing',
        number: '02',
        title: 'GÂTEAU SHARING',
        description: 'Chocolate gâteau creations crafted for gatherings and shared celebration.',
        productIds: ['cupcake', 'bento-cake'],
      },
      {
        id: 'chocolatiers-cake',
        number: '03',
        title: 'CHOCOLATIER’S CAKE',
        description: 'Classic artisanal cakes crafted with fresh cream and rich chocolate balance.',
        productIds: ['fresh-strawberry-vanilla-cream', 'brownie-cheesecake'],
      },
      {
        id: 'gather-celebrate',
        number: '04',
        title: 'GATHER & CELEBRATE',
        description: 'Refreshing citrus cakes and crowd-pleasing sweets for parties and group orders.',
        productIds: ['fresh-lemon-cupcakes', 'smore-stick'],
      },
    ],
  )

  assert.deepEqual(
    korean.map(({ title, description }) => ({ title, description })),
    [
      { title: '시그니처 갸또', description: '진하고 밀도감 있는 시그니처 갸또 쇼콜라 시트로 완성한 케이크.' },
      { title: '갸또 셰어링', description: '여럿이 함께 나누기 좋은 갸또 디저트와 케이크.' },
      { title: '쇼콜라티에 케이크', description: '신선한 생크림과 진한 초콜릿의 조화로 완성한 케이크.' },
      { title: '개더 & 셀레브레이트', description: '파티와 단체 모임, 특별한 날에 함께하기 좋은 디저트.' },
    ],
  )

  assert.equal(english.length, 4)
  assert.ok(english.every((group) => group.cards.length === 2))
  const currentIds = english.flatMap((group) => group.cards.map((card) => card.id))
  assert.equal(currentIds.length, 8)
  assert.equal(new Set(currentIds).size, 8)
  assert.equal(currentIds.includes('vanilla-fresh-cream'), false)
  assert.equal(currentIds.includes('buttercream'), false)
  assert.equal(getAuCakeCatalog().flatMap((entry) => entry.productIds).includes('eiffel-tower-brownie-cheesecake'), false)
})

test('catalog cards expose the approved AU category display names while Korean names stay unchanged', () => {
  const english = getAuCakeCatalogCards('en')
  const korean = getAuCakeCatalogCards('ko')
  assert.deepEqual(english.map((card) => card.name), [
    'PAVÉ CHOCOLATE GÂTEAU', 'SIGNATURE GÂTEAU LOAF (POUND)', 'GÂTEAU CUPCAKES (FOR SHARING)',
    'BENTO CAKE', 'VANILLA FRESH CREAM CAKE', 'Chocolatier’s BROWNIE CHEESECAKE',
    'Patissier’s LEMON GLAZE CAKE', 'S’MORE STICK',
  ])
  assert.deepEqual(korean.map((card) => card.name), [
    '파베 초콜릿 케이크', '시그니처 갸또 쇼콜라', '초콜릿 컵케이크',
    '도시락 케이크', '생딸기 바닐라 생크림 케이크', '브라우니 치즈케이크',
    '레몬 케이크', '스모어 스틱',
  ])
  assert.equal(english.find((card) => card.id === 'bento-cake')?.isComingSoonOnly, true)
  assert.equal(english.find((card) => card.id === 'bento-cake')?.priceLabel, 'COMING SOON')
  assert.equal(english.find((card) => card.id === 'bento-cake')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'smore-stick')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'smore-stick')?.priceLabel, 'From AUD 4.50')
  assert.equal(english.find((card) => card.id === 'fresh-strawberry-vanilla-cream')?.isPhotoComingSoon, false)
  assert.equal(
    english.find((card) => card.id === 'fresh-strawberry-vanilla-cream')?.imagePath,
    '/products/fresh-strawberry-vanilla-cream-cake-sydney.webp',
  )
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.isPhotoComingSoon, false)
  assert.equal(english.find((card) => card.id === 'brownie-cheesecake')?.imagePath, '/products/brownie-cheesecake-sydney.webp')
  assert.equal(english.find((card) => card.id === 'cupcake')?.imagePath, '/products/chocolate-cupcakes-sydney.webp')
  assert.equal(english.find((card) => card.id === 'signature-gateau')?.imagePath, '/products/signature-gateau-au-chocolat-sydney.webp')
  assert.deepEqual(
    english.map((card) => [card.id, card.priceLabel]),
    [
      ['pave', 'AUD 79.00'],
      ['signature-gateau', 'AUD 45.00'],
      ['cupcake', 'From AUD 31.00'],
      ['bento-cake', 'COMING SOON'],
      ['fresh-strawberry-vanilla-cream', 'From AUD 65.00'],
      ['brownie-cheesecake', 'From AUD 85.00'],
      ['fresh-lemon-cupcakes', 'From AUD 36.00'],
      ['smore-stick', 'From AUD 4.50'],
    ],
  )
  assert.equal(english.find((card) => card.id === 'pave')?.features[0], 'Signature Gâteau layers')
  assert.equal(english.find((card) => card.id === 'fresh-strawberry-vanilla-cream')?.features[2], 'Soft genoise layers')
  assert.equal(korean.find((card) => card.id === 'pave')?.features[0], '시그니처 갸또 쇼콜라 시트')
  assert.equal(korean.find((card) => card.id === 'fresh-strawberry-vanilla-cream')?.features[2], '부드러운 제누아즈 시트')
})

test('AU catalogue cards use the canonical public image for every available photo', () => {
  for (const card of getAuCakeCatalogCards('en')) {
    if (card.isComingSoonOnly) {
      assert.equal(card.imagePath, '/products/bento-cake-sydney.webp')
      continue
    }
    const page = getPublicCakePage(card.slug)
    assert.ok(page, card.slug)
    assert.equal(card.imagePath, page.imagePath, card.slug)
    assert.equal(card.optionLabel, page.cardOptionLabel, card.slug)
    if (!card.isPhotoComingSoon) assert.notEqual(card.imagePath, '', card.slug)
  }
})

test('canonical Whole Cake statements match the selectable AU products', () => {
  const pave = getPublicCakePage('pave-chocolate-cake')
  const strawberryVanilla = getPublicCakePage('fresh-strawberry-vanilla-cream-cake')
  const buttercreamLegacy = getPublicCakePage('buttercream-cake')
  const strawberryChocolateLegacy = getPublicCakePage('fresh-strawberry-chocolate-cream-cake')
  assert.equal(pave?.optionSummary, 'Choose a size · dark chocolate only')
  assert.equal(pave?.startingPrice, 79)
  assert.equal(pave?.description, 'A rich four-layer chocolate cake built for a dense, chocolate-forward bite. Instead of a light sponge-and-cream style, each layer is filled with smooth pave chocolate ganache, creating a substantial cake with deep chocolate flavour from the first slice to the last.')
  assert.doesNotMatch(pave?.optionSummary || '', /milk/i)
  assert.deepEqual(
    marketConfig.chocolateTypeOptions.map((option) => option.value),
    ['dark'],
  )
  assert.ok(buttercreamLegacy)
  assert.equal(isLegacyCakePublicPage('buttercream-cake'), true)
  assert.equal(buttercreamLegacy.startingPrice, null)
  assert.match(strawberryVanilla?.description || '', /Real vanilla bean/)
  assert.match(strawberryVanilla?.description || '', /fresh strawberries/)
  assert.ok(strawberryChocolateLegacy)
  assert.equal(isLegacyCakePublicPage('fresh-strawberry-chocolate-cream-cake'), true)
  assert.equal(strawberryChocolateLegacy.startingPrice, null)
  assert.equal(strawberryVanilla?.imagePath, '/products/fresh-strawberry-vanilla-cream-cake-sydney.webp')
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
  { productId: 'fresh-lemon-cupcakes-6' },
  { productId: 'fresh-lemon-cupcakes-6', options: { chocolateIcingCount: 3 } },
  { productId: 'fresh-lemon-cupcakes-8' },
  { productId: 'fresh-lemon-cupcakes-12' },
  { productId: 'fresh-lemon-cupcakes-12', options: { chocolateIcingCount: 8 } },
  { productId: 'fresh-lemon-cupcakes-16' },
]

test('secondary catalogue exactly matches the deployed Reservation API final pricing', () => {
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
      ...(productId === 'brownie-cheesecake' || productId === 'pave-brownie-cheesecake'
        ? { brownieCreamOption: options.brownieCreamOption || 'none' }
        : {}),
      vanillaCakeSheet: 'chocolate',
      vanillaCakeFlavor: 'plain',
      quantity: 1,
      pickupDate: '2026-08-01',
      pickupTime: '10:00',
      requestNote: '',
      privacyConsent: true,
      website: '',
    }, { now, reservationNumber: 'VG-C-AU-CATALOG' })

    const frontendPrice = getCakeCatalogUnitPrice(productId, options)
    assert.equal(frontendPrice, serverReservation.totalPrice, `${productId} ${JSON.stringify(options)}`)
  }
})

test('current Whole Cake contract matches agreed backend product, size, price and serving values', async () => {
  const { getReservationUnitPrice } = await import('../src/lib/constants.js')

  assert.deepEqual(getAuCakeCatalog().map((entry) => entry.defaultProductId), [
    'pave-cake',
    'pound-cake',
    'cupcake-dozen',
    undefined,
    'fresh-strawberry-vanilla-cream-cake',
    'brownie-cheesecake',
    'fresh-lemon-cupcakes-12',
    'smore-stick',
  ])
  assert.deepEqual(getCurrentWholeCakeSizeOptions('pave-cake'), ['6in', '8in', '10in'])
  assert.deepEqual(getCurrentWholeCakeSizeOptions('fresh-strawberry-vanilla-cream-cake'), ['6in', '8in', '10in'])
  assert.equal(getCakeServingProfile('pave-cake'), 'gateau')
  assert.equal(getCakeServingProfile('fresh-strawberry-vanilla-cream-cake'), 'genoise')
  assert.deepEqual([
    getReservationUnitPrice('pave-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('pave-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('pave-cake', { cakeSize: '10in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '6in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '8in' }),
    getReservationUnitPrice('fresh-strawberry-vanilla-cream-cake', { cakeSize: '10in' }),
  ], [79, 109, 159, 65, 89, 129])
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('buttercream-cake'), null)
})
