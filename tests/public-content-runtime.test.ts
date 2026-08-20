import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  getAuPublicContent,
  getPublicCakePage,
  getPublicStartingPrice,
  SITE_URL,
} from '../src/lib/public-content.js'

test('runtime public-content adapter exposes AU homepage and starting-price facts', () => {
  const content = getAuPublicContent()
  assert.equal(SITE_URL, 'https://au.verygood-chocolate.com')
  assert.equal(content.home.h1, 'Made-to-Order Chocolate Cakes in Sydney')
  assert.equal(getPublicStartingPrice('pave-chocolate-cake'), 79)
  assert.equal(getPublicStartingPrice('lemon-cake'), 36)
  assert.equal(getPublicCakePage('chocolate-pound-cake-and-cupcakes')?.schema, 'webpage-only')
})
