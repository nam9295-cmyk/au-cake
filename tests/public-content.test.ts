import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AU_PUBLIC_CONTENT,
  AU_SITE_ORIGIN,
  KNOWN_DIRECT_ACCESS_ROUTES,
  NOINDEX_OPERATIONAL_ROUTES,
  getCakePublicPage,
  isLegacyCakePublicPage,
  getStartingPrice,
} from '../src/lib/public-content.js'

test('typed AU public content exposes the approved home contract', () => {
  assert.equal(AU_SITE_ORIGIN, 'https://au.verygood-chocolate.com')
  assert.equal(AU_PUBLIC_CONTENT.home.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | verygood chocolate')
  assert.equal(AU_PUBLIC_CONTENT.home.h1, 'Made-to-Order Chocolate Cakes in Sydney')
  assert.equal('ctas' in AU_PUBLIC_CONTENT.home, false)
  assert.equal('orderingSteps' in AU_PUBLIC_CONTENT.home, false)
  assert.deepEqual((AU_PUBLIC_CONTENT.site as { socialProfiles?: string[] }).socialProfiles, [
    'https://www.instagram.com/verygood_syd/',
  ])
})

test('typed cake page helpers expose eight sale pages and noindex legacy pages', () => {
  assert.equal(getStartingPrice('pave-chocolate-cake'), 79)
  assert.equal(getStartingPrice('buttercream-cake'), 75)
  assert.equal(getStartingPrice('chocolate-cupcakes'), 31)
  assert.equal(getStartingPrice('signature-gateau-au-chocolat'), 45)
  assert.equal(getStartingPrice('lemon-cake'), 36)
  assert.equal(getStartingPrice('fresh-strawberry-vanilla-cream-cake'), 65)
  assert.equal(getStartingPrice('fresh-strawberry-chocolate-cream-cake'), 69)
  assert.equal(getStartingPrice('brownie-cheesecake'), 85)
  assert.equal(getStartingPrice('chocolatiers-basque-cheesecake'), null)
  assert.equal(getStartingPrice('chocolate-pound-cake-and-cupcakes'), null)
  assert.equal(getStartingPrice('vanilla-fresh-cream-cake'), null)
  assert.equal(getCakePublicPage('vanilla-fresh-cream-cake')?.schema, 'webpage-only')
  assert.equal(getCakePublicPage('chocolate-pound-cake-and-cupcakes')?.schema, 'webpage-only')
  assert.equal(isLegacyCakePublicPage('chocolate-pound-cake-and-cupcakes'), true)
  assert.equal(isLegacyCakePublicPage('chocolatiers-basque-cheesecake'), true)
  assert.equal(isLegacyCakePublicPage('brownie-cheesecake'), false)
  assert.equal(getCakePublicPage('missing-cake'), undefined)
})

test('typed route lists name known direct-access and noindex boundaries', () => {
  assert.equal(KNOWN_DIRECT_ACCESS_ROUTES.length, 28)
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

test('Brownie public content publishes the three mutually exclusive current outcomes and prices', () => {
  const brownie = getCakePublicPage('brownie-cheesecake')
  assert.equal(brownie?.priceSummary, 'Basic AUD 85.00, Pave AUD 95.00 (+AUD 10.00), or Fresh cream AUD 105.00 (+AUD 20.00).')
  assert.equal(brownie?.optionSummary, '6 inch serves 8 · three mutually exclusive finish choices')
  assert.equal(brownie?.cardOptionLabel, 'Basic, Pave +AUD 10, or Fresh cream +AUD 20')
  assert.doesNotMatch(JSON.stringify(brownie), /Eiffel|AUD 115/i)
})
