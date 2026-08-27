import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as reservationBusiness from '../appwrite-functions/reservation-api/src/business.js'
import { SPRING_CLASS_CAMPAIGN_2026 } from '../src/lib/class-campaign.js'
import {
  AU_CAKE_PICKUP_SCHEDULE,
  getAuCakePickupTimeOptions,
  isAuCakePickupServiceTime,
} from '../src/lib/pickup-schedule.js'
import { filterCakePickupTimesForClass, isCakePickupBlockedByClass } from '../src/lib/class-utils.js'

const serverExports = reservationBusiness as unknown as Record<string, unknown>

test('client and Reservation API publish the same AU pickup schedule', () => {
  assert.deepEqual(serverExports.AU_CAKE_PICKUP_SCHEDULE, AU_CAKE_PICKUP_SCHEDULE)
})

test('client and Reservation API publish the same Spring class campaign policy', () => {
  assert.deepEqual(serverExports.SPRING_CLASS_CAMPAIGN_2026, SPRING_CLASS_CAMPAIGN_2026)
})

test('AU Cake pickup schedule opens every Sydney date from 08:00 through the inclusive 20:00 boundary', () => {
  const date = '2026-09-01'
  const frontendOptions = getAuCakePickupTimeOptions(date)
  const backendAllows = serverExports.isCakePickupServiceTime as (pickupDate: string, pickupTime: string) => boolean

  assert.equal(AU_CAKE_PICKUP_SCHEDULE.intervalMinutes, 15)
  assert.deepEqual(frontendOptions, Array.from({ length: 49 }, (_, index) => {
    const minutes = 8 * 60 + index * 15
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  }))

  for (const [time, expected] of [
    ['07:45', false], ['08:00', true], ['08:15', true], ['09:30', true], ['12:00', true],
    ['15:15', true], ['19:45', true], ['20:00', true], ['20:15', false],
  ] as const) {
    assert.equal(isAuCakePickupServiceTime(date, time), expected, `frontend ${time}`)
    assert.equal(backendAllows(date, time), expected, `backend ${time}`)
  }
})

test('AU Cake closes only the 2026-08-29 09:30–12:00 Sydney interval and keeps its boundaries open', () => {
  const date = '2026-08-29'
  const frontendOptions = getAuCakePickupTimeOptions(date)
  const backendAllows = serverExports.isCakePickupServiceTime as (pickupDate: string, pickupTime: string) => boolean
  const buildCakeReservation = serverExports.buildCakeReservation as (input: Record<string, unknown>, options: Record<string, unknown>) => unknown

  for (const [time, expected] of [
    ['08:00', true], ['09:00', true], ['09:15', true],
    ['09:30', false], ['09:45', false], ['10:00', false], ['10:15', false], ['10:30', false],
    ['10:45', false], ['11:00', false], ['11:15', false], ['11:30', false], ['11:45', false],
    ['12:00', true], ['12:15', true], ['15:00', true], ['19:45', true], ['20:00', true],
  ] as const) {
    assert.equal(frontendOptions.includes(time), expected, `frontend ${time}`)
    assert.equal(backendAllows(date, time), expected, `backend ${time}`)
  }

  const baseInput = {
    customerName: 'Schedule Test', customerPhone: '0412345678', customerEmail: 'schedule.test@example.com',
    productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', quantity: 1,
    pickupDate: date, cacaoPercent: '기본', requestNote: '', promoCode: '', privacyConsent: true,
  }
  assert.doesNotThrow(() => buildCakeReservation({ ...baseInput, pickupTime: '09:15' }, { now: new Date('2026-08-20T00:00:00.000Z') }))
  assert.throws(
    () => buildCakeReservation({ ...baseInput, pickupTime: '09:30' }, { now: new Date('2026-08-20T00:00:00.000Z') }),
    (error: unknown) => (error as { code?: string })?.code === 'PICKUP_TIME_UNAVAILABLE',
  )
  for (const time of ['09:29', '11:59']) {
    assert.throws(
      () => buildCakeReservation({ ...baseInput, pickupTime: time }, { now: new Date('2026-08-20T00:00:00.000Z') }),
      (error: unknown) => (error as { code?: string })?.code === 'INVALID_PICKUP_TIME',
    )
  }
})

test('AU Cake availability does not close for school pickup or Kids Class slots', () => {
  const date = '2026-09-01'
  const bookedSlots = [{ classDate: date, classTime: '13:00', durationMinutes: 180 }]
  const backendSchoolBlocked = serverExports.isSchoolPickupWindowClosed as (pickupDate: string, pickupTime: string) => boolean
  const backendClassBlocked = serverExports.isCakePickupBlocked as (pickupDate: string, pickupTime: string, slots: unknown[]) => boolean

  assert.equal(backendSchoolBlocked(date, '15:15'), false)
  assert.equal(backendClassBlocked(date, '15:15', bookedSlots), false)
  assert.equal(isCakePickupBlockedByClass(date, '15:15', bookedSlots), false)
  assert.deepEqual(filterCakePickupTimesForClass(date, ['15:15'], bookedSlots), ['15:15'])
})
