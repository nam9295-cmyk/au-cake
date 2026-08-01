import { getProductById, getReservationUnitPrice, type ReservationPriceOptions } from './constants.js'
import { getProductFeatures, getProductText, type Language } from './i18n.js'
import { marketConfig } from './market.js'
import { formatCurrency } from './utils.js'
import type { ProductId } from './types.js'

export type CakeCatalogId =
  | 'pound-cupcake'
  | 'pave'
  | 'cheesecake'
  | 'fresh-lemon-cupcakes'
  | 'vanilla-fresh-cream'

export type CakeCatalogImageKey =
  | 'pound-cake'
  | 'pave-cake'
  | 'basque-cheesecake'
  | 'lemon-cake'
  | 'vanilla-fresh-cream-cake'

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
  isPhotoComingSoon: boolean
  priceLabel: string
}

const AU_CAKE_CATALOG: readonly CakeCatalogEntry[] = [
  {
    id: 'pound-cupcake',
    slug: 'chocolate-pound-cake-and-cupcakes',
    defaultProductId: 'pound-cake',
    productIds: ['pound-cake', 'cupcake-dozen'],
    imageKey: 'pound-cake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
    copy: {
      en: {
        name: 'Chocolate Pound Cake & Cupcakes',
        description: 'Choose the pound cake, or make it a dozen cupcakes for AUD 10 more.',
        features: ['Chocolate Pound Cake · AUD 45', 'Chocolate Cupcakes · 1 dozen · AUD 55', 'Keep your choice of finish'],
        optionLabel: 'Choose pound or cupcakes, then a finish',
      },
      ko: {
        name: '초코 파운드케이크 & 컵케이크',
        description: '파운드케이크를 기본으로 선택하고 10달러를 추가하면 컵케이크 1다스로 변경할 수 있어요.',
        features: ['파운드케이크 AUD 45', '컵케이크 1다스 +AUD 10', '기존 마감 옵션 선택 가능'],
        optionLabel: '파운드 / 컵케이크와 마감 선택',
      },
    },
  },
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
    id: 'cheesecake',
    slug: 'chocolatiers-basque-cheesecake',
    defaultProductId: 'choco-basque-cheesecake',
    productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'],
    imageKey: 'basque-cheesecake',
    isPhotoComingSoon: false,
    priceMode: 'from',
    priceDisplay: 'whole-aud',
    copy: {
      en: {
        name: "Chocolatier's Basque Cheesecake",
        description: 'Choose classic, pave chocolate on top, or a full pave chocolate finish with one Eiffel Tower chocolate.',
        features: ['Gluten-free', '6" | serves 8', 'Classic AUD 55', 'Pave chocolate on top +AUD 10', 'Eiffel Tower finish +AUD 20'],
        optionLabel: 'Three finishing options',
      },
      ko: {
        name: '쇼콜라티에 바스크 치즈케이크',
        description: '기본, 파베 초콜릿 on top, 에펠탑 초콜릿 마감 중에서 선택할 수 있는 6" | serves 8 치즈케이크예요.',
        features: ['글루텐 프리', '6" | serves 8', '기본 AUD 55', '파베 on top +AUD 10', '에펠탑 마감 +AUD 20'],
        optionLabel: '세 가지 마감 선택',
      },
    },
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
    id: 'vanilla-fresh-cream',
    slug: 'vanilla-fresh-cream-cake',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
    imageKey: 'vanilla-fresh-cream-cake',
    isPhotoComingSoon: true,
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
  const copy = entry.copy?.[language] || {
    name: productText.name,
    description: productText.description,
    features: getProductFeatures(entry.defaultProductId, language),
    optionLabel: productText.priceNote,
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
