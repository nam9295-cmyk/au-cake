import { marketConfig, PAYMENT_STATUSES, RESERVATION_STATUSES } from './market'
import type { CacaoPercent, CakeSize, ProductId } from './types'

export const PRODUCT_NAME = marketConfig.copy.productName

export const DEFAULT_PRODUCT_ID: ProductId = 'pave-cake'
export const DEFAULT_CAKE_SIZE: CakeSize = 'mini'
export const MAX_RESERVATION_QUANTITY = 5

export const PRODUCTS = marketConfig.products

export function getProductById(productId?: string) {
  return PRODUCTS[(productId as ProductId) || DEFAULT_PRODUCT_ID] || PRODUCTS[DEFAULT_PRODUCT_ID]
}

export function formatCacaoLabel(cacaoPercent: CacaoPercent) {
  return CACAO_OPTIONS.find((item) => item.value === cacaoPercent)?.label || `${cacaoPercent}%`
}

export const CAKE_SIZE_OPTIONS = marketConfig.cakeSizeOptions

export function getCakeSizeOption(cakeSize?: CakeSize) {
  return CAKE_SIZE_OPTIONS.find((item) => item.value === cakeSize) || CAKE_SIZE_OPTIONS[0]
}

export function formatCakeSizeLabel(cakeSize?: CakeSize) {
  return getCakeSizeOption(cakeSize).label
}

export function normalizeCakeSize(productId: ProductId, cakeSize?: CakeSize) {
  const product = getProductById(productId)
  if (!product.usesSizeOptions) return DEFAULT_CAKE_SIZE
  return getCakeSizeOption(cakeSize).value
}

export function getReservationUnitPrice(
  productId: ProductId,
  cacaoPercent: CacaoPercent,
  cakeSize: CakeSize = DEFAULT_CAKE_SIZE,
) {
  const product = getProductById(productId)
  const option = CACAO_OPTIONS.find((item) => item.value === cacaoPercent)
  const sizePrice = product.usesSizeOptions ? getCakeSizeOption(cakeSize).price : product.price
  return sizePrice + (product.usesCacaoOptions ? option?.extraPrice || 0 : 0)
}

export function getReservationPrice(
  productId: ProductId,
  cacaoPercent: CacaoPercent,
  quantity = 1,
  cakeSize: CakeSize = DEFAULT_CAKE_SIZE,
) {
  return getReservationUnitPrice(productId, cacaoPercent, cakeSize) * quantity
}

export const DEFAULT_SETTINGS = marketConfig.defaultSettings

export const CACAO_OPTIONS = marketConfig.cacaoOptions

export { PAYMENT_STATUSES, RESERVATION_STATUSES }
