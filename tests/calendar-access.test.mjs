import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  createCalendarToken,
  verifyCalendarToken,
  sanitizeCakeCalendarEvent,
  sanitizeClassCalendarEvent,
} from '../functions/reservation-api/src/calendar-access.js'

const secret = 'a-test-secret-that-is-long-enough-for-hmac'

test('calendar tokens are signed, expire, and reject tampering', () => {
  const now = new Date('2026-07-12T00:00:00.000Z')
  const token = createCalendarToken(secret, now)

  assert.equal(verifyCalendarToken(token, secret, new Date('2026-08-10T23:59:59.000Z')), true)
  assert.equal(verifyCalendarToken(token, secret, new Date('2026-08-11T00:00:01.000Z')), false)
  assert.equal(verifyCalendarToken(`${token}x`, secret, now), false)
  assert.equal(verifyCalendarToken(token, 'different-secret', now), false)
})

test('calendar cake events expose schedule details without customer PII or internal notes', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'cake-private-id',
    pickupDate: '2026-07-25',
    pickupTime: '10:00',
    productId: 'pound-cake',
    poundAddon: 'extra-chocolate',
    quantity: 2,
    customerName: 'Private Customer',
    customerPhone: '0412345678',
    requestNote: 'Private request',
    adminMemo: 'Private admin memo',
    status: '예약확정',
    paymentStatus: '입금확인',
  })

  assert.deepEqual(event, {
    id: 'cake:cake-private-id',
    kind: 'cake',
    date: '2026-07-25',
    time: '10:00',
    label: 'Pound cake · Extra chocolate ×2',
    status: 'Confirmed',
    isCancelled: false,
  })
  assert.equal(JSON.stringify(event).includes('Private'), false)
  assert.equal(JSON.stringify(event).includes('0412345678'), false)
})

test('calendar cheesecake events show the selected variant without irrelevant finish text', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'cheesecake-id',
    pickupDate: '2026-08-01',
    pickupTime: '12:00',
    productId: 'pave-choco-basque-cheesecake',
    cakeSize: '15cm',
    poundAddon: 'none',
    quantity: 1,
    status: '예약신청',
  })

  assert.equal(event.label, 'Pave chocolate on top · 6" | serves 8 ×1')
})

test('calendar Pave events format compatible CakeSize values with the shared customer label', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'pave-id',
    pickupDate: '2026-08-01',
    pickupTime: '12:00',
    productId: 'pave-cake',
    cakeSize: '22cm',
    chocolateType: 'milk',
    quantity: 2,
    status: '예약신청',
  })

  assert.equal(event.label, 'Pave cake · 9" | serves 22 · Milk chocolate ×2')
})

test('calendar Vanilla Fresh Cream Cake events use the safe name and selected customer size label', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'vanilla-fresh-cream-id',
    pickupDate: '2026-08-01',
    pickupTime: '12:00',
    productId: 'vanilla-fresh-cream-cake',
    cakeSize: '19cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
    quantity: 2,
    status: '예약신청',
  })

  assert.equal(event.label, 'vanilla fresh cream cake · 7.5" | serves 14 ×2')
  assert.equal(event.label.includes('cm'), false)
  assert.equal(event.label.includes('Vanilla cream'), false)
})

test('calendar Lemon Cake events show the selected pack and icing mix', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'lemon-cupcakes-id',
    pickupDate: '2026-08-02',
    pickupTime: '13:00',
    productId: 'fresh-lemon-cupcakes-8',
    chocolateIcingCount: 3,
    poundAddon: 'none',
    quantity: 1,
    status: '예약신청',
  })

  assert.equal(event.label, 'Lemon Cake · 8 pieces · Finishing: Fresh lemon zest icing 5 / Dark couverture chocolate 3 ×1')
})

test('calendar treats legacy Lemon Cake reservations without icing count as all lemon', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'legacy-lemon-id',
    pickupDate: '2026-08-02',
    pickupTime: '13:00',
    productId: 'fresh-lemon-cupcakes-4',
    quantity: 1,
    status: '예약신청',
  })

  assert.equal(event.label, 'Lemon Cake · 4 pieces · Finishing: Fresh lemon zest icing 4 / Dark couverture chocolate 0 ×1')
})

test('calendar cupcake events show vanilla cream and party decoration counts without chocolate finish', () => {
  const event = sanitizeCakeCalendarEvent({
    $id: 'cupcake-dozen-id',
    pickupDate: '2026-08-03',
    pickupTime: '14:00',
    productId: 'cupcake-dozen',
    poundAddon: 'extra-chocolate',
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    quantity: 2,
    status: '예약확정',
  })

  assert.equal(event.label, 'Cupcakes · Finishing: Basic 5 / Vanilla cream 4 / Party decoration 3 ×2')
  assert.equal(event.label.includes('Extra chocolate'), false)
})

test('calendar labels both cheesecake finishing upgrades at the fixed size', () => {
  const pave = sanitizeCakeCalendarEvent({
    $id: 'pave-cheesecake-id',
    pickupDate: '2026-08-03',
    pickupTime: '11:00',
    productId: 'pave-choco-basque-cheesecake',
  })
  const eiffel = sanitizeCakeCalendarEvent({
    $id: 'eiffel-cheesecake-id',
    pickupDate: '2026-08-03',
    pickupTime: '12:00',
    productId: 'eiffel-tower-basque-cheesecake',
  })

  assert.match(pave.label, /Pave chocolate on top/)
  assert.match(eiffel.label, /Cake finishing with Eiffel Tower/)
  assert.match(pave.label, /6" \| serves 8/)
  assert.match(eiffel.label, /6" \| serves 8/)
})

test('calendar class events expose only safe class schedule and pricing audit fields', () => {
  const event = sanitizeClassCalendarEvent({
    $id: 'class-private-id',
    classType: 'cupcake-chocolate-class',
    classDate: '2026-07-25',
    classTime: '11:00',
    coursePlan: 'basic',
    durationMinutes: 120,
    extensionMinutes: 30,
    subtotalCents: 11900,
    discountPercent: 0,
    discountCents: 0,
    totalPriceCents: 11900,
    parentName: 'Private Parent',
    childName: 'Private Child',
    parentPhone: '0412345678',
    parentEmail: 'private@example.com',
    allergyNote: 'Private allergy',
    adminMemo: 'Private memo',
    status: 'Requested',
    paymentStatus: 'Payment pending',
  })

  assert.deepEqual(event, {
    id: 'class:class-private-id',
    kind: 'class',
    date: '2026-07-25',
    time: '11:00',
    label: 'Basic Cupcakes & Chocolate Class',
    coursePlan: 'basic',
    durationMinutes: 120,
    extensionMinutes: 30,
    subtotalCents: 11900,
    discountPercent: 0,
    discountCents: 0,
    totalPriceCents: 11900,
    status: 'Requested',
    isCancelled: false,
  })
  assert.equal(JSON.stringify(event).includes('Private'), false)
  assert.equal(JSON.stringify(event).includes('example.com'), false)
})
