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
  getProductById,
  getReservationUnitPrice,
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
  isCakePickupBlockedByClass,
} from '../src/lib/class-utils.js'

test('AU catalogue exposes Fresh Lemon Cupcakes as a fourth grouped product family', () => {
  assert.deepEqual(
    PRODUCT_GROUPS.map((group) => ({ id: group.id, defaultProductId: group.defaultProductId, productIds: group.productIds })),
    [
      { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
      { id: 'pound-cupcake', defaultProductId: 'pound-cake', productIds: ['pound-cake', 'cupcake-dozen'] },
      { id: 'cheesecake', defaultProductId: 'choco-basque-cheesecake', productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake'] },
      {
        id: 'fresh-lemon-cupcakes',
        defaultProductId: 'fresh-lemon-cupcakes-6',
        productIds: ['fresh-lemon-cupcakes-4', 'fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12'],
      },
    ],
  )
  assert.equal(getProductGroupByProductId('cupcake-dozen').id, 'pound-cupcake')
  assert.equal(getProductGroupByProductId('pave-choco-basque-cheesecake').id, 'cheesecake')
  assert.equal(getProductGroupByProductId('fresh-lemon-cupcakes-8' as ProductId).id, 'fresh-lemon-cupcakes')
})

test('Lemon Cake variants use fixed pack prices and the six pack is the default', () => {
  const variants = [
    ['fresh-lemon-cupcakes-4', 24],
    ['fresh-lemon-cupcakes-6', 36],
    ['fresh-lemon-cupcakes-8', 45],
    ['fresh-lemon-cupcakes-12', 65],
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

  assert.equal(getProductById('fresh-lemon-cupcakes-6').priceNote.includes('Most Popular'), true)
  assert.equal(getProductById('fresh-lemon-cupcakes-12').priceNote.includes('Best Value'), true)
})

test('Lemon Cake chocolate icing count derives mix and adds AUD 0.50 per changed piece', () => {
  assert.equal(getFreshLemonCupcakePackSize('fresh-lemon-cupcakes-4'), 4)
  assert.equal(getLemonIcingCount('fresh-lemon-cupcakes-4', 3), 1)
  assert.equal(getChocolateIcingSurcharge('fresh-lemon-cupcakes-4', 3), 1.5)
  assert.equal(getReservationUnitPrice('fresh-lemon-cupcakes-4', { chocolateIcingCount: 3 }), 25.5)
  assert.equal(getLemonIcingCount('fresh-lemon-cupcakes-12', 8), 4)
  assert.equal(getChocolateIcingSurcharge('fresh-lemon-cupcakes-12', 8), 4)
  assert.equal(getReservationUnitPrice('fresh-lemon-cupcakes-12', { chocolateIcingCount: 8 }), 69)
  assert.equal(getChocolateIcingSurcharge('pave-cake', 8), 0)
})

test('Lemoni discounts the Lemon Cake subtotal after chocolate icing surcharge', () => {
  const subtotal = getReservationUnitPrice('fresh-lemon-cupcakes-4', { chocolateIcingCount: 3 })
  assert.equal(subtotal, 25.5)
  assert.equal(applyPromoDiscount(subtotal, 'fresh-lemon-cupcakes-4', 'lemoni', new Date('2026-07-13T00:00:00Z')), 22.95)
})

test('AU cheesecake variants are fixed 6 inch cakes priced at AUD 55 and AUD 65', () => {
  const chocoBasque = getProductById('choco-basque-cheesecake')
  const paveBasque = getProductById('pave-choco-basque-cheesecake')

  assert.equal(chocoBasque.name, "Chocolatier's Basque Cheesecake")
  assert.equal(chocoBasque.price, 55)
  assert.equal(paveBasque.name, "Pave Chocolatier's Basque Cheesecake")
  assert.equal(paveBasque.price, 65)
  assert.equal(chocoBasque.usesSizeOptions, false)
  assert.equal(chocoBasque.usesPoundAddonOptions, false)
  assert.equal(getReservationUnitPrice('choco-basque-cheesecake'), 55)
  assert.equal(getReservationUnitPrice('pave-choco-basque-cheesecake'), 65)
})

test('cupcakes stay AUD 10 above pound cake and keep the existing finish prices', () => {
  assert.equal(getReservationUnitPrice('pound-cake', { poundAddon: 'none' }), 45)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'none' }), 55)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'extra-chocolate' }), 62)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'vanilla-cream' }), 60)
})

test('client request IDs are valid UUIDs for idempotent reservation retries', () => {
  assert.match(generateRequestId(), /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i)
})

test('AU cake size labels show inch and centimetre together with 17cm removed', () => {
  assert.deepEqual(
    CAKE_SIZE_OPTIONS.map((option) => option.value),
    ['15cm', '19cm', '22cm'],
  )
  assert.equal(formatCakeSizeLabel('15cm'), '6 inch / 15cm')
  assert.equal(formatCakeSizeLabel('19cm'), '7.5 inch / 19cm')
  assert.equal(formatCakeSizeLabel('22cm'), '8.7 inch / 22cm')
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

test('cupcakes are sold by the dozen and use pound cake finish options', () => {
  const cupcakes = getProductById('cupcake-dozen')

  assert.equal(cupcakes.name, 'Chocolate Cupcakes (1 dozen)')
  assert.equal(cupcakes.price, 55)
  assert.equal(cupcakes.usesSizeOptions, false)
  assert.equal(cupcakes.usesChocolateTypeOptions, false)
  assert.equal(cupcakes.usesPoundAddonOptions, true)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'none' }), 55)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'extra-chocolate', chocolateType: 'milk' }), 62)
  assert.equal(getReservationUnitPrice('cupcake-dozen', { poundAddon: 'vanilla-cream' }), 60)
  assert.equal(usesReservationChocolateType('cupcake-dozen', 'extra-chocolate'), true)
  assert.equal(normalizeReservationChocolateType('cupcake-dozen', 'milk', 'vanilla-cream'), 'dark')
})

test('pave cake pricing uses size and chocolate type choices without pound finish', () => {
  const paveCake = getProductById('pave-cake')

  assert.equal(paveCake.usesSizeOptions, true)
  assert.equal(paveCake.usesChocolateTypeOptions, true)
  assert.equal(paveCake.usesPoundAddonOptions, false)
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

  assert.equal(applyPromoDiscount(24, 'fresh-lemon-cupcakes-4', 'LEMONI', validAt), 21.6)
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

test('13:00 and 16:00 classes block their inclusive two-hour pick-up windows', () => {
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

test('booking all known class sessions blocks the whole cake pick-up day', () => {
  const bookedSlots = [
    { classDate: '2026-07-10', classTime: '10:00' },
    { classDate: '2026-07-10', classTime: '13:00' },
    { classDate: '2026-07-10', classTime: '16:00' },
  ]

  assert.equal(isCakePickupBlockedByClass('2026-07-10', '08:30', bookedSlots), true)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '19:30', bookedSlots), true)
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
  ]

  assert.equal(isCakePickupBlockedByClass('not-a-date', '10:00', ['not-a-date']), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', 'not-a-time', [{ classDate: '2026-07-10', classTime: '10:00' }]), false)
  assert.equal(isCakePickupBlockedByClass('2026-07-10', '10:00', malformedBookedSlots), false)
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

Thank you for your order Jenny

Booking number: VG-C-AU-20260704-204051216
Product: Pave Chocolate Cake
Size: 6 inch / 15cm
Chocolate: Dark chocolate
Pick-up date: 2026-07-04
Pick-up time: 10:00
Quantity: 1ea

Thank you:)`)
  assert.doesNotMatch(message, /Product: Gâteau au Chocolat Pave Chocolate Cake/)
  assert.doesNotMatch(message, /Pick-up address:/)
  assert.doesNotMatch(message, /Contact: .*TBC/)
})

test('AU cheesecake confirmation includes the selected variant and fixed 6 inch size', () => {
  const message = buildSmsMessage({
    id: 'test-cheesecake-id',
    reservationNumber: 'VG-C-AU-20260704-CHEESE',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'pave-choco-basque-cheesecake',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
    pickupDate: '2026-07-04',
    pickupTime: '12:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 65,
    adminMemo: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  })

  assert.match(message, /Pave Chocolatier's Basque Cheesecake/)
  assert.match(message, /Size: 6 inch \/ 15cm/)
  assert.equal(message.includes('Finish:'), false)
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
