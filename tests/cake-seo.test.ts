import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getSeoConfig } from '../src/lib/seo.js'

test('cake catalogue and five detail routes are public canonical pages', () => {
  const paths = [
    '/cakes',
    '/cakes/chocolate-pound-cake-and-cupcakes',
    '/cakes/pave-chocolate-cake',
    '/cakes/chocolatiers-basque-cheesecake',
    '/cakes/lemon-cake',
    '/cakes/vanilla-fresh-cream-cake',
  ]

  for (const path of paths) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, undefined, path)
    assert.equal(config.canonical, `https://au.verygood-chocolate.com${path}`)
    assert.match(config.title, /Cake|cake/)
  }
})

test('direct cake pages expose one Product schema with the detail URL', () => {
  const path = '/cakes/lemon-cake'
  const config = getSeoConfig(path)
  const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
  assert.ok(product)
  assert.equal(product.name, 'Lemon Cake')
  assert.equal((product.offers as Record<string, unknown>).url, `https://au.verygood-chocolate.com${path}`)
  assert.equal((product.offers as Record<string, unknown>).priceCurrency, 'AUD')
})

test('cart route has private noindex metadata for direct loads', () => {
  const config = getSeoConfig('/cart')

  assert.equal(config.title, 'Your Cart | Verygood Chocolate')
  assert.equal(config.description, 'Review your selected cakes before sending one cake request to Verygood Chocolate Sydney.')
  assert.equal(config.noindex, true)
  assert.equal(config.structuredData, undefined)
})
