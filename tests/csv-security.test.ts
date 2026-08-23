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

test('cake CSV preserves legacy cupcake count finishing and omits retired chocolate finish', () => {
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

test('cake CSV exports current Cupcake pack and whole-box finish', () => {
  const csv = reservationsToCsv([{
    ...cakeReservation,
    productId: 'cupcake-half-dozen', cupcakeFinish: 'chocolate-buttercream',
    totalPrice: 41, totalPriceCents: 4100,
  }])

  assert.match(csv, /Pack: Half Dozen · 6 cupcakes/)
  assert.match(csv, /Finish: Chocolate Buttercream/)
})

test('cake CSV preserves historical Vanilla sheet and flavour without applying current copy', () => {
  const historicalVanilla: Reservation = {
    ...cakeReservation,
    productId: 'vanilla-fresh-cream-cake',
    vanillaCakeSheet: 'vanilla',
    vanillaCakeFlavor: 'triple-berry',
    vanillaCakePointColor: 'blue',
    totalPrice: 75,
    totalPriceCents: 7500,
  }
  const csv = reservationsToCsv([historicalVanilla])
  const sms = buildSmsMessage(historicalVanilla)

  assert.match(csv, /Vanilla cake sheet/)
  assert.match(csv, /Triple berry/)
  assert.doesNotMatch(csv, /Signature Gâteau au Chocolat layers/)
  assert.doesNotMatch(csv, /real vanilla bean/)
  assert.match(sms, /Cake sheet: Vanilla cake sheet/)
  assert.match(sms, /Flavour: Triple berry/)
  assert.doesNotMatch(sms, /real vanilla bean/)
})

test('cake CSV and confirmation SMS show individual packaging pieces, fee, and two-decimal total', () => {
  const packaged: Reservation = {
    ...cakeReservation,
    productId: 'cupcake-half-dozen',
    cupcakeFinish: 'basic',
    individualPackaging: true,
    individualPackagingPieces: 6,
    individualPackagingFeeCents: 300,
    subtotalCents: 3100,
    totalPrice: 34,
    totalPriceCents: 3400,
  }
  const csv = reservationsToCsv([packaged])
  const sms = buildSmsMessage(packaged)

  assert.match(csv, /Individual packaging: 6 pieces · AUD 3\.00/)
  assert.match(csv, /AUD 34\.00/)
  assert.match(sms, /Individual packaging: 6 pieces · AUD 3\.00/)
  assert.match(sms, /Total: AUD 34\.00/)
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
