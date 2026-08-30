import type { BrownieCreamOption, ProductId } from './types.js'

export const DEFAULT_BROWNIE_CREAM_OPTION: BrownieCreamOption = 'none'
export const BROWNIE_FRESH_CREAM_PRICE = 20

export const BROWNIE_CREAM_OPTIONS: ReadonlyArray<{
  value: BrownieCreamOption
  label: string
  labelKo: string
  extraPrice: number
}> = [
  { value: 'none', label: 'No fresh cream', labelKo: '생크림 선택 안 함', extraPrice: 0 },
  { value: 'fresh-cream', label: 'Fresh cream', labelKo: '생크림 추가', extraPrice: BROWNIE_FRESH_CREAM_PRICE },
]

export function isBrownieCheesecakeProduct(productId: ProductId) {
  return productId === 'brownie-cheesecake' || productId === 'pave-brownie-cheesecake'
}

export function isBrownieFreshCreamEligibleProduct(productId: ProductId) {
  return productId === 'brownie-cheesecake'
}

export function normalizeBrownieCreamOption(
  productId: ProductId,
  value?: BrownieCreamOption | string,
): BrownieCreamOption {
  if (!isBrownieFreshCreamEligibleProduct(productId)) return DEFAULT_BROWNIE_CREAM_OPTION
  return value === 'fresh-cream' ? 'fresh-cream' : DEFAULT_BROWNIE_CREAM_OPTION
}

export function getBrownieCreamOption(
  productId: ProductId,
  value?: BrownieCreamOption | string,
) {
  const normalized = normalizeBrownieCreamOption(productId, value)
  return BROWNIE_CREAM_OPTIONS.find((option) => option.value === normalized) || BROWNIE_CREAM_OPTIONS[0]
}

export function getBrownieCreamPrice(
  productId: ProductId,
  value?: BrownieCreamOption | string,
) {
  return getBrownieCreamOption(productId, value).extraPrice
}

export function formatBrownieCreamOption(
  productId: ProductId,
  value: BrownieCreamOption | string | undefined,
  language: 'en' | 'ko' = 'en',
) {
  const option = getBrownieCreamOption(productId, value)
  return language === 'ko' ? option.labelKo : option.label
}
