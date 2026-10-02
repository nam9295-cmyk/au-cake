import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPageFromPath, pathForPage } from '../src/lib/app-routes.js'
import { getSeoConfig } from '../src/lib/seo.js'

test('company portfolio has a stable AU route without capturing product routes', () => {
  assert.equal(getPageFromPath('/portfolio'), 'portfolio')
  assert.equal(getPageFromPath('/portfolio/'), 'portfolio')
  assert.equal(pathForPage('portfolio' as Parameters<typeof pathForPage>[0]), '/portfolio')
  assert.equal(getPageFromPath('/portfolio/unknown'), 'not-found')
  assert.equal(getPageFromPath('/cakes/custom-cake'), 'custom-cake')
  assert.equal(getPageFromPath('/cart'), 'cart')
})

test('portfolio canonical and indexable metadata are specific to the company page', () => {
  const seo = getSeoConfig('/portfolio')
  assert.equal(seo.canonical, 'https://au.verygood-chocolate.com/portfolio')
  assert.match(seo.title, /Portfolio/)
  assert.notEqual(seo.noindex, true)
  assert.deepEqual(getSeoConfig('/portfolio/'), seo)
})
