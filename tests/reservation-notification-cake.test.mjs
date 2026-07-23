import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as notification from '../functions/reservation-notification/src/main.js'

function rowsByLabel(reservation) {
  assert.equal(typeof notification.buildCakeNotificationRows, 'function')
  return Object.fromEntries(notification.buildCakeNotificationRows(reservation))
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

test('AU operator notification gives Vanilla Fresh Cream Cake its safe name and selected no-cm size label', () => {
  const rows = rowsByLabel({
    reservationNumber: 'VG-C-AU-VANILLA',
    productId: 'vanilla-fresh-cream-cake',
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
    quantity: 1,
  })

  assert.equal(rows.Product, 'vanilla fresh cream cake')
  assert.equal(rows.Size, '9" | serves 22')
  assert.equal(rows.Chocolate, '-')
  assert.equal(rows.Finish, '-')
})
