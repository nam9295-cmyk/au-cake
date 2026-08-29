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
  | 'fresh-strawberry-vanilla-cream'
  | 'fresh-strawberry-chocolate-cream'
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
  | 'fresh-strawberry-vanilla-cream-cake'
  | 'fresh-strawberry-chocolate-cream-cake'
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
  group: 'whole-cakes' | 'more-cakes'
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
  group: CakeCatalogEntry['group']
  slug: string
  productId: ProductId
  imageKey: CakeCatalogImageKey
  imagePath: string
  isPhotoComingSoon: boolean
  priceLabel: string
}

export type CakeCatalogGroupId =
  | 'signature-gateau'
  | 'gateau-daily'
  | 'fresh-cream-cakes'
  | 'tea-time-refresh'

type LocalizedCatalogGroupCopy = {
  title: string
  description: string
}

type CakeCatalogGroupDefinition = {
  id: CakeCatalogGroupId
  number: string
  copy: Record<Language, LocalizedCatalogGroupCopy>
  catalogIds: readonly CakeCatalogId[]
}

export type CakeCatalogGroup = LocalizedCatalogGroupCopy & {
  id: CakeCatalogGroupId
  number: string
  catalogIds: readonly CakeCatalogId[]
  cards: readonly CakeCatalogCard[]
}

const AU_CAKE_CATALOG: readonly CakeCatalogEntry[] = [
  {
    id: 'pave',
    slug: 'pave-chocolate-cake',
    group: 'whole-cakes',
    defaultProductId: 'pave-cake',
    productIds: ['pave-cake'],
    imageKey: 'pave-cake',
    isPhotoComingSoon: false,
    priceMode: 'fixed',
  },
  {
    id: 'buttercream',
    slug: 'buttercream-cake',
    group: 'whole-cakes',
    defaultProductId: 'buttercream-cake',
    productIds: ['buttercream-cake'],
    imageKey: 'buttercream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'fresh-strawberry-vanilla-cream',
    slug: 'fresh-strawberry-vanilla-cream-cake',
    group: 'whole-cakes',
    defaultProductId: 'fresh-strawberry-vanilla-cream-cake',
    productIds: ['fresh-strawberry-vanilla-cream-cake'],
    imageKey: 'fresh-strawberry-vanilla-cream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'fresh-strawberry-chocolate-cream',
    slug: 'fresh-strawberry-chocolate-cream-cake',
    group: 'whole-cakes',
    defaultProductId: 'fresh-strawberry-chocolate-cream-cake',
    productIds: ['fresh-strawberry-chocolate-cream-cake'],
    imageKey: 'fresh-strawberry-chocolate-cream-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'cupcake',
    slug: 'chocolate-cupcakes',
    group: 'more-cakes',
    defaultProductId: 'cupcake-dozen',
    productIds: ['cupcake-half-dozen', 'cupcake-dozen'],
    imageKey: 'chocolate-cupcakes',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
  {
    id: 'signature-gateau',
    slug: 'signature-gateau-au-chocolat',
    group: 'more-cakes',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake'],
    imageKey: 'signature-gateau-au-chocolat',
    isPhotoComingSoon: false,
    priceMode: 'fixed',
  },
  {
    id: 'fresh-lemon-cupcakes',
    slug: 'lemon-cake',
    group: 'more-cakes',
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
    group: 'more-cakes',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake'],
    imageKey: 'brownie-cheesecake',
    isPhotoComingSoon: false,
    priceMode: 'from',
  },
]

const AU_CAKE_CATALOG_GROUPS: readonly CakeCatalogGroupDefinition[] = [
  {
    id: 'signature-gateau',
    number: '01',
    copy: {
      en: {
        title: 'SIGNATURE GÂTEAU',
        description: 'Rich chocolate cakes built on our signature gâteau layers.',
      },
      ko: {
        title: '시그니처 갸또',
        description: '진하고 밀도감 있는 시그니처 갸또 쇼콜라 시트로 완성한 케이크.',
      },
    },
    catalogIds: ['pave', 'buttercream'],
  },
  {
    id: 'gateau-daily',
    number: '02',
    copy: {
      en: {
        title: 'GÂTEAU DAILY',
        description: 'Everyday chocolate cakes made for easy sharing and simple moments.',
      },
      ko: {
        title: '갸또 데일리',
        description: '매일 부담 없이 즐기고 나누기 좋은 초콜릿 케이크.',
      },
    },
    catalogIds: ['signature-gateau', 'cupcake'],
  },
  {
    id: 'fresh-cream-cakes',
    number: '03',
    copy: {
      en: {
        title: 'FRESH CREAM CAKES',
        description: 'Soft genoise layers with fresh cream and fresh strawberries.',
      },
      ko: {
        title: '프레시 생크림 케이크',
        description: '부드러운 제누아즈 시트에 생크림과 생딸기를 더한 케이크.',
      },
    },
    catalogIds: ['fresh-strawberry-vanilla-cream', 'fresh-strawberry-chocolate-cream'],
  },
  {
    id: 'tea-time-refresh',
    number: '04',
    copy: {
      en: {
        title: 'TEA TIME & REFRESH',
        description: 'Easy treats for sharing, gifting and afternoon tea.',
      },
      ko: {
        title: '티타임 & 리프레시',
        description: '티타임과 가벼운 디저트 시간에 함께하기 좋은 케이크.',
      },
    },
    catalogIds: ['fresh-lemon-cupcakes', 'brownie-cheesecake'],
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
    group: entry.group,
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

export function getAuCakeCatalogGroups(language: Language): readonly CakeCatalogGroup[] {
  if (marketConfig.market !== 'AU') return []

  const cardsById = new Map(getAuCakeCatalogCards(language).map((card) => [card.id, card]))

  return AU_CAKE_CATALOG_GROUPS.map((group) => ({
    id: group.id,
    number: group.number,
    catalogIds: group.catalogIds,
    ...group.copy[language],
    cards: group.catalogIds.map((catalogId) => {
      const card = cardsById.get(catalogId)
      if (!card) throw new Error(`Missing AU cake catalogue card: ${catalogId}`)
      return card
    }),
  }))
}

const AU_HOME_HERO_PRIORITY: readonly CakeCatalogId[] = [
  'fresh-strawberry-vanilla-cream',
  'fresh-strawberry-chocolate-cream',
  'pave',
  'brownie-cheesecake',
]

export function getAuHomeHeroCards(language: Language): readonly CakeCatalogCard[] {
  const priority = new Map(AU_HOME_HERO_PRIORITY.map((id, index) => [id, index]))
  return [...getAuCakeCatalogCards(language)].sort(
    (left, right) => (priority.get(left.id) ?? AU_HOME_HERO_PRIORITY.length) - (priority.get(right.id) ?? AU_HOME_HERO_PRIORITY.length),
  )
}

export function getCakeCatalogUnitPrice(productId: ProductId, options: ReservationPriceOptions = {}) {
  const entry = getCakeCatalogEntryByProductId(productId)
  if (!entry) return null
  return getReservationUnitPrice(productId, options)
}
