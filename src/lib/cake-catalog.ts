import { getProductById, getReservationUnitPrice, type ReservationPriceOptions } from './constants.js'
import { getProductFeatures, getProductText, type Language } from './i18n.js'
import { marketConfig } from './market.js'
import { getPublicCakePage } from './public-content.js'
import { formatCurrency } from './utils.js'
import type { ProductId } from './types.js'

export type CakeCatalogId =
  | 'pave'
  | 'vanilla-fresh-cream'
  | 'buttercream'
  | 'cupcake'
  | 'signature-gateau'
  | 'fresh-lemon-cupcakes'
  | 'brownie-cheesecake'
  // Retained only by the Korean catalogue and AU legacy route views.
  | 'pound-cupcake'
  | 'cheesecake'

export type CakeCatalogImageKey =
  | 'pave-cake'
  | 'vanilla-fresh-cream-cake'
  | 'buttercream-cake'
  | 'chocolate-cupcakes'
  | 'signature-gateau-au-chocolat'
  | 'lemon-cake'
  | 'brownie-cheesecake'
  // Legacy image keys are deliberately kept so historic route views remain typed.
  | 'pound-cake'
  | 'basque-cheesecake'

type LocalizedCatalogCopy = {
  name: string
  description: string
  features: readonly string[]
  optionLabel: string
}

type LocalizedCopyMap = Record<Language, LocalizedCatalogCopy>

export type CakeCatalogEntry = {
  id: CakeCatalogId
  slug: string
  defaultProductId: ProductId
  productIds: readonly ProductId[]
  imageKey: CakeCatalogImageKey
  isPhotoComingSoon: boolean
  priceMode: 'fixed' | 'from'
  priceDisplay: 'currency' | 'whole-aud'
  copy?: LocalizedCopyMap
}

export type CakeCatalogCard = LocalizedCatalogCopy & {
  id: CakeCatalogId
  slug: string
  productId: ProductId
  imageKey: CakeCatalogImageKey
  imagePath: string
  isPhotoComingSoon: boolean
  priceLabel: string
}

const AU_CAKE_CATALOG: readonly CakeCatalogEntry[] = [
  {
    id: 'pave',
    slug: 'pave-chocolate-cake',
    defaultProductId: 'pave-cake',
    productIds: ['pave-cake'],
    imageKey: 'pave-cake',
    isPhotoComingSoon: false,
    priceMode: 'fixed',
    priceDisplay: 'currency',
  },
  {
    id: 'vanilla-fresh-cream',
    slug: 'vanilla-fresh-cream-cake',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
    imageKey: 'vanilla-fresh-cream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
  },
  {
    id: 'buttercream',
    slug: 'buttercream-cake',
    defaultProductId: 'buttercream-cake',
    productIds: ['buttercream-cake'],
    imageKey: 'buttercream-cake',
    isPhotoComingSoon: true,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
  },
  {
    id: 'cupcake',
    slug: 'chocolate-cupcakes',
    defaultProductId: 'cupcake-dozen',
    productIds: ['cupcake-half-dozen', 'cupcake-dozen'],
    imageKey: 'chocolate-cupcakes',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
  },
  {
    id: 'signature-gateau',
    slug: 'signature-gateau-au-chocolat',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake'],
    imageKey: 'signature-gateau-au-chocolat',
    isPhotoComingSoon: false,
    priceMode: 'fixed',
    priceDisplay: 'currency',
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
    imageKey: 'lemon-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
    copy: {
      en: {
        name: 'Lemon Cake',
        description: 'Lemon-shaped cakes filled with fresh lemon cream and finished with a floral decoration.',
        features: ['Boxes of 6, 8, 12 or 16', '12 pieces · Most Popular', 'Choose basic or special finishing'],
        optionLabel: 'Choose a pack size',
      },
      ko: {
        name: '레몬 케이크',
        description: '레몬 모양 케이크에 상큼한 레몬 크림을 채우고 꽃무늬 장식으로 마무리해요.',
        features: ['6, 8, 12, 16개 구성', '12개 · Most Popular', '기본 또는 스페셜 마감 선택'],
        optionLabel: '구성 수량만 선택',
      },
    },
  },
  {
    id: 'brownie-cheesecake',
    slug: 'brownie-cheesecake',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'],
    imageKey: 'brownie-cheesecake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
  },
]

export function getAuCakeCatalog(): readonly CakeCatalogEntry[] {
  return marketConfig.market === 'AU' ? AU_CAKE_CATALOG : []
}

export function getCakeCatalogEntryBySlug(slug: string) {
  return getAuCakeCatalog().find((entry) => entry.slug === slug) || null
}

export function getCakeCatalogEntryByProductId(productId: ProductId) {
  return getAuCakeCatalog().find((entry) => entry.productIds.includes(productId)) || null
}

export function getCakeCatalogStartingPrice(entry: CakeCatalogEntry) {
  return Math.min(...entry.productIds.map((productId) => getProductById(productId).price))
}

function getCakeCatalogCard(entry: CakeCatalogEntry, language: Language): CakeCatalogCard {
  const productText = getProductText(entry.defaultProductId, language)
  const publicPage = getPublicCakePage(entry.slug)
  const localizedCopy = entry.copy?.[language] || {
    name: productText.name,
    description: productText.description,
    features: getProductFeatures(entry.defaultProductId, language),
    optionLabel: productText.priceNote,
  }
  const copy = language === 'en' && publicPage
    ? {
        ...localizedCopy,
        name: publicPage.name,
        description: publicPage.description,
        optionLabel: publicPage.cardOptionLabel,
      }
    : localizedCopy
  const imagePath = publicPage?.imagePath || ''

  if (!entry.isPhotoComingSoon && !imagePath) {
    throw new Error('Missing public cake image: ' + entry.slug)
  }
  const startingPrice = getCakeCatalogStartingPrice(entry)
  const price = entry.priceDisplay === 'whole-aud' ? `AUD ${startingPrice}` : formatCurrency(startingPrice)
  const priceLabel = entry.priceMode === 'fixed'
    ? price
    : language === 'ko' ? `${price}부터` : `From ${price}`

  return {
    id: entry.id,
    slug: entry.slug,
    productId: entry.defaultProductId,
    imageKey: entry.imageKey,
    imagePath,
    isPhotoComingSoon: entry.isPhotoComingSoon,
    priceLabel,
    ...copy,
  }
}

export function getAuCakeCatalogCards(language: Language): readonly CakeCatalogCard[] {
  return getAuCakeCatalog().map((entry) => getCakeCatalogCard(entry, language))
}

export function getCakeCatalogUnitPrice(productId: ProductId, options: ReservationPriceOptions = {}) {
  const entry = getCakeCatalogEntryByProductId(productId)
  if (!entry) return null
  return getReservationUnitPrice(productId, options)
}
