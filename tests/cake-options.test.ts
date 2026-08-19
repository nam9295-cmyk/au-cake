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
  getBookingCalendarMonthDays,
  isCakePickupBlockedByClass,
  isCakePickupDateUnavailable,
} from '../src/lib/class-utils.js'
import { getProductFeatures, getProductText } from '../src/lib/i18n.js'

test('AU cake chooser follows the final seven-product order and keeps Basque legacy-only', () => {
  assert.deepEqual(
    PRODUCT_GROUPS.map((group) => ({ id: group.id, defaultProductId: group.defaultProductId, productIds: group.productIds })),
    [
      { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
      { id: 'vanilla-fresh-cream', defaultProductId: 'vanilla-fresh-cream-cake', productIds: ['vanilla-fresh-cream-cake'] },
      { id: 'buttercream', defaultProductId: 'buttercream-cake', productIds: ['buttercream-cake'] },
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
        productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'],
      },
    ],
  )
  assert.equal(getProductGroupByProductId('cupcake-dozen').id, 'cupcake')
  assert.equal(getProductGroupByProductId('cupcake-half-dozen' as ProductId).id, 'cupcake')
  assert.equal(getProductGroupByProductId('pound-cake').id, 'signature-gateau')
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

test('Vanilla Fresh Cream Cake keeps its size prices and fixes the chocolate cake sheet while retaining flavour choices', () => {
  const vanillaFreshCreamCakeId: ProductId = 'vanilla-fresh-cream-cake'
  const vanillaFreshCreamCake = getProductById(vanillaFreshCreamCakeId)

  assert.equal(vanillaFreshCreamCake.name, 'Vanilla Fresh Cream Cake')
  assert.deepEqual(vanillaFreshCreamCake.sizePrices, { '15cm': 75, '19cm': 98, '22cm': 139 })
  assert.equal(vanillaFreshCreamCake.usesSizeOptions, true)
  assert.equal(vanillaFreshCreamCake.usesCacaoOptions, false)
  assert.equal(vanillaFreshCreamCake.usesChocolateTypeOptions, false)
  assert.equal(vanillaFreshCreamCake.usesPoundAddonOptions, false)
  assert.equal(DEFAULT_VANILLA_CAKE_SHEET, 'vanilla')
  assert.equal(VANILLA_FRESH_CREAM_CAKE_SHEET, 'chocolate')
  assert.equal(DEFAULT_VANILLA_CAKE_FLAVOR, 'triple-berry')
  assert.equal(DEFAULT_VANILLA_CAKE_POINT_COLOR, 'pink')
  assert.deepEqual(VANILLA_CAKE_SHEET_OPTIONS, [{ value: 'chocolate', label: 'Chocolate cake sheet' }])
  assert.deepEqual(VANILLA_CAKE_FLAVOR_OPTIONS, [
    { value: 'triple-berry', label: 'Triple berry' },
    { value: 'nutella-chocolate-chip', label: 'Nutella chocolate chip' },
  ])
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
  assert.equal(normalizeVanillaCakeFlavor(vanillaFreshCreamCakeId, 'nutella-chocolate-chip'), 'nutella-chocolate-chip')
  assert.equal(normalizeVanillaCakePointColor(vanillaFreshCreamCakeId, 'blue'), 'blue')
  assert.equal(normalizeVanillaCakePointColor(vanillaFreshCreamCakeId, 'unknown'), 'pink')
  assert.equal(normalizeVanillaCakeSheet('pave-cake', 'chocolate'), 'vanilla')
  assert.equal(normalizeVanillaCakeFlavor('pave-cake', 'nutella-chocolate-chip'), 'triple-berry')
  assert.equal(normalizeVanillaCakePointColor('pave-cake', 'blue'), 'pink')
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '15cm', cacaoPercent: '100', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 75)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '19cm', cacaoPercent: '70', chocolateType: 'dark', poundAddon: 'extra-chocolate' }), 98)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '22cm', cacaoPercent: '80.5', chocolateType: 'milk', poundAddon: 'none' }), 139)

  for (const language of ['en', 'ko'] as const) {
    const text = getProductText(vanillaFreshCreamCakeId, language)
    const features = getProductFeatures(vanillaFreshCreamCakeId, language)
    assert.match(text.description, /cake sheet|케이크 시트/i)
    assert.match(text.description, /vanilla fresh cream|바닐라 생크림/)
    assert.equal(text.description.includes('cm'), false)
    assert.equal(text.priceNote.includes('cm'), false)
    assert.deepEqual(features, language === 'en'
      ? ['Chocolate cake sheet only', 'Triple berry or Nutella chocolate chip', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22']
      : ['초코 케이크 시트만 사용', '트리플베리 또는 누텔라 초코칩', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22'])
  }
})

test('Buttercream Cake uses the Vanilla size price ladder with no customer-selectable finish or flavour', () => {
  const buttercream = getProductById('buttercream-cake')

  assert.equal(buttercream.name, 'Buttercream Cake')
  assert.deepEqual(buttercream.sizePrices, { '15cm': 75, '19cm': 98, '22cm': 139 })
  assert.equal(buttercream.usesSizeOptions, true)
  assert.equal(buttercream.usesCacaoOptions, false)
  assert.equal(buttercream.usesChocolateTypeOptions, false)
  assert.equal(buttercream.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '15cm' }), 75)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '19cm' }), 98)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, { cakeSize: '22cm' }), 139)
  assert.equal(getReservationUnitPrice('buttercream-cake' as ProductId, {
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
  }), 139)
})

test('Brownie Cheesecake keeps the three approved fixed finishing prices', () => {
  const brownie = getProductById('brownie-cheesecake')
  const paveBrownie = getProductById('pave-brownie-cheesecake')
  const eiffelBrownie = getProductById('eiffel-tower-brownie-cheesecake')

  assert.equal(brownie.name, 'Brownie Cheesecake')
  assert.equal(brownie.price, 55)
  assert.equal(paveBrownie.price, 65)
  assert.equal(eiffelBrownie.price, 70)
  for (const productId of ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'] as const) {
    const product = getProductById(productId as ProductId)
    assert.equal(product.usesSizeOptions, false)
    assert.equal(product.usesPoundAddonOptions, false)
    assert.equal(getReservationUnitPrice(productId as ProductId), product.price)
  }
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

test('pave cake keeps its approved prices behind the size labels and dark-only finish', () => {
  const paveCake = getProductById('pave-cake')

  assert.equal(paveCake.usesSizeOptions, true)
  assert.equal(paveCake.usesChocolateTypeOptions, true)
  assert.equal(paveCake.usesPoundAddonOptions, false)
  assert.deepEqual(paveCake.sizePrices, { '15cm': 75, '19cm': 95, '22cm': 115 })
  assert.equal(getProductFeatures('pave-cake', 'en')[1], '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22')
  assert.equal(getProductFeatures('pave-cake', 'ko')[1], '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22')
  assert.equal(formatChocolateTypeLabel('dark'), 'Dark chocolate')
  assert.equal(formatChocolateTypeLabel('milk'), 'Dark chocolate')
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none' }), 75)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '19cm', chocolateType: 'milk', poundAddon: 'extra-chocolate' }), 95)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '19cm', chocolateType: 'dark', poundAddon: 'vanilla-cream' }), 95)
  assert.equal(getReservationUnitPrice('pave-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'none' }), 115)
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

test('AU cake pick-up is available only on weekends from 10:00 through 17:00', () => {
  const weekdayTimes = timeOptionsForDate('2026-07-06', DEFAULT_SETTINGS)
  const weekendTimes = timeOptionsForDate('2026-07-05', DEFAULT_SETTINGS)
  const customerWeekdayTimes = customerTimeOptionsForDate(
    '2026-07-06',
    DEFAULT_SETTINGS,
    new Date('2026-07-04T00:00:00.000Z'),
  )
  const customerWeekendTimes = customerTimeOptionsForDate(
    '2026-07-05',
    { ...DEFAULT_SETTINGS, weekendClose: '20:00' },
    new Date('2026-07-03T00:00:00.000Z'),
  )

  assert.equal(weekdayTimes.at(-1), '20:00')
  assert.equal(weekendTimes.at(-1), '17:00')
  assert.ok(weekdayTimes.includes('19:30'))
  assert.deepEqual(customerWeekdayTimes, [])
  assert.equal(customerWeekendTimes[0], '10:00')
  assert.equal(customerWeekendTimes.at(-1), '17:00')
  assert.equal(customerWeekendTimes.includes('17:30'), false)
  assert.equal(isCakePickupServiceTime('2026-07-05', '10:00'), true)
  assert.equal(isCakePickupServiceTime('2026-07-05', '17:00'), true)
  assert.equal(isCakePickupServiceTime('2026-07-05', '17:30'), false)
  assert.equal(isCakePickupServiceTime('2026-07-06', '10:00'), false)
})

test('AU customer calendar skips weekdays and selects the next eligible weekend date', () => {
  const now = new Date('2026-07-10T00:00:00.000Z')

  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, now), [])
  assert.equal(firstCustomerPickupDate(DEFAULT_SETTINGS, now), '2026-07-11')
  assert.equal(
    firstCustomerPickupDate(DEFAULT_SETTINGS, new Date('2026-07-12T00:00:00.000Z')),
    '2026-07-18',
  )
})

test('10:00 class blocks every half-hour pick-up boundary through 12:00 inclusive', () => {
  const bookedSlots = [{ classDate: '2026-07-10', classTime: '10:00' }]

  assert.equal(CLASS_SESSION_DURATION_MINUTES, 120)
  for (const pickupTime of ['10:00', '10:30', '11:00', '11:30', '12:00']) {
    assert.equal(isCakePickupBlockedByClass('2026-07-10', pickupTime, bookedSlots), true, pickupTime)
  }
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '09:30', bookedSlots), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '12:30', bookedSlots), false)
})

test('13:00 and 16:00 classes block their inclusive 120-minute pick-up windows', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]

  for (const pickupTime of ['13:00', '13:30', '14:00', '14:30', '15:00']) {
    assert.equal(isCakePickupBlockedByClass('2026-07-10', pickupTime, bookedSlots), true, pickupTime)
  }
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '15:30', bookedSlots), false)
  for (const pickupTime of ['16:00', '16:30', '17:00', '17:30', '18:00']) {
    assert.equal(isCakePickupBlockedByClass('2026-07-10', pickupTime, bookedSlots), true, pickupTime)
  }
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '18:30', bookedSlots), false)
})

test('an 11:00 class blocks cake pick-up through 13:00 even when it is not a standard session time', () => {
  const bookedSlots = [{ classDate: '2026-07-25', classTime: '11:00' }]

  for (const pickupTime of ['11:00', '11:30', '12:00', '12:30', '13:00']) {
    assert.equal(isCakePickupBlockedByClass('2026-07-25', pickupTime, bookedSlots), true, pickupTime)
  }
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '10:30', bookedSlots), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '13:30', bookedSlots), false)
})

test('booking all known class sessions blocks the whole cake pick-up day', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]

  assert.equal(isCakePickupBlockedByClass('2026-07-10', '08:30', bookedSlots), true)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '19:30', bookedSlots), true)
})

test('cake calendar keeps partially available class dates open and disables fully blocked dates', () => {
  const pickupTimes = ['09:30', '10:00', '10:30', '12:30', '13:00', '15:30', '16:00', '18:30']
  const partialSlots = [{ classDate: '2026-07-25', classTime: '10:00' }]
  const fullSlots = [
    { classDate: '2026-07-26', classTime: '10:00' },
    { classDate: '2026-07-26', classTime: '13:00' },
    { classDate: '2026-07-26', classTime: '16:00' },
  ]

  assert.equal(isCakePickupDateUnavailable('2026-07-25', pickupTimes, partialSlots), false)
  assert.equal(isCakePickupDateUnavailable('2026-07-26', pickupTimes, fullSlots), true)
  assert.equal(isCakePickupDateUnavailable('2026-07-26', pickupTimes, fullSlots, [{ pickupDate: '2026-07-26', pickupTime: '18:30' }]), false)

  const days = getBookingCalendarMonthDays('2026-07', '2026-07-22', false)
  assert.equal(days.find((day) => day.isoDate === '2026-07-24')?.disabled, false)
  assert.equal(days.find((day) => day.isoDate === '2026-07-25')?.disabled, false)
})

test('legacy date strings and blank class times each block the whole pick-up day', () => {
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '19:30', ['2026-07-10']), true)
  assert.equal(
    isCakePickupBlockedByClass('2026-07-10', '08:30', [{ classDate: '2026-07-10', classTime: '' }]),
    true,
  )
})

test('an exact cake opening overrides only its matching class-blocked date and time', () => {
  const bookedSlots = [{ classDate: '2026-07-10', classTime: '10:00' }]
  const pickupOpenings = [
    { pickupDate: '2026-07-10', pickupTime: '10:30' },
    { pickupDate: '2026-07-11', pickupTime: '11:00' },
  ]

  assert.equal(isCakePickupBlockedByClass('2026-07-10', '10:30', bookedSlots, pickupOpenings), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '10:00', bookedSlots, pickupOpenings), true)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '11:00', bookedSlots, pickupOpenings), true)
})

test('an exact cake opening overrides a full-day class block for only that time', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]
  const pickupOpenings = [{ pickupDate: '2026-07-10', pickupTime: '19:30' }]

  assert.equal(isCakePickupBlockedByClass('2026-07-10', '19:30', bookedSlots, pickupOpenings), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '19:00', bookedSlots, pickupOpenings), true)
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
    ['09:30', '10:30', '12:30', '15:30', '18:30'],
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
  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, atOneSecondBeforeEight)[0], '10:00')
  assert.equal(isPickupTimeAllowed('2026-07-11', '10:00', atOneSecondBeforeEight), true)
})

test('orders from 20:00 Sydney can pick up only from noon the next day', () => {
  const atEight = new Date('2026-07-10T10:00:00.000Z')
  const beforeMidnight = new Date('2026-07-10T13:59:59.000Z')

  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, atEight)[0], '12:00')
  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, beforeMidnight)[0], '12:00')
  assert.equal(isPickupTimeAllowed('2026-07-11', '11:30', atEight), false)
  assert.equal(isPickupTimeAllowed('2026-07-11', '12:00', atEight), true)
})

test('same-day pickup stays closed and later dates keep all store hours', () => {
  const atSevenSydney = new Date('2026-07-10T09:00:00.000Z')
  const atNineTenSydney = new Date('2026-07-09T23:10:00.000Z')

  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atSevenSydney), [])
  assert.equal(isPickupTimeAllowed('2026-07-10', '20:00', atNineTenSydney), false)
  assert.equal(customerTimeOptionsForDate('2026-07-12', DEFAULT_SETTINGS, atSevenSydney)[0], '10:00')
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
    dailyLimitText: 'Small-batch cakes, limited daily availability',
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
