import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildCakeReservation, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { ReservationDrawer } from '../src/ReservationDrawer.js'
import { DEFAULT_SETTINGS } from '../src/lib/constants.js'
import { buildCakeOrderRequest, getOptionalReservationPricingAudit, getReservationPricingAudit, parseCakeReservationResult } from '../src/lib/review-coupon-client.js'
import { getReservationByNumber, toReservation } from '../src/lib/repository.js'

const now = new Date('2026-09-07T00:00:00.000Z')
const customer = {
  customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com',
  pickupDate: '2026-09-12', pickupTime: '10:00', privacyConsent: true, requestNote: '', website: '',
}
const smoreSets = [[10, 350, 3500], [25, 300, 7500], [50, 270, 13500]] as const

function generated(quantity: 10 | 25 | 50, reward?: 5 | 10) {
  return buildCakeReservation({ ...customer, orderLines: [
    { productId: 'smore-stick', quantity },
    ...(reward ? [{ productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 }] : []),
  ] }, {
    now,
    ...(reward ? { reviewCoupon: { id: reward === 5 ? 'manual:test' : 'review-test', rewardPercent: reward, codeLast4: 'ABCD' } } : {}),
  })
}

function response(document: ReturnType<typeof generated>) {
  return cakeReservationResponse(document)
}

async function lookup(row: unknown, number: string) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify([row]) } })
  try { return await getReservationByNumber(number, customer.customerPhone) }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete (globalThis as { localStorage?: Storage }).localStorage
  }
}

for (const [quantity, unitPriceCents, totalPriceCents] of smoreSets) {
  test(`current ${quantity}-stick S’more set survives create, admin and public lookup at its fixed price`, async () => {
    const document = generated(quantity)
    const result = response(document)
    const line = result.orderLines[0]
    assert.equal(document.quantity, quantity)
    assert.equal(document.orderItemCount, quantity)
    assert.equal(line.unitPriceCents, unitPriceCents)
    assert.equal(line.subtotalCents, totalPriceCents)
    assert.equal(line.discountPercent, 0)
    assert.equal(line.discountCents, 0)
    assert.equal(line.totalPriceCents, totalPriceCents)

    const created = parseCakeReservationResult(result)
    const admin = toReservation({ ...document, $id: `set-${quantity}` } as never)
    assert.equal(created.totalPriceCents, totalPriceCents)
    assert.equal(admin.totalPriceCents, totalPriceCents)
    assert.deepEqual(getReservationPricingAudit(created), {
      subtotalCents: totalPriceCents,
      discountPercent: 0,
      discountCents: 0,
      totalPriceCents,
      appliedPromoCodeLast4: '',
    })
    const projection = publicCakeReservation(document)
    const found = await lookup({ ...projection, id: `public-set-${quantity}`, customerPhone: customer.customerPhone }, document.reservationNumber)
    assert.equal(found?.quantity, quantity)
    assert.equal(found?.totalPriceCents, totalPriceCents)
  })
}

test('review coupons keep the standalone S’more set excluded from promotion pricing', () => {
  const document = generated(25, 10)
  const reservation = parseCakeReservationResult(response(document))
  const [smore, cupcakes] = reservation.orderLines!
  assert.equal(smore.totalPriceCents, 7500)
  assert.equal(smore.discountCents, 0)
  assert.equal(cupcakes.subtotalCents, 3000)
  assert.equal(cupcakes.discountCents, 300)
  assert.equal(reservation.discountBasisCents, 3000)
  assert.equal(reservation.discountCents, 300)
  assert.equal(reservation.totalPriceCents, 10200)
})

test('current S’more response rejects forged set prices and discounts', () => {
  const valid = response(generated(50))
  for (const mutate of [
    (row: typeof valid) => { row.orderLines[0].unitPriceCents = 450 },
    (row: typeof valid) => { row.orderLines[0].discountPercent = 20 },
    (row: typeof valid) => { row.orderLines[0].discountCents = 1; row.orderLines[0].totalPriceCents -= 1; row.discountCents = 1; row.totalPriceCents -= 1; row.totalPrice = row.totalPriceCents / 100 },
  ]) {
    const forged = structuredClone(valid)
    mutate(forged)
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  }
})

test('new client request validation only permits published S’more quantities', () => {
  const line = (quantity: number) => ({
    productId: 'smore-stick', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla',
    vanillaCakeFlavor: 'triple-berry', individualPackaging: false, quantity,
  })
  const request = (quantity: number) => ({
    ...customer, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', website: '', orderLines: [
      line(quantity),
      { ...line(10), productId: 'cupcake-half-dozen', quantity: 1 },
    ],
  })
  assert.doesNotThrow(() => buildCakeOrderRequest(request(10) as never))
  for (const quantity of [1, 24, 51]) {
    assert.throws(() => buildCakeOrderRequest(request(quantity) as never), /INVALID_ORDER_LINES/)
  }
})

test('existing legacy bulk-priced S’more records remain readable without changing new-order pricing', () => {
  const raw = JSON.parse(readFileSync('tests/fixtures/smore-appwrite-nullable.json', 'utf8'))
  const legacy = toReservation(raw as never)
  const audit = getReservationPricingAudit(legacy)
  assert.equal(legacy.quantity, 12)
  assert.equal(legacy.orderLines?.[0].unitPriceCents, 450)
  assert.equal(legacy.orderLines?.[0].discountPercent, 20)
  assert.deepEqual(audit, {
    subtotalCents: 5400,
    discountPercent: 0,
    discountCents: 1080,
    totalPriceCents: 4320,
    appliedPromoCodeLast4: '',
  })
})

test('admin drawer does not present a current fixed S’more set as a quantity discount', () => {
  const document = generated(50)
  const admin = toReservation({ ...document, $id: 'current-smoreset-drawer' } as never)
  const html = renderToStaticMarkup(React.createElement(ReservationDrawer, {
    reservation: admin,
    onClose: () => {}, onSave: async () => {}, onCopy: async () => {}, settings: DEFAULT_SETTINGS,
  }))
  assert.match(html, /AUD 135\.00/)
  assert.doesNotMatch(html, /수량 할인|bulk discount/)
  assert.equal(getOptionalReservationPricingAudit(admin)?.discountCents, 0)
})
