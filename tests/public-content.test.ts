import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AU_PUBLIC_CONTENT,
  AU_SITE_ORIGIN,
  KNOWN_DIRECT_ACCESS_ROUTES,
  NOINDEX_OPERATIONAL_ROUTES,
  getCakePublicPage,
  getStartingPrice,
} from '../src/lib/public-content.js'

test('typed AU public content exposes the approved home contract', () => {
  assert.equal(AU_SITE_ORIGIN, 'https://au.verygood-chocolate.com')
  assert.equal(AU_PUBLIC_CONTENT.home.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | Very Good')
  assert.equal(AU_PUBLIC_CONTENT.home.h1, 'Made-to-Order Chocolate Cakes in Sydney')
  assert.equal(AU_PUBLIC_CONTENT.home.ctas[0].href, '/cakes')
  assert.equal(AU_PUBLIC_CONTENT.home.ctas[1].href, '#how-ordering-works')
})

test('typed cake page helpers preserve single Offer and webpage-only contracts', () => {
  assert.equal(getStartingPrice('pave-chocolate-cake'), 75)
  assert.equal(getStartingPrice('chocolatiers-basque-cheesecake'), 55)
  assert.equal(getStartingPrice('lemon-cake'), 36)
  assert.equal(getStartingPrice('vanilla-fresh-cream-cake'), 75)
  assert.equal(getStartingPrice('chocolate-pound-cake-and-cupcakes'), null)
  assert.equal(getCakePublicPage('chocolate-pound-cake-and-cupcakes')?.schema, 'webpage-only')
  assert.equal(getCakePublicPage('missing-cake'), undefined)
})

test('typed route lists name known direct-access and noindex boundaries', () => {
  assert.equal(KNOWN_DIRECT_ACCESS_ROUTES.length, 22)
  assert.ok(KNOWN_DIRECT_ACCESS_ROUTES.includes('/admin/reviews'))
  assert.deepEqual(NOINDEX_OPERATIONAL_ROUTES, [
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
