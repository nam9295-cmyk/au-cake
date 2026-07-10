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
  getProductById,
  getReservationUnitPrice,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  usesReservationChocolateType,
} from '../src/lib/constants.js'
import {
  PICKUP_LEAD_TIME_MINUTES,
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

test('AU promo discount keeps cents instead of rounding to whole dollars', () => {
  assert.equal(applyPromoDiscount(75, 'VERYGOODsyd'), 67.5)
  assert.equal(formatCurrency(applyPromoDiscount(75, 'verygoodSYD')), 'AUD 67.50')
  assert.equal(formatCurrency(75 - applyPromoDiscount(75, 'verygoodSYD')), 'AUD 7.50')
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

test('cake openings do not add times already removed by the two-hour lead-time filter', () => {
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
  assert.equal(filteredTimes[0], '12:30')
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

test('AU customer pick-up times require two full hours of preparation', () => {
  const atNineSydney = new Date('2026-07-09T23:00:00.000Z')
  const oneSecondAfterNineSydney = new Date('2026-07-09T23:00:01.000Z')
  const atNineTenSydney = new Date('2026-07-09T23:10:00.000Z')

  assert.equal(PICKUP_LEAD_TIME_MINUTES, 120)
  assert.equal(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atNineSydney)[0], '11:00')
  assert.equal(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, oneSecondAfterNineSydney)[0], '11:30')
  assert.equal(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atNineTenSydney)[0], '11:30')
  assert.equal(isPickupTimeAllowed('2026-07-10', '10:59', atNineSydney), false)
  assert.equal(isPickupTimeAllowed('2026-07-10', '11:00', atNineSydney), true)
})

test('AU customer pick-up lead time uses elapsed time across Sydney daylight saving changes', () => {
  const beforeSpringForward = new Date('2026-10-03T15:30:00.000Z')
  const beforeAutumnFallback = new Date('2026-04-04T15:30:00.000Z')

  assert.equal(isPickupTimeAllowed('2026-10-04', '03:30', beforeSpringForward), false)
  assert.equal(isPickupTimeAllowed('2026-04-05', '03:30', beforeAutumnFallback), true)
})

test('AU customer pick-up times keep full hours for future dates and close today when too late', () => {
  const atNineTenSydney = new Date('2026-07-09T23:10:00.000Z')
  const atSevenSydney = new Date('2026-07-10T09:00:00.000Z')

  assert.equal(customerTimeOptionsForDate('2026-07-11', DEFAULT_SETTINGS, atNineTenSydney)[0], '10:00')
  assert.deepEqual(customerTimeOptionsForDate('2026-07-10', DEFAULT_SETTINGS, atSevenSydney), [])
  assert.equal(isPickupTimeAllowed('2026-07-09', '20:00', atNineTenSydney), false)
  assert.equal(isPickupTimeAllowed('2026-07-11', '10:00', atNineTenSydney), true)
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
