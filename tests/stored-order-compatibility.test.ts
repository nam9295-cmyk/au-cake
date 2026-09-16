import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseStoredOrderLines as readStored } from '../appwrite-functions/reservation-api/src/stored-order-reader.js'
import { buildCakeReservation, parseStoredOrderLines as readFacade, publicCakeReservation, VANILLA_CAKE_POINT_COLORS } from '../appwrite-functions/reservation-api/src/business.js'
import { toReservation, toPublicReservation } from '../src/lib/stored-order-reader.js'
import { toReservation as readAdminFacade } from '../src/lib/repository.js'
import { getProductById } from '../src/lib/constants.js'
import baseline from './fixtures/order-core-golden.json'

test('stored readers retain existing facade identities and golden stored bytes', () => {
  assert.equal(readStored, readFacade)
  assert.equal(toReservation, readAdminFacade)
  for (const fixture of baseline.cases) {
    const row = fixture.document || fixture.expected.built?.value
    if (!row || !fixture.expected.parsedStored?.value) continue
    const before = JSON.stringify(row)
    assert.deepEqual(readStored(row), fixture.expected.parsedStored.value)
    assert.doesNotThrow(() => toReservation({ ...row, $id: 'synthetic' } as never), fixture.name)
    assert.equal(JSON.stringify(row), before)
  }
})

test('new order colour policy cannot change the stored reader acceptance', () => {
  const fixture = baseline.cases.find(row => row.name === 'legacy-single-request')!
  const document = fixture.expected.built!.value!
  const before = readStored(document)
  const hadPink = VANILLA_CAKE_POINT_COLORS.has('pink')
  try {
    VANILLA_CAKE_POINT_COLORS.delete('pink')
    assert.deepEqual(readStored(document), before)
  } finally {
    if (hadPink) VANILLA_CAKE_POINT_COLORS.add('pink')
  }
})

test('new browser catalogue prices cannot reprice or reject saved orders', () => {
  const fixture = baseline.cases.find(row => row.name === 'legacy-single-request')!
  const document = { ...fixture.expected.built!.value!, $id: 'synthetic' }
  const lookup = fixture.expected.lookupResponse!.value!
  const beforeAdmin = toReservation(document as never)
  const beforeLookup = toPublicReservation(lookup as never)
  const product = getProductById('pave-cake')
  const original = product.sizePrices['15cm']
  try {
    product.sizePrices['15cm'] = 999999
    assert.deepEqual(toReservation(document as never), beforeAdmin)
    assert.deepEqual(toPublicReservation(lookup as never), beforeLookup)
  } finally {
    if (original === undefined) delete product.sizePrices['15cm']
    else product.sizePrices['15cm'] = original
  }
})

test('browser stored readers accept paid packaging on current 24 and 48 cupcake packs', () => {
  for (const [productId, packSize] of [
    ['cupcake-twenty-four', 24],
    ['cupcake-forty-eight', 48],
  ] as const) {
    const document = buildCakeReservation({
      customerName: 'Packaging Customer', customerPhone: '0412345678', customerEmail: 'customer@example.com',
      pickupDate: '2026-07-11', pickupTime: '10:00', requestNote: '', privacyConsent: true,
      orderLines: [{ productId, cupcakeFinish: 'basic', individualPackaging: true, quantity: 1 }],
    }, { now: new Date('2026-07-10T00:00:00.000Z'), reservationNumber: `VG-PACK-${packSize}` })
    const admin = toReservation({ ...document, $id: `pack-${packSize}` } as never)
    const lookup = toPublicReservation(publicCakeReservation(document) as never)

    assert.equal(admin.individualPackagingFeeCents, packSize * 50, productId)
    assert.equal(lookup.individualPackagingFeeCents, packSize * 50, productId)
  }
})

test('compatibility reader source has no dependency on live ordering policy', () => {
  for (const file of ['src/lib/stored-order-reader.ts', 'src/lib/stored-order-policy.ts']) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /from ['"].*(?:constants|review-coupon-client|active-cake-products|repository)['"]/)
  }
  for (const file of ['stored-order-reader.js', 'stored-order-policy.js']) {
    const source = readFileSync(`appwrite-functions/reservation-api/src/${file}`, 'utf8')
    assert.doesNotMatch(source, /from ['"].*(?:business|active-cake-products)\.js['"]/)
  }
})
