import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import * as assert from 'node:assert/strict'

test('home and Phase 1 market rendering and CSS isolation regressions pass', () => {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  execFileSync(process.execPath, ['--test', 'tests/home-market-boundary.test.mjs', 'tests/phase1-market-boundary.test.mjs'], { stdio: 'pipe', env })
})
import { marketConfig } from '../src/lib/market.js'
import { addCartLine } from '../src/lib/cart.js'
import { CHOCOLATE_OPTIONS_V1 } from '../appwrite-functions/reservation-api/src/chocolate-products.js'

test('KR rejects standalone chocolate cart entries', () => {
  assert.deepEqual(addCartLine([], { ...CHOCOLATE_OPTIONS_V1, productId: 'almond-chocoball-80g', quantity: 1 }), [])
  assert.equal(marketConfig.products['almond-chocoball-80g'], undefined)
})
import { getProductFeatures } from '../src/lib/i18n.js'
import { isSchoolPickupWindowClosed } from '../src/lib/utils.js'
import {
  getAuCakeCatalog,
  getCakeCatalogEntryByProductId,
  getCakeCatalogEntryBySlug,
  getCakeCatalogUnitPrice,
} from '../src/lib/cake-catalog.js'

test('KR catalogue retains its own Korean Pave size copy without AU serves labels', () => {
  assert.equal(marketConfig.market, 'KR')
  const features = getProductFeatures('pave-cake', 'ko')
  assert.deepEqual(features, ['4단 초코 시트와 파베 가나슈', '미니케이크, 1호사이즈', '농도, 사이즈 선택 가능'])
  assert.equal(features.some((feature) => feature.includes('serves')), false)
})

test('AU-only cake catalog helpers fail closed in the KR market', () => {
  assert.deepEqual(getAuCakeCatalog(), [])
  assert.equal(getCakeCatalogEntryBySlug('vanilla-fresh-cream-cake'), null)
  assert.equal(getCakeCatalogEntryByProductId('fresh-lemon-cupcakes-12'), null)
  assert.equal(getCakeCatalogUnitPrice('vanilla-fresh-cream-cake', { cakeSize: '22cm' }), null)
})

test('AU school-run cake closures do not alter the KR market schedule', () => {
  assert.equal(isSchoolPickupWindowClosed('2026-08-03', '15:00'), false)
  assert.equal(isSchoolPickupWindowClosed('2026-08-04', '17:30'), false)
})

import { cakeCopy } from '../src/lib/i18n.js'
test('AU renewal pickup finalization leaves the existing KR announcements and lead-time help unchanged',()=>{
 assert.equal(cakeCopy('ko').announcement,'케이크 픽업 · 매일 08:00–20:00')
 assert.equal(cakeCopy('en').announcement,'Cake pick-up · Every day 08:00–20:00')
 assert.deepEqual(cakeCopy('ko').pickupHours,['케이크 픽업 · 매일 08:00–20:00'])
 assert.equal(cakeCopy('ko').pickupLeadTimeHelp,'케이크 픽업은 매일 08:00–20:00에 가능합니다. 전날 오후 8시 이후 주문 시 다음 날 낮 12시부터 선택할 수 있어요.')
})
