import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  CART_STORAGE_KEY,
  addCartLine,
  getCartEstimatedSubtotal,
  getCartEstimatedPricing,
  getCartLineKey,
  getCartTotalQuantity,
  loadCartLines,
  normalizeCartSelection,
  parseCartLines,
  removeCartLine,
  saveCartLines,
  serializeCartLines,
  subtractSubmittedCartLines,
  updateCartLineQuantity,
} from '../src/lib/cart.js'
import type { CakeDetailSelection } from '../src/lib/cake-detail.js'

const baseSelection = (overrides: Partial<CakeDetailSelection> = {}): CakeDetailSelection => ({
  productId: 'pound-cake',
  cakeSize: '15cm',
  chocolateType: 'dark',
  poundAddon: 'none',
  cupcakeFinish: 'basic',
  chocolateExtra: 'none',
  chocolateIcingCount: 0,
  vanillaCreamCount: 0,
  partyDecorationCount: 0,
  vanillaCakeSheet: 'vanilla',
  vanillaCakeFlavor: 'triple-berry',
  brownieCreamOption: 'none',
  individualPackaging: false,
  quantity: 1,
  ...overrides,
} as CakeDetailSelection)

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
      'none',
      0,
      0,
      0,
      'vanilla',
      'triple-berry',
      'none',
    ]),
  )
  assert.equal(getCartLineKey({ ...normalized, quantity: 2 }), getCartLineKey(normalized))
})

test('direct cart entry points reject retired and unknown products without reviving defaults', () => {
  const invalidSelections = [
    baseSelection({ productId: 'fresh-lemon-cupcakes-4' }),
    baseSelection({ productId: 'choco-basque-cheesecake' }),
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

test('Buttercream and Brownie Cheesecake cart lines add, update, and remove independently', () => {
  const buttercream = baseSelection({ productId: 'buttercream-cake', cakeSize: '10in', quantity: 1 })
  const brownie = baseSelection({ productId: 'pave-brownie-cheesecake', quantity: 1 })
  const added = addCartLine(addCartLine([], buttercream), brownie)

  assert.equal(added.length, 2)
  assert.equal(getCartEstimatedSubtotal(added), 240)
  const updated = updateCartLineQuantity(added, added[0].lineKey, 2)
  assert.equal(updated[0].selection.quantity, 2)
  assert.equal(getCartEstimatedSubtotal(updated), 385)
  assert.deepEqual(removeCartLine(updated, updated[1].lineKey), [updated[0]])
})

test('Brownie Fresh cream is a persisted cart identity option priced per cake while legacy carts default to none', () => {
  const basic = baseSelection({ productId: 'brownie-cheesecake' })
  const withCream = { ...basic, brownieCreamOption: 'fresh-cream' } as CakeDetailSelection
  const lines = addCartLine(addCartLine([], basic), withCream)

  assert.equal(lines.length, 2)
  assert.notEqual(lines[0]?.lineKey, lines[1]?.lineKey)
  assert.equal(getCartEstimatedSubtotal(lines), 190)
  assert.match(serializeCartLines(lines), /"brownieCreamOption":"fresh-cream"/)
  assert.equal(parseCartLines(serializeCartLines(lines))[1]?.selection.brownieCreamOption, 'fresh-cream')

  const attemptedPaveCombination = normalizeCartSelection(baseSelection({
    productId: 'pave-brownie-cheesecake',
    brownieCreamOption: 'fresh-cream',
  }))
  assert.equal(attemptedPaveCombination?.brownieCreamOption, 'none')
  assert.equal(attemptedPaveCombination ? getCartEstimatedSubtotal(addCartLine([], attemptedPaveCombination)) : 0, 95)

  const legacySelection: Partial<CakeDetailSelection> = { ...basic }
  delete legacySelection.brownieCreamOption
  const legacy = parseCartLines(JSON.stringify({ version: 1, lines: [legacySelection] }))
  assert.equal(legacy[0]?.selection.brownieCreamOption, 'none')
})

test('Cupcake cart lines keep pack size and whole-box finish as separate priced selections', () => {
  const halfVanilla = {
    ...baseSelection({ productId: 'cupcake-half-dozen' as CakeDetailSelection['productId'] }),
    cupcakeFinish: 'vanilla-fresh-cream',
  } as CakeDetailSelection
  const dozenButtercream = {
    ...baseSelection({ productId: 'cupcake-dozen' }),
    cupcakeFinish: 'chocolate-buttercream',
  } as CakeDetailSelection
  const lines = addCartLine(addCartLine([], halfVanilla), dozenButtercream)

  assert.equal(lines.length, 2)
  assert.notEqual(lines[0].lineKey, lines[1].lineKey)
  assert.equal(getCartEstimatedSubtotal(lines), 109)
  assert.equal((lines[0].selection as CakeDetailSelection & { cupcakeFinish?: string }).cupcakeFinish, 'vanilla-fresh-cream')
  assert.equal(lines[0].selection.vanillaCreamCount, 0)
  assert.equal(lines[0].selection.partyDecorationCount, 0)
})

test('individual packaging is a persisted eligible line choice and participates in cart identity', () => {
  const unpackaged = baseSelection({ productId: 'cupcake-half-dozen' })
  const packaged = baseSelection({ productId: 'cupcake-half-dozen', individualPackaging: true })
  const wholeCake = baseSelection({ productId: 'pave-cake', individualPackaging: true })
  const lines = addCartLine(addCartLine([], unpackaged), packaged)

  assert.equal(lines.length, 2)
  assert.notEqual(lines[0].lineKey, lines[1].lineKey)
  assert.equal(lines[1].selection.individualPackaging, true)
  assert.equal(normalizeCartSelection(wholeCake)?.individualPackaging, false)
  assert.deepEqual(JSON.parse(serializeCartLines(lines)).lines.map((line: CakeDetailSelection) => line.individualPackaging), [false, true])

  const historical = parseCartLines(JSON.stringify({
    version: 1,
    lines: [{ ...unpackaged, individualPackaging: undefined }],
  }))
  assert.equal(historical[0].selection.individualPackaging, false)
})

test('cart pricing keeps product subtotal separate and aggregates packaging after it', () => {
  const lines = [
    ...addCartLine([], baseSelection({ productId: 'cupcake-half-dozen', quantity: 1, individualPackaging: true })),
    ...addCartLine([], baseSelection({ productId: 'cupcake-dozen', quantity: 1, individualPackaging: true })),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '6in', individualPackaging: true })),
  ]

  assert.equal(getCartEstimatedSubtotal(lines), 165)
  assert.deepEqual(getCartEstimatedPricing(lines), {
    productSubtotalCents: 16500,
    selectedPackagingPieces: 18,
    selectedPackagingProductSubtotalCents: 8600,
    individualPackagingBaseFeeCents: 900,
    individualPackagingDiscountCents: 0,
    individualPackagingFeeCents: 900,
    totalPriceCents: 17400,
  })
})

test('cart makes selected Cupcake and Lemon packaging free when their combined product subtotal reaches AUD 100', () => {
  const lines = [
    ...addCartLine([], baseSelection({ productId: 'cupcake-dozen', cupcakeFinish: 'basic', individualPackaging: true })),
    ...addCartLine([], baseSelection({ productId: 'fresh-lemon-cupcakes-8', individualPackaging: true })),
  ]

  assert.deepEqual(getCartEstimatedPricing(lines), {
    productSubtotalCents: 10000,
    selectedPackagingPieces: 20,
    selectedPackagingProductSubtotalCents: 10000,
    individualPackagingBaseFeeCents: 1000,
    individualPackagingDiscountCents: 1000,
    individualPackagingFeeCents: 0,
    totalPriceCents: 10000,
  })
})

test('current Strawberry orders ignore legacy Vanilla fields while Lemon options stay separate with no total line cap', () => {
  const selections: CakeDetailSelection[] = [
    baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '6in' }),
    baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in' }),
    baseSelection({ productId: 'fresh-strawberry-chocolate-cream-cake', cakeSize: '10in' }),
    baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '6in', vanillaCakeFlavor: 'nutella-chocolate-chip' }),
    baseSelection({ productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 0 }),
    baseSelection({ productId: 'fresh-lemon-cupcakes-6', chocolateIcingCount: 1 }),
  ]
  const lines = selections.reduce(addCartLine, [])

  assert.equal(lines.length, 5)
  assert.equal(new Set(lines.map((line) => line.lineKey)).size, 5)
  assert.equal(lines[0].selection.quantity, 2)
  assert.notEqual(lines[3].lineKey, lines[4].lineKey)
  assert.equal(getCartTotalQuantity(lines), 6)
})

test('Strawberry carts omit legacy point colours while Buttercream colours remain separate', () => {
  const pink = baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '6in', vanillaCakePointColor: 'pink' })
  const blue = baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '6in', vanillaCakePointColor: 'blue' })
  const lines = addCartLine(addCartLine([], pink), blue)

  assert.equal(lines.length, 1)
  assert.equal(lines[0].selection.quantity, 2)


  const buttercreamPink = baseSelection({ productId: 'buttercream-cake', vanillaCakePointColor: 'pink' })
  const buttercreamBlue = baseSelection({ productId: 'buttercream-cake', vanillaCakePointColor: 'blue' })
  const buttercreamLines = addCartLine(addCartLine([], buttercreamPink), buttercreamBlue)
  assert.equal(buttercreamLines.length, 2)
  assert.notEqual(buttercreamLines[0].lineKey, buttercreamLines[1].lineKey)
})

test('updating one line clamps its quantity without changing other lines', () => {
  const lines = [
    ...addCartLine([], baseSelection()),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '8in' })),
  ]
  const updated = updateCartLineQuantity(lines, lines[0].lineKey, 99)

  assert.equal(updated[0].selection.quantity, 5)
  assert.equal(updated[1].selection.quantity, 1)
  assert.deepEqual(updateCartLineQuantity(updated, 'missing', 2), updated)
})

test('successful snapshot cleanup subtracts only submitted quantities and preserves every later addition', () => {
  const submitted = [
    ...addCartLine([], baseSelection()),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '8in' })),
  ]
  const distinctAddedAfterSubmission = addCartLine([], baseSelection({
    productId: 'fresh-strawberry-vanilla-cream-cake',
    cakeSize: '10in',
  }))[0]
  const currentWithSameKeyAddition = addCartLine(submitted, baseSelection())
  const current = [...currentWithSameKeyAddition, distinctAddedAfterSubmission]
  const afterSuccess = subtractSubmittedCartLines(current, submitted)

  assert.deepEqual(afterSuccess, [
    { ...submitted[0], selection: { ...submitted[0].selection, quantity: 1 } },
    distinctAddedAfterSubmission,
  ])
  assert.equal(current[0].selection.quantity, 2)
  assert.equal(submitted[0].selection.quantity, 1)
})

test('removing a line deletes only its exact normalized configuration', () => {
  const lines = [
    ...addCartLine([], baseSelection()),
    ...addCartLine([], baseSelection({ productId: 'pave-cake', cakeSize: '8in' })),
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
      baseSelection({ productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', quantity: 2 }),
    ],
  })
  const parsed = parseCartLines(mixed)

  assert.equal(parsed.length, 1)
  assert.deepEqual(parsed[0].selection, baseSelection({
    productId: 'fresh-strawberry-vanilla-cream-cake',
    cakeSize: '8in',
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

test('estimated subtotal reprices every current cart selection without mutating lines', () => {
  const lines = [
    ...addCartLine([], baseSelection({ quantity: 2, poundAddon: 'extra-chocolate' })),
    ...addCartLine([], baseSelection({
      productId: 'fresh-strawberry-vanilla-cream-cake',
      cakeSize: '8in',
      quantity: 3,
    })),
  ]
  const snapshot = structuredClone(lines)

  assert.equal(getCartEstimatedSubtotal([]), 0)
  assert.equal(getCartEstimatedSubtotal(lines), 371)
  assert.deepEqual(lines, snapshot)
})

test('Chocolate Extra changes cart identity, persists, and is priced once per selected order line', () => {
  const withoutExtra = baseSelection({ productId: 'pave-cake', cakeSize: '6in', quantity: 2 })
  const withExtra = { ...withoutExtra, chocolateExtra: 'pave-100g' } as CakeDetailSelection
  const lines = addCartLine(addCartLine([], withoutExtra), withExtra)

  assert.equal(lines.length, 2)
  assert.notEqual(getCartLineKey(withoutExtra), getCartLineKey(withExtra))
  assert.equal(getCartEstimatedSubtotal(lines), 328)
  assert.match(serializeCartLines(lines), /"chocolateExtra":"pave-100g"/)
  assert.equal(parseCartLines(serializeCartLines(lines))[1]?.selection.chocolateExtra, 'pave-100g')
})
