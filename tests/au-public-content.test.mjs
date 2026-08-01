import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const contentPath = new URL('../src/content/au-public-pages.json', import.meta.url)
const content = JSON.parse(await readFile(contentPath, 'utf8'))

const cakePages = content.cakePages
const productStartingPrices = Object.fromEntries(
  Object.entries(cakePages)
    .filter(([, page]) => page.schema === 'product-offer')
    .map(([slug, page]) => [slug, page.startingPrice]),
)

test('AU public content owns the approved homepage contract', () => {
  assert.equal(content.home.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | Very Good')
  assert.equal(content.home.h1, 'Made-to-Order Chocolate Cakes in Sydney')
  assert.equal(content.home.description, 'Order small-batch chocolate cakes for pre-arranged pickup in Melrose Park, Sydney. Pave cake, chocolate Basque cheesecake, pound cake and cupcakes from AUD 45.')
  assert.equal(content.home.pickup, 'Pre-order only. Pickup in Melrose Park, Sydney. No walk-in shop or delivery.')
  assert.deepEqual(content.home.ctas, [
    { label: 'Browse Chocolate Cakes', href: '/cakes' },
    { label: 'How Ordering Works', href: '#how-ordering-works' },
  ])
})

test('AU cake pages own starting prices and final schema modes', () => {
  assert.deepEqual(productStartingPrices, {
    'pave-chocolate-cake': 75,
    'chocolatiers-basque-cheesecake': 55,
    'lemon-cake': 36,
    'vanilla-fresh-cream-cake': 75,
  })
  assert.equal(cakePages['chocolate-pound-cake-and-cupcakes'].schema, 'webpage-only')
  assert.equal(cakePages['chocolate-pound-cake-and-cupcakes'].startingPrice, null)
  assert.equal(Object.hasOwn(cakePages['chocolate-pound-cake-and-cupcakes'], 'aggregateOffer'), false)
  assert.equal(Object.hasOwn(cakePages['chocolate-pound-cake-and-cupcakes'], 'product'), false)
})

test('AU public content has no guide output and includes every known direct-access noindex route', () => {
  assert.equal(content.guides, undefined)
  assert.equal(content.home.relatedGuides, undefined)
  assert.ok(content.knownDirectAccessRoutes.includes('/reserve'))
  assert.ok(content.knownDirectAccessRoutes.includes('/admin/reviews'))
  assert.deepEqual(content.noindexOperationalRoutes, [
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
  ])
})
