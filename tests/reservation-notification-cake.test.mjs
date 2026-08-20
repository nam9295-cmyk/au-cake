import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as notification from '../appwrite-functions/reservation-notification/src/main.js'

function rowsByLabel(reservation) {
  assert.equal(typeof notification.buildCakeNotificationRows, 'function')
  return Object.fromEntries(notification.buildCakeNotificationRows(reservation))
}

function validStoredReservation() {
  const lines = [
    { productId: 'pound-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 4500, subtotalCents: 4500, discountPercent: 0, discountCents: 0, totalPriceCents: 4500 },
    { productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1, unitPriceCents: 7500, subtotalCents: 7500, discountPercent: 0, discountCents: 0, totalPriceCents: 7500 },
  ]
  return {
    reservationNumber: 'VG-C-AU-MULTI', customerName: 'Customer', customerPhone: '0400000000',
    pickupDate: '2026-08-02', pickupTime: '12:00', requestNote: '', createdAt: '2026-07-30T00:00:00.000Z',
    productId: 'pound-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1,
    subtotalCents: 12000, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
    totalPriceCents: 12000, totalPrice: 120, orderLineCount: 2, orderItemCount: 2,
    orderLinesJson: JSON.stringify({ version: 1, lines }),
  }
}

test('AU operator cake notifications use the shared customer size labels', () => {
  const pave = rowsByLabel({
    reservationNumber: 'VG-C-AU-PAVE',
    productId: 'pave-cake',
    cakeSize: '19cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
  })
  const basque = rowsByLabel({
    reservationNumber: 'VG-C-AU-BASQUE',
    productId: 'choco-basque-cheesecake',
    cakeSize: '15cm',
    poundAddon: 'none',
    quantity: 1,
  })

  assert.equal(pave.Size, '7.5" | serves 14')
  assert.equal(basque.Size, '6" | serves 8')
})

test('AU operator cake notification projection exposes only approved cake-size labels', () => {
  const expectedLabels = {
    '15cm': '6" | serves 8',
    '19cm': '7.5" | serves 14',
    '22cm': '9" | serves 22',
  }
  const projectedLabels = Object.fromEntries(
    Object.keys(expectedLabels).map((cakeSize) => [
      cakeSize,
      rowsByLabel({
        reservationNumber: `VG-C-AU-${cakeSize}`,
        productId: 'pave-cake',
        cakeSize,
        chocolateType: 'dark',
        poundAddon: 'none',
        quantity: 1,
      }).Size,
    ]),
  )
  const legacySize = rowsByLabel({
    reservationNumber: 'VG-C-AU-17CM',
    productId: 'pave-cake',
    cakeSize: '17cm',
    chocolateType: 'dark',
    poundAddon: 'none',
    quantity: 1,
  }).Size

  assert.deepEqual(projectedLabels, expectedLabels)
  assert.equal(legacySize, '17cm')
})

test('AU operator notification gives new cream cakes their chocolate sheets, filling, and point colour', () => {
  const rows = rowsByLabel({
    reservationNumber: 'VG-C-AU-VANILLA',
    productId: 'vanilla-fresh-cream-cake',
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
    vanillaCakeSheet: 'chocolate',
    vanillaCakeFlavor: 'plain',
    vanillaCakePointColor: 'blue',
    quantity: 1,
  })

  assert.equal(rows.Product, 'vanilla fresh cream cake')
  assert.equal(rows.Size, '9" | serves 22')
  assert.equal(rows.Chocolate, '-')
  assert.equal(rows.Finish, '-')
  assert.equal(rows['Cake sheet'], 'Chocolate cake sheet')
  assert.equal(rows.Filling, 'Plain fresh cream')
  assert.equal(rows['Point colour'], 'Blue')

  const buttercream = rowsByLabel({
    reservationNumber: 'VG-C-AU-BUTTERCREAM',
    productId: 'buttercream-cake',
    cakeSize: '19cm',
    vanillaCakeSheet: 'chocolate',
    vanillaCakeFlavor: 'plain',
    vanillaCakePointColor: 'purple',
    quantity: 1,
  })
  assert.equal(buttercream['Cake sheet'], 'Chocolate cake sheet')
  assert.equal(buttercream.Filling, 'Chocolate Buttercream')
  assert.equal(buttercream['Point colour'], 'Purple')
})

test('AU operator notification shows current Cupcake pack and whole-box finish', () => {
  const rows = rowsByLabel({
    reservationNumber: 'VG-C-AU-CUPCAKE-HALF', productId: 'cupcake-half-dozen', cupcakeFinish: 'chocolate-buttercream',
    cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', quantity: 1,
  })

  assert.equal(rows.Product, 'Chocolate Cupcakes')
  assert.equal(rows.Size, '-')
  assert.equal(rows['Finishing mix'], 'Pack: Half Dozen · 6 cupcakes / Finish: Chocolate Buttercream')
})

test('AU operator notification renders every validated stored order line and one aggregate total', () => {
  const rows = notification.buildCakeNotificationRows(validStoredReservation())

  assert.deepEqual(rows.filter(([label]) => label.startsWith('Product')), [
    ['Product 1', 'Signature Gâteau au Chocolat'], ['Product 2', 'Pave Chocolate Cake'],
  ])
  assert.deepEqual(rows.filter(([label]) => label.startsWith('Quantity')), [
    ['Quantity 1', '1ea'], ['Quantity 2', '1ea'],
  ])
  assert.deepEqual(rows.filter(([label]) => label.startsWith('Finish ')), [
    ['Finish 1', 'Basic finish'], ['Finish 2', '-'],
  ])
  assert.equal(rows.filter(([label]) => label === 'Total').length, 1)
  assert.match(rows.find(([label]) => label === 'Total')[1], /120\.00/)
})

test('operator plain-text email flattens control and newline characters so values cannot forge labelled rows', () => {
  assert.equal(typeof notification.buildNotificationText, 'function')
  const text = notification.buildNotificationText({
    ...validStoredReservation(),
    customerName: 'Customer\nTotal: AUD 0.00',
    requestNote: 'Please write Happy Birthday\r\nMobile: 0000000000\tStatus: Cancelled',
  })

  assert.doesNotMatch(text, /^Total: AUD 0\.00$/m)
  assert.doesNotMatch(text, /^Mobile: 0000000000/m)
  assert.doesNotMatch(text, /^Status: Cancelled$/m)
  assert.match(text, /Customer name: Customer Total: AUD 0\.00/)
  assert.match(text, /Request note: Please write Happy Birthday Mobile: 0000000000 Status: Cancelled/)
})

test('operator HTML email flattens control and line-separator characters inside dynamic cells', () => {
  assert.equal(typeof notification.buildNotificationHtml, 'function')
  const html = notification.buildNotificationHtml({
    ...validStoredReservation(),
    customerName: 'START\nFORGED\u0000\u0085\u2028\u2029END',
    requestNote: 'NOTE\r\nTotal: AUD 0.00',
  })
  assert.doesNotMatch(html, /START\nFORGED/)
  assert.doesNotMatch(html, /[\u0000\u0085\u2028\u2029]/u)
  assert.match(html, /START FORGED END/)
  assert.match(html, /NOTE Total: AUD 0\.00/)
})

test('stored cake payload cannot bypass authoritative parsing by adding class markers', () => {
  assert.throws(() => notification.buildNotificationText({
    ...validStoredReservation(),
    orderLinesJson: '{broken',
    classType: 'school-holiday-private-cake-class',
    parentName: 'Injected parent',
  }), /INVALID_STORED_ORDER/)
})

test('operator notification fails closed when stored order lines are present but malformed', () => {
  assert.throws(() => notification.buildCakeNotificationRows({
    reservationNumber: 'VG-C-AU-BROKEN', orderLinesJson: '{broken',
  }), /INVALID_STORED_ORDER/)
})

test('operator notification rejects semantically forged stored orders before rendering', () => {
  const valid = validStoredReservation()
  const payload = JSON.parse(valid.orderLinesJson)
  const withoutCount = { ...valid }
  delete withoutCount.orderLineCount
  const mutations = [
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, privateCustomerPhone: '0400000000' }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [{ ...payload.lines[0], privateNote: 'PII' }, payload.lines[1]] }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [{ ...payload.lines[0], productId: 'unknown-product' }, payload.lines[1]] }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [{ ...payload.lines[0], cakeSize: '15cm\nTotal: AUD 0.00' }, payload.lines[1]] }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [{ ...payload.lines[0], quantity: '1' }, payload.lines[1]] }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [{ ...payload.lines[0], totalPriceCents: -1 }, payload.lines[1]] }) },
    { ...valid, orderLinesJson: JSON.stringify({ ...payload, lines: [payload.lines[0], { ...payload.lines[0] }] }) },
    withoutCount,
    { ...valid, orderLineCount: '2' },
    { ...valid, totalPriceCents: 1 },
    { ...valid, productId: 'pave-cake' },
    { ...valid, orderLinesJson: JSON.stringify({ version: 1, lines: payload.lines, padding: 'x'.repeat(66_000) }) },
  ]
  for (const reservation of mutations) {
    assert.throws(() => notification.buildCakeNotificationRows(reservation), /INVALID_STORED_ORDER/)
  }
})
