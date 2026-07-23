import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  DEFAULT_SETTINGS,
  CAKE_SIZE_OPTIONS,
  applyPromoDiscount,
  formatCakeSizeLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getFreshLemonCupcakePackSize,
  getLemonIcingCount,
  getChocolateIcingSurcharge,
  getCupcakeFinishSurcharge,
  getProductById,
  getReservationUnitPrice,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  usesReservationChocolateType,
  PRODUCT_GROUPS,
  getProductGroupByProductId,
} from '../src/lib/constants.js'
import type { ProductId } from '../src/lib/types.js'
import {
  addDaysToInputValue,
  buildSmsMessage,
  customerTimeOptionsForDate,
  dateInputValue,
  formatCurrency,
  generateRequestId,
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

test('AU cake chooser follows the approved pound, pave, basque, lemon, vanilla order', () => {
  assert.deepEqual(
    PRODUCT_GROUPS.map((group) => ({ id: group.id, defaultProductId: group.defaultProductId, productIds: group.productIds })),
    [
      { id: 'pound-cupcake', defaultProductId: 'pound-cake', productIds: ['pound-cake', 'cupcake-dozen'] },
      { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
      {
        id: 'cheesecake',
        defaultProductId: 'choco-basque-cheesecake',
        productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'],
      },
      {
        id: 'fresh-lemon-cupcakes',
        defaultProductId: 'fresh-lemon-cupcakes-12',
        productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
      },
      { id: 'vanilla-fresh-cream', defaultProductId: 'vanilla-fresh-cream-cake', productIds: ['vanilla-fresh-cream-cake'] },
    ],
  )
  assert.equal(getProductGroupByProductId('cupcake-dozen').id, 'pound-cupcake')
  assert.equal(getProductGroupByProductId('vanilla-fresh-cream-cake').id, 'vanilla-fresh-cream')
  assert.equal(getProductGroupByProductId('pave-choco-basque-cheesecake').id, 'cheesecake')
  assert.equal(getProductGroupByProductId('fresh-lemon-cupcakes-8' as ProductId).id, 'fresh-lemon-cupcakes')
})

test('Vanilla Fresh Cream Cake is a separate size-only product with approved AUD prices and bilingual text', () => {
  const vanillaFreshCreamCakeId: ProductId = 'vanilla-fresh-cream-cake'
  const vanillaFreshCreamCake = getProductById(vanillaFreshCreamCakeId)

  assert.equal(vanillaFreshCreamCake.name, 'vanilla fresh cream cake')
  assert.deepEqual(vanillaFreshCreamCake.sizePrices, { '15cm': 75, '19cm': 98, '22cm': 139 })
  assert.equal(vanillaFreshCreamCake.usesSizeOptions, true)
  assert.equal(vanillaFreshCreamCake.usesCacaoOptions, false)
  assert.equal(vanillaFreshCreamCake.usesChocolateTypeOptions, false)
  assert.equal(vanillaFreshCreamCake.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '15cm', cacaoPercent: '100', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 75)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '19cm', cacaoPercent: '70', chocolateType: 'dark', poundAddon: 'extra-chocolate' }), 98)
  assert.equal(getReservationUnitPrice(vanillaFreshCreamCakeId, { cakeSize: '22cm', cacaoPercent: '80.5', chocolateType: 'milk', poundAddon: 'none' }), 139)

  for (const language of ['en', 'ko'] as const) {
    const text = getProductText(vanillaFreshCreamCakeId, language)
    const features = getProductFeatures(vanillaFreshCreamCakeId, language)
    assert.match(text.description, /four chocolate sponge layers|초콜릿 시트 4단/i)
    assert.match(text.description, /vanilla fresh cream|바닐라 생크림/)
    assert.equal(text.description.includes('cm'), false)
    assert.equal(text.priceNote.includes('cm'), false)
    assert.deepEqual(features, language === 'en'
      ? ['Four chocolate sponge layers', 'Vanilla fresh cream', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22']
      : ['초콜릿 시트 4단', '바닐라 생크림', '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22'])
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
  assert.equal(eiffelBasque.price, 75)
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
  assert.equal(getReservationUnitPrice('eiffel-tower-basque-cheesecake' as ProductId), 75)
})

test('cupcakes replace chocolate finish with per-piece vanilla cream and party decoration', () => {
  const cupcakes = getProductById('cupcake-dozen')

  assert.equal(cupcakes.usesChocolateTypeOptions, false)
  assert.equal(cupcakes.usesPoundAddonOptions, false)
  assert.equal(usesReservationChocolateType('cupcake-dozen', 'extra-chocolate'), false)
  assert.deepEqual(normalizeCupcakeFinishCounts('cupcake-dozen', 4, 3), {
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
  })
  assert.equal(getCupcakeFinishSurcharge('cupcake-dozen', 4, 3), 5)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { vanillaCreamCount: 4, partyDecorationCount: 3 }), 60)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { vanillaCreamCount: 0, partyDecorationCount: 12 }), 67)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'extra-chocolate', chocolateType: 'milk' }), 55)
})

test('cupcake finish counts clamp safely and do not affect other products', () => {
  assert.deepEqual(normalizeCupcakeFinishCounts('cupcake-dozen', 9, 8), {
    vanillaCreamCount: 9,
    partyDecorationCount: 3,
  })
  assert.deepEqual(normalizeCupcakeFinishCounts('cupcake-dozen', -2, 1.8), {
    vanillaCreamCount: 0,
    partyDecorationCount: 1,
  })
  assert.deepEqual(normalizeCupcakeFinishCounts('pound-cake', 4, 3), {
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
  })
  assert.equal(getCupcakeFinishSurcharge('pave-cake', 4, 3), 0)
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
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 50)
})

test('pound cake only asks dark or milk chocolate when extra chocolate is selected', () => {
  assert.equal(usesReservationChocolateType('pound-cake', 'none'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'vanilla-cream'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'extra-chocolate'), true)
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'extra-chocolate'), 'milk')
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'vanilla-cream'), 'dark')
})

test('cupcakes are sold by the dozen with per-piece finishing instead of pound cake options', () => {
  const cupcakes = getProductById('cupcake-dozen')

  assert.equal(cupcakes.name, 'Chocolate Cupcakes (1 dozen)')
  assert.equal(cupcakes.price, 55)
  assert.equal(cupcakes.usesSizeOptions, false)
  assert.equal(cupcakes.usesChocolateTypeOptions, false)
  assert.equal(cupcakes.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice('cupcake-dozen'), 55)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { vanillaCreamCount: 6 }), 58)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { partyDecorationCount: 6 }), 61)
  assert.equal(usesReservationChocolateType('cupcake-dozen', 'extra-chocolate'), false)
})

test('pave cake keeps its approved prices behind the new customer size labels', () => {
  const paveCake = getProductById('pave-cake')

  assert.equal(paveCake.usesSizeOptions, true)
  assert.equal(paveCake.usesChocolateTypeOptions, true)
  assert.equal(paveCake.usesPoundAddonOptions, false)
  assert.deepEqual(paveCake.sizePrices, { '15cm': 75, '19cm': 95, '22cm': 115 })
  assert.equal(getProductFeatures('pave-cake', 'en')[1], '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22')
  assert.equal(getProductFeatures('pave-cake', 'ko')[1], '6" | serves 8 · 7.5" | serves 14 · 9" | serves 22')
  assert.equal(formatChocolateTypeLabel('dark'), 'Dark chocolate')
  assert.equal(formatChocolateTypeLabel('milk'), 'Milk chocolate')
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

test('AU pick-up time options run until 20:00 every day', () => {
  const weekdayTimes = timeOptionsForDate('2026-07-06', DEFAULT_SETTINGS)
  const weekendTimes = timeOptionsForDate('2026-07-05', DEFAULT_SETTINGS)

  assert.equal(weekdayTimes.at(-1), '20:00')
  assert.equal(weekendTimes.at(-1), '20:00')
  assert.ok(weekdayTimes.includes('19:30'))
  assert.ok(weekendTimes.includes('19:30'))
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
    totalPrice: 75,
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

  assert.match(message, /Product: Chocolate Pound Cake/)
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
