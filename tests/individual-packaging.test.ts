import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  calculateIndividualPackagingFeeCents,
  getIndividualPackagingPieceCount,
  getIndividualPackagingPricing,
  isIndividualPackagingEligibleProduct,
} from '../src/lib/individual-packaging.js'

test('individual packaging is available only for current Cupcake and Lemon products', () => {
  for (const productId of [
    'cupcake-half-dozen', 'cupcake-dozen', 'fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8',
    'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16',
  ] as const) assert.equal(isIndividualPackagingEligibleProduct(productId), true, productId)

  for (const productId of [
    'pave-cake', 'vanilla-fresh-cream-cake', 'buttercream-cake', 'pound-cake', 'brownie-cheesecake',
    'fresh-lemon-cupcakes-4',
  ] as const) assert.equal(isIndividualPackagingEligibleProduct(productId), false, productId)
})

test('individual packaging pieces use authoritative pack sizes and line quantity', () => {
  assert.equal(getIndividualPackagingPieceCount('cupcake-half-dozen', 1), 6)
  assert.equal(getIndividualPackagingPieceCount('cupcake-dozen', 2), 24)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-6', 3), 18)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-8', 4), 32)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-12', 5), 60)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-16', 2), 32)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-4', 1), 0)
  assert.equal(getIndividualPackagingPieceCount('pave-cake', 5), 0)
})

test('individual packaging becomes free at an AUD 100 selected packaging product subtotal, not a piece count', () => {
  assert.equal(calculateIndividualPackagingFeeCents(0, 0), 0)
  assert.equal(calculateIndividualPackagingFeeCents(12, 9_999), 600)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10_000), 0)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10_001), 0)
})

test('selected Cupcake and Lemon lines aggregate their product subtotal for the free packaging rule', () => {
  const paid = getIndividualPackagingPricing([
    { productId: 'cupcake-dozen', quantity: 1, individualPackaging: true, productSubtotalCents: 5_500 },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 1, individualPackaging: false, productSubtotalCents: 4_500 },
  ])
  const free = getIndividualPackagingPricing([
    { productId: 'cupcake-dozen', quantity: 1, individualPackaging: true, productSubtotalCents: 5_500 },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 1, individualPackaging: true, productSubtotalCents: 4_500 },
  ])

  assert.deepEqual(paid, {
    selectedPackagingPieces: 12,
    selectedPackagingProductSubtotalCents: 5_500,
    individualPackagingBaseFeeCents: 600,
    individualPackagingDiscountCents: 0,
    individualPackagingFeeCents: 600,
  })
  assert.deepEqual(free, {
    selectedPackagingPieces: 20,
    selectedPackagingProductSubtotalCents: 10_000,
    individualPackagingBaseFeeCents: 1_000,
    individualPackagingDiscountCents: 1_000,
    individualPackagingFeeCents: 0,
  })
})
