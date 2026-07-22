import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  CLASS_EXTENSION_WARNING,
  CLASS_SESSION_DURATION_MINUTES,
  CLASS_SESSION_TIMES,
  buildClassConfirmationMessage,
  buildClassPaymentMessage,
  calculateClassPricing,
  classReservationsToCsv,
  generateClassReservationNumber,
  getAvailableClassSessionTimes,
  getClassBookingPrice,
  getClassBookingType,
  getClassAgeGroupForSchoolYear,
  getClassSchoolYears,
  isClassSchoolYearAllowed,
  getClassDepositAmount,
  getClassDurationMinutes,
  getClassCalendarMonthDays,
  getClassCalendarMonthLabel,
  shiftClassCalendarMonth,
  getClassTypeLabel,
  getClassSlotAvailability,
  isCakePickupBlockedByClass,
  isClassDateBooked,
  isClassSessionTimeBooked,
  isWeekendClassDate,
  resolveWeekendClassDate,
  normalizeClassReservationInput,
  formatClassBookingType,
  filterClassReservationsForAdmin,
} from '../src/lib/class-utils.js'
import type { ClassReservation } from '../src/lib/types.js'

const sampleReservation: ClassReservation = {
  id: 'local-1',
  reservationNumber: 'VG-KC-AU-20260702-101500123',
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-07-10',
  classTime: '10:00',
  bookingType: 'year-1-2',
  parentName: 'Jenny Parent',
  parentPhone: '0412 345 678',
  parentEmail: 'jenny@example.com',
  childName: 'Mina',
  childAge: 9,
  schoolYear: 'Year 4',
  secondChildName: 'Leo',
  secondChildAge: 10,
  secondChildSchoolYear: 'Year 5',
  allergyNote: 'Nut allergy check needed',
  emergencyContact: 'John 0400 000 000',
  pickupPerson: 'Jenny Parent',
  parentConsent: true,
  cancellationAgreement: true,
  photoConsent: false,
  status: 'Requested',
  paymentStatus: 'Fully paid',
  totalPrice: 99,
  depositAmount: 0,
  adminMemo: 'Bring apron',
  createdAt: '2026-07-02T01:00:00.000Z',
  updatedAt: '2026-07-02T01:00:00.000Z',
}

test('class booking prices and session times match Jenny feedback', () => {
  assert.deepEqual([...CLASS_SESSION_TIMES], ['10:00', '13:00', '16:00'])
  assert.equal(CLASS_SESSION_DURATION_MINUTES, 120)
  assert.equal(getClassBookingPrice('year-1-2'), 99)
  assert.equal(getClassBookingPrice('1-child'), 109)
  assert.equal(getClassBookingPrice('2-friends'), 198)
  assert.equal(getClassDepositAmount(), 0)
})

test('basic, advanced and package pricing use cents and discount only package base fees', () => {
  assert.deepEqual(calculateClassPricing({ coursePlan: 'basic', bookingType: 'year-1-2', extensionMinutes: 30 }), {
    subtotalCents: 11900, discountPercent: 0, discountCents: 0, totalPriceCents: 11900,
  })
  assert.deepEqual(calculateClassPricing({ coursePlan: 'basic', bookingType: '2-friends', extensionMinutes: 30 }), {
    subtotalCents: 23800, discountPercent: 0, discountCents: 0, totalPriceCents: 23800,
  })
  assert.deepEqual(calculateClassPricing({ coursePlan: 'advanced', bookingType: '1-child', extensionMinutes: 30 }), {
    subtotalCents: 17900, discountPercent: 0, discountCents: 0, totalPriceCents: 17900,
  })
  assert.deepEqual(calculateClassPricing({
    coursePlan: 'basic-advanced-package', bookingType: 'year-1-2', extensionMinutes: 30, advancedExtensionMinutes: 30,
  }), {
    subtotalCents: 29800, discountPercent: 5, discountCents: 1290, totalPriceCents: 28510,
  })
})

test('class durations and exact extension warning match the approved weekend offering', () => {
  assert.equal(getClassDurationMinutes('basic', 0), 90)
  assert.equal(getClassDurationMinutes('basic', 30), 120)
  assert.equal(getClassDurationMinutes('advanced', 0), 120)
  assert.equal(getClassDurationMinutes('advanced', 30), 150)
  assert.equal(isWeekendClassDate('2026-07-25'), true)
  assert.equal(isWeekendClassDate('2026-07-26'), true)
  assert.equal(isWeekendClassDate('2026-07-27'), false)
  assert.equal(CLASS_EXTENSION_WARNING, 'Please consider your child’s focus and stamina before adding 30 minutes. For boys in particular, please choose this option carefully, as the longer session can feel demanding.')
})

test('weekday date-picker changes keep the previous weekend date', () => {
  assert.equal(resolveWeekendClassDate('2026-07-25', '2026-07-27'), '2026-07-25')
  assert.equal(resolveWeekendClassDate('2026-07-25', '2026-07-26'), '2026-07-26')
  assert.equal(resolveWeekendClassDate('2026-07-25', ''), '2026-07-25')
})

test('custom class calendar builds a stable month grid with weekday-only disabled states', () => {
  const days = getClassCalendarMonthDays('2026-07', '2026-07-22')
  assert.equal(days.length, 42)
  assert.deepEqual(days[0], {
    isoDate: '2026-06-28', dayNumber: 28, inCurrentMonth: false,
    isWeekend: true, disabled: true,
  })
  assert.equal(days.find((day) => day.isoDate === '2026-07-24')?.disabled, true)
  assert.equal(days.find((day) => day.isoDate === '2026-07-25')?.disabled, false)
  assert.equal(days.find((day) => day.isoDate === '2026-07-26')?.disabled, false)
  assert.equal(getClassCalendarMonthLabel('2026-07'), 'July 2026')
  assert.equal(shiftClassCalendarMonth('2026-07', 1), '2026-08')
  assert.equal(shiftClassCalendarMonth('2026-07', -1), '2026-06')
})

test('class course, school group and child count map to the legacy pricing types', () => {
  assert.equal(getClassTypeLabel('school-holiday-private-cake-class'), 'Basic Cake Class')
  assert.equal(getClassTypeLabel('cupcake-chocolate-class'), 'Basic Cupcakes & Chocolate Class')
  assert.equal(getClassTypeLabel('advanced-2-tier-cake-class'), 'Advanced 2-Tier Cake Class')
  assert.equal(formatClassBookingType('year-1-2'), 'Kindy–Year 2')
  assert.equal(formatClassBookingType('1-child'), 'Year 3–6')
  assert.equal(formatClassBookingType('2-friends'), '2 children')
  assert.equal(getClassBookingType('kindy-year-2', 1), 'year-1-2')
  assert.equal(getClassBookingType('year-2', 1), 'year-1-2')
  assert.equal(getClassBookingType('year-3-6', 1), '1-child')
  assert.equal(getClassBookingType('kindy-year-2', 2), '2-friends')
  assert.equal(getClassBookingType('year-3-6', 2), '2-friends')
})

test('Basic accepts Kindy through Year 6 while Advanced and packages start at Year 2', () => {
  assert.deepEqual(getClassSchoolYears('basic'), ['Kindy', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])
  assert.deepEqual(getClassSchoolYears('advanced'), ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])
  assert.deepEqual(getClassSchoolYears('basic-advanced-package'), ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'])
  assert.equal(isClassSchoolYearAllowed('basic', 'Kindy'), true)
  assert.equal(isClassSchoolYearAllowed('advanced', 'Kindy'), false)
  assert.equal(isClassSchoolYearAllowed('basic-advanced-package', 'Year 1'), false)
  assert.equal(getClassAgeGroupForSchoolYear('Kindy'), 'kindy-year-2')
  assert.equal(getClassAgeGroupForSchoolYear('Year 1'), 'kindy-year-2')
  assert.equal(getClassAgeGroupForSchoolYear('Year 2'), 'year-2')
  assert.equal(getClassAgeGroupForSchoolYear('Year 3'), 'year-3-6')
})

test('class request normalization removes stale package-only fields after plan changes', () => {
  const stale = {
    ...sampleReservation,
    coursePlan: 'basic' as const,
    partySize: 1 as const,
    advancedClassDate: '2026-07-26',
    advancedClassTime: '13:00',
    advancedExtensionMinutes: 30 as const,
    privacyConsent: true,
    website: '',
    requestId: 'request-1',
  }
  const basic = normalizeClassReservationInput(stale)
  assert.equal(basic.partySize, undefined)
  assert.equal(basic.advancedClassDate, undefined)
  assert.equal(basic.advancedClassTime, undefined)
  assert.equal(basic.advancedExtensionMinutes, undefined)

  const packageRequest = normalizeClassReservationInput({ ...stale, coursePlan: 'basic-advanced-package' })
  assert.equal(packageRequest.advancedClassDate, '2026-07-26')
  assert.equal(packageRequest.advancedClassTime, '13:00')
  assert.equal(packageRequest.advancedExtensionMinutes, 30)
})

test('admin class date filter matches either Basic or package Advanced session', () => {
  const packageReservation: ClassReservation = {
    ...sampleReservation,
    coursePlan: 'basic-advanced-package',
    classDate: '2026-07-25',
    advancedClassDate: '2026-08-01',
    advancedClassTime: '13:00',
  }
  const filters = { status: '', paymentStatus: '', search: '' }
  assert.equal(filterClassReservationsForAdmin([packageReservation], { ...filters, classDate: '2026-07-25' }).length, 1)
  assert.equal(filterClassReservationsForAdmin([packageReservation], { ...filters, classDate: '2026-08-01' }).length, 1)
  assert.equal(filterClassReservationsForAdmin([packageReservation], { ...filters, classDate: '2026-08-02' }).length, 0)
})

test('class reservation number uses kids class AU prefix and date', () => {
  const number = generateClassReservationNumber(new Date('2026-07-02T01:15:00.000Z'))
  assert.match(number, /^VG-KC-AU-20260702-\d{9}$/)
})

test('payment and confirmation messages include session, child, parent, soft payment wording and safety details', () => {
  const payment = buildClassPaymentMessage(sampleReservation)
  assert.match(payment, /Basic Cake Class/)
  assert.match(payment, /Jenny Parent/)
  assert.match(payment, /thank you for your booking for Mina and Leo/)
  assert.match(payment, /2026-07-10 10:00/)
  assert.match(payment, /The session is currently available\./)
  assert.match(payment, /Please use the payment details below:/)
  assert.match(payment, /Once your payment is confirmed, we will send you a final confirmation message!/)
  assert.match(payment, /BSB 012263 Account 324999682/)
  assert.match(payment, /Account name: JEONGMIN CHEON/)
  assert.match(payment, /Amount due: AUD 99\.00/)
  assert.match(payment, /favourite figure, doll, LEGO, or small toy/)
  assert.match(payment, /create their own special cake/)
  assert.match(payment, /1 Bundil Blvd, Melrose Park, Sydney/)
  assert.doesNotMatch(payment, /deposit/i)

  const cupcakePayment = buildClassPaymentMessage({ ...sampleReservation, classType: 'cupcake-chocolate-class' })
  assert.match(cupcakePayment, /Basic Cupcakes & Chocolate Class/)

  const confirmation = buildClassConfirmationMessage(sampleReservation)
  assert.match(confirmation, /Mina and Leo's cake class booking is confirmed/)
  assert.match(confirmation, /1 Bundil Blvd, Melrose Park, Sydney/)
  assert.match(confirmation, /Long hair should be tied back/)
  assert.match(confirmation, /allergies or dietary concerns/)
  assert.match(confirmation, /favourite figure, doll, LEGO, or small toy/)
  assert.match(confirmation, /Thank you:\)/)

  const packageReservation: ClassReservation = {
    ...sampleReservation,
    coursePlan: 'basic-advanced-package',
    extensionMinutes: 30,
    durationMinutes: 120,
    advancedClassDate: '2026-07-12',
    advancedClassTime: '13:00',
    advancedExtensionMinutes: 30,
    advancedDurationMinutes: 150,
    subtotalCents: 27800,
    discountPercent: 5,
    discountCents: 1290,
    totalPriceCents: 26510,
    totalPrice: 265.10,
  }
  for (const message of [buildClassPaymentMessage(packageReservation), buildClassConfirmationMessage(packageReservation)]) {
    assert.match(message, /30-minute extension/)
    assert.match(message, /Subtotal: AUD 278\.00/)
    assert.match(message, /Package discount: 5% \(-AUD 12\.90\)/)
    assert.match(message, /Total: AUD 265\.10/)
  }
})

test('class availability closes only the requested time slot for active bookings', () => {
  const activeReservations: ClassReservation[] = [
    sampleReservation,
    { ...sampleReservation, id: 'cancelled-1', classDate: '2026-07-11', classTime: '10:00', status: 'Cancelled' },
    { ...sampleReservation, id: 'active-2', classDate: '2026-07-12', classTime: '13:00', status: 'Confirmed' },
    { ...sampleReservation, id: 'active-3', classDate: '2026-07-12', classTime: '16:00', status: 'Requested' },
  ]

  assert.equal(isClassSessionTimeBooked('2026-07-10', '10:00', activeReservations), true)
  assert.equal(isClassSessionTimeBooked('2026-07-10', '13:00', activeReservations), false)
  assert.equal(isClassDateBooked('2026-07-10', activeReservations), false)
  assert.equal(isClassDateBooked('2026-07-11', activeReservations), false)
  assert.deepEqual(getAvailableClassSessionTimes('2026-07-10', activeReservations), ['13:00', '16:00'])
  assert.deepEqual(getAvailableClassSessionTimes('2026-07-11', activeReservations), [...CLASS_SESSION_TIMES])
  assert.deepEqual(getAvailableClassSessionTimes('2026-07-12', activeReservations), ['10:00'])
  assert.deepEqual(getClassSlotAvailability('2026-07-12', activeReservations), {
    classDate: '2026-07-12',
    availableTimes: ['10:00'],
    bookedTimes: ['13:00', '16:00'],
    isFullyBooked: false,
  })
})

test('class CSV exports parent child safety consent payment and admin fields', () => {
  const csv = classReservationsToCsv([sampleReservation])
  assert.match(csv, /Booking number,Created at,Class date,Class time,Course plan,Advanced class date,Advanced class time/)
  assert.match(csv, /Jenny Parent/)
  assert.match(csv, /Nut allergy check needed/)
  assert.match(csv, /Fully paid/)
  assert.match(csv, /Bring apron/)
  assert.match(csv, /Duration minutes,Advanced duration minutes,Extension minutes,Advanced extension minutes/)
  assert.match(csv, /Subtotal cents,Discount percent,Discount cents,Total price cents/)
})

test('pickup conflicts use each booked slot duration and keep a safe 120-minute legacy fallback', () => {
  const basic = [{ classDate: '2026-07-25', classTime: '10:00', durationMinutes: 90 }]
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '11:30', basic), true)
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '12:00', basic), false)
  const extended = [{ classDate: '2026-07-25', classTime: '10:00', durationMinutes: 150 }]
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '12:30', extended), true)
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '13:00', extended), false)
  const legacy = [{ classDate: '2026-07-25', classTime: '10:00' }]
  assert.equal(isCakePickupBlockedByClass('2026-07-25', '12:00', legacy), true)
})
