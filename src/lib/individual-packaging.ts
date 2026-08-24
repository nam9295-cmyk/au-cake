import type { ProductId } from './types.js'

export const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50
export const INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS = 10_000

export type IndividualPackagingLine = {
  productId: ProductId
  quantity: number
  individualPackaging?: boolean
  productSubtotalCents?: number
}

export type IndividualPackagingPricing = {
  selectedPackagingPieces: number
  selectedPackagingProductSubtotalCents: number
  individualPackagingBaseFeeCents: number
  individualPackagingDiscountCents: number
  individualPackagingFeeCents: number
}

const INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT: Partial<Record<ProductId, number>> = {
  'cupcake-half-dozen': 6,
  'cupcake-dozen': 12,
  'fresh-lemon-cupcakes-6': 6,
  'fresh-lemon-cupcakes-8': 8,
  'fresh-lemon-cupcakes-12': 12,
  'fresh-lemon-cupcakes-16': 16,
}

export function isIndividualPackagingEligibleProduct(productId: ProductId) {
  return INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT[productId] !== undefined
}

export function getIndividualPackagingPieceCount(productId: ProductId, quantity: number) {
  if (!isIndividualPackagingEligibleProduct(productId) || !Number.isSafeInteger(quantity) || quantity < 1) return 0
  const packSize = INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT[productId] || 0
  const pieces = packSize * quantity
  return Number.isSafeInteger(pieces) ? pieces : 0
}

export function calculateIndividualPackagingBaseFeeCents(selectedPackagingPieces: number) {
  if (!Number.isSafeInteger(selectedPackagingPieces) || selectedPackagingPieces <= 0) return 0
  return selectedPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
}

export function calculateIndividualPackagingFeeCents(
  selectedPackagingPieces: number,
  selectedPackagingProductSubtotalCents = 0,
) {
  const baseFeeCents = calculateIndividualPackagingBaseFeeCents(selectedPackagingPieces)
  if (!baseFeeCents) return 0
  return Number.isSafeInteger(selectedPackagingProductSubtotalCents)
    && selectedPackagingProductSubtotalCents >= INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS
    ? 0
    : baseFeeCents
}

export function getIndividualPackagingPricing(lines: readonly IndividualPackagingLine[]): IndividualPackagingPricing {
  const selectedLines = lines.filter((line) => line.individualPackaging === true && isIndividualPackagingEligibleProduct(line.productId))
  const selectedPackagingPieces = selectedLines.reduce(
    (pieces, line) => pieces + getIndividualPackagingPieceCount(line.productId, line.quantity),
    0,
  )
  const selectedPackagingProductSubtotalCents = selectedLines.reduce(
    (subtotalCents, line) => subtotalCents + (
      Number.isSafeInteger(line.productSubtotalCents) && line.productSubtotalCents! >= 0
        ? line.productSubtotalCents!
        : 0
    ),
    0,
  )
  const individualPackagingBaseFeeCents = calculateIndividualPackagingBaseFeeCents(selectedPackagingPieces)
  const individualPackagingFeeCents = calculateIndividualPackagingFeeCents(
    selectedPackagingPieces,
    selectedPackagingProductSubtotalCents,
  )
  return {
    selectedPackagingPieces,
    selectedPackagingProductSubtotalCents,
    individualPackagingBaseFeeCents,
    individualPackagingDiscountCents: individualPackagingBaseFeeCents - individualPackagingFeeCents,
    individualPackagingFeeCents,
  }
}
