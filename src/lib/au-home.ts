import { getAuCakeCatalogCards, type CakeCatalogId } from './cake-catalog'
import { getAuChocolateCollectionCards } from './au-catalog'
import type { Language } from './i18n'

// Presentation-only membership. Catalogue groups, ProductIds and pricing stay unchanged.
const whole: CakeCatalogId[] = [
  'pave',
  'signature-gateau',
  'fresh-strawberry-vanilla-cream',
  'brownie-cheesecake',
]
const sharing: CakeCatalogId[] = [
  'cupcake',
  'fresh-lemon-cupcakes',
  'bento-cake',
]
export type HomeCollectionId = 'whole' | 'sharing' | 'chocolates'
export interface HomeProduct {
  id: string
  name: string
  description: string
  image: string
  imageAlt: string
  price: string
  href: string | null
  comingSoon?: boolean
}
export function getAuHomeCollections(language: Language) {
  const cakes = getAuCakeCatalogCards(language)
  const select = (ids: CakeCatalogId[]): HomeProduct[] =>
    ids.map((id) => {
      const cake = cakes.find((card) => card.id === id)!
      return {
        id: cake.id,
        name: cake.name,
        description: cake.optionLabel,
        image: cake.imagePath,
        imageAlt: cake.name,
        price: cake.priceLabel,
        href: cake.isComingSoonOnly ? null : `/cakes/${cake.slug}`,
        comingSoon: cake.isComingSoonOnly,
      }
    })
  return [
    {
      id: 'whole' as const,
      label: language === 'ko' ? '홀 케이크' : 'WHOLE CAKES',
      products: select(whole),
    },
    {
      id: 'sharing' as const,
      label: language === 'ko' ? '함께 나누는 케이크' : 'SHARING / CELEBRATION',
      products: select(sharing),
    },
    {
      id: 'chocolates' as const,
      label: language === 'ko' ? '초콜릿' : 'CHOCOLATES',
      products: getAuChocolateCollectionCards(language),
    },
  ]
}
export function getAuHomeBest(language: Language) {
  const products = getAuHomeCollections(language)[0].products
  return ['signature-gateau', 'pave', 'brownie-cheesecake'].map((id) =>
    products.find((product) => product.id === id)!,
  )
}
