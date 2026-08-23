import type { ProductId } from './types.js'

export const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50
export const INDIVIDUAL_PACKAGING_FREE_FROM_PIECES = 100

export type IndividualPackagingLine = {
  productId: ProductId
  quantity: number
  individualPackaging?: boolean
}

export type IndividualPackagingPricing = {
  selectedPackagingPieces: number
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

export function calculateIndividualPackagingFeeCents(selectedPackagingPieces: number) {
  if (!Number.isSafeInteger(selectedPackagingPieces) || selectedPackagingPieces <= 0) return 0
  if (selectedPackagingPieces >= INDIVIDUAL_PACKAGING_FREE_FROM_PIECES) return 0
  return selectedPackagingPieces * INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE
}

export function getIndividualPackagingPricing(lines: readonly IndividualPackagingLine[]): IndividualPackagingPricing {
  const selectedPackagingPieces = lines.reduce((pieces, line) => {
    if (line.individualPackaging !== true) return pieces
    return pieces + getIndividualPackagingPieceCount(line.productId, line.quantity)
  }, 0)
  return {
    selectedPackagingPieces,
    individualPackagingFeeCents: calculateIndividualPackagingFeeCents(selectedPackagingPieces),
  }
}
