import type { ChocolateExtra, ProductId } from './types.js'

export type ChocolateExtraOption = {
  value: ChocolateExtra
  price: number
  label: string
  labelKo: string
  description: string
  descriptionKo: string
}

const ELIGIBLE_CHOCOLATE_EXTRA_PRODUCT_IDS: readonly ProductId[] = [
  'pave-cake',
  'buttercream-cake',
  'pound-cake',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
]

export const CHOCOLATE_EXTRA_OPTIONS: readonly ChocolateExtraOption[] = [
  { value: 'none', price: 0, label: 'None', labelKo: '추가 안 함', description: 'No additional chocolate item.', descriptionKo: '별도 초콜릿 추가 구성 없음.' },
  {
    value: 'eiffel-6', price: 10, label: 'Eiffel Tower Chocolates · 6 pieces', labelKo: '에펠탑 초콜릿 · 6개',
    description: 'Six Eiffel Tower chocolates to enjoy alongside your cake.', descriptionKo: '케이크와 함께 즐길 수 있는 에펠탑 초콜릿 6개 구성.',
  },
  {
    value: 'pave-100g', price: 12, label: 'Pavé Chocolate · 100g tub', labelKo: '파베 초콜릿 · 100g 통',
    description: 'Rich, smooth pavé chocolate to enjoy by the spoonful, spread over your cake, or share on the side.', descriptionKo: '부드럽고 진한 파베 초콜릿을 그대로 떠먹거나, 케이크에 발라 먹거나, 곁들여 함께 즐길 수 있습니다.',
  },
  {
    value: 'combo', price: 20, label: 'Chocolate Extra Set', labelKo: '초콜릿 추가 세트',
    description: '6 Eiffel Tower chocolates + 100g Pavé Chocolate. Save AUD 2.00.', descriptionKo: '에펠탑 초콜릿 6개 + 파베 초콜릿 100g 통 · AUD 2.00 할인.',
  },
]

export const DEFAULT_CHOCOLATE_EXTRA: ChocolateExtra = 'none'

export function isChocolateExtraEligibleProduct(productId: ProductId) {
  return ELIGIBLE_CHOCOLATE_EXTRA_PRODUCT_IDS.includes(productId)
}

export function getChocolateExtraOption(value?: ChocolateExtra | string) {
  return CHOCOLATE_EXTRA_OPTIONS.find((option) => option.value === value) || CHOCOLATE_EXTRA_OPTIONS[0]
}

export function normalizeChocolateExtra(productId: ProductId, value?: ChocolateExtra | string): ChocolateExtra {
  if (!isChocolateExtraEligibleProduct(productId)) return DEFAULT_CHOCOLATE_EXTRA
  return getChocolateExtraOption(value).value
}

export function getChocolateExtraPrice(value?: ChocolateExtra | string) {
  return getChocolateExtraOption(value).price
}

export function formatChocolateExtra(value: ChocolateExtra | string | undefined, language: 'en' | 'ko') {
  const option = getChocolateExtraOption(value)
  return language === 'ko' ? option.labelKo : option.label
}
