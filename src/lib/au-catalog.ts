import { isActiveCakeOrderProductId } from '../../appwrite-functions/reservation-api/src/active-cake-products.js'
import { getAuCakeCatalogCards } from './cake-catalog.js'
import type { Language } from './i18n.js'

export function getAuOrderableCakeCards(language: Language) {
  return getAuCakeCatalogCards(language).filter((card) =>
    !card.isComingSoonOnly && card.productId && isActiveCakeOrderProductId(card.productId),
  )
}

// Named slots keep Phase 1 placeholders easy to replace without changing layout.
export const auEditorialImages = {
  making: '/redesign/3906.jpg',
  craft: '/redesign/39538.jpg',
  celebration: '/redesign/53935.jpg',
  custom: '/products/custom-cake.webp',
} as const
