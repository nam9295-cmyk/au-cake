import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { classReservationsToCsv } from '../src/lib/class-utils.js'
import type { ClassReservation, Reservation } from '../src/lib/types.js'
import { buildSmsMessage, reservationsToCsv } from '../src/lib/utils.js'

const cakeReservation: Reservation = {
  id: 'cake-1',
  reservationNumber: 'VG-C-AU-1',
  customerName: '=HYPERLINK("https://example.test")',
  customerPhone: '0412345678',
  productId: 'pave-cake',
  cakeSize: '15cm',
  chocolateType: 'dark',
  poundAddon: 'none',
  quantity: 1,
  pickupDate: '2026-07-20',
  pickupTime: '10:00',
  cacaoPercent: '기본',
  requestNote: '\t+SUM(1,2)',
  status: '예약신청',
  paymentStatus: '입금대기',
  totalPrice: 75,
  totalPriceCents: 7500,
  adminMemo: '@IMPORTDATA("https://example.test")',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

const classReservation: ClassReservation = {
  id: 'class-1',
  reservationNumber: 'VG-KC-AU-1',
  classType: 'school-holiday-private-cake-class',
  classDate: '2026-07-20',
  classTime: '10:00',
  bookingType: 'year-1-2',
  parentName: '-1+1',
  parentPhone: '0412345678',
  parentEmail: 'parent@example.com',
  childName: 'Mina',
  childAge: 8,
  schoolYear: 'Year 2',
  secondChildName: '',
  secondChildAge: null,
  secondChildSchoolYear: '',
  allergyNote: '=CMD()',
  emergencyContact: 'John 0400000000',
  pickupPerson: 'Jenny',
  parentConsent: true,
  cancellationAgreement: true,
  photoConsent: false,
  status: 'Requested',
  paymentStatus: 'Payment pending',
  totalPrice: 99,
  depositAmount: 0,
  adminMemo: '',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

test('cake CSV neutralises spreadsheet formulas including leading control characters', () => {
  const csv = reservationsToCsv([cakeReservation])
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/)
  assert.match(csv, /"'\t\+SUM\(1,2\)"/)
  assert.match(csv, /"'@IMPORTDATA\(""https:\/\/example\.test""\)"/)
})

test('cake CSV exports cupcake per-piece finishing and omits retired chocolate finish', () => {
  const csv = reservationsToCsv([{
    ...cakeReservation,
    productId: 'cupcake-dozen',
    poundAddon: 'extra-chocolate',
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    totalPrice: 60,
    totalPriceCents: 6000,
  }])

  assert.match(csv, /Basic 5 \/ Vanilla cream 4 \/ Party decoration 3/)
  assert.equal(csv.includes('Extra chocolate'), false)
})

test('cake CSV preserves legacy columns and appends every multi-line item with authoritative counts', () => {
  const csv = reservationsToCsv([{
    ...cakeReservation,
    totalPrice: 130,
    totalPriceCents: 13000,
    orderLineCount: 2,
    orderItemCount: 2,
    orderLines: [
      { productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 7500, subtotalCents: 7500, discountPercent: 0, discountCents: 0, totalPriceCents: 7500 },
      { productId: 'choco-basque-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 5500, subtotalCents: 5500, discountPercent: 0, discountCents: 0, totalPriceCents: 5500 },
    ],
  }])

  const [header, row] = csv.split('\n')
  assert.match(header, /"Order line count","Order item count","Order items"$/)
  assert.match(row, /Pave Chocolate Cake.*x1.*AUD 75\.00/)
  assert.match(row, /Chocolatier's Basque Cheesecake.*x1.*AUD 55\.00/)
  assert.match(row, /,"2","2",/)
})

test('cake confirmation SMS lists every multi-line item instead of only the legacy first projection', () => {
  const message = buildSmsMessage({
    ...cakeReservation,
    customerName: 'Jenny',
    orderLineCount: 2,
    orderItemCount: 2,
    orderLines: [
      { productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 7500, subtotalCents: 7500, discountPercent: 0, discountCents: 0, totalPriceCents: 7500 },
      { productId: 'choco-basque-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 5500, subtotalCents: 5500, discountPercent: 0, discountCents: 0, totalPriceCents: 5500 },
    ],
  })
  assert.match(message, /1\. Pave Chocolate Cake/)
  assert.match(message, /2\. Chocolatier's Basque Cheesecake/)
  assert.match(message, /Total items: 2/)
})

test('class CSV neutralises spreadsheet formulas in customer-entered fields', () => {
  const csv = classReservationsToCsv([classReservation])
  assert.match(csv, /"'-1\+1"/)
  assert.match(csv, /"'=CMD\(\)"/)
})
