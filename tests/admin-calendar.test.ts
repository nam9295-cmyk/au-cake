import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildAdminCalendarEvents,
  getCalendarGridDays,
  getDailyCalendarSummary,
  getMonthLabel,
  shiftCalendarMonth,
} from '../src/lib/admin-calendar.js'
import type { ClassReservation, Reservation } from '../src/lib/types.js'

function cake(overrides: Partial<Reservation>): Reservation {
  return {
    id: 'cake-1',
    reservationNumber: 'VG-C-AU-1',
    customerName: 'Jenny',
    customerPhone: '0412345678',
    productId: 'pave-cake',
    cakeSize: '15cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
    pickupDate: '2026-07-09',
    pickupTime: '10:00',
    cacaoPercent: '기본',
    requestNote: '',
    status: '예약신청',
    paymentStatus: '입금대기',
    totalPrice: 75,
    adminMemo: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function classBooking(overrides: Partial<ClassReservation>): ClassReservation {
  return {
    id: 'class-1',
    reservationNumber: 'VG-K-AU-1',
    classType: 'school-holiday-private-cake-class',
    classDate: '2026-07-09',
    classTime: '09:30',
    bookingType: '1-child',
    parentName: 'Sarah',
    parentPhone: '0412345678',
    parentEmail: 'sarah@example.com',
    childName: 'Emma',
    childAge: 7,
    schoolYear: 'Year 1',
    secondChildName: '',
    secondChildAge: null,
    secondChildSchoolYear: '',
    allergyNote: '',
    emergencyContact: 'Sarah 0412345678',
    pickupPerson: 'Sarah',
    parentConsent: true,
    cancellationAgreement: true,
    photoConsent: false,
    status: 'Requested',
    paymentStatus: 'Payment pending',
    totalPrice: 95,
    depositAmount: 0,
    adminMemo: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

test('monthly calendar grid covers full weeks around target month', () => {
  const days = getCalendarGridDays('2026-07')

  assert.equal(days.length, 35)
  assert.equal(days[0].date, '2026-06-28')
  assert.equal(days[0].isCurrentMonth, false)
  assert.equal(days[3].date, '2026-07-01')
  assert.equal(days[3].isCurrentMonth, true)
  assert.equal(days.at(-1)?.date, '2026-08-01')
})

test('calendar month label and navigation use local date-safe yyyy-mm strings', () => {
  assert.equal(getMonthLabel('2026-07'), '2026년 7월')
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12')
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01')
})

test('cake and class reservations become time-sorted colored calendar events', () => {
  const events = buildAdminCalendarEvents([
    cake({ id: 'cake-late', pickupTime: '14:00', customerName: 'Mina', productId: 'cupcake-dozen', quantity: 2 }),
    cake({ id: 'cake-early', pickupTime: '10:00', customerName: 'Jenny', productId: 'pave-cake', quantity: 1 }),
  ], [
    classBooking({ id: 'class-first', classTime: '09:30', childName: 'Emma' }),
  ])

  assert.deepEqual(events.map((event) => `${event.kind}:${event.time}:${event.title}:${event.subtitle}`), [
    'class:09:30:Basic Cake Class · Emma:Year 3–6 · Payment pending',
    'cake:10:00:Jenny · Pave Chocolate Cake:Pave x1 · 입금대기',
    'cake:14:00:Mina · Chocolate Cupcakes (1 dozen):Cupcake x2 · 입금대기',
  ])
})

test('daily summary counts active cakes by quantity and classes separately', () => {
  const events = buildAdminCalendarEvents([
    cake({ id: 'cake-1', quantity: 1, status: '예약확정' }),
    cake({ id: 'cake-2', quantity: 2, productId: 'pound-cake' }),
    cake({ id: 'cake-cancelled', quantity: 4, status: '취소' }),
  ], [
    classBooking({ id: 'class-1' }),
    classBooking({ id: 'class-cancelled', status: 'Cancelled' }),
  ])

  assert.equal(getDailyCalendarSummary(events), 'Cake 3 · Class 1')
})

test('package reservations create separate basic and advanced calendar sessions', () => {
  const reservation = classBooking({
    coursePlan: 'basic-advanced-package',
    classDate: '2026-07-25',
    classTime: '10:00',
    durationMinutes: 120,
    extensionMinutes: 30,
    advancedClassDate: '2026-07-26',
    advancedClassTime: '13:00',
    advancedDurationMinutes: 150,
    advancedExtensionMinutes: 30,
    subtotalCents: 27800,
    discountPercent: 5,
    discountCents: 1290,
    totalPriceCents: 26510,
  })
  const events = buildAdminCalendarEvents([], [reservation])
  assert.deepEqual(events.map((event) => [event.date, event.time, event.title, event.subtitle]), [
    ['2026-07-25', '10:00', 'Basic Cake Class · Emma', 'Package · Basic · 120 min · +30 min extension · 5% off · AUD 265.10 · Payment pending'],
    ['2026-07-26', '13:00', 'Advanced 2-Tier Cake Class · Emma', 'Package · Advanced · 150 min · +30 min extension · 5% off · AUD 265.10 · Payment pending'],
  ])
})
