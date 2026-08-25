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
  },
  {
    id: 'vanilla-fresh-cream',
    slug: 'vanilla-fresh-cream-cake',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
    imageKey: 'vanilla-fresh-cream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'buttercream',
    slug: 'buttercream-cake',
    defaultProductId: 'buttercream-cake',
    productIds: ['buttercream-cake'],
    imageKey: 'buttercream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'cupcake',
    slug: 'chocolate-cupcakes',
    defaultProductId: 'cupcake-dozen',
    productIds: ['cupcake-half-dozen', 'cupcake-dozen'],
    imageKey: 'chocolate-cupcakes',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'signature-gateau',
    slug: 'signature-gateau-au-chocolat',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake'],
    imageKey: 'signature-gateau-au-chocolat',
    isPhotoComingSoon: false,
    priceMode: 'fixed',
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
    imageKey: 'lemon-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    copy: {
      en: {
        name: 'Lemon Cake',
        description: 'Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.',
        features: ['Freshly squeezed lemon juice', 'Fresh lemon zest', 'Lemon syrup & glaze', 'Floral decoration', 'Boxes of 6, 8, 12 or 16'],
        optionLabel: 'Choose a pack size',
      },
      ko: {
        name: '레몬 케이크',
        description: '생 레몬즙을 직접 짜고 신선한 레몬 제스트를 더해 케이크 반죽부터 레몬 시럽, 글레이즈까지 완성합니다. 레몬의 산뜻한 풍미를 단계마다 담아낸 작은 레몬 케이크입니다.',
        features: ['신선한 레몬즙을 직접 짜서 제조', '신선한 레몬 제스트', '레몬 시럽과 글레이즈', '꽃 장식', '6개·8개·12개·16개 구성'],
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
  const price = formatCurrency(startingPrice)
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
