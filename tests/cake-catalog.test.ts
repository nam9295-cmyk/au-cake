import { test } from 'node:test'
import * as assert from 'node:assert/strict'
// Reservation API business rules are deployed as JavaScript; this contract test imports the runtime module with --allowJs.
import { buildCakeReservation } from '../functions/reservation-api/src/business.js'
import {
  getAuCakeCatalog,
  getAuCakeCatalogCards,
  getCakeCatalogEntryByProductId,
  getCakeCatalogEntryBySlug,
  getCakeCatalogUnitPrice,
} from '../src/lib/cake-catalog.js'
import type { ReservationPriceOptions } from '../src/lib/constants.js'
import type { ProductId } from '../src/lib/types.js'

const expectedCatalog = [
  {
    id: 'pound-cupcake',
    slug: 'chocolate-pound-cake-and-cupcakes',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake', 'cupcake-dozen'],
  },
  {
    id: 'pave',
    slug: 'pave-chocolate-cake',
    defaultProductId: 'pave-cake',
    productIds: ['pave-cake'],
  },
  {
    id: 'cheesecake',
    slug: 'chocolatiers-basque-cheesecake',
    defaultProductId: 'choco-basque-cheesecake',
    productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'],
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
  },
  {
    id: 'vanilla-fresh-cream',
    slug: 'vanilla-fresh-cream-cake',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
  },
] as const

test('AU cake catalog owns five unique public slugs and the existing backend product mapping', () => {
  const catalog = getAuCakeCatalog()
  assert.deepEqual(
    catalog.map(({ id, slug, defaultProductId, productIds }) => ({ id, slug, defaultProductId, productIds })),
    expectedCatalog,
  )
  assert.equal(new Set(catalog.map((entry) => entry.slug)).size, catalog.length)
  assert.equal(getCakeCatalogEntryBySlug('pave-chocolate-cake')?.id, 'pave')
  assert.equal(getCakeCatalogEntryBySlug('missing-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('cupcake-dozen')?.id, 'pound-cupcake')
  assert.equal(getCakeCatalogEntryByProductId('vanilla-fresh-cream-cake')?.slug, 'vanilla-fresh-cream-cake')
})

test('catalog cards preserve the current English and Korean home content', () => {
  const english = getAuCakeCatalogCards('en')
  const korean = getAuCakeCatalogCards('ko')

  const customerContent = (cards: typeof english) => cards.map(({ name, description, features, optionLabel, priceLabel }) => ({
    name,
    description,
    features,
    optionLabel,
    priceLabel,
  }))

  assert.deepEqual(customerContent(english), [
    {
      name: 'Chocolate Pound Cake & Cupcakes',
      description: 'Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.',
      features: ['Pound cake AUD 45', 'Cupcakes · 1 dozen +AUD 10', 'Keep your choice of finish'],
      optionLabel: 'Choose pound or cupcakes, then a finish',
      priceLabel: 'From AUD 45',
    },
    {
      name: 'Pave Chocolate Cake',
      description: 'A round chocolate cake layered with soft pave ganache and chocolate sponge. Dense, smooth and made for serious chocolate flavour.',
      features: ['Layered chocolate sponge and pave ganache', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22', 'Dark or milk chocolate'],
      optionLabel: 'Size and dark/milk chocolate options available',
      priceLabel: 'AUD 75.00',
    },
    {
      name: "Chocolatier's Basque Cheesecake",
      description: 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
      features: ['Gluten-free', '6" | serves 8', 'Classic AUD 55', 'Pave chocolate on top +AUD 10', 'Eiffel Tower finish +AUD 20'],
      optionLabel: 'Three finishing options',
      priceLabel: 'From AUD 55',
    },
    {
      name: 'Lemon Cake',
      description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
      features: ['Boxes of 6, 8, 12 or 16', '12 pieces · Most Popular', 'Choose basic or special finishing'],
      optionLabel: 'Choose a pack size',
      priceLabel: 'From AUD 36',
    },
    {
      name: 'vanilla fresh cream cake',
      description: 'Choose vanilla or chocolate cake sheet with vanilla fresh cream, then Triple berry or Nutella chocolate chip flavour.',
      features: ['Choose vanilla or chocolate cake sheet', 'Triple berry or Nutella chocolate chip', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22'],
      optionLabel: 'Choose size, cake sheet and flavour',
      priceLabel: 'From AUD 75',
    },
  ])

  assert.deepEqual(customerContent(korean), [
    {
      name: '초코 파운드케이크 & 컵케이크',
      description: '파운드케이크를 기본으로 선택하고 10달러를 추가하면 컵케이크 1다스로 변경할 수 있어요.',
      features: ['파운드케이크 AUD 45', '컵케이크 1다스 +AUD 10', '기존 마감 옵션 선택 가능'],
      optionLabel: '파운드 / 컵케이크와 마감 선택',
      priceLabel: 'AUD 45부터',
    },
    {
      name: '파베 초콜릿 케이크',
      description: '초콜릿 시트 사이에 부드러운 파베 가나슈를 겹겹이 넣은 원형 케이크예요. 크림보다 초콜릿 맛이 먼저 오는 스타일입니다.',
      features: ['초콜릿 시트와 파베 가나슈', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22', '다크 또는 밀크 선택'],
      optionLabel: '사이즈와 다크/밀크 선택 가능',
      priceLabel: 'AUD 75.00',
    },
    {
      name: '쇼콜라티에 바스크 치즈케이크',
      description: '기본, 파베 초콜릿 on top, 에펠탑 초콜릿 마감 중에서 선택할 수 있는 6" | serves 8 치즈케이크예요.',
      features: ['글루텐 프리', '6" | serves 8', '기본 AUD 55', '파베 on top +AUD 10', '에펠탑 마감 +AUD 20'],
      optionLabel: '세 가지 마감 선택',
      priceLabel: 'AUD 55부터',
    },
    {
      name: '레몬 케이크',
      description: '레몬 모양 케이크에 상큼한 레몬 크림을 채우고 꽃무늬 장식으로 마무리해요.',
      features: ['6, 8, 12, 16개 구성', '12개 · Most Popular', '기본 또는 스페셜 마감 선택'],
      optionLabel: '구성 수량만 선택',
      priceLabel: 'AUD 36부터',
    },
    {
      name: '바닐라 생크림 케이크',
      description: '바닐라 또는 초코 케이크 시트에 바닐라 생크림을 채우고, 트리플베리 또는 누텔라 초코칩 맛을 선택할 수 있어요.',
      features: ['바닐라 또는 초코 케이크 시트', '트리플베리 또는 누텔라 초코칩', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22'],
      optionLabel: '사이즈, 케이크 시트, 맛 선택',
      priceLabel: 'AUD 75부터',
    },
  ])
})

const serverPriceCases: Array<{ productId: ProductId; options?: ReservationPriceOptions }> = [
  { productId: 'pound-cake' },
  { productId: 'pound-cake', options: { poundAddon: 'extra-chocolate', chocolateType: 'milk' } },
  { productId: 'pound-cake', options: { poundAddon: 'vanilla-cream' } },
  { productId: 'cupcake-dozen' },
  { productId: 'cupcake-dozen', options: { vanillaCreamCount: 4, partyDecorationCount: 3 } },
  { productId: 'pave-cake', options: { cakeSize: '15cm' } },
  { productId: 'pave-cake', options: { cakeSize: '19cm' } },
  { productId: 'pave-cake', options: { cakeSize: '22cm' } },
  { productId: 'choco-basque-cheesecake' },
  { productId: 'pave-choco-basque-cheesecake' },
  { productId: 'eiffel-tower-basque-cheesecake' },
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
      vanillaCakeSheet: 'vanilla',
      vanillaCakeFlavor: 'triple-berry',
      quantity: 1,
      pickupDate: '2026-07-28',
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
