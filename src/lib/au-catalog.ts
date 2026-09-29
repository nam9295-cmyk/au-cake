import { isActiveCakeOrderProductId } from '../../appwrite-functions/reservation-api/src/active-cake-products.js'
import { getAuCakeCatalogCards, getAuCakeCatalogGroups } from './cake-catalog.js'
import { auChocolateAssets } from './au-chocolate-assets.js'
import { getAuChocolatePreviews } from './au-chocolate-preview.js'
import type { Language } from './i18n.js'

export function getAuOrderableCakeCards(language: Language) {
  return getAuCakeCatalogGroups(language).flatMap((group) => group.cards).filter((card) =>
    !card.isComingSoonOnly && card.productId && isActiveCakeOrderProductId(card.productId),
  )
}

// The S’more keeps its cake ProductId and detail route; only its AU collection placement changes.
export function getAuChocolateCollectionCards(language: Language) {
  const chocolateCards: Array<{
    id: string
    slug: string
    name: string
    description: string
    price: string
    image: string
    imageAlt: string
    href: string
  }> = getAuChocolatePreviews().map((product) => ({
    id: product.slug,
    slug: product.slug,
    name: product.name,
    description: product.packLabel,
    price: product.price,
    image: auChocolateAssets[product.slug].src,
    imageAlt: auChocolateAssets[product.slug].alt,
    href: `/chocolates/${product.slug}`,
  }))
  const smore = getAuCakeCatalogCards(language).find((card) => card.id === 'smore-stick')
  if (smore) chocolateCards.push({
    id: smore.id,
    slug: smore.slug,
    name: smore.name,
    description: smore.optionLabel,
    price: smore.priceLabel,
    image: smore.imagePath,
    imageAlt: smore.name,
    href: `/cakes/${smore.slug}`,
  })
  return chocolateCards
}

// Named slots keep Phase 1 placeholders easy to replace without changing layout.
export const auEditorialImages = {
  making: '/redesign/3906.jpg',
  craft: '/redesign/39538.jpg',
  celebration: '/redesign/53935.jpg',
  custom: '/products/custom-cake.webp',
} as const
