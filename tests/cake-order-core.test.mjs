import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as business from '../appwrite-functions/reservation-api/src/business.js'
import { buildCakeOrderData, serializeStoredOrderLines } from '../appwrite-functions/reservation-api/src/cake-order-data.js'
import { canonicalCakeRequestPayload, normalizeCakeOrderLines } from '../appwrite-functions/reservation-api/src/cake-order-input.js'
import { getValidPromoCode } from '../appwrite-functions/reservation-api/src/cake-order-pricing.js'

const baseline = JSON.parse(readFileSync(new URL('./fixtures/order-core-golden.json', import.meta.url)))
const capture = fn => {
  try { return { value: JSON.parse(JSON.stringify(fn())) } }
  catch (error) { return JSON.parse(JSON.stringify({ error: { name: error.name, message: error.message, code: error.code, status: error.status } })) }
}

test('pure Cake storage builder matches unchanged Stage 0 creation goldens', () => {
  for (const fixture of baseline.cases.filter(entry => entry.input)) {
    const options = { customerEmailMode: 'required', cakeCatalogMode: 'compat', ...fixture.options, now: new Date(fixture.options.now) }
    assert.deepEqual(capture(() => buildCakeOrderData(fixture.input, options)), fixture.expected.built, fixture.name)
  }
})

test('business keeps existing normalization, canonical, pricing and writer export identities', () => {
  assert.equal(business.canonicalCakeRequestPayload, canonicalCakeRequestPayload)
  assert.equal(business.normalizeCakeOrderLines, normalizeCakeOrderLines)
  assert.equal(business.getValidPromoCode, getValidPromoCode)
  assert.equal(business.serializeStoredOrderLines, serializeStoredOrderLines)
})

test('new order dependency graph excludes stored readers, facade and orchestration', () => {
  const root = new URL('../appwrite-functions/reservation-api/src/', import.meta.url)
  const seen = new Set()
  function visit(name) {
    if (seen.has(name)) return
    seen.add(name)
    assert.doesNotMatch(name, /stored-order|business\.js|main\.js/)
    const source = readFileSync(new URL(name, root), 'utf8')
    assert.doesNotMatch(source, /allowStoredProduct|allowLegacyCupcakeCounts|allowLegacyCreamCakeOptions/)
    for (const match of source.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)) visit(match[1])
  }
  visit('cake-order-data.js')
  visit('cake-order-input.js')
  assert.ok(seen.has('cake-order-pricing.js'))
  const input = readFileSync(new URL('cake-order-input.js', root), 'utf8')
  assert.doesNotMatch(input, /isStoredCakeOrderProductId/)
  for (const name of ['cake-order-data.js', 'cake-order-pricing.js']) {
    assert.doesNotMatch(readFileSync(new URL(name, root), 'utf8'), /Math\.random|new Date\(|process\.env|node-appwrite/)
  }
})

test('stored-only switches cannot relax the public new-order normalizer', () => {
  const switches = { allowStoredProduct: true, allowLegacyCupcakeCounts: true, allowLegacyCreamCakeOptions: true }
  for (const line of [
    { productId: 'cupcake-dozen', quantity: 1, vanillaCreamCount: 6, partyDecorationCount: 6 },
    { productId: 'brownie-cheesecake', quantity: 1 },
    { productId: 'buttercream-cake', quantity: 1, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry' },
  ]) {
    for (const cakeCatalogMode of ['required', 'compat']) {
      assert.deepEqual(
        capture(() => normalizeCakeOrderLines([line], { cakeCatalogMode, ...switches })),
        capture(() => normalizeCakeOrderLines([line], { cakeCatalogMode })),
      )
    }
  }
})
