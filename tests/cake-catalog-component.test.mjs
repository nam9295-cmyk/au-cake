import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('home catalogue renders its five cards from the shared AU cake catalog', () => {
  assert.match(appSource, /getAuCakeCatalogCards\(language\)/)
  assert.doesNotMatch(appSource, /const catalogCards = \[/)
})

test('home catalogue keeps image selection outside customer product copy data', () => {
  assert.match(appSource, /catalogImages\[card\.imageKey\]/)
  assert.match(appSource, /card\.isPhotoComingSoon/)
})
