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

test('individual packaging fee has exact 99, 100 and 101-piece boundaries', () => {
  assert.equal(calculateIndividualPackagingFeeCents(0), 0)
  assert.equal(calculateIndividualPackagingFeeCents(99), 4950)
  assert.equal(calculateIndividualPackagingFeeCents(100), 0)
  assert.equal(calculateIndividualPackagingFeeCents(101), 0)
})

test('valid selected order lines aggregate packaging across the reservation', () => {
  const pricing98 = getIndividualPackagingPricing([
    { productId: 'fresh-lemon-cupcakes-16', quantity: 5, individualPackaging: true },
    { productId: 'cupcake-half-dozen', quantity: 3, individualPackaging: true },
    { productId: 'pave-cake', quantity: 5, individualPackaging: true },
  ])
  const pricing100 = getIndividualPackagingPricing([
    { productId: 'fresh-lemon-cupcakes-16', quantity: 5, individualPackaging: true },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 1, individualPackaging: true },
    { productId: 'fresh-lemon-cupcakes-12', quantity: 1, individualPackaging: true },
  ])
  const pricing102 = getIndividualPackagingPricing([
    { productId: 'fresh-lemon-cupcakes-16', quantity: 5, individualPackaging: true },
    { productId: 'fresh-lemon-cupcakes-8', quantity: 2, individualPackaging: true },
    { productId: 'cupcake-half-dozen', quantity: 1, individualPackaging: true },
    { productId: 'cupcake-dozen', quantity: 2, individualPackaging: false },
  ])

  assert.deepEqual(pricing98, { selectedPackagingPieces: 98, individualPackagingFeeCents: 4900 })
  assert.deepEqual(pricing100, { selectedPackagingPieces: 100, individualPackagingFeeCents: 0 })
  assert.deepEqual(pricing102, { selectedPackagingPieces: 102, individualPackagingFeeCents: 0 })
})
