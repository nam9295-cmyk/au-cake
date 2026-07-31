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

test('cake catalogue exposes one five-item list of canonical detail pages', () => {
  const config = getSeoConfig('/cakes')
  const collection = config.structuredData?.find((entry) => entry['@type'] === 'CollectionPage')
  const itemList = config.structuredData?.find((entry) => entry['@type'] === 'ItemList')

  assert.ok(collection)
  assert.ok(itemList)
  assert.equal(collection.mainEntity, itemList['@id'])
  const items = itemList.itemListElement as Array<Record<string, unknown>>
  assert.equal(items.length, 5)
  assert.deepEqual(items.map((item) => item.url), [
    'https://au.verygood-chocolate.com/cakes/chocolate-pound-cake-and-cupcakes',
    'https://au.verygood-chocolate.com/cakes/pave-chocolate-cake',
    'https://au.verygood-chocolate.com/cakes/chocolatiers-basque-cheesecake',
    'https://au.verygood-chocolate.com/cakes/lemon-cake',
    'https://au.verygood-chocolate.com/cakes/vanilla-fresh-cream-cake',
  ])
})

test('cake detail SEO uses product pages, breadcrumbs and only real product photos', () => {
  const photographed = new Map([
    ['/cakes/chocolate-pound-cake-and-cupcakes', 'https://au.verygood-chocolate.com/products/chocolate-pound-cake.jpg'],
    ['/cakes/pave-chocolate-cake', 'https://au.verygood-chocolate.com/products/pave-chocolate-cake.jpg'],
    ['/cakes/chocolatiers-basque-cheesecake', 'https://au.verygood-chocolate.com/products/chocolatiers-basque-cheesecake.jpg'],
    ['/cakes/lemon-cake', 'https://au.verygood-chocolate.com/products/lemon-cake.jpg'],
  ])

  for (const [path, image] of photographed) {
    const config = getSeoConfig(path)
    const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
    const breadcrumb = config.structuredData?.find((entry) => entry['@type'] === 'BreadcrumbList')
    assert.ok(product, path)
    assert.ok(breadcrumb, path)
    assert.equal(config.ogType, 'product', path)
    assert.equal(config.image, image, path)
    assert.equal(product.image, image, path)
  }

  const vanilla = getSeoConfig('/cakes/vanilla-fresh-cream-cake')
  const vanillaProduct = vanilla.structuredData?.find((entry) => entry['@type'] === 'Product')
  assert.equal(vanilla.title, 'Vanilla Fresh Cream Cake Sydney | Verygood Chocolate')
  assert.equal(vanilla.ogType, 'product')
  assert.equal(vanilla.image, undefined)
  assert.ok(vanillaProduct)
  assert.equal(Object.hasOwn(vanillaProduct, 'image'), false)
})

test('Product offers include paid finishes without claiming live stock availability', () => {
  const expectations = new Map([
    ['/cakes/chocolate-pound-cake-and-cupcakes', { lowPrice: 45, highPrice: 67 }],
    ['/cakes/lemon-cake', { lowPrice: 36, highPrice: 93 }],
  ])

  for (const [path, expected] of expectations) {
    const config = getSeoConfig(path)
    const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
    assert.ok(product, path)
    const offers = product.offers as Record<string, unknown>
    assert.equal(offers.lowPrice, expected.lowPrice, path)
    assert.equal(offers.highPrice, expected.highPrice, path)
    assert.equal(Object.hasOwn(offers, 'availability'), false, path)
  }
})

test('cart route has private noindex metadata for direct loads', () => {
  const config = getSeoConfig('/cart')

  assert.equal(config.title, 'Your Cart | Verygood Chocolate')
  assert.equal(config.description, 'Review your selected cakes before sending one cake request to Verygood Chocolate Sydney.')
  assert.equal(config.noindex, true)
  assert.equal(config.structuredData, undefined)
})
