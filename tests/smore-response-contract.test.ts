import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildCakeReservation, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/main.js'
import { ReservationDrawer } from '../src/ReservationDrawer.js'
import { DEFAULT_SETTINGS } from '../src/lib/constants.js'
import { buildCakeOrderRequest, getOptionalReservationPricingAudit, getReservationPricingAudit, parseCakeReservationResult } from '../src/lib/review-coupon-client.js'
import { getReservationByNumber, toReservation } from '../src/lib/repository.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import { readFileSync } from 'node:fs'

const now = new Date('2026-09-07T00:00:00.000Z')
const customer = { customerName: 'Test Customer', customerPhone: '0412345678', customerEmail: 'test@example.com', pickupDate: '2026-09-12', pickupTime: '10:00', privacyConsent: true, requestNote: '', website: '' }
function generated(quantity: number, reward?: 5 | 10) {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'smore-stick', quantity },
    ...(reward ? [{ productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 }] : []),
  ] }, { now, ...(reward ? { reviewCoupon: { id: reward === 5 ? 'manual:test' : 'review-test', rewardPercent: reward, codeLast4: 'ABCD' } } : {}) })
  return document
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
for (const quantity of [1, 5, 6, 11, 12, 50, 100, 1000000, Math.floor(Number.MAX_SAFE_INTEGER / 450)]) {
  test(`actual backend smore quantity ${quantity} survives create/admin/lookup with deterministic bulk`, async () => {
    const document = generated(quantity)
    assert.equal(document.quantity, quantity)
    assert.equal(document.orderItemCount, quantity)
    assert.equal(JSON.parse(document.orderLinesJson).lines[0].quantity, quantity)
    const result = response(document)
    const rate = quantity >= 12 ? 20 : quantity >= 6 ? 10 : 0
    assert.equal(result.orderLines[0].discountPercent, rate)
    const created = parseCakeReservationResult(result)
    const admin = toReservation({ ...document, $id: 'test' } as never)
    assert.equal(created.quantity, quantity)
    assert.equal(admin.quantity, quantity)
    const updated = buildAdminReservationUpdate(admin, { status: '픽업완료' })
    assert.equal(updated.quantity, quantity)
    assert.equal(toReservation({ ...document, ...updated, $id: 'test' } as never).quantity, quantity)
    assert.equal(created.discountPercent, 0)
    assert.equal(created.discountBasisCents, 0)
    assert.equal(created.discountCents, quantity * (450 * rate / 100))
    assert.equal((await lookup({ ...admin, ...publicCakeReservation(document) }, document.reservationNumber))?.quantity, quantity)
  })
}
for (const reward of [5, 10] as const) {
  for (const quantity of [1, 6, 12]) {
    test(`mixed ${quantity} smore + ${reward}% coupon preserves isolated promotion basis`, async () => {
      const document = generated(quantity, reward)
      const result = response(document)
      const created = parseCakeReservationResult(result)
      const admin = toReservation({ ...document, $id: 'test' } as never)
      assert.equal(created.discountBasisCents, result.orderLines[1].subtotalCents)
      assert.equal(created.discountCents, result.orderLines.reduce((sum: number, line: { discountCents: number }) => sum + line.discountCents, 0))
      assert.equal((await lookup({ ...admin, ...publicCakeReservation(document) }, document.reservationNumber))?.discountCents, created.discountCents)
      assert.doesNotThrow(() => buildCakeOrderRequest({ ...customer, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', orderLines: result.orderLines.map((line: object) => ({ ...line, individualPackaging: false })) } as never))
    })
  }
}
test('create/admin/lookup reject balanced forged bulk discounts and promo inclusion', async () => {
  for (const reward of [undefined, 5, 10] as const) {
    const document = generated(12, reward)
    for (const delta of [-1, 1]) {
      const forged = response(document)
      forged.orderLines[0].discountCents += delta
      forged.orderLines[0].totalPriceCents -= delta
      forged.discountCents += delta
      forged.totalPriceCents -= delta
      forged.totalPrice = forged.totalPriceCents / 100
      assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
      assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
      await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
    }
  }
})
test('smore bulk is never reclassified as a coupon, even when both rates are 10%', async () => {
  const document = generated(6, 10)
  const base = response(document)
  const mutations = [
    (row: typeof base) => { row.discountBasisCents += row.orderLines[0].subtotalCents },
    (row: typeof base) => { row.orderLines[0].discountPercent = 5 },
    (row: typeof base) => { row.discountPercent = 20 },
    (row: typeof base) => { row.totalPriceCents += 1; row.totalPrice = row.totalPriceCents / 100 },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(base)
    mutate(forged)
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
    assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
    await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
  }
})
test('smore-only forged coupon provenance is rejected by all readers', async () => {
  const document = generated(1)
  const forged = response(document)
  forged.promotionKind = 'review-reward'
  forged.appliedPromoCodeLast4 = 'ABCD'
  forged.discountPercent = 10
  forged.discountBasisCents = forged.subtotalCents
  forged.discountCents = 45
  forged.totalPriceCents -= 45
  forged.totalPrice = forged.totalPriceCents / 100
  forged.orderLines[0].discountPercent = 10
  forged.orderLines[0].discountCents = 45
  forged.orderLines[0].totalPriceCents -= 45
  assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  assert.throws(() => toReservation({ ...document, ...forged, quantity: document.quantity, reviewCouponId: 'review-test', orderLinesJson: JSON.stringify({ version: 1, lines: forged.orderLines }), $id: 'test' } as never), /INVALID_STORED_ORDER/)
  await assert.rejects(lookup({ ...forged, id: 'test' }, forged.reservationNumber), /INVALID_RESERVATION_RESPONSE/)
})
test('admin rejects inconsistent smore stored quantities including the discarded sentinel', () => {
  const document = generated(12)
  for (const quantity of [0, 1, 2, '12', null]) {
    assert.throws(() => toReservation({ ...document, quantity, $id: 'test' } as never), /INVALID_STORED_ORDER|INVALID_RESERVATION_RESPONSE/)
  }
})
test('normal product quantities remain capped and unsafe smore amounts rejected', () => {
  const result = response(generated(12, 10))
  for (const quantity of [6, Number.MAX_SAFE_INTEGER]) {
    const forged = structuredClone(result)
    forged.orderLines[1].quantity = quantity
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  }
  const forged = structuredClone(result)
  forged.orderLines[0].quantity = Number.MAX_SAFE_INTEGER
  assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
})

test('pricing audit accepts validated Smore bulk savings separately from promotion savings', () => {
  const cases = [
    generated(6),
    generated(12),
    generated(50),
    buildCakeReservation({ ...customer, orderLines: [
      { productId: 'smore-stick', quantity: 12 },
      { productId: 'pave-cake', cakeSize: '6in', quantity: 1 },
    ] }, { now }),
    buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
      { productId: 'smore-stick', quantity: 12 },
      { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
    ] }, { now }),
    generated(12, 10),
  ]
  for (const document of cases) {
    const reservation = parseCakeReservationResult(response(document))
    assert.deepEqual(getReservationPricingAudit(reservation), {
      subtotalCents: reservation.subtotalCents,
      discountPercent: reservation.discountPercent,
      discountCents: reservation.discountCents,
      totalPriceCents: reservation.totalPriceCents,
      appliedPromoCodeLast4: reservation.appliedPromoCodeLast4 || '',
    })
  }
})

test('pricing audit rejects forged bulk, promotion provenance, basis, and total fields', () => {
  const valid = response(generated(12, 10))
  const mutations = [
    (row: typeof valid) => { row.orderLines[0].discountPercent = 10 },
    (row: typeof valid) => { row.orderLines[0].discountCents += 1; row.orderLines[0].totalPriceCents -= 1; row.discountCents += 1; row.totalPriceCents -= 1; row.totalPrice = row.totalPriceCents / 100 },
    (row: typeof valid) => { row.discountPercent = 5 },
    (row: typeof valid) => { row.discountBasisCents += 1 },
    (row: typeof valid) => { row.appliedPromoCodeLast4 = '' },
    (row: typeof valid) => { row.totalPriceCents += 1; row.totalPrice = row.totalPriceCents / 100 },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(valid)
    mutate(forged)
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/)
  }
})

test('present malformed or removed orderLines cannot fall back to aggregate-only pricing audit', () => {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    { productId: 'smore-stick', quantity: 6 },
  ] }, { now, reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' } })
  const valid = response(document)
  assert.equal(valid.discountCents, Math.round(valid.subtotalCents * valid.discountPercent / 100))
  for (const replacement of [null, {}, 'invalid']) {
    const forged = { ...valid, orderLines: replacement }
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/)
    assert.throws(() => parseCakeReservationResult(forged), /INVALID_RESPONSE/)
  }
  const removed = { ...valid }
  delete (removed as Partial<typeof valid>).orderLines
  assert.throws(() => getReservationPricingAudit(removed), /INVALID_RESPONSE/)
  assert.throws(() => parseCakeReservationResult(removed), /INVALID_RESPONSE/)
})

test('CompletePage sends a server-authoritative Smore bulk reservation through the validated pricing audit', () => {
  const reservation = parseCakeReservationResult(response(generated(12)))
  assert.doesNotThrow(() => getReservationPricingAudit(reservation))
  const completePage = readFileSync('src/pages/CompletePage.tsx', 'utf8')
  assert.match(completePage, /getReservationPricingAudit\(reservation\)/)
  assert.match(completePage, /pricingAudit\.discountCents/)
})

test('server-authoritative pricing provenance survives every normal versioned Admin audit path', () => {
  const cases = [
    buildCakeReservation({ ...customer, orderLines: [
      { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    ] }, { now, reviewCoupon: { id: 'review-cupcake', rewardPercent: 10, codeLast4: 'ABCD' } } as never),
    generated(1, 10),
    buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
      { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
    ] }, { now }),
    generated(12),
    buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
      { productId: 'smore-stick', quantity: 6 },
      { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
    ] }, { now }),
    buildCakeReservation({ ...customer, orderLines: [
      { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
      { productId: 'smore-stick', quantity: 6 },
    ] }, { now, reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' } } as never),
  ]
  for (const [index, document] of cases.entries()) {
    const expected = getReservationPricingAudit(response(document))
    const admin = toReservation({ ...document, $id: `admin-audit-${index}` } as never)
    assert.deepEqual(getReservationPricingAudit(admin), expected)
    assert.deepEqual(getOptionalReservationPricingAudit(admin), expected)
    assert.equal(admin.promotionKind, response(document).promotionKind)
  }
  const bulkOnly = toReservation({ ...cases[3], $id: 'admin-bulk-only' } as never)
  assert.equal(bulkOnly.promotionKind, 'none')
  assert.equal(bulkOnly.discountPercent, 0)
  assert.ok((bulkOnly.discountCents || 0) > 0)
})

test('Appwrite nullable promo projections normalize only at the trusted Admin hydration boundary', () => {
  const cases = [
    generated(12),
    buildCakeReservation({ ...customer, orderLines: [
      { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    ] }, { now }),
    buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
      { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
    ] }, { now }),
    generated(1, 10),
    generated(1, 5),
  ]

  for (const [index, document] of cases.entries()) {
    const appwriteDocument = {
      ...document,
      $id: `admin-nullable-provenance-${index}`,
      appliedPromoCodeLast4: document.appliedPromoCodeLast4 ?? null,
      reviewCouponId: document.reviewCouponId ?? null,
    }
    assert.equal(Object.hasOwn(appwriteDocument, 'appliedPromoCodeLast4'), true)
    assert.equal(Object.hasOwn(appwriteDocument, 'reviewCouponId'), true)

    const admin = toReservation(appwriteDocument as never)
    assert.equal(Object.hasOwn(admin, 'appliedPromoCodeLast4'), true)
    assert.equal(Object.hasOwn(admin, 'reviewCouponId'), true)
    assert.equal(admin.appliedPromoCodeLast4, document.appliedPromoCodeLast4)
    assert.equal(admin.reviewCouponId, document.reviewCouponId)
    assert.deepEqual(getReservationPricingAudit(admin), getReservationPricingAudit(response(document)))
  }
})

test('Admin audit rejects forged versioned provenance and pricing instead of downgrading', () => {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    { productId: 'smore-stick', quantity: 6 },
  ] }, { now, reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' } } as never)
  const admin = toReservation({ ...document, $id: 'admin-forged-audit' } as never)
  for (const mode of ['deleted', 'null', 'undefined'] as const) {
    const forged = structuredClone(admin) as typeof admin
    if (mode === 'deleted') delete forged.reviewCouponId
    else forged.reviewCouponId = mode === 'null' ? null as never : undefined
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/, mode)
    assert.equal(getOptionalReservationPricingAudit(forged), null, mode)
  }
  const reviewLemon = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
  ] }, { now, reviewCoupon: { id: 'review-lemon', rewardPercent: 10, codeLast4: 'ABCD' } } as never)
  const forgedStatic = toReservation({ ...reviewLemon, $id: 'admin-forged-static' } as never)
  delete forgedStatic.reviewCouponId
  forgedStatic.promotionKind = 'static'
  forgedStatic.appliedPromoCodeLast4 = 'MONI'
  assert.throws(() => getReservationPricingAudit(forgedStatic), /INVALID_RESPONSE/)
  assert.equal(getOptionalReservationPricingAudit(forgedStatic), null)
  const publicResponse = response(document)
  assert.equal(Object.hasOwn(publicResponse, 'id'), false)
  assert.equal(Object.hasOwn(publicResponse, 'reviewCouponId'), false)
  assert.doesNotThrow(() => getReservationPricingAudit(publicResponse))

  const mutations: Array<(row: typeof admin) => void> = [
    row => { row.promotionKind = 'static' },
    row => { row.reviewCouponId = 'manual:***' },
    row => { row.appliedPromoCodeLast4 = '***' },
    row => { row.promotionKind = 'none'; row.reviewCouponId = undefined; row.appliedPromoCodeLast4 = undefined },
    row => { row.discountBasisCents = (row.discountBasisCents || 0) + 1 },
    row => { row.discountCents = (row.discountCents || 0) + 1 },
    row => { row.totalPriceCents = (row.totalPriceCents || 0) + 1 },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(admin)
    mutate(forged)
    assert.throws(() => getReservationPricingAudit(forged), /INVALID_RESPONSE/)
    assert.equal(getOptionalReservationPricingAudit(forged), null)
  }
  const forgedBulk = toReservation({ ...generated(12), $id: 'admin-forged-bulk' } as never)
  forgedBulk.promotionKind = 'static'
  forgedBulk.appliedPromoCodeLast4 = 'ABCD'
  assert.throws(() => getReservationPricingAudit(forgedBulk), /INVALID_RESPONSE/)
  assert.equal(getOptionalReservationPricingAudit(forgedBulk), null)
})

test('ReservationDrawer renders the validated Admin subtotal, discount and coupon provenance', () => {
  const document = buildCakeReservation({ ...customer, orderLines: [
    { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    { productId: 'smore-stick', quantity: 6 },
  ] }, { now, reviewCoupon: { id: 'review-test', rewardPercent: 10, codeLast4: 'ABCD' } } as never)
  const admin = toReservation({ ...document, $id: 'admin-drawer-audit' } as never)
  assert.equal(admin.subtotalCents, 5800)
  assert.equal(admin.discountCents, 580)
  assert.equal(admin.totalPriceCents, 5220)
  const html = renderToStaticMarkup(React.createElement(ReservationDrawer, {
    reservation: admin,
    onClose: () => {},
    onSave: async () => {},
    onCopy: async () => {},
    settings: DEFAULT_SETTINGS,
  }))
  assert.match(html, /할인 감사 정보/)
  assert.match(html, /AUD 58\.00/)
  assert.match(html, /AUD 5\.80/)
  assert.match(html, /코드 끝 4자리 ABCD/)
  assert.match(html, /일회용 쿠폰 ID review-test/)
})

function renderAppwriteDrawer(document: object) {
  const raw = {
    ...document,
    $id: 'drawer-display-fixture',
    appliedPromoCodeLast4: (document as { appliedPromoCodeLast4?: string }).appliedPromoCodeLast4 ?? null,
    reviewCouponId: (document as { reviewCouponId?: string }).reviewCouponId ?? null,
  }
  const admin = toReservation(raw as never)
  // Exercise the real strict boundary without a JSON round-trip losing own undefined.
  const audit = getReservationPricingAudit(admin)
  const before = structuredClone(admin)
  const html = renderToStaticMarkup(React.createElement(ReservationDrawer, {
    reservation: admin, settings: DEFAULT_SETTINGS,
    onClose: () => {}, onSave: async () => {}, onCopy: async () => {},
  }))
  assert.deepEqual(admin, before, 'rendering must not mutate authoritative pricing')
  const auditHtml = html.match(/<dt>할인 감사 정보<\/dt><dd>([\s\S]*?)<\/dd>/)?.[1] || ''
  const auditText = auditHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return { raw, admin, audit, html, auditText }
}

test('Drawer production-log qty12 nullable fixture labels AUD 10.80 as 20% quantity discount', () => {
  // Captured production pricing/nullable shape; identity/pickup fields are redacted placeholders.
  const document = JSON.parse(readFileSync('tests/fixtures/smore-appwrite-nullable.json', 'utf8'))
  const { raw, admin, audit, html, auditText } = renderAppwriteDrawer(document)
  for (const key of ['appliedPromoCodeLast4', 'reviewCouponId'] as const) {
    assert.equal(raw[key], null)
    assert.equal(Object.hasOwn(admin, key), true)
    assert.equal(admin[key], undefined)
  }
  assert.equal(admin.quantity, 12)
  assert.equal(admin.promotionKind, 'none')
  assert.equal(audit.subtotalCents, 5400)
  assert.equal(audit.discountCents, 1080)
  assert.equal(audit.totalPriceCents, 4320)
  assert.match(html, /주문 구성 · 12개/)
  assert.match(html, /AUD 43\.20/)
  assert.doesNotMatch(auditText, /(?:^|\s)0% 할인/)
  assert.match(auditText, /20% 수량 할인\s*·\s*- AUD 10\.80/)
  assert.match(auditText, /소계 AUD 54\.00/)
  assert.doesNotMatch(auditText, /프로모션|리뷰|쿠폰/)
})

test('Drawer qty6 bulk-only labels 10% quantity discount and exact AUD 2.70', () => {
  const { auditText, html } = renderAppwriteDrawer(generated(6))
  assert.match(auditText, /10% 수량 할인\s*·\s*- AUD 2\.70/)
  assert.doesNotMatch(auditText, /(?:^|\s)0% 할인/)
  assert.match(html, /AUD 24\.30/)
})

test('Drawer qty5 no-discount order has no fake discount row', () => {
  const { auditText, html, audit } = renderAppwriteDrawer(generated(5))
  assert.equal(audit.discountCents, 0)
  assert.equal(auditText, '')
  assert.doesNotMatch(html, /할인 감사 정보|수량 할인/)
  assert.match(html, /AUD 22\.50/)
})

test('Drawer normal static promo preserves the existing percentage and provenance display', () => {
  const document = buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
    { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
  ] }, { now: new Date('2026-07-10T00:00:00.000Z') })
  const { auditText, admin } = renderAppwriteDrawer(document)
  assert.equal(admin.promotionKind, 'static')
  assert.match(auditText, /10% 할인/)
  assert.ok(auditText.includes(`- AUD ${(document.discountCents / 100).toFixed(2)}`))
  assert.match(auditText, /코드 끝 4자리 MONI/)
  assert.doesNotMatch(auditText, /수량 할인/)
})

for (const reward of [5, 10] as const) {
  test(`Drawer normal ${reward}% coupon keeps the existing rate, amount and ID`, () => {
    const couponId = reward === 5 ? 'manual:drawer' : 'review-drawer'
    const document = buildCakeReservation({ ...customer, orderLines: [
      { productId: 'cupcake-half-dozen', cupcakeFinish: 'basic', quantity: 1 },
    ] }, { now, reviewCoupon: { id: couponId, rewardPercent: reward, codeLast4: 'ABCD' } } as never)
    const { auditText } = renderAppwriteDrawer(document)
    assert.ok(auditText.includes(`${reward}% 할인`))
    assert.ok(auditText.includes(`- AUD ${(document.discountCents / 100).toFixed(2)}`))
    assert.ok(auditText.includes(`일회용 쿠폰 ID ${couponId}`))
    assert.doesNotMatch(auditText, /수량 할인/)
  })
}

for (const quantity of [6, 12]) {
  for (const provenance of ['static', 'review'] as const) {
    test(`Drawer mixed qty${quantity} + ${provenance} separates bulk, promotion and total savings`, () => {
      const document = provenance === 'static'
        ? buildCakeReservation({ ...customer, promoCode: 'lemoni', orderLines: [
          { productId: 'smore-stick', quantity },
          { productId: 'fresh-lemon-cupcakes-6', quantity: 1 },
        ] }, { now: new Date('2026-07-10T00:00:00.000Z') })
        : generated(quantity, 10)
      const { admin, auditText } = renderAppwriteDrawer(document)
      const bulk = admin.orderLines![0]
      const promoCents = document.discountCents - bulk.discountCents
      assert.ok(auditText.includes(`${bulk.discountPercent}% 수량 할인 · - AUD ${(bulk.discountCents / 100).toFixed(2)}`))
      assert.ok(auditText.includes(`${provenance === 'static' ? '프로모션' : '리뷰'} 10% 할인 · - AUD ${(promoCents / 100).toFixed(2)}`))
      assert.ok(auditText.includes(`총 할인 · - AUD ${(document.discountCents / 100).toFixed(2)}`))
      assert.ok(!auditText.includes(`10% 할인 · - AUD ${(document.discountCents / 100).toFixed(2)}`), 'total savings cannot be described as one promotion percentage')
      assert.match(auditText, /코드 끝 4자리/)
      if (provenance === 'review') assert.match(auditText, /일회용 쿠폰 ID/)
    })
  }
}
