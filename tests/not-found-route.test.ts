import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getCakeSlugFromPath, getPageFromPath, pathForPage } from '../src/lib/app-routes.js'

test('unknown direct paths fail closed instead of rendering home', () => {
  assert.equal(getPageFromPath('/definitely-not-a-real-route-seo-check'), 'not-found')
  assert.equal(getPageFromPath('/guides'), 'not-found')
  assert.equal(getPageFromPath('/cakes/not-a-real-cake'), 'not-found')
})

test('known cake slugs remain cake-detail routes while invalid slugs are rejected', () => {
  assert.equal(getPageFromPath('/cakes/pave-chocolate-cake'), 'cake-detail')
  assert.equal(getCakeSlugFromPath('/cakes/pave-chocolate-cake'), 'pave-chocolate-cake')
  assert.equal(getCakeSlugFromPath('/cakes/not-a-real-cake'), null)
})

test('not-found has a stable internal route identity', () => {
  assert.equal(pathForPage('not-found'), '/404')
})
