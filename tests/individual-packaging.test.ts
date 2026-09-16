import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  calculateIndividualPackagingFeeCents,
  getIndividualPackagingPieceCount,
  getIndividualPackagingPricing,
  isIndividualPackagingEligibleProduct,
} from '../src/lib/individual-packaging.js'

test('individual packaging always charges AUD 0.50 per selected piece', () => {
  assert.equal(calculateIndividualPackagingFeeCents(6, 3_000), 300)
  assert.equal(calculateIndividualPackagingFeeCents(200, 100_000), 10_000)
})

test('individual packaging is available for all stored Cupcake and Lemon pack sizes', () => {
  for (const productId of [
    'cupcake-half-dozen', 'cupcake-dozen', 'cupcake-twenty-four', 'cupcake-forty-eight',
    'fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16',
    'fresh-lemon-cupcakes-24', 'fresh-lemon-cupcakes-48',
  ] as const) assert.equal(isIndividualPackagingEligibleProduct(productId), true, productId)

  for (const productId of [
    'pave-cake', 'vanilla-fresh-cream-cake', 'buttercream-cake', 'pound-cake', 'brownie-cheesecake',
    'fresh-lemon-cupcakes-4',
  ] as const) assert.equal(isIndividualPackagingEligibleProduct(productId), false, productId)
})

test('individual packaging pieces use authoritative pack sizes and line quantity', () => {
  assert.equal(getIndividualPackagingPieceCount('cupcake-half-dozen', 1), 6)
  assert.equal(getIndividualPackagingPieceCount('cupcake-dozen', 2), 24)
  assert.equal(getIndividualPackagingPieceCount('cupcake-twenty-four', 1), 24)
  assert.equal(getIndividualPackagingPieceCount('cupcake-forty-eight', 1), 48)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-6', 3), 18)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-8', 4), 32)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-12', 5), 60)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-16', 2), 32)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-24', 1), 24)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-48', 1), 48)
  assert.equal(getIndividualPackagingPieceCount('fresh-lemon-cupcakes-4', 1), 0)
  assert.equal(getIndividualPackagingPieceCount('pave-cake', 5), 0)
})

test('individual packaging never becomes free at an AUD 100 selected packaging product subtotal', () => {
  assert.equal(calculateIndividualPackagingFeeCents(0, 0), 0)
  assert.equal(calculateIndividualPackagingFeeCents(12, 9_999), 600)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10_000), 600)
  assert.equal(calculateIndividualPackagingFeeCents(12, 10_001), 600)
})

test('selected Cupcake and Lemon lines always pay packaging, independent of product subtotal', () => {
  const paid = getIndividualPackagingPricing([
    { productId: 'cupcake-dozen', quantity: 1, individualPackaging: true, productSubtotalCents: 5_500 },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 1, individualPackaging: false, productSubtotalCents: 4_500 },
  ])
  const combined = getIndividualPackagingPricing([
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
  assert.deepEqual(combined, {
    selectedPackagingPieces: 20,
    selectedPackagingProductSubtotalCents: 10_000,
    individualPackagingBaseFeeCents: 1_000,
    individualPackagingDiscountCents: 0,
    individualPackagingFeeCents: 1_000,
  })
})
