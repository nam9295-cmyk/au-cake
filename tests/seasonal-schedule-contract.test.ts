import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as reservationBusiness from '../appwrite-functions/reservation-api/src/business.js'
import { SPRING_CLASS_CAMPAIGN_2026 } from '../src/lib/class-campaign.js'
import { AU_CAKE_PICKUP_SCHEDULE } from '../src/lib/pickup-schedule.js'

const serverExports = reservationBusiness as unknown as Record<string, unknown>

test('client and Reservation API publish the same AU pickup schedule', () => {
  assert.deepEqual(serverExports.AU_CAKE_PICKUP_SCHEDULE, AU_CAKE_PICKUP_SCHEDULE)
})

test('client and Reservation API publish the same Spring class campaign policy', () => {
  assert.deepEqual(serverExports.SPRING_CLASS_CAMPAIGN_2026, SPRING_CLASS_CAMPAIGN_2026)
})
