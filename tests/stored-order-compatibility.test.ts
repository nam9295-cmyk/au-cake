import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseStoredOrderLines as readStored } from '../appwrite-functions/reservation-api/src/stored-order-reader.js'
import { parseStoredOrderLines as readFacade, VANILLA_CAKE_POINT_COLORS } from '../appwrite-functions/reservation-api/src/business.js'
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
    toReservation({ ...row, $id: 'synthetic' } as never)
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
