import { getProductById, getReservationUnitPrice, type ReservationPriceOptions } from './constants.js'
import { getProductFeatures, getProductText, type Language } from './i18n.js'
import { marketConfig } from './market.js'
import { getPublicCakePage } from './public-content.js'
import { formatCurrency } from './utils.js'
import type { ProductId } from './types.js'

export type CakeCatalogId =
  | 'pave'
  | 'signature-gateau'
  | 'cupcake'
  | 'bento-cake'
  | 'fresh-strawberry-vanilla-cream'
  | 'brownie-cheesecake'
  | 'fresh-lemon-cupcakes'
  | 'smore-stick'
  // Retained only by the Korean catalogue and AU legacy route views.
  | 'buttercream'
  | 'fresh-strawberry-chocolate-cream'
  | 'vanilla-fresh-cream'
  | 'pound-cupcake'
  | 'cheesecake'

export type CakeCatalogImageKey =
  | 'pave-cake'
  | 'signature-gateau-au-chocolat'
  | 'chocolate-cupcakes'
  | 'bento-cake'
  | 'fresh-strawberry-vanilla-cream-cake'
  | 'brownie-cheesecake'
  | 'lemon-cake'
  | 'smore-stick'
  // Legacy image keys are deliberately kept so historic route views remain typed.
  | 'buttercream-cake'
  | 'fresh-strawberry-chocolate-cream-cake'
  | 'vanilla-fresh-cream-cake'
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
  defaultProductId?: ProductId
  productIds: readonly ProductId[]
  imageKey: CakeCatalogImageKey
  isPhotoComingSoon: boolean
  isComingSoonOnly?: boolean
  priceMode: 'fixed' | 'from' | 'none'
  copy?: LocalizedCopyMap
}

export type CakeCatalogCard = LocalizedCatalogCopy & {
  id: CakeCatalogId
  group: CakeCatalogEntry['group']
  slug: string
  productId?: ProductId
  imageKey: CakeCatalogImageKey
  imagePath: string
  isPhotoComingSoon: boolean
  isComingSoonOnly?: boolean
  priceLabel: string
}

export type CakeCatalogGroupId =
  | 'signature-gateau'
  | 'gateau-sharing'
  | 'chocolatiers-cake'
  | 'gather-celebrate'

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

const AU_CATALOG_DISPLAY_NAMES: Partial<Record<CakeCatalogId, string>> = {
  pave: 'PAVÉ CHOCOLATE GÂTEAU',
  'signature-gateau': 'SIGNATURE GÂTEAU LOAF (POUND)',
  cupcake: 'GÂTEAU CUPCAKES (FOR SHARING)',
  'bento-cake': 'BENTO CAKE',
  'fresh-strawberry-vanilla-cream': 'VANILLA FRESH CREAM CAKE',
  'brownie-cheesecake': 'Chocolatier’s BROWNIE CHEESECAKE',
  'fresh-lemon-cupcakes': 'Patissier’s LEMON GLAZE CAKE',
  'smore-stick': 'S’MORE STICK',
  buttercream: 'BUTTERCREAM CHOCOLATE GÂTEAU',
  'fresh-strawberry-chocolate-cream': 'STRAWBERRY CHOCO FRESH CREAM',
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
    id: 'bento-cake',
    slug: 'bento-cake',
    group: 'more-cakes',
    defaultProductId: undefined,
    productIds: [],
    imageKey: 'bento-cake',
    isPhotoComingSoon: false,
    isComingSoonOnly: true,
    priceMode: 'none',
    copy: {
      en: {
        name: 'BENTO CAKE',
        description: 'A petite lunchbox-sized celebration cake for intimate moments. Coming soon.',
        features: ['Petite celebration size', 'Coming soon'],
        optionLabel: 'Coming soon',
      },
      ko: {
        name: '도시락 케이크',
        description: '작고 소중한 순간을 위한 런치박스 사이즈 케이크. 준비 중입니다.',
        features: ['미니 사이즈 케이크', '출시 준비 중'],
        optionLabel: '출시 준비 중',
      },
    },
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
    id: 'brownie-cheesecake',
    slug: 'brownie-cheesecake',
    group: 'more-cakes',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake'],
    imageKey: 'brownie-cheesecake',
    isPhotoComingSoon: false,
    priceMode: 'from',
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
    id: 'smore-stick',
    slug: 'smore-stick',
    group: 'more-cakes',
    defaultProductId: 'smore-stick',
    productIds: ['smore-stick'],
    imageKey: 'smore-stick',
    isPhotoComingSoon: false,
    priceMode: 'from',
    copy: {
      en: {
        name: 'S’more Stick',
        description: 'Fluffy marshmallows toasted on a stick and coated in rich couverture chocolate. Designed for gatherings and bulk sharing with automatic discounts from 6 sticks.',
        features: [
          'Toasted marshmallow on stick',
          'Rich couverture chocolate coating',
          'AUD 4.50 / stick',
          '6–11 sticks: 10% off',
          '12+ sticks: 20% bulk discount',
        ],
        optionLabel: 'Bulk discounts from 6+ sticks',
      },
      ko: {
        name: '스모어 스틱',
        description: '스틱에 꽂은 푹신한 마시멜로에 진한 커버춰 초콜릿을 더한 디저트. 모임과 파티용 대량 주문에 적합합니다.',
        features: [
          '스틱 마시멜로 디저트',
          '리얼 커버춰 초콜릿 코팅',
          '개당 AUD 4.50',
          '6~11개 10% 할인',
          '12개 이상 20% 대량 할인',
        ],
        optionLabel: '6개 이상 수량 할인',
      },
    },
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
    catalogIds: ['pave', 'signature-gateau'],
  },
  {
    id: 'gateau-sharing',
    number: '02',
    copy: {
      en: {
        title: 'GÂTEAU SHARING',
        description: 'Chocolate gâteau creations crafted for gatherings and shared celebration.',
      },
      ko: {
        title: '갸또 셰어링',
        description: '여럿이 함께 나누기 좋은 갸또 디저트와 케이크.',
      },
    },
    catalogIds: ['cupcake', 'bento-cake'],
  },
  {
    id: 'chocolatiers-cake',
    number: '03',
    copy: {
      en: {
        title: 'CHOCOLATIER’S CAKE',
        description: 'Classic artisanal cakes crafted with fresh cream and rich chocolate balance.',
      },
      ko: {
        title: '쇼콜라티에 케이크',
        description: '신선한 생크림과 진한 초콜릿의 조화로 완성한 케이크.',
      },
    },
    catalogIds: ['fresh-strawberry-vanilla-cream', 'brownie-cheesecake'],
  },
  {
    id: 'gather-celebrate',
    number: '04',
    copy: {
      en: {
        title: 'GATHER & CELEBRATE',
        description: 'Refreshing citrus cakes and crowd-pleasing sweets for parties and group orders.',
      },
      ko: {
        title: '개더 & 셀레브레이트',
        description: '파티와 단체 모임, 특별한 날에 함께하기 좋은 디저트.',
      },
    },
    catalogIds: ['fresh-lemon-cupcakes', 'smore-stick'],
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
  if (!entry.productIds || entry.productIds.length === 0) return 0
  return Math.min(...entry.productIds.map((productId) => getProductById(productId).price))
}

function getCakeCatalogCard(entry: CakeCatalogEntry, language: Language): CakeCatalogCard {
  const publicPage = getPublicCakePage(entry.slug)
  const productText = entry.defaultProductId ? getProductText(entry.defaultProductId, language) : null
  const localizedCopy = entry.copy?.[language] || {
    name: productText?.name || '',
    description: productText?.description || '',
    features: entry.defaultProductId ? getProductFeatures(entry.defaultProductId, language) : [],
    optionLabel: productText?.priceNote || '',
  }
  const copy = language === 'en' && publicPage
    ? {
        ...localizedCopy,
        name: publicPage.name,
        description: publicPage.description,
        optionLabel: publicPage.cardOptionLabel,
      }
    : localizedCopy
  const imagePath = publicPage?.imagePath || (entry.slug === 'bento-cake' ? '/products/bento-cake-sydney.webp' : '')

  if (!entry.isPhotoComingSoon && !imagePath) {
    throw new Error('Missing public cake image: ' + entry.slug)
  }

  let priceLabel = 'COMING SOON'
  if (entry.priceMode === 'fixed') {
    priceLabel = formatCurrency(getCakeCatalogStartingPrice(entry))
  } else if (entry.priceMode === 'from') {
    const startingPrice = getCakeCatalogStartingPrice(entry)
    const price = formatCurrency(startingPrice)
    priceLabel = language === 'ko' ? `${price}부터` : `From ${price}`
  } else if (entry.isComingSoonOnly) {
    priceLabel = 'COMING SOON'
  }

  return {
    group: entry.group,
    id: entry.id,
    slug: entry.slug,
    productId: entry.defaultProductId,
    imageKey: entry.imageKey,
    imagePath,
    isPhotoComingSoon: entry.isPhotoComingSoon,
    isComingSoonOnly: entry.isComingSoonOnly,
    priceLabel,
    ...copy,
    name: language === 'en' ? AU_CATALOG_DISPLAY_NAMES[entry.id] || copy.name : copy.name,
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
  'pave',
  'brownie-cheesecake',
  'signature-gateau',
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
