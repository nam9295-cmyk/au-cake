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

test('cart has a stable direct route and page path', () => {
  assert.equal(getPageFromPath('/cart'), 'cart')
  assert.equal(pathForPage('cart'), '/cart')
})
