import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getCakeSlugFromPath, getPageFromPath, pathForCake, pathForPage } from '../src/lib/app-routes.js'

test('cake routes support catalogue, direct detail URLs and safe slug extraction', () => {
  assert.equal(getPageFromPath('/cakes'), 'cakes')
  assert.equal(getPageFromPath('/cakes/pave-chocolate-cake'), 'cake-detail')
  assert.equal(getCakeSlugFromPath('/cakes/pave-chocolate-cake'), 'pave-chocolate-cake')
  assert.equal(getCakeSlugFromPath('/cakes/'), null)
  assert.equal(getCakeSlugFromPath('/cakes/pave-chocolate-cake/extra'), null)
  assert.equal(pathForCake('pave-chocolate-cake'), '/cakes/pave-chocolate-cake')
})

test('all seven sale slugs and both legacy cake URLs remain directly routable', () => {
  const slugs = [
    'pave-chocolate-cake',
    'vanilla-fresh-cream-cake',
    'buttercream-cake',
    'chocolate-cupcakes',
    'signature-gateau-au-chocolat',
    'lemon-cake',
    'brownie-cheesecake',
    'chocolate-pound-cake-and-cupcakes',
    'chocolatiers-basque-cheesecake',
  ]
  for (const slug of slugs) {
    assert.equal(getCakeSlugFromPath(`/cakes/${slug}`), slug)
    assert.equal(getPageFromPath(`/cakes/${slug}`), 'cake-detail')
  }
})

test('cart has a stable direct route and page path', () => {
  assert.equal(getPageFromPath('/cart'), 'cart')
  assert.equal(pathForPage('cart'), '/cart')
})

test('HOGIRL route family accepts canonical English and published Korean paths without enabling future locales', () => {
  for (const path of [
    '/stories/hogirl',
    '/stories/hogirl/',
    '/stories/hogirl/season-1',
    '/stories/hogirl/season-1/ep01-i-know-what-i-want',
    '/ko/stories/hogirl',
    '/ko/stories/hogirl/season-1',
    '/ko/stories/hogirl/season-1/ep01-i-know-what-i-want',
  ]) assert.equal(getPageFromPath(path), 'hogirl', path)

  assert.equal(getPageFromPath('/ja/stories/hogirl/season-1/ep01-i-know-what-i-want'), 'not-found')
  assert.equal(getPageFromPath('/stories/hogirl/season-1/not-an-episode'), 'not-found')
})
