import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  CART_STORAGE_KEY,
  addCartLine,
  getCartLineKey,
  getCartTotalQuantity,
  loadCartLines,
  normalizeCartSelection,
  parseCartLines,
  removeCartLine,
  saveCartLines,
  serializeCartLines,
  updateCartLineQuantity,
} from '../src/lib/cart.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'

const baseSelection = (overrides: Partial<CakeDetailSelection> = {}): CakeDetailSelection => ({
  productId: 'pound-cake',
  cakeSize: '15cm',
  chocolateType: 'dark',
  poundAddon: 'none',
  chocolateIcingCount: 0,
  vanillaCreamCount: 0,
  partyDecorationCount: 0,
  vanillaCakeSheet: 'vanilla',
  vanillaCakeFlavor: 'triple-berry',
  quantity: 1,
  ...overrides,
})

test('cart normalizes hidden options before deriving the fixed-order quantity-free key', () => {
  const normalized = normalizeCartSelection(baseSelection({
    cakeSize: '22cm',
    chocolateType: 'milk',
    poundAddon: 'vanilla-cream',
    chocolateIcingCount: 9,
    vanillaCreamCount: 4,
    partyDecorationCount: 3,
    vanillaCakeSheet: 'chocolate',
    vanillaCakeFlavor: 'nutella-chocolate-chip',
    quantity: 9,
  }))

  assert.ok(normalized)
  assert.deepEqual(normalized, baseSelection({ poundAddon: 'vanilla-cream', quantity: 5 }))
  assert.equal(
    getCartLineKey(normalized),
    JSON.stringify([
      'pound-cake',
      '15cm',
      'dark',
      'vanilla-cream',
      0,
      0,
      0,
      'vanilla',
      'triple-berry',
    ]),
  )
  assert.equal(getCartLineKey({ ...normalized, quantity: 2 }), getCartLineKey(normalized))
})

test('direct cart entry points reject retired and unknown products without reviving defaults', () => {
  const invalidSelections = [
    baseSelection({ productId: 'fresh-lemon-cupcakes-4' }),
    baseSelection({ productId: 'unknown-cake' as CakeDetailSelection['productId'] }),
  ]

  for (const selection of invalidSelections) {
    assert.equal(normalizeCartSelection(selection), null)
    assert.equal(getCartLineKey(selection), null)
    assert.deepEqual(addCartLine([], selection), [])
    assert.deepEqual(JSON.parse(serializeCartLines([{ lineKey: 'untrusted', selection }])), {
      version: 1,
      lines: [],
    })
  }
})

test('adding an identical normalized configuration merges quantity into one capped line', () => {
  const first = addCartLine([], baseSelection({ quantity: 3 }))
  const merged = addCartLine(first, baseSelection({
    cakeSize: '22cm',
    chocolateIcingCount: 12,
    vanillaCreamCount: 12,
    quantity: 4,
  }))

  assert.equal(merged.length, 1)
  assert.equal(merged[0].lineKey, getCartLineKey(baseSelection()))
  assert.equal(merged[0].selection.quantity, 5)
})

test('meaningful Vanilla and Lemon options stay separate with no total line cap', () => {
  const selections: CakeDetailSelection[] = [
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '15cm' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '19cm' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '22cm' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '15cm', vanillaCakeSheet: 'chocolate' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '19cm', vanillaCakeSheet: 'chocolate' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '22cm', vanillaCakeSheet: 'chocolate' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '15cm', vanillaCakeFlavor: 'nutella-chocolate-chip' }),
    baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '19cm', vanillaCakeFlavor: 'nutella-chocolate-chip' }),
    baseSelection({ productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 0 }),
    baseSelection({ productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1 }),
  ]
  const lines = selections.reduce(addCartLine, [])

  assert.equal(lines.length, 10)
  assert.equal(new Set(lines.map((line) => line.lineKey)).size, 10)
  assert.notEqual(lines[0].lineKey, lines[6].lineKey)
  assert.notEqual(lines[8].lineKey, lines[9].lineKey)
  assert.equal(getCartTotalQuantity(lines), 10)
})

test('updating one line clamps its quantity without changing other lines', () => {
  const lines = [
    ...addCartLine([], baseSelection()),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '19cm' })),
  ]
  const updated = updateCartLineQuantity(lines, lines[0].lineKey, 99)

  assert.equal(updated[0].selection.quantity, 5)
  assert.equal(updated[1].selection.quantity, 1)
  assert.deepEqual(updateCartLineQuantity(updated, 'missing', 2), updated)
})

test('removing a line deletes only its exact normalized configuration', () => {
  const lines = [
    ...addCartLine([], baseSelection()),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '19cm' })),
  ]
  const remaining = removeCartLine(lines, lines[0].lineKey)

  assert.deepEqual(remaining, [lines[1]])
  assert.deepEqual(removeCartLine(remaining, 'missing'), remaining)
})

test('versioned serialization allowlists selection fields and strips keys, money, PII, pickup, notes, and promo data', () => {
  const contaminatedSelection = {
    ...baseSelection({ quantity: 2 }),
    customerName: 'Not for storage',
    customerPhone: '0400000000',
    pickupDate: '2026-08-01',
    pickupTime: '10:00',
    requestNote: 'private',
    promoCode: 'secret',
    price: 45,
    subtotal: 90,
    discount: 9,
  }
  const contaminatedLine = {
    lineKey: 'forced-stale-key',
    selection: contaminatedSelection,
    price: 45,
    subtotal: 90,
  }
  const serialized = serializeCartLines([contaminatedLine])

  assert.equal(CART_STORAGE_KEY, 'verygood-au-cake-cart-v1')
  assert.deepEqual(JSON.parse(serialized), {
    version: 1,
    lines: [baseSelection({ quantity: 2 })],
  })
  for (const forbidden of [
    'lineKey',
    'price',
    'subtotal',
    'discount',
    'customerName',
    'customerPhone',
    'pickupDate',
    'pickupTime',
    'requestNote',
    'promoCode',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test('parsing fails soft for malformed JSON or a wrong version and preserves valid mixed entries', () => {
  assert.deepEqual(parseCartLines('{broken'), [])
  assert.deepEqual(parseCartLines(JSON.stringify({ version: 2, lines: [baseSelection()] })), [])
  assert.deepEqual(parseCartLines(JSON.stringify({ version: 1, lines: 'not-an-array' })), [])

  const mixed = JSON.stringify({
    version: 1,
    lines: [
      null,
      { ...baseSelection(), productId: 'unknown-cake' },
      { ...baseSelection(), productId: 'fresh-lemon-cupcakes-4' },
      { ...baseSelection(), quantity: 'two' },
      baseSelection({ productId: 'vanilla-fresh-cream-cake', cakeSize: '19cm', quantity: 2 }),
    ],
  })
  const parsed = parseCartLines(mixed)

  assert.equal(parsed.length, 1)
  assert.deepEqual(parsed[0].selection, baseSelection({
    productId: 'vanilla-fresh-cream-cake',
    cakeSize: '19cm',
    quantity: 2,
  }))
  assert.equal(parsed[0].lineKey, getCartLineKey(parsed[0].selection))
})

test('parsing rekeys normalized duplicates and merges their quantities at the per-line cap', () => {
  const parsed = parseCartLines(JSON.stringify({
    version: 1,
    lines: [
      baseSelection({ quantity: 3 }),
      baseSelection({
        cakeSize: '22cm',
        chocolateIcingCount: 9,
        vanillaCreamCount: 5,
        quantity: 4,
      }),
    ],
  }))

  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].lineKey, getCartLineKey(baseSelection()))
  assert.equal(parsed[0].selection.quantity, 5)
})

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue
  const storage: StorageLike = {
    getItem(key) {
      assert.equal(key, CART_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, CART_STORAGE_KEY)
      value = nextValue
    },
  }
  return { storage, read: () => value }
}

test('storage helpers use the fixed key and round-trip only safe cart fields', () => {
  const lines = addCartLine([], baseSelection({ quantity: 2 }))
  const memory = createMemoryStorage()

  saveCartLines(memory.storage, lines)

  assert.equal(memory.read(), serializeCartLines(lines))
  assert.deepEqual(loadCartLines(memory.storage), lines)
})

test('loading fails soft when storage access throws', () => {
  const storage: StorageLike = {
    getItem() {
      throw new Error('storage unavailable')
    },
    setItem() {},
  }

  assert.deepEqual(loadCartLines(storage), [])
})

test('saving ignores storage write failures without mutating in-memory lines', () => {
  const lines = addCartLine([], baseSelection({ quantity: 2 }))
  const snapshot = structuredClone(lines)
  const storage: StorageLike = {
    getItem() {
      return null
    },
    setItem() {
      throw new Error('quota exceeded')
    },
  }

  assert.doesNotThrow(() => saveCartLines(storage, lines))
  assert.deepEqual(lines, snapshot)
})
