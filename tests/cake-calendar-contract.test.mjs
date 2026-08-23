import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const calendar = readFileSync(new URL('../src/components/WeekendDatePicker.tsx', import.meta.url), 'utf8')
const reserve = readFileSync(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const siteChrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')

test('cake reserve uses the shared compact calendar and keeps class conflict filtering authoritative', () => {
  assert.match(reserve, /<PickupDatePicker/)
  assert.doesNotMatch(reserve, /type="date"/)
  assert.match(reserve, /filterCakePickupTimesForClass/)
  assert.match(reserve, /isCakePickupDateUnavailable/)
  assert.match(reserve, /listClassBookedSlots\(\)/)
  assert.match(reserve, /listCakePickupOpenings\(\)/)
  assert.match(calendar, /weekendsOnly/)
  assert.match(calendar, /allowedWeekdays/)
  assert.match(calendar, /PickupDatePicker[\s\S]*AU_CAKE_PICKUP_ALLOWED_WEEKDAYS/)
  assert.match(calendar, /isDateDisabled/)
  assert.match(reserve, /Cake pick-up · Fri 18:00–20:00 · Sat–Sun 08:00–20:00/)
  assert.match(reserve, /케이크 픽업 · 금 18:00–20:00 · 토·일 08:00–20:00/)
  assert.match(siteChrome, /pickup-location-hours/)
  assert.match(siteChrome, /copy\.pickupHours\[0\]/)
})

test('AU customer source has no stale weekend-only pickup hours', () => {
  const source = `${reserve}\n${calendar}\n${readFileSync(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8')}`
  for (const stale of [
    'Cake pick-up Sat–Sun · 10:00–17:00',
    'Saturday–Sunday pick-up · 10:00–17:00',
    '케이크 픽업 토·일 10:00–17:00',
    '토·일 10:00–17:00 픽업',
  ]) assert.equal(source.includes(stale), false, stale)
})
