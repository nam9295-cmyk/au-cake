import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
const catalogSource = await readFile(new URL('../src/lib/cake-catalog.ts', import.meta.url), 'utf8')

test('S’more detail opens its existing add-to-order CTA without changing normal cake or Bento guards', () => {
  assert.doesNotMatch(detailSource, /Orders opening soon/)
  assert.doesNotMatch(detailSource, /cake-detail-smore-notice-box/)
  assert.match(detailSource, /className="primary-button cake-detail-request" onClick=\{addToOrder\}/)
  assert.match(detailSource, /disabled=\{!isSmoreStick && selection\.quantity >= MAX_RESERVATION_QUANTITY\}/)
  assert.match(catalogSource, /id: 'bento-cake',[\s\S]*?isComingSoonOnly: true/)
})
