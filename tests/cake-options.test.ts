import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_POUND_ADDON,
  CAKE_SIZE_OPTIONS,
  formatCakeSizeLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  getProductById,
  getReservationUnitPrice,
  normalizeReservationChocolateType,
  usesReservationChocolateType,
} from '../src/lib/constants.js'
import { formatCurrency, buildSmsMessage, isValidPhone, normalizePhone } from '../src/lib/utils.js'

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
  assert.equal(formatPoundAddonLabel('none'), 'Basic pound cake')
  assert.equal(formatPoundAddonLabel('extra-chocolate'), 'Extra chocolate')
  assert.equal(formatPoundAddonLabel('vanilla-cream'), 'Vanilla cream')
})

test('pound cake pricing ignores size and chocolate, and uses confirmed finish prices', () => {
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none' }), 45)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'none' }), 45)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'extra-chocolate' }), 50)
  assert.equal(getReservationUnitPrice('pound-cake', { cakeSize: '22cm', chocolateType: 'milk', poundAddon: 'vanilla-cream' }), 55)
})

test('pound cake only asks dark or milk chocolate when extra chocolate is selected', () => {
  assert.equal(usesReservationChocolateType('pound-cake', 'none'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'vanilla-cream'), false)
  assert.equal(usesReservationChocolateType('pound-cake', 'extra-chocolate'), true)
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'extra-chocolate'), 'milk')
  assert.equal(normalizeReservationChocolateType('pound-cake', 'milk', 'vanilla-cream'), 'dark')
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

We will check availability and send you a confirmation.

Thank you:)`)
  assert.doesNotMatch(message, /Product: Gâteau au Chocolat Pave Chocolate Cake/)
  assert.doesNotMatch(message, /Pick-up address:/)
  assert.doesNotMatch(message, /Contact: .*TBC/)
})
