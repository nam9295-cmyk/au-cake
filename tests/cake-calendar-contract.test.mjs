import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const calendar = readFileSync(new URL('../src/components/WeekendDatePicker.tsx', import.meta.url), 'utf8')
const reserve = readFileSync(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')

test('cake reserve uses the shared compact calendar and keeps class conflict filtering authoritative', () => {
  assert.match(reserve, /<PickupDatePicker/)
  assert.doesNotMatch(reserve, /type="date"/)
  assert.match(reserve, /filterCakePickupTimesForClass/)
  assert.match(reserve, /isCakePickupDateUnavailable/)
  assert.match(reserve, /listClassBookedSlots\(\)/)
  assert.match(reserve, /listCakePickupOpenings\(\)/)
  assert.match(calendar, /weekendsOnly/)
  assert.match(calendar, /PickupDatePicker[\s\S]*weekendsOnly/)
  assert.match(calendar, /isDateDisabled/)
  assert.match(calendar, /Unavailable dates are shown in grey/)
})
