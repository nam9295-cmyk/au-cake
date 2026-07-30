import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')

test('home catalogue renders its five cards from the shared AU cake catalog', () => {
  assert.match(homeSource, /getAuCakeCatalogCards\(language\)/)
  assert.doesNotMatch(homeSource, /const catalogCards = \[/)
})

test('home catalogue keeps image selection outside customer product copy data', () => {
  assert.match(homeSource, /catalogImages\[card\.imageKey\]/)
  assert.match(homeSource, /card\.isPhotoComingSoon/)
})
