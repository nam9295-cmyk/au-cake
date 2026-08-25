import {
  DEFAULT_CAKE_SIZE,
  DEFAULT_CHOCOLATE_TYPE,
  DEFAULT_CUPCAKE_FINISH,
  DEFAULT_POUND_ADDON,
  DEFAULT_VANILLA_CAKE_FLAVOR,
  DEFAULT_VANILLA_CAKE_POINT_COLOR,
  DEFAULT_VANILLA_CAKE_SHEET,
  getProductById,
  getReservationPrice,
  normalizeCakeSize,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinish,
  normalizeCupcakeFinishCounts,
  normalizePoundAddon,
  normalizeReservationChocolateType,
  normalizeVanillaCakeFlavor,
  normalizeVanillaCakePointColor,
  normalizeVanillaCakeSheet,
  isCakePointColorProduct,
  isCupcakeProduct,
} from './constants.js'
import {
  getAuCakeCatalogCards,
  getCakeCatalogEntryBySlug,
  type CakeCatalogId,
} from './cake-catalog.js'
import type { Language } from './i18n.js'
import { getPublicCakePage } from './public-content.js'
import {
  calculateIndividualPackagingFeeCents,
  getIndividualPackagingPieceCount,
  isIndividualPackagingEligibleProduct,
} from './individual-packaging.js'
import type {
  CakeSize,
  ChocolateType,
  CupcakeFinish,
  PoundAddon,
  ProductId,
  VanillaCakeFlavor,
  VanillaCakePointColor,
  VanillaCakeSheet,
} from './types.js'

export type CakeDetailImageKey =
  | 'pound-side'
  | 'pound-quick-view'
  | 'pound-previous'
  | 'pound-hero'
  | 'cupcake-side'
  | 'cupcake-detail'
  | 'cupcake-hero'
  | 'pave-side'
  | 'pave-quick-view'
  | 'pave-previous'
  | 'pave-hero'
  | 'pave-card'
  | 'pave-slice'
  | 'pave-slices'
  | 'cheesecake-hero'
  | 'cheesecake-side'
  | 'cheesecake-quick-view'
  | 'cheesecake-previous'
  | 'lemon-hero'
  | 'lemon-side'
  | 'lemon-quick-view'
  | 'lemon-previous'
  | 'vanilla-side'
  | 'vanilla-quick-view'
  | 'buttercream-side'
  | 'buttercream-detail'
  | 'buttercream-quick-view'
  | 'signature-gateau-side'
  | 'signature-gateau-detail'
  | 'signature-gateau-quick-view'
  | 'signature-gateau-previous'
  | 'signature-gateau-hero'
  | 'brownie-side'
  | 'brownie-detail'
  | 'brownie-quick-view'

export type CakeDetailSelection = {
  productId: ProductId
  cakeSize: CakeSize
  chocolateType: ChocolateType
  poundAddon: PoundAddon
  cupcakeFinish: CupcakeFinish
  chocolateIcingCount: number
  vanillaCreamCount: number
  partyDecorationCount: number
  vanillaCakeSheet: VanillaCakeSheet
  vanillaCakeFlavor: VanillaCakeFlavor
  vanillaCakePointColor?: VanillaCakePointColor
  individualPackaging: boolean
  quantity: number
}

export type CakeDetailData = {
  id: CakeCatalogId
  slug: string
  name: string
  description: string
  features: readonly string[]
  optionLabel: string
  priceLabel: string
  productIds: readonly ProductId[]
  defaultProductId: ProductId
  gallery: readonly CakeDetailImageKey[]
  isPhotoComingSoon: boolean
  isLegacy?: boolean
  legacyLinks?: readonly { slug: string; name: string }[]
  trustPoints: readonly string[]
  accordions: readonly { title: string; body: string }[]
}

const DETAIL_GALLERIES: Record<CakeCatalogId, readonly CakeDetailImageKey[]> = {
  'pound-cupcake': ['pound-side', 'pound-quick-view', 'pound-previous', 'pound-hero', 'cupcake-side', 'cupcake-hero'],
  pave: ['pave-side', 'pave-quick-view', 'pave-previous', 'pave-hero', 'pave-card', 'pave-slice', 'pave-slices'],
  cheesecake: ['cheesecake-side', 'cheesecake-quick-view', 'cheesecake-previous', 'cheesecake-hero'],
  'fresh-lemon-cupcakes': ['lemon-side', 'lemon-quick-view', 'lemon-previous', 'lemon-hero'],
  'vanilla-fresh-cream': ['vanilla-side', 'vanilla-quick-view'],
  buttercream: ['buttercream-side', 'buttercream-detail', 'buttercream-quick-view'],
  cupcake: ['cupcake-side', 'cupcake-detail', 'cupcake-hero'],
  'signature-gateau': ['signature-gateau-side', 'signature-gateau-detail', 'signature-gateau-quick-view', 'signature-gateau-previous', 'signature-gateau-hero'],
  'brownie-cheesecake': ['brownie-side', 'brownie-detail', 'brownie-quick-view'],
}

const LEGACY_CAKE_DETAILS = {
  'chocolate-pound-cake-and-cupcakes': {
    id: 'pound-cupcake' as const,
    links: {
      en: [
        { slug: 'signature-gateau-au-chocolat', name: 'Signature Gâteau au Chocolat' },
        { slug: 'chocolate-cupcakes', name: 'Chocolate Cupcakes' },
      ],
      ko: [
        { slug: 'signature-gateau-au-chocolat', name: '시그니처 갸또 쇼콜라' },
        { slug: 'chocolate-cupcakes', name: '초콜릿 컵케이크' },
      ],
    },
  },
  'chocolatiers-basque-cheesecake': {
    id: 'cheesecake' as const,
    links: {
      en: [{ slug: 'brownie-cheesecake', name: 'Brownie Cheesecake' }],
      ko: [{ slug: 'brownie-cheesecake', name: '브라우니 치즈케이크' }],
    },
  },
} as const

const DETAIL_OPERATION_COPY: Record<Language, {
  trustPoints: readonly string[]
  accordions: readonly { title: string; body: string }[]
}> = {
  en: {
    trustPoints: ['Chocolatier-grade couverture', 'Made to order', 'Melrose Park pick-up'],
    accordions: [
      {
        title: 'How ordering works',
        body: 'Choose your cake and options, then send a request. Our team checks availability before sending payment details.',
      },
      {
        title: 'Pick-up',
        body: 'Orders are collected by pre-arranged pick-up in Melrose Park, Sydney. This is not a walk-in shop.',
      },
      {
        title: 'Order confirmation',
        body: 'Submitting a request does not confirm the order. Your order is confirmed after availability is checked and payment is received.',
      },
    ],
  },
  ko: {
    trustPoints: ['쇼콜라티에용 커버춰 초콜릿', '주문 후 제작', 'Melrose Park 픽업'],
    accordions: [
      {
        title: '주문 방법',
        body: '케이크와 옵션을 선택해 요청을 보내면 베리굿 팀이 제작 가능 여부를 확인한 뒤 결제 정보를 안내합니다.',
      },
      {
        title: '픽업',
        body: 'Sydney Melrose Park에서 사전 약속 픽업으로 진행합니다. 방문 판매 매장은 아닙니다.',
      },
      {
        title: '주문 확정',
        body: '요청서를 보내는 것만으로 주문이 확정되지는 않습니다. 제작 가능 여부 확인과 결제가 끝난 뒤 최종 확정됩니다.',
      },
    ],
  },
}

function normalizeQuantity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(5, Math.max(1, Math.floor(value)))
}

export function getCakeDetailBySlug(slug: string, language: Language): CakeDetailData | null {
  const entry = getCakeCatalogEntryBySlug(slug)
  if (!entry) {
    const legacy = LEGACY_CAKE_DETAILS[slug as keyof typeof LEGACY_CAKE_DETAILS]
    const publicPage = getPublicCakePage(slug)
    if (!legacy || !publicPage) return null
    const isGroupedCollection = legacy.id === 'pound-cupcake'
    const operations = DETAIL_OPERATION_COPY[language]
    return {
      id: legacy.id,
      slug,
      name: language === 'ko'
        ? isGroupedCollection ? '초코 파운드케이크 & 컵케이크' : '쇼콜라티에 바스크 치즈케이크'
        : publicPage.name,
      description: language === 'ko'
        ? isGroupedCollection
          ? '이 상품은 두 개의 독립 상품으로 나뉘었습니다.'
          : '이 상품은 현재 케이크 카탈로그에서 판매하지 않습니다.'
        : publicPage.description,
      features: [],
      optionLabel: '',
      priceLabel: '',
      productIds: [],
      defaultProductId: isGroupedCollection ? 'pound-cake' : 'choco-basque-cheesecake',
      gallery: DETAIL_GALLERIES[legacy.id],
      isPhotoComingSoon: false,
      isLegacy: true,
      legacyLinks: legacy.links[language],
      trustPoints: operations.trustPoints,
      accordions: operations.accordions,
    }
  }
  const card = getAuCakeCatalogCards(language).find((candidate) => candidate.slug === slug)
  if (!card) return null
  const operations = DETAIL_OPERATION_COPY[language]

  return {
    id: entry.id,
    slug: entry.slug,
    name: card.name,
    description: card.description,
    features: card.features,
    optionLabel: card.optionLabel,
    priceLabel: card.priceLabel,
    productIds: entry.productIds,
    defaultProductId: entry.defaultProductId,
    gallery: DETAIL_GALLERIES[entry.id],
    isPhotoComingSoon: entry.isPhotoComingSoon,
    trustPoints: card.features.slice(0, 3),
    accordions: operations.accordions,
  }
}

export function createCakeDetailSelection(slug: string): CakeDetailSelection | null {
  const entry = getCakeCatalogEntryBySlug(slug)
  if (!entry) return null
  return selectCakeDetailProduct({
    productId: entry.defaultProductId,
    cakeSize: DEFAULT_CAKE_SIZE,
    chocolateType: DEFAULT_CHOCOLATE_TYPE,
    poundAddon: DEFAULT_POUND_ADDON,
    cupcakeFinish: DEFAULT_CUPCAKE_FINISH,
    chocolateIcingCount: 0,
    vanillaCreamCount: 0,
    partyDecorationCount: 0,
    vanillaCakeSheet: DEFAULT_VANILLA_CAKE_SHEET,
    vanillaCakeFlavor: DEFAULT_VANILLA_CAKE_FLAVOR,
    vanillaCakePointColor: DEFAULT_VANILLA_CAKE_POINT_COLOR,
    individualPackaging: false,
    quantity: 1,
  }, entry.defaultProductId)
}

export function selectCakeDetailProduct(
  selection: CakeDetailSelection,
  productId: ProductId,
): CakeDetailSelection {
  const product = getProductById(productId)
  const poundAddon = normalizePoundAddon(product.id, selection.poundAddon)
  const cupcakeCounts = normalizeCupcakeFinishCounts(
    product.id,
    selection.vanillaCreamCount,
    selection.partyDecorationCount,
  )

  return {
    productId: product.id,
    cakeSize: normalizeCakeSize(product.id, selection.cakeSize),
    poundAddon,
    chocolateType: normalizeReservationChocolateType(product.id, selection.chocolateType, poundAddon),
    chocolateIcingCount: normalizeChocolateIcingCount(product.id, selection.chocolateIcingCount),
    ...(isCupcakeProduct(product.id)
      ? { vanillaCreamCount: 0, partyDecorationCount: 0 }
      : cupcakeCounts),
    cupcakeFinish: normalizeCupcakeFinish(product.id, selection.cupcakeFinish),
    vanillaCakeSheet: normalizeVanillaCakeSheet(product.id, selection.vanillaCakeSheet),
    vanillaCakeFlavor: normalizeVanillaCakeFlavor(product.id, selection.vanillaCakeFlavor),
    ...(isCakePointColorProduct(product.id)
      ? { vanillaCakePointColor: normalizeVanillaCakePointColor(product.id, selection.vanillaCakePointColor) }
      : {}),
    individualPackaging: isIndividualPackagingEligibleProduct(product.id) && selection.individualPackaging === true,
    quantity: normalizeQuantity(selection.quantity),
  }
}

export function getCakeDetailSelectionTotal(selection: CakeDetailSelection) {
  return getReservationPrice(selection.productId, {
    cakeSize: selection.cakeSize,
    chocolateType: selection.chocolateType,
    poundAddon: selection.poundAddon,
    cupcakeFinish: selection.cupcakeFinish,
    chocolateIcingCount: selection.chocolateIcingCount,
    vanillaCreamCount: selection.vanillaCreamCount,
    partyDecorationCount: selection.partyDecorationCount,
  }, normalizeQuantity(selection.quantity))
}

export function getCakeDetailSelectionEstimatedTotal(selection: CakeDetailSelection) {
  const productTotal = getCakeDetailSelectionTotal(selection)
  if (!selection.individualPackaging) return productTotal
  const pieces = getIndividualPackagingPieceCount(selection.productId, normalizeQuantity(selection.quantity))
  return productTotal + calculateIndividualPackagingFeeCents(pieces, Math.round(productTotal * 100)) / 100
}
