import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_VANILLA_CAKE_FLAVOR,
  DEFAULT_VANILLA_CAKE_POINT_COLOR,
  DEFAULT_VANILLA_CAKE_SHEET,
  VANILLA_FRESH_CREAM_CAKE_SHEET,
  DEFAULT_SETTINGS,
  CAKE_SIZE_OPTIONS,
  CHOCOLATE_TYPE_OPTIONS,
  VANILLA_CAKE_FLAVOR_OPTIONS,
  VANILLA_CAKE_POINT_COLOR_OPTIONS,
  VANILLA_CAKE_SHEET_OPTIONS,
  applyPromoDiscount,
  formatCakeSizeLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getFreshLemonCupcakePackSize,
  getLemonIcingCount,
  getChocolateIcingSurcharge,
  getProductById,
  getReservationUnitPrice,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  isCheesecakeProduct,
  usesReservationChocolateType,
  PRODUCT_GROUPS,
  getProductGroupByProductId,
  type ReservationPriceOptions,
} from '../src/lib/constants.js'
import type { ProductId } from '../src/lib/types.js'
import {
  addDaysToInputValue,
  buildSmsMessage,
  customerTimeOptionsForDate,
  dateInputValue,
  formatCurrency,
  firstCustomerPickupDate,
  generateRequestId,
  isCakePickupServiceTime,
  isPickupTimeAllowed,
  isValidPhone,
  normalizePhone,
  timeOptionsForDate,
} from '../src/lib/utils.js'
import {
  CLASS_SESSION_DURATION_MINUTES,
  filterCakePickupTimesForClass,
  isCakePickupBlockedByClass,
  isCakePickupDateUnavailable,
} from '../src/lib/class-utils.js'
import { getProductFeatures, getProductText } from '../src/lib/i18n.js'
import { normalizeAuDailyLimitText } from '../src/lib/legacy-settings.js'
import { CHOCOLATE_EXTRA_OPTIONS, getChocolateExtraPrice, isChocolateExtraEligibleProduct, normalizeChocolateExtra } from '../src/lib/chocolate-extras.js'

test('legacy AU small-batch settings copy is replaced without overwriting custom admin copy', () => {
  assert.equal(
    normalizeAuDailyLimitText('Small-batch cakes, limited daily availability'),
    'Made to order with chocolatier-grade couverture chocolate',
  )
  assert.equal(normalizeAuDailyLimitText('Custom seasonal announcement'), 'Custom seasonal announcement')
})

test('AU cake chooser follows the final eight-product order and keeps legacy groups out of sale navigation', () => {
  assert.deepEqual(
    PRODUCT_GROUPS.map((group) => ({ id: group.id, defaultProductId: group.defaultProductId, productIds: group.productIds })),
    [
      { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
      { id: 'buttercream', defaultProductId: 'buttercream-cake', productIds: ['buttercream-cake'] },
      { id: 'fresh-strawberry-vanilla-cream', defaultProductId: 'fresh-strawberry-vanilla-cream-cake', productIds: ['fresh-strawberry-vanilla-cream-cake'] },
      { id: 'fresh-strawberry-chocolate-cream', defaultProductId: 'fresh-strawberry-chocolate-cream-cake', productIds: ['fresh-strawberry-chocolate-cream-cake'] },
      { id: 'cupcake', defaultProductId: 'cupcake-dozen', productIds: ['cupcake-half-dozen', 'cupcake-dozen'] },
      { id: 'signature-gateau', defaultProductId: 'pound-cake', productIds: ['pound-cake'] },
      {
        id: 'fresh-lemon-cupcakes',
        defaultProductId: 'fresh-lemon-cupcakes-12',
        productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
      },
      {
        id: 'brownie-cheesecake',
        defaultProductId: 'brownie-cheesecake',
        productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake'],
      },
    ],
  )
  assert.equal(getProductGroupByProductId('cupcake-dozen').id, 'cupcake')
  assert.equal(getProductGroupByProductId('cupcake-half-dozen' as ProductId).id, 'cupcake')
  assert.equal(getProductGroupByProductId('pound-cake').id, 'signature-gateau')
  assert.equal(getProductGroupByProductId('fresh-strawberry-vanilla-cream-cake').id, 'fresh-strawberry-vanilla-cream')
  assert.equal(getProductGroupByProductId('fresh-strawberry-chocolate-cream-cake').id, 'fresh-strawberry-chocolate-cream')
  assert.equal(getProductGroupByProductId('buttercream-cake').id, 'buttercream')
  assert.equal(getProductGroupByProductId('brownie-cheesecake').id, 'brownie-cheesecake')
  assert.equal(getProductGroupByProductId('vanilla-fresh-cream-cake').id, 'vanilla-fresh-cream')
  assert.equal(getProductGroupByProductId('pave-choco-basque-cheesecake').id, 'cheesecake')
  assert.equal(getProductGroupByProductId('fresh-lemon-cupcakes-8' as ProductId).id, 'fresh-lemon-cupcakes')
})

test('cheesecake product detection is shared by customer and admin presentation', () => {
  assert.equal(isCheesecakeProduct('choco-basque-cheesecake'), true)
  assert.equal(isCheesecakeProduct('pave-choco-basque-cheesecake'), true)
  assert.equal(isCheesecakeProduct('eiffel-tower-basque-cheesecake'), true)
  assert.equal(isCheesecakeProduct('brownie-cheesecake'), true)
  assert.equal(isCheesecakeProduct('pave-brownie-cheesecake'), true)
  assert.equal(isCheesecakeProduct('eiffel-tower-brownie-cheesecake'), true)
  assert.equal(isCheesecakeProduct('pave-cake'), false)
})

test('Vanilla Fresh Cream Cake uses Signature Gâteau layers and real vanilla fresh cream without a selectable flavour', () => {
  const vanillaFreshCreamCakeId: ProductId = 'vanilla-fresh-cream-cake'
  const vanillaFreshCreamCake = getProductById(vanillaFreshCreamCakeId)

  assert.equal(vanillaFreshCreamCake.name, 'Vanilla Fresh Cream Cake')
  assert.deepEqual(vanillaFreshCreamCake.sizePrices, { '15cm': 69, '19cm': 89, '22cm': 119 })
  assert.equal(vanillaFreshCreamCake.usesSizeOptions, true)
  assert.equal(vanillaFreshCreamCake.usesCacaoOptions, false)
  assert.equal(vanillaFreshCreamCake.usesChocolateTypeOptions, false)
  assert.equal(vanillaFreshCreamCake.usesPoundAddonOptions, false)
  assert.equal(DEFAULT_VANILLA_CAKE_SHEET, 'vanilla')
  assert.equal(VANILLA_FRESH_CREAM_CAKE_SHEET, 'chocolate')
  assert.equal(DEFAULT_VANILLA_CAKE_FLAVOR, 'plain')
  assert.equal(DEFAULT_VANILLA_CAKE_POINT_COLOR, 'pink')
  assert.deepEqual(VANILLA_CAKE_SHEET_OPTIONS, [{ value: 'chocolate', label: 'Chocolate cake sheet' }])
  assert.deepEqual(VANILLA_CAKE_FLAVOR_OPTIONS, [{ value: 'plain', label: 'Vanilla fresh cream with real vanilla bean' }])
  assert.deepEqual(VANILLA_CAKE_POINT_COLOR_OPTIONS, [
    { value: 'pink', label: 'Pink', labelKo: '핑크', hex: '#ec4899' },
    { value: 'red', label: 'Red', labelKo: '레드', hex: '#ef4444' },
    { value: 'green', label: 'Green', labelKo: '그린', hex: '#22c55e' },
    { value: 'yellow', label: 'Yellow', labelKo: '옐로우', hex: '#eab308' },
    { value: 'blue', label: 'Blue', labelKo: '블루', hex: '#3b82f6' },
    { value: 'purple', label: 'Purple', labelKo: '퍼플', hex: '#a855f7' },
    { value: 'orange', label: 'Orange', labelKo: '오렌지', hex: '#f97316' },
    { value: 'white', label: 'White', labelKo: '화이트', hex: '#ffffff' },
  ])
  assert.equal(normalizeVanillaCakeSheet(vanillaFreshCreamCakeId, 'vanilla'), 'chocolate')
  assert.equal(normalizeVanillaCakeSheet(vanillaFreshCreamCakeId, 'chocolate'), 'chocolate')
  assert.equal(normalizeVanillaCakeFlavor(vanillaFreshCreamCakeId, 'nutella-chocolate-chip'), 'plain')
  assert.equal(normalizeVanillaCakePointColor(vanillaFreshCreamCakeId, 'blue'), 'blue')
  assert.equal(normalizeVanillaCakePointColor(vanillaFreshCreamCakeId, 'unknown'), 'pink')
  assert.equal(normalizeVanillaCakeSheet('pave-cake', 'chocolate'), 'vanilla')
  assert.equal(normalizeVanillaCakeFlavor('pave-cake', 'nutella-chocolate-chip'), 'triple-berry')
  assert.equal(normalizeVanillaCakePointColor('pave-cake', 'blue'), 'pink')
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '15cm', cacaoPercent: '100', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 69)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '19cm', cacaoPercent: '70', chocolateType: 'dark', poundAddon: 'extra-chocolate' }), 89)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '22cm', cacaoPercent: '80.5', chocolateType: 'milk', poundAddon: 'none' }), 119)

  for (const language of ['en', 'ko'] as const) {
    const text = getProductText(vanillaFreshCreamCakeId, language)
    const features = getProductFeatures(vanillaFreshCreamCakeId, language)
    assert.match(text.description, /Signature Gâteau au Chocolat|시그니처 갸또 쇼콜라/)
    assert.doesNotMatch(text.description, /100% fresh milk|100% 신선한 우유/)
    assert.match(text.description, /real vanilla bean|실제 바닐라빈/i)
    assert.match(text.description, /vanilla bean specks|작은 점/)
    assert.doesNotMatch(text.description, /Triple berry|Nutella|트리플베리|누텔라/)
    assert.equal(text.description.includes('cm'), false)
    assert.equal(text.priceNote.includes('cm'), false)
    assert.deepEqual(features, language === 'en'
      ? ['Signature Gâteau au Chocolat layers', 'Vanilla fresh cream with real vanilla bean', 'Real vanilla bean with visible vanilla bean specks', '6" · 7.5" · 9"']
      : ['시그니처 갸또 쇼콜라 시트', '실제 바닐라빈을 넣은 바닐라 생크림', '눈에 보이는 실제 바닐라빈', '6" · 7.5" · 9" 사이즈'])
  }
})

test('Buttercream Cake uses Signature Gâteau layers, real chocolate ingredients, and a selectable cake colour', () => {
  const buttercream = getProductById('buttercream-cake')

  assert.equal(buttercream.name, 'Buttercream Cake')
  assert.deepEqual(buttercream.sizePrices, { '6in': 75, '8in': 99, '10in': 145 })
  assert.equal(buttercream.usesSizeOptions, true)
  assert.equal(buttercream.usesCacaoOptions, false)
  assert.equal(buttercream.usesChocolateTypeOptions, false)
  assert.equal(buttercream.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '6in' }), 75)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '8in' }), 99)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '10in' }), 145)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, {
    cakeSize: '10in',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
  }), 145)
  assert.equal(normalizeVanillaCakeSheet('buttercream-cake', 'vanilla'), 'chocolate')
  assert.equal(normalizeVanillaCakeFlavor('buttercream-cake', 'nutella-chocolate-chip'), 'plain')
  assert.equal(normalizeVanillaCakePointColor('buttercream-cake', 'blue'), 'blue')

  for (const language of ['en', 'ko'] as const) {
    const text = getProductText('buttercream-cake', language)
    const features = getProductFeatures('buttercream-cake', language)
    assert.match(text.description, /Italian meringue|이탈리안 머랭/i)
    assert.match(text.description, /real butter|실제 버터/i)
    assert.match(text.description, /cocoa powder|코코아 파우더/i)
    assert.deepEqual(features, language === 'en'
      ? ['Signature Gâteau layers', 'Italian meringue, real butter and cocoa powder', 'Choose a cake colour']
      : ['시그니처 갸또 쇼콜라 시트', '이탈리안 머랭·실제 버터·코코아 파우더', '케이크 컬러 선택'])
  }
})

test('Brownie Cheesecake keeps two approved current finishes and an Eiffel historical reader', () => {
  const brownie = getProductById('brownie-cheesecake')
  const paveBrownie = getProductById('pave-brownie-cheesecake')
  const eiffelBrownie = getProductById('eiffel-tower-brownie-cheesecake')

  assert.equal(brownie.name, 'Brownie Cheesecake')
  assert.equal(brownie.price, 58)
  assert.equal(paveBrownie.price, 68)
  assert.equal(eiffelBrownie.price, 70)
  assert.deepEqual(PRODUCT_GROUPS.find((group) => group.id === 'brownie-cheesecake')?.productIds, ['brownie-cheesecake', 'pave-brownie-cheesecake'])
  assert.deepEqual(getProductGroupByProductId('eiffel-tower-brownie-cheesecake').productIds, ['eiffel-tower-brownie-cheesecake'])
  assert.equal(getReservationUnitPrice('eiffel-tower-brownie-cheesecake'), eiffelBrownie.price)
  for (const productId of ['brownie-cheesecake', 'pave-brownie-cheesecake'] as const) {
    const product = getProductById(productId as ProductId)
    assert.equal(product.usesSizeOptions, false)
    assert.equal(product.usesPoundAddonOptions, false)
    assert.equal(getReservationUnitPrice(productId as ProductId), product.price)
  }
  assert.equal(getReservationUnitPrice('eiffel-tower-brownie-cheesecake'), 70)
})

test('Lemon Cake variants use fixed pack prices and the twelve pack is Most Popular', () => {
  const variants = [
    ['fresh-lemon-cupcakes-6', 36],
    ['fresh-lemon-cupcakes-8', 45],
    ['fresh-lemon-cupcakes-12', 65],
    ['fresh-lemon-cupcakes-16', 85],
  ] as const

  for (const [productId, price] of variants) {
    const product = getProductById(productId)
    assert.equal(product.name.startsWith('Lemon Cake · '), true)
    assert.equal(product.price, price)
    assert.equal(product.usesSizeOptions, false)
    assert.equal(product.usesChocolateTypeOptions, false)
    assert.equal(product.usesPoundAddonOptions, false)
    assert.equal(getReservationUnitPrice(productId as ProductId), price)
    assert.equal(applyPromoDiscount(price, productId as ProductId, 'chocolate'), price)
    const english = getProductText(productId, 'en')
    const korean = getProductText(productId, 'ko')
    assert.match(english.description, /freshly squeezed lemon juice/)
    assert.match(korean.description, /레몬즙을 직접 짜/)
    assert.deepEqual(getProductFeatures(productId, 'en'), ['Freshly squeezed lemon juice', 'Fresh lemon zest', 'Lemon syrup & glaze', 'Floral decoration', 'Boxes of 6, 8, 12 or 16'])
    assert.deepEqual(getProductFeatures(productId, 'ko'), ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'])
    assert.doesNotMatch(english.description, /fresh lemon cream/i)
    assert.doesNotMatch(korean.description, /레몬 크림/)
  }

  assert.equal(getProductById('fresh-lemon-cupcakes-6').priceNote.includes('Most Popular'), false)
  assert.equal(getProductById('fresh-lemon-cupcakes-12').priceNote.includes('Most Popular'), true)
})

test('Lemon Cake special finishing count derives the mix and adds AUD 0.50 per changed piece', () => {
  assert.equal(getFreshLemonCupcakePackSize('fresh-lemon-cupcakes-6'), 6)
  assert.equal(getLemonIcingCount('fresh-lemon-cupcakes-6', 3), 3)
  assert.equal(getChocolateIcingSurcharge('fresh-lemon-cupcakes-6', 3), 1.5)
  assert.equal(getReservationUnitPrice('fresh-lemon-cupcakes-6', { chocolateIcingCount: 3 }), 37.5)
  assert.equal(getLemonIcingCount('fresh-lemon-cupcakes-12', 8), 4)
  assert.equal(getChocolateIcingSurcharge('fresh-lemon-cupcakes-12', 8), 4)
  assert.equal(getReservationUnitPrice('fresh-lemon-cupcakes-12', { chocolateIcingCount: 8 }), 69)
  assert.equal(getChocolateIcingSurcharge('pave-cake', 8), 0)
})

test('Lemoni discounts the Lemon Cake subtotal after chocolate icing surcharge', () => {
  const subtotal = getReservationUnitPrice('fresh-lemon-cupcakes-6', { chocolateIcingCount: 3 })
  assert.equal(subtotal, 37.5)
  assert.equal(applyPromoDiscount(subtotal, 'fresh-lemon-cupcakes-6', 'lemoni', new Date('2026-07-13T00:00:00Z')), 33.75)
})

test('AU cheesecake variants keep fixed prices and show the fixed shared size label', () => {
  const chocoBasque = getProductById('choco-basque-cheesecake')
  const paveBasque = getProductById('pave-choco-basque-cheesecake')
  const eiffelBasque = getProductById('eiffel-tower-basque-cheesecake')

  assert.equal(chocoBasque.name, "Chocolatier's Basque Cheesecake")
  assert.equal(chocoBasque.price, 55)
  assert.equal(paveBasque.name, 'Pave chocolate on top')
  assert.equal(paveBasque.price, 65)
  assert.equal(paveBasque.description.includes('pave chocolate on top'), true)
  assert.equal(eiffelBasque.name, 'Cake finishing with Eiffel Tower')
  assert.equal(eiffelBasque.price, 70)
  assert.equal(eiffelBasque.description.includes('Eiffel Tower chocolate'), true)
  assert.equal(eiffelBasque.description.includes('covered with pave chocolate'), true)
  for (const product of [chocoBasque, paveBasque, eiffelBasque]) {
    assert.equal(product.usesSizeOptions, false)
    assert.equal(product.usesPoundAddonOptions, false)
    assert.equal(product.priceNote, '6" | serves 8')
  }
  for (const productId of ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'] as const) {
    for (const language of ['en', 'ko'] as const) {
      assert.equal(getProductText(productId, language).priceNote, '6" | serves 8')
      assert.match(getProductText(productId, language).description, /6" \| serves 8/)
      assert.equal(getProductFeatures(productId, language)[0], '6" | serves 8')
    }
  }
  assert.equal(getReservationUnitPrice('choco-basque-cheesecake'), 55)
  assert.equal(getReservationUnitPrice('pave-choco-basque-cheesecake'), 65)
  assert.equal(getReservationUnitPrice('eiffel-tower-basque-cheesecake' as ProductId), 70)
})

test('Chocolate Cupcakes use an all-box finish with fixed pack-and-finish prices', () => {
  const halfDozen = getProductById('cupcake-half-dozen' as ProductId)
  const dozen = getProductById('cupcake-dozen')

  assert.equal(halfDozen.name, 'Chocolate Cupcakes')
  assert.equal(halfDozen.price, 31)
  assert.equal(dozen.price, 55)
  assert.equal(halfDozen.usesChocolateTypeOptions, false)
  assert.equal(dozen.usesPoundAddonOptions, false)
  assert.equal(usesReservationChocolateType('cupcake-dozen', 'extra-chocolate'), false)
  assert.equal(getReservationUnitPrice('cupcake-half-dozen' as ProductId, { cupcakeFinish: 'basic' } as ReservationPriceOptions), 31)
  assert.equal(getReservationUnitPrice('cupcake-half-dozen' as ProductId, { cupcakeFinish: 'vanilla-fresh-cream' } as ReservationPriceOptions), 36)
  assert.equal(getReservationUnitPrice('cupcake-half-dozen' as ProductId, { cupcakeFinish: 'chocolate-buttercream' } as ReservationPriceOptions), 41)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { cupcakeFinish: 'basic' } as ReservationPriceOptions), 55)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { cupcakeFinish: 'vanilla-fresh-cream' } as ReservationPriceOptions), 64)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { cupcakeFinish: 'chocolate-buttercream' } as ReservationPriceOptions), 73)
})

test('new Cupcake pricing ignores retired per-piece finishing counts', () => {
  assert.equal(getReservationUnitPrice('cupcake-dozen', {
    cupcakeFinish: 'basic', vanillaCreamCount: 4, partyDecorationCount: 3,
  } as ReservationPriceOptions), 55)
  assert.deepEqual(normalizeCupcakeFinishCounts('pound-cake', 4, 3), {
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
  })
})

test('client request IDs are valid UUIDs for idempotent reservation retries', () => {
  assert.match(generateRequestId(), /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i)
})

test('AU cake size labels use the approved inch and serves copy while retaining internal CakeSize values', () => {
  assert.deepEqual(
    CAKE_SIZE_OPTIONS.map((option) => option.value),
    ['15cm', '19cm', '22cm'],
  )
  assert.deepEqual(
    CAKE_SIZE_OPTIONS.map((option) => option.label),
    ['6" | serves 8', '7.5" | serves 14', '9" | serves 22'],
  )
  assert.equal(formatCakeSizeLabel('15cm'), '6" | serves 8')
  assert.equal(formatCakeSizeLabel('19cm'), '7.5" | serves 14')
  assert.equal(formatCakeSizeLabel('22cm'), '9" | serves 22')
})

test('pound cake only exposes one finish choice group', () => {
  const poundCake = getProductById('pound-cake')

  assert.equal(DEFAULT_CAKE_SIZE, '15cm')
  assert.equal(DEFAULT_CHOCOLATE_TYPE, 'dark')
  assert.equal(DEFAULT_POUND_ADDON, 'none')
  assert.equal(poundCake.usesSizeOptions, false)
  assert.equal(poundCake.usesChocolateTypeOptions, false)
  assert.equal(poundCake.usesPoundAddonOptions, true)
  assert.equal(poundCake.name, 'Signature Gâteau au Chocolat')
  assert.ok(getProductFeatures('pound-cake', 'en').includes('Fixed gâteau size'))
  assert.equal(formatPoundAddonLabel('none'), 'Basic finish')
  assert.equal(formatPoundAddonLabel('extra-chocolate'), 'Extra chocolate')
  assert.equal(formatPoundAddonLabel('Extra chocolate'), 'Extra chocolate')
  assert.equal(formatPoundAddonLabel('vanilla-cream'), 'Vanilla cream')
  assert.equal(normalizePoundAddon('pound-cake', 'Extra chocolate'), 'extra-chocolate')
})

test('pound cake pricing ignores size and chocolate, and uses confirmed finish prices', () => {
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none' }), 45)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'none' }), 45)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'extra-chocolate' }), 52)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 55)
})

test('pound and pave cakes only offer dark chocolate', () => {
  assert.deepEqual(CHOCOLATE_TYPE_OPTIONS, [
    { value: 'dark', label: 'Dark chocolate', description: 'Deep and balanced chocolate profile', extraPrice: 0 },
  ])
  assert.equal(usesReservationChocolateType('pound-cake', 'none'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'vanilla-cream'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'extra-chocolate'), true)
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'extra-chocolate'), 'dark')
  assert.equal(normalizeReservationChocolateType('pave-cake', 'milk', 'none'), 'dark')
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'vanilla-cream'), 'dark')
})

test('cupcakes default to a Basic dozen while allowing the Half Dozen product within the same group', () => {
  const cupcakes = getProductById('cupcake-dozen')

  assert.equal(cupcakes.name, 'Chocolate Cupcakes')
  assert.equal(cupcakes.price, 55)
  assert.equal(cupcakes.usesSizeOptions, false)
  assert.equal(cupcakes.usesChocolateTypeOptions, false)
  assert.equal(cupcakes.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice('cupcake-dozen'), 55)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { cupcakeFinish: 'vanilla-fresh-cream' } as ReservationPriceOptions), 64)
  assert.equal(getReservationUnitPrice('cupcake-half-dozen' as ProductId, { cupcakeFinish: 'chocolate-buttercream' } as ReservationPriceOptions), 41)
  assert.equal(usesReservationChocolateType('cupcake-dozen', 'extra-chocolate'), false)
})

test('Pave Chocolate Cake keeps its approved prices, dense four-layer copy and dark-only finish', () => {
  const paveCake = getProductById('pave-cake')

  assert.equal(paveCake.usesSizeOptions, true)
  assert.equal(paveCake.usesChocolateTypeOptions, true)
  assert.equal(paveCake.usesPoundAddonOptions, false)
  assert.deepEqual(paveCake.sizePrices, { '6in': 79, '8in': 109, '10in': 159 })
  assert.equal(getProductText('pave-cake', 'en').description, 'A rich four-layer chocolate cake built for a dense, chocolate-forward bite. Instead of a light sponge-and-cream style, each layer is filled with smooth pave chocolate ganache, creating a substantial cake with deep chocolate flavour from the first slice to the last.')
  assert.equal(getProductText('pave-cake', 'ko').description, '가벼운 스펀지와 크림 중심의 케이크가 아니라, 묵직한 초콜릿 케이크 시트를 4단으로 쌓고 각 층을 부드러운 파베 초콜릿 가나슈로 채웠습니다. 처음부터 끝까지 진한 초콜릿의 밀도와 묵직한 식감을 느낄 수 있는 베리굿의 시그니처 초콜릿 케이크입니다.')
  assert.deepEqual(getProductFeatures('pave-cake', 'en'), ['Signature Gâteau layers', 'Smooth pave chocolate ganache', 'Dense, chocolate-forward finish'])
  assert.deepEqual(getProductFeatures('pave-cake', 'ko'), ['시그니처 갸또 쇼콜라 시트', '각 층을 채운 파베 초콜릿 가나슈', '크림보다 초콜릿이 중심인 진한 맛'])
  assert.equal(formatChocolateTypeLabel('dark'), 'Dark chocolate')
  assert.equal(formatChocolateTypeLabel('milk'), 'Dark chocolate')
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none' }), 79)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '8in', chocolateType: 'milk', poundAddon: 'extra-chocolate' }), 109)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '8in', chocolateType: 'dark', poundAddon: 'vanilla-cream' }), 109)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '10in', chocolateType: 'milk', poundAddon: 'none' }), 159)
})

test('AU currency display uses AUD code instead of dollar symbol', () => {
  assert.equal(formatCurrency(55), 'AUD 55.00')
})

test('Chocolate promo is case-insensitive, cheesecake-only, and valid through 15 July Sydney', () => {
  const validAt = new Date('2026-07-15T13:59:59.000Z')
  const expiredAt = new Date('2026-07-15T14:00:00.000Z')

  assert.equal(applyPromoDiscount(55, 'choco-basque-cheesecake', 'CHOCOLATE', validAt), 49.5)
  assert.equal(applyPromoDiscount(65, 'pave-choco-basque-cheesecake', 'chocolate', validAt), 58.5)
  assert.equal(applyPromoDiscount(55, 'choco-basque-cheesecake', 'ChOcOlAtE', expiredAt), 55)
  assert.equal(applyPromoDiscount(75, 'pave-cake', 'chocolate', validAt), 75)
  assert.equal(applyPromoDiscount(45, 'fresh-lemon-cupcakes-8', 'chocolate', validAt), 45)
  assert.equal(applyPromoDiscount(55, 'choco-basque-cheesecake', 'verygoodSYD', validAt), 55)
})

test('Lemoni promo is case-insensitive, lemon-only, and valid through 16 July Sydney', () => {
  const validAt = new Date('2026-07-16T13:59:59.000Z')
  const expiredAt = new Date('2026-07-16T14:00:00.000Z')

  assert.equal(applyPromoDiscount(36, 'fresh-lemon-cupcakes-6', 'LEMONI', validAt), 32.4)
  assert.equal(applyPromoDiscount(45, 'fresh-lemon-cupcakes-8', 'lemoni', validAt), 40.5)
  assert.equal(applyPromoDiscount(65, 'fresh-lemon-cupcakes-12', 'LeMoNi', expiredAt), 65)
  assert.equal(applyPromoDiscount(55, 'choco-basque-cheesecake', 'lemoni', validAt), 55)
})

test('AU cake pick-up exposes every day from 08:00 through the inclusive 20:00 boundary', () => {
  const fridayTimes = timeOptionsForDate('2026-08-28', DEFAULT_SETTINGS)
  const saturdayTimes = timeOptionsForDate('2026-08-29', DEFAULT_SETTINGS)
  const sundayTimes = timeOptionsForDate('2026-08-30', DEFAULT_SETTINGS)

  assert.equal(fridayTimes.length, 49)
  assert.deepEqual(fridayTimes.slice(0, 3), ['08:00', '08:15', '08:30'])
  assert.equal(fridayTimes.at(-1), '20:00')
  assert.equal(saturdayTimes.length, 39)
  assert.equal(saturdayTimes[0], '08:00')
  assert.equal(saturdayTimes.at(-1), '20:00')
  assert.equal(sundayTimes.length, 49)
  assert.deepEqual(timeOptionsForDate('2026-08-27', DEFAULT_SETTINGS), fridayTimes)
})

test('AU cake pick-up rejects only outside boundaries, special closures, and off-grid minutes', () => {
  for (const [pickupDate, pickupTime] of [
    ['2026-08-28', '20:15'],
    ['2026-08-29', '07:45'],
    ['2026-08-29', '20:15'],
    ['2026-08-29', '18:07'],
    ['2026-08-29', '09:30'],
    ['2026-08-29', '11:45'],
  ]) assert.equal(isCakePickupServiceTime(pickupDate, pickupTime), false, `${pickupDate} ${pickupTime}`)

  for (const [pickupDate, pickupTime] of [
    ['2026-08-28', '08:00'],
    ['2026-08-28', '17:45'],
    ['2026-08-28', '18:00'],
    ['2026-08-28', '20:00'],
    ['2026-08-29', '08:00'],
    ['2026-08-29', '09:15'],
    ['2026-08-29', '12:00'],
    ['2026-08-29', '20:00'],
    ['2026-08-30', '08:00'],
    ['2026-08-30', '20:00'],
  ]) assert.equal(isCakePickupServiceTime(pickupDate, pickupTime), true, `${pickupDate} ${pickupTime}`)
})

test('AU customer calendar offers the next daily pickup date', () => {
  const now = new Date('2026-07-10T00:00:00.000Z')

  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, now), [])
  assert.equal(firstCustomerPickupDate(DEFAULT_SETTINGS, now), '2026-07-11')
  assert.equal(
    firstCustomerPickupDate(DEFAULT_SETTINGS, new Date('2026-07-12T00:00:00.000Z')),
    '2026-07-13',
  )
})

test('Kids Class records do not suppress Cake pick-up slots or Cake calendar availability', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]
  const pickupTimes = ['09:30', '10:00', '10:30', '12:30', '13:00', '15:30', '16:00', '18:30']

  assert.equal(CLASS_SESSION_DURATION_MINUTES, 120)
  for (const pickupTime of pickupTimes) {
    assert.equal(isCakePickupBlockedByClass('2026-07-10', pickupTime, bookedSlots), false, pickupTime)
  }
  assert.deepEqual(filterCakePickupTimesForClass('2026-07-10', pickupTimes, bookedSlots), pickupTimes)
  assert.equal(isCakePickupDateUnavailable('2026-07-10', pickupTimes, bookedSlots), false)
})

test('class bookings on a different date do not block cake pick-up', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]

  assert.equal(isCakePickupBlockedByClass('2026-07-11', '10:00', bookedSlots), false)
})

test('malformed class and pick-up values are ignored safely', () => {
  const malformedBookedSlots = [
    'not-a-date',
    { classDate: '2026-07-10', classTime: '25:00' },
    { classDate: '2026-02-30', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: ' ' },
    { classDate: '2026-07-10', classTime: 0 },
    { classDate: '2026-07-10', classTime: false },
  ]

  assert.equal(isCakePickupBlockedByClass('not-a-date', '10:00', ['not-a-date']), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', 'not-a-time', [{ classDate: '2026-07-10', classTime: '10:00' }]), false)
  assert.equal(
    isCakePickupBlockedByClass(
      '2026-07-10',
      '10:00',
      malformedBookedSlots as unknown as Parameters<typeof isCakePickupBlockedByClass>[2],
    ),
    false,
  )
})

test('class filtering returns only unblocked supplied times without mutating inputs', () => {
  const pickupTimes = ['09:30', '10:00', '10:30', '12:00', '12:30', '15:30', '16:00', '18:00', '18:30']
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]
  const pickupOpenings = [{ pickupDate: '2026-07-10', pickupTime: '10:30' }]
  const originalPickupTimes = [...pickupTimes]
  const originalBookedSlots = bookedSlots.map((slot) => ({ ...slot }))
  const originalPickupOpenings = pickupOpenings.map((opening) => ({ ...opening }))

  assert.deepEqual(
    filterCakePickupTimesForClass('2026-07-10', pickupTimes, bookedSlots, pickupOpenings),
    pickupTimes,
  )
  assert.deepEqual(pickupTimes, originalPickupTimes)
  assert.deepEqual(bookedSlots, originalBookedSlots)
  assert.deepEqual(pickupOpenings, originalPickupOpenings)
})

test('cake openings do not add times already removed by the pickup cutoff filter', () => {
  const now = new Date('2026-07-09T23:00:00.000Z')
  const leadTimeFilteredTimes = customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, now)
  const filteredTimes = filterCakePickupTimesForClass(
    '2026-07-10',
    leadTimeFilteredTimes,
    [{ classDate: '2026-07-10', classTime: '10:00' }],
    [{ pickupDate: '2026-07-10', pickupTime: '10:00' }],
  )

  assert.equal(leadTimeFilteredTimes.includes('10:00'), false)
  assert.equal(filteredTimes.includes('10:00'), false)
  assert.deepEqual(filteredTimes, [])
})

test('Sydney date input stays independent of the browser timezone near midnight', () => {
  assert.equal(dateInputValue(new Date('2026-07-09T14:30:00.000Z')), '2026-07-10')
  assert.equal(dateInputValue(new Date('2026-07-10T13:30:00.000Z')), '2026-07-10')
})

test('date input calendar addition is independent of browser timezone and DST length', () => {
  assert.equal(addDaysToInputValue('2026-07-10', 1), '2026-07-11')
  assert.equal(addDaysToInputValue('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysToInputValue('2028-02-28', 1), '2028-02-29')
})

test('orders before 20:00 Sydney can pick up from opening time the next day', () => {
  const atOneSecondBeforeEight = new Date('2026-07-10T09:59:59.000Z')

  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atOneSecondBeforeEight), [])
  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, atOneSecondBeforeEight)[0], '08:00')
  assert.equal(isPickupTimeAllowed('2026-07-11', '08:00', atOneSecondBeforeEight), true)
})

test('orders from 20:00 Sydney can pick up only from noon the next day', () => {
  const atEight = new Date('2026-07-10T10:00:00.000Z')
  const beforeMidnight = new Date('2026-07-10T13:59:59.000Z')

  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, atEight)[0], '12:00')
  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, beforeMidnight)[0], '12:00')
  assert.equal(isPickupTimeAllowed('2026-07-11', '11:45', atEight), false)
  assert.equal(isPickupTimeAllowed('2026-07-11', '12:00', atEight), true)
})

test('same-day pickup stays closed and later dates keep all store hours', () => {
  const atSevenSydney = new Date('2026-07-10T09:00:00.000Z')
  const atNineTenSydney = new Date('2026-07-09T23:10:00.000Z')

  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atSevenSydney), [])
  assert.equal(isPickupTimeAllowed('2026-07-10', '20:00', atNineTenSydney), false)
  assert.equal(customerTimeOptionsForDate('2026-07-12', DEFAULT_SETTINGS, atSevenSydney)[0], '08:00')
})

test('AU mobile numbers accept common local and international formats', () => {
  const validInputs = [
    '0412 345 678',
    '0412345678',
    '04 1234 5678',
    '+61 412 345 678',
    '+61412345678',
    '61 412 345 678',
    '412 345 678',
  ]

  for (const input of validInputs) {
    const phone = normalizePhone(input)
    assert.equal(phone, '0412345678')
    assert.equal(isValidPhone(phone), true, input)
  }
})

test('AU mobile numbers reject incomplete or non-mobile numbers', () => {
  for (const input of ['0412 345 67', '0212 345 678', '+61 2 1234 5678']) {
    assert.equal(isValidPhone(normalizePhone(input)), false, input)
  }
})

test('AU cake confirmation message matches Jenny request copy', () => {
  const message = buildSmsMessage({
    id: 'test-id',
    reservationNumber: 'VG-C-AU-20260704-204051216',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'pave-cake',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
    pickupDate: '2026-07-04',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 75,
    adminMemo: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  }, {
    price: 45,
    bankName: 'BSB 012263',
    bankAccount: 'Account 324999682',
    accountHolder: 'Verygood Chocolate',
    weekdayOpen: '10:00',
    weekdayClose: '17:00',
    weekendOpen: '10:00',
    weekendClose: '16:00',
    dailyLimitText: 'Made to order with chocolatier-grade couverture chocolate',
    reservationNotice: 'We will confirm availability after your request. Payment details and final confirmation will follow by message.',
    pickupNotice: 'Street pick-up near 1 Bundil Blvd, Melrose Park. There is a small playground and seating nearby. Parking can be limited, so Jenny will bring the cake down to you.',
    storeAddress: 'Street pick-up near 1 Bundil Blvd, Melrose Park. Small playground/seating nearby; Jenny will bring the cake down to you.',
    storePhone: '+61 mobile number TBC',
  })

  assert.equal(message, `[Verygood Chocolate SYD]

Thank you for your order Jenny. (0412345678)

Booking number: VG-C-AU-20260704-204051216
Product: Pave Chocolate Cake
Size: 6" | serves 8
Quantity: 1ea
Chocolate: Dark chocolate
Pick-up date: 2026-07-04
Pick-up time: 10:00
Total: AUD 75.00
Pick-up location: https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw

Thank you for your order:)
Have a verygood day!`)
  assert.doesNotMatch(message, /Product: Gâteau au Chocolat Pave Chocolate Cake/)
  assert.doesNotMatch(message, /Pick-up address:/)
  assert.doesNotMatch(message, /Contact: .*TBC/)
})

test('AU cheesecake confirmations include the selected finish and fixed shared size label', () => {
  const reservation = {
    id: 'test-cheesecake-id',
    reservationNumber: 'VG-C-AU-20260704-CHEESE',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'pave-choco-basque-cheesecake' as ProductId,
    cakeSize: '15cm' as const,
    chocolateType: 'dark' as const,
    poundAddon: 'none' as const,
    quantity: 1,
    pickupDate: '2026-07-04',
    pickupTime: '12:00',
    cacaoPercent: '기본' as const,
    requestNote: '',
    status: '예약신청' as const,
    paymentStatus: '입금대기' as const,
    totalPrice: 65,
    adminMemo: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  }
  const paveMessage = buildSmsMessage(reservation)
  const eiffelMessage = buildSmsMessage({
    ...reservation,
    productId: 'eiffel-tower-basque-cheesecake',
    totalPrice: 70,
  })

  assert.match(paveMessage, /Product: Pave chocolate on top/)
  assert.match(paveMessage, /Size: 6" \| serves 8/)
  assert.equal(paveMessage.includes('Finish:'), false)
  assert.match(eiffelMessage, /Product: Cake finishing with Eiffel Tower/)
  assert.match(eiffelMessage, /Size: 6" \| serves 8/)
  assert.equal(eiffelMessage.includes('Finish:'), false)
})

test('AU pound cake extra chocolate SMS includes selected chocolate type', () => {
  const message = buildSmsMessage({
    id: 'test-pound-id',
    reservationNumber: 'VG-C-AU-20260704-204051217',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'pound-cake',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'extra-chocolate',
    quantity: 1,
    pickupDate: '2026-07-04',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 52,
    adminMemo: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  })

  assert.match(message, /Product: Signature Gâteau au Chocolat/)
  assert.match(message, /Finish: Extra chocolate/)
  assert.match(message, /Chocolate: Dark chocolate/)
})

test('AU cupcake SMS shows vanilla cream and party decoration counts without chocolate option', () => {
  const message = buildSmsMessage({
    id: 'test-cupcake-id',
    reservationNumber: 'VG-C-AU-CUPCAKE',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'cupcake-dozen',
    cakeSize: '15cm',
    chocolateType: 'milk',
    poundAddon: 'extra-chocolate',
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    quantity: 1,
    pickupDate: '2026-07-20',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 60,
    totalPriceCents: 6000,
    adminMemo: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  })

  assert.match(message, /Finishing mix: Basic 5 \/ Vanilla cream 4 \/ Party decoration 3/)
  assert.equal(message.includes('Finish: Extra chocolate'), false)
  assert.equal(message.includes('Chocolate: Milk chocolate'), false)
})

test('current Whole Cake serving profiles use new inch keys without reinterpreting stored cm orders', async () => {
  const {
    CURRENT_WHOLE_CAKE_SIZES,
    formatCurrentCakeSizeLabel,
    formatStoredCakeSizeLabel,
  } = await import('../src/lib/cake-serving.js')

  assert.deepEqual(CURRENT_WHOLE_CAKE_SIZES, ['6in', '8in', '10in'])
  assert.equal(formatCurrentCakeSizeLabel('pave-cake', '8in'), '8" | serves approx. 14–18')
  assert.equal(formatCurrentCakeSizeLabel('fresh-strawberry-vanilla-cream-cake', '8in'), '8" | serves approx. 10–14')
  assert.equal(formatCurrentCakeSizeLabel('fresh-strawberry-chocolate-cream-cake', '10in'), '10" | serves approx. 16–20')
  assert.equal(formatStoredCakeSizeLabel('pave-cake', '15cm'), '6" | serves 8')
  assert.equal(formatStoredCakeSizeLabel('pave-cake', '19cm'), '7.5" | serves 14')
  assert.equal(formatStoredCakeSizeLabel('pave-cake', '22cm'), '9" | serves 22')
})

test('Whole Cake serving disclosure explains the distinct cake sheets without changing serving ranges', async () => {
  const serving = await import('../src/lib/cake-serving.js') as Record<string, unknown>
  const getCakeServingGuideCopy = serving.getCakeServingGuideCopy as undefined | ((language: 'en' | 'ko') => { title: string; body: string })

  assert.deepEqual(getCakeServingGuideCopy?.('en'), {
    title: 'Why do serving sizes vary?',
    body: 'Serving guides vary by cake sheet and portion size. Our Signature Gâteau cakes use rich, dense chocolate layers and are usually served in smaller slices, while soft genoise cakes are typically cut into larger celebration portions.',
  })
  assert.deepEqual(getCakeServingGuideCopy?.('ko'), {
    title: '케이크마다 권장 인원수가 다른 이유',
    body: '케이크 시트와 권장 1인분 크기에 따라 인원수가 달라집니다. 시그니처 갸또 케이크는 진하고 밀도감 있는 초콜릿 시트로 작은 조각을, 제누아즈 케이크는 생크림과 생딸기에 잘 어울리는 부드러운 시트로 보다 넉넉한 기념일용 조각을 안내합니다.',
  })
})

test('Chocolate Extras use a separate current-sales contract for exactly four eligible cake products', () => {
  assert.deepEqual(CHOCOLATE_EXTRA_OPTIONS.map(({ value, price }) => [value, price]), [
    ['none', 0],
    ['eiffel-6', 10],
    ['pave-100g', 12],
    ['combo', 20],
  ])
  assert.equal(getChocolateExtraPrice('combo'), 20)
  assert.equal(isChocolateExtraEligibleProduct('pave-cake'), true)
  assert.equal(isChocolateExtraEligibleProduct('buttercream-cake'), true)
  assert.equal(isChocolateExtraEligibleProduct('pound-cake'), true)
  assert.equal(isChocolateExtraEligibleProduct('brownie-cheesecake'), true)
  assert.equal(isChocolateExtraEligibleProduct('pave-brownie-cheesecake'), true)
  assert.equal(isChocolateExtraEligibleProduct('eiffel-tower-brownie-cheesecake'), false)
  assert.equal(isChocolateExtraEligibleProduct('fresh-strawberry-vanilla-cream-cake'), false)
  assert.equal(normalizeChocolateExtra('pave-cake', 'eiffel-6'), 'eiffel-6')
  assert.equal(normalizeChocolateExtra('fresh-strawberry-vanilla-cream-cake', 'combo'), 'none')
})
