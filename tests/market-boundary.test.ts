import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { marketConfig } from '../src/lib/market.js'
import { getProductFeatures } from '../src/lib/i18n.js'

test('KR catalogue retains its own Korean Pave size copy without AU serves labels', () => {
  assert.equal(marketConfig.market, 'KR')
  const features = getProductFeatures('pave-cake', 'ko')
  assert.deepEqual(features, ['4단 초코 시트와 파베 가나슈', '미니케이크, 1호사이즈', '농도, 사이즈 선택 가능'])
  assert.equal(features.some((feature) => feature.includes('serves')), false)
})
