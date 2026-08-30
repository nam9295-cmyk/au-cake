import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getAuPublicContent, getPublicRoutePage } from '../src/lib/public-content.js'
import { getSeoConfig } from '../src/lib/seo.js'

const SITE_URL = 'https://au.verygood-chocolate.com'
const publicContent = getAuPublicContent()

function structuredTypes(path: string) {
  return getSeoConfig(path).structuredData?.map((entry) => entry['@type']) || []
}

function productOffer(path: string) {
  const product = getSeoConfig(path).structuredData?.find((entry) => entry['@type'] === 'Product')
  assert.ok(product, `${path} should expose Product JSON-LD`)
  const offer = product.offers as Record<string, unknown>
  assert.equal(offer['@type'], 'Offer', `${path} should expose one Offer`)
  return offer
}

test('home and eight sale cake detail routes use AU self canonicals', () => {
  const paths = [
    '/',
    '/cakes',
    '/cakes/pave-chocolate-cake',
    '/cakes/fresh-strawberry-vanilla-cream-cake',
    '/cakes/fresh-strawberry-chocolate-cream-cake',
    '/cakes/buttercream-cake',
    '/cakes/chocolate-cupcakes',
    '/cakes/signature-gateau-au-chocolat',
    '/cakes/lemon-cake',
    '/cakes/brownie-cheesecake',
  ]

  for (const path of paths) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, undefined, path)
    assert.equal(config.canonical, `${SITE_URL}${path === '/' ? '' : path}`)
  }
})

test('homepage owns the approved Sydney chocolate cake metadata', () => {
  const config = getSeoConfig('/')
  assert.equal(config.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | verygood chocolate')
  assert.equal(config.description, 'Order eight made-to-order cakes for pre-arranged pickup in Melrose Park, Sydney: Pave, buttercream, fresh strawberry cream cakes, cupcakes, gâteau au chocolat, lemon cake and brownie cheesecake.')
  assert.deepEqual(structuredTypes('/'), ['Organization', 'WebSite', 'ItemList', 'FAQPage'])
  const organization = config.structuredData?.find((entry) => entry['@type'] === 'Organization')
  const faq = config.structuredData?.find((entry) => entry['@type'] === 'FAQPage')
  assert.deepEqual(organization?.sameAs, ['https://www.instagram.com/verygood_syd/'])
  assert.deepEqual(faq?.mainEntity, publicContent.home.faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })))
})

test('all indexable runtime SEO uses the canonical lowercase brand', () => {
  for (const path of [
    '/',
    '/cakes',
    '/classes',
    '/reviews',
    ...Object.keys(publicContent.cakePages).map((slug) => '/cakes/' + slug),
  ]) {
    const serialized = JSON.stringify(getSeoConfig(path))
    assert.match(getSeoConfig(path).title, /verygood chocolate/)
    assert.doesNotMatch(serialized, /Very Good Chocolate|Verygood Chocolate/)
  }
})

test('all noindex runtime SEO uses the canonical lowercase brand', () => {
  for (const path of [
    '/cart',
    '/reserve',
    '/complete',
    '/lookup',
    '/class-reserve',
    '/class-complete',
    '/calendar',
    '/review',
    '/review.html',
    '/admin',
    '/admin/login',
    '/admin/reservations',
    '/admin/classes',
    '/admin/reviews',
    '/not-found',
  ]) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, true, path)
    assert.match(config.title, /verygood chocolate/, path)
    assert.doesNotMatch(JSON.stringify(config), /Very Good Chocolate|Verygood Chocolate/, path)
  }
})

test('runtime route metadata comes from the typed public-content adapter', () => {
  for (const path of ['/', '/cakes', '/classes', '/reviews'] as const) {
    const page = getPublicRoutePage(path)
    assert.ok(page)
    assert.equal(getSeoConfig(path).title, page.title)
    assert.equal(getSeoConfig(path).description, page.description)
  }
})

test('Course AggregateOffer uses the canonical base range and excludes extensions', () => {
  const course = getSeoConfig('/classes').structuredData
    ?.find((entry) => entry['@type'] === 'Course')
  assert.ok(course)
  const offers = course.offers as Record<string, unknown>
  assert.equal(offers.lowPrice, publicContent.classes.baseLowPrice)
  assert.equal(offers.highPrice, publicContent.classes.baseHighPrice)
})

test('product runtime metadata carries descriptive copy and complete image attributes', () => {
  for (const [slug, page] of Object.entries(publicContent.cakePages)) {
    const config = getSeoConfig('/cakes/' + slug)
    assert.equal(config.title, page.title)
    assert.equal(config.description, page.description)
    assert.equal(config.imageType, page.imagePath ? page.imageType : undefined)
    assert.equal(config.imageWidth, page.imagePath ? page.imageWidth : undefined)
    assert.equal(config.imageHeight, page.imagePath ? page.imageHeight : undefined)
    const entity = config.structuredData?.[0]
    assert.equal(entity?.description, page.description)
    assert.equal(entity?.image, page.imagePath ? `${SITE_URL}${page.imagePath}` : undefined)
  }
})

test('eight sale cakes use one Offer at the visible starting price', () => {
  const expectations = new Map([
    ['/cakes/pave-chocolate-cake', { name: 'Pave Chocolate Cake', price: 79 }],
    ['/cakes/buttercream-cake', { name: 'Buttercream Cake', price: 75 }],
    ['/cakes/fresh-strawberry-vanilla-cream-cake', { name: 'Fresh Strawberry Vanilla Cream Cake', price: 65 }],
    ['/cakes/fresh-strawberry-chocolate-cream-cake', { name: 'Fresh Strawberry Chocolate Cream Cake', price: 69 }],
    ['/cakes/chocolate-cupcakes', { name: 'Chocolate Cupcakes', price: 31 }],
    ['/cakes/signature-gateau-au-chocolat', { name: 'Signature Gâteau au Chocolat', price: 45 }],
    ['/cakes/lemon-cake', { name: 'Lemon Cake', price: 36 }],
    ['/cakes/brownie-cheesecake', { name: 'Brownie Cheesecake', price: 85 }],
  ])

  for (const [path, expected] of expectations) {
    const config = getSeoConfig(path)
    const types = structuredTypes(path)
    assert.deepEqual(types, ['Product', 'BreadcrumbList'], path)
    const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
    assert.equal(product?.name, expected.name, path)
    const offer = productOffer(path)
    assert.equal(offer.price, expected.price, path)
    assert.equal(offer.priceCurrency, 'AUD', path)
    assert.equal(offer.url, `${SITE_URL}${path}`, path)
    assert.equal(types.includes('AggregateOffer'), false, path)
    assert.equal(types.includes('ProductGroup'), false, path)
    assert.equal(Object.hasOwn(offer, 'lowPrice'), false, path)
    assert.equal(Object.hasOwn(offer, 'highPrice'), false, path)
    assert.equal(Object.hasOwn(offer, 'availability'), false, path)
    assert.equal(Object.hasOwn(offer, 'shippingDetails'), false, path)
  }
})

test('legacy grouped and Basque pages are noindex WebPage compatibility views', () => {
  const path = '/cakes/chocolate-pound-cake-and-cupcakes'
  const config = getSeoConfig(path)
  assert.equal(config.noindex, true)
  assert.deepEqual(structuredTypes(path), ['WebPage', 'BreadcrumbList'])
  assert.equal(config.ogType, 'website')
  assert.equal(config.image, 'https://au.verygood-chocolate.com/products/chocolate-pound-cake-sydney.webp')
  assert.equal(getSeoConfig('/cakes/chocolatiers-basque-cheesecake').noindex, true)
  assert.deepEqual(structuredTypes('/cakes/chocolatiers-basque-cheesecake'), ['WebPage', 'BreadcrumbList'])
})

test('cake catalogue exposes eight canonical detail pages in product order', () => {
  const config = getSeoConfig('/cakes')
  const itemList = config.structuredData?.find((entry) => entry['@type'] === 'ItemList')
  assert.ok(itemList)
  const items = itemList.itemListElement as Array<Record<string, unknown>>
  assert.equal(items.length, 8)
  assert.deepEqual(items.map((item) => item.url), [
    `${SITE_URL}/cakes/pave-chocolate-cake`,
    `${SITE_URL}/cakes/buttercream-cake`,
    `${SITE_URL}/cakes/fresh-strawberry-vanilla-cream-cake`,
    `${SITE_URL}/cakes/fresh-strawberry-chocolate-cream-cake`,
    `${SITE_URL}/cakes/chocolate-cupcakes`,
    `${SITE_URL}/cakes/signature-gateau-au-chocolat`,
    `${SITE_URL}/cakes/lemon-cake`,
    `${SITE_URL}/cakes/brownie-cheesecake`,
  ])
})

test('legacy Vanilla page remains a noindex compatibility view without Product Offer JSON-LD', () => {
  const config = getSeoConfig('/cakes/vanilla-fresh-cream-cake')
  assert.equal(config.noindex, true)
  assert.equal(config.canonical, `${SITE_URL}/cakes/vanilla-fresh-cream-cake`)
  assert.deepEqual(structuredTypes('/cakes/vanilla-fresh-cream-cake'), ['WebPage', 'BreadcrumbList'])
  assert.equal(config.structuredData?.some((entry) => entry['@type'] === 'Product'), false)
  assert.equal(JSON.stringify(config.structuredData).includes('offers'), false)
  assert.equal(config.ogType, 'website')
})

test('Brownie Product publishes the supplied Brownie image with its actual dimensions', () => {
  const config = getSeoConfig('/cakes/brownie-cheesecake')
  const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
  assert.ok(product)
  const image = `${SITE_URL}/products/brownie-cheesecake-sydney.webp`
  assert.equal(config.image, image)
  assert.equal(config.imageWidth, 1080)
  assert.equal(config.imageHeight, 1012)
  assert.equal(product.image, image)
})

test('Signature Product publishes its descriptive canonical product image', () => {
  const config = getSeoConfig('/cakes/signature-gateau-au-chocolat')
  const product = config.structuredData?.find((entry) => entry['@type'] === 'Product')
  assert.ok(product)
  const image = `${SITE_URL}/products/signature-gateau-au-chocolat-sydney.webp`
  assert.equal(config.image, image)
  assert.equal(product.image, image)
})

test('all noindex operational routes remain directly loadable metadata pages', () => {
  for (const path of [
    '/cart',
    '/reserve',
    '/complete',
    '/lookup',
    '/class-reserve',
    '/class-complete',
    '/calendar',
    '/review',
    '/admin',
    '/admin/login',
    '/admin/reservations',
    '/admin/classes',
    '/admin/reviews',
  ]) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, true, path)
    assert.equal(config.structuredData, undefined, path)
  }
})
