import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('home catalogue opens shared cake detail routes instead of skipping to the request form', () => {
  assert.match(homeSource, /navigateToCake\(card\.slug\)/)
  assert.match(appSource, /<CakeDetailPage/)
  assert.match(appSource, /<CakesPage/)
})

test('direct navigation between cake slugs remounts the detail state for the new product', () => {
  assert.match(appSource, /<CakeDetailPage[\s\S]*?key=\{currentCakeSlug\}/)
})

test('shared detail template contains ENZE-inspired gallery, purchase panel and verified information sections', () => {
  assert.match(detailSource, /cake-detail-gallery/)
  assert.match(detailSource, /cake-detail-purchase/)
  assert.match(detailSource, /cake-detail-trust/)
  assert.match(detailSource, /cake-detail-accordion/)
  assert.match(detailSource, /Request this cake/)
  assert.doesNotMatch(detailSource, /Free delivery|Delivery tomorrow|Look & taste guarantee/)
})

test('detail template has explicit narrow-screen layout and accessible controls', () => {
  assert.match(detailSource, /aria-live="polite"/)
  assert.match(detailSource, /aria-pressed=/)
  assert.match(detailSource, /aria-label=/)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.cake-detail-hero/)
  assert.match(cssSource, /\.cake-detail-option:focus-visible/)
})
