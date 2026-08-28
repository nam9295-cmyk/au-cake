import { marketConfig, PAYMENT_STATUSES, RESERVATION_STATUSES } from './market.js'
import type { CacaoPercent, CakeSize, ChocolateType, CupcakeFinish, PoundAddon, ProductId, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet } from './types.js'

export const PRODUCT_NAME = marketConfig.copy.productName

export const DEFAULT_PRODUCT_ID: ProductId = 'pave-cake'
export const DEFAULT_CAKE_SIZE: CakeSize = '15cm'
export const DEFAULT_CHOCOLATE_TYPE: ChocolateType = 'dark'
export const DEFAULT_POUND_ADDON: PoundAddon = 'none'
export const DEFAULT_CUPCAKE_FINISH: CupcakeFinish = 'basic'
export const DEFAULT_VANILLA_CAKE_SHEET: VanillaCakeSheet = 'vanilla'
export const VANILLA_FRESH_CREAM_CAKE_SHEET: VanillaCakeSheet = 'chocolate'
export const DEFAULT_VANILLA_CAKE_FLAVOR: VanillaCakeFlavor = 'plain'
export const DEFAULT_VANILLA_CAKE_POINT_COLOR: VanillaCakePointColor = 'pink'
export const MAX_RESERVATION_QUANTITY = 5
export const PROMO_CODE = 'chocolate'
export const LEMON_PROMO_CODE = 'lemoni'
export const PROMO_DISCOUNT_RATE = 0.1
export const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'
export const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'
export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50
export const CUPCAKE_PACK_SIZE = 12
export const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50
export const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100

const CUPCAKE_PRODUCT_IDS: ProductId[] = ['cupcake-half-dozen', 'cupcake-dozen']
const CUPCAKE_PACK_SIZES: Partial<Record<ProductId, 6 | 12>> = {
  'cupcake-half-dozen': 6,
  'cupcake-dozen': 12,
}
const CUPCAKE_FINISH_PRICES: Partial<Record<ProductId, Record<CupcakeFinish, number>>> = {
  'cupcake-half-dozen': {
    basic: 31,
    'vanilla-fresh-cream': 36,
    'chocolate-buttercream': 41,
  },
  'cupcake-dozen': {
    basic: 55,
    'vanilla-fresh-cream': 64,
    'chocolate-buttercream': 73,
  },
}

export const CUPCAKE_FINISH_OPTIONS: Array<{ value: CupcakeFinish; label: string; labelKo: string }> = [
  { value: 'basic', label: 'Basic', labelKo: '기본' },
  { value: 'vanilla-fresh-cream', label: 'Vanilla Fresh Cream', labelKo: '바닐라 생크림' },
  { value: 'chocolate-buttercream', label: 'Chocolate Buttercream', labelKo: '초콜릿 버터크림' },
]

const CHEESECAKE_PROMO_PRODUCT_IDS: ProductId[] = [
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
]
const BROWNIE_CHEESECAKE_PRODUCT_IDS: ProductId[] = [
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
  'eiffel-tower-brownie-cheesecake',
]
const LEMON_PROMO_PRODUCT_IDS: ProductId[] = [
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
]

const PROMOTIONS = [
  { code: PROMO_CODE, expiresOn: CHOCOLATE_PROMO_EXPIRES_ON, productIds: CHEESECAKE_PROMO_PRODUCT_IDS },
  { code: LEMON_PROMO_CODE, expiresOn: LEMONI_PROMO_EXPIRES_ON, productIds: LEMON_PROMO_PRODUCT_IDS },
]

function sydneyDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function toCurrencyCents(value: number) {
  return Math.round(Number(value || 0) * 100)
}

export function fromCurrencyCents(cents?: number | null) {
  const value = Number(cents || 0)
  if (!Number.isFinite(value)) return 0
  return value / 100
}

export function isPromoEligibleProduct(productId: ProductId) {
  return PROMOTIONS.some((promo) => promo.productIds.includes(productId))
}

export function isCheesecakeProduct(productId: ProductId) {
  return CHEESECAKE_PROMO_PRODUCT_IDS.includes(productId) || BROWNIE_CHEESECAKE_PRODUCT_IDS.includes(productId)
}

export function getValidPromoCode(productId: ProductId, code?: string, now = new Date()) {
  const normalizedCode = code?.trim().toLowerCase()
  if (!normalizedCode) return null
  const promo = PROMOTIONS.find((candidate) => candidate.code === normalizedCode && candidate.productIds.includes(productId))
  if (!promo || sydneyDateValue(now) > promo.expiresOn) return null
  return promo.code
}

export function isValidPromoCode(productId: ProductId, code?: string, now = new Date()) {
  return getValidPromoCode(productId, code, now) !== null
}

export function applyPromoDiscount(total: number, productId: ProductId, code?: string, now = new Date()) {
  if (!isValidPromoCode(productId, code, now)) return total
  const discountedCents = Math.round(toCurrencyCents(total) * (1 - PROMO_DISCOUNT_RATE))
  return fromCurrencyCents(Math.max(0, discountedCents))
}

export const PRODUCTS = marketConfig.products

export type ProductGroupId =
  | 'vanilla-fresh-cream'
  | 'pave'
  | 'buttercream'
  | 'fresh-strawberry-vanilla-cream'
  | 'fresh-strawberry-chocolate-cream'
  | 'cupcake'
  | 'signature-gateau'
  | 'fresh-lemon-cupcakes'
  | 'brownie-cheesecake'
  | 'pound-cupcake'
  | 'cheesecake'
export type ProductGroup = {
  id: ProductGroupId
  defaultProductId: ProductId
  productIds: ProductId[]
}

const KR_PRODUCT_GROUPS: ProductGroup[] = [
  { id: 'pound-cupcake', defaultProductId: 'pound-cake', productIds: ['pound-cake', 'cupcake-dozen'] },
  { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
  {
    id: 'cheesecake',
    defaultProductId: 'choco-basque-cheesecake',
    productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'],
  },
]

export const PRODUCT_GROUPS: ProductGroup[] = marketConfig.market === 'AU' ? [
  { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
  { id: 'buttercream', defaultProductId: 'buttercream-cake', productIds: ['buttercream-cake'] },
  { id: 'fresh-strawberry-vanilla-cream', defaultProductId: 'fresh-strawberry-vanilla-cream-cake', productIds: ['fresh-strawberry-vanilla-cream-cake'] },
  { id: 'fresh-strawberry-chocolate-cream', defaultProductId: 'fresh-strawberry-chocolate-cream-cake', productIds: ['fresh-strawberry-chocolate-cream-cake'] },
  { id: 'cupcake', defaultProductId: 'cupcake-dozen', productIds: ['cupcake-half-dozen', 'cupcake-dozen'] },
  { id: 'signature-gateau', defaultProductId: 'pound-cake', productIds: ['pound-cake'] },
  {
    id: 'fresh-lemon-cupcakes',
    defaultProductId: 'fresh-lemon-cupcakes-12',
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'],
  },
  {
    id: 'brownie-cheesecake',
    defaultProductId: 'brownie-cheesecake',
    productIds: ['brownie-cheesecake', 'pave-brownie-cheesecake', 'eiffel-tower-brownie-cheesecake'],
  },
] : KR_PRODUCT_GROUPS

const LEGACY_AU_PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'vanilla-fresh-cream',
    defaultProductId: 'vanilla-fresh-cream-cake',
    productIds: ['vanilla-fresh-cream-cake'],
  },
  {
    id: 'cheesecake',
    defaultProductId: 'choco-basque-cheesecake',
    productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake', 'eiffel-tower-basque-cheesecake'],
  },
]

export function isVanillaFreshCreamCakeProduct(productId: ProductId) {
  return productId === 'vanilla-fresh-cream-cake'
}

export function isCreamLayerCakeProduct(productId: ProductId) {
  return productId === 'vanilla-fresh-cream-cake' || productId === 'buttercream-cake'
}

export function isButtercreamCakeProduct(productId: ProductId) {
  return productId === 'buttercream-cake'
}

export function isCakePointColorProduct(productId: ProductId) {
  return isCreamLayerCakeProduct(productId)
}

export const VANILLA_CAKE_SHEET_OPTIONS: Array<{ value: VanillaCakeSheet; label: string }> = [
  { value: 'chocolate', label: 'Chocolate cake sheet' },
]

export const VANILLA_CAKE_FLAVOR_OPTIONS: Array<{ value: VanillaCakeFlavor; label: string }> = [
  { value: 'plain', label: 'Vanilla fresh cream with real vanilla bean' },
]

const LEGACY_VANILLA_CAKE_FLAVOR_OPTIONS: Array<{ value: VanillaCakeFlavor; label: string }> = [
  { value: 'triple-berry', label: 'Triple berry' },
  { value: 'nutella-chocolate-chip', label: 'Nutella chocolate chip' },
]

export const VANILLA_CAKE_POINT_COLOR_OPTIONS: Array<{
  value: VanillaCakePointColor
  label: string
  labelKo: string
  hex: string
}> = [
  { value: 'pink', label: 'Pink', labelKo: '핑크', hex: '#ec4899' },
  { value: 'red', label: 'Red', labelKo: '레드', hex: '#ef4444' },
  { value: 'green', label: 'Green', labelKo: '그린', hex: '#22c55e' },
  { value: 'yellow', label: 'Yellow', labelKo: '옐로우', hex: '#eab308' },
  { value: 'blue', label: 'Blue', labelKo: '블루', hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', labelKo: '퍼플', hex: '#a855f7' },
  { value: 'orange', label: 'Orange', labelKo: '오렌지', hex: '#f97316' },
  { value: 'white', label: 'White', labelKo: '화이트', hex: '#ffffff' },
]

export function normalizeVanillaCakeSheet(productId: ProductId, value?: VanillaCakeSheet | string) {
  if (!isCreamLayerCakeProduct(productId)) return DEFAULT_VANILLA_CAKE_SHEET
  void value
  return VANILLA_FRESH_CREAM_CAKE_SHEET
}

export function normalizeVanillaCakeFlavor(productId: ProductId, value?: VanillaCakeFlavor | string) {
  if (!isCreamLayerCakeProduct(productId)) return 'triple-berry'
  void value
  return DEFAULT_VANILLA_CAKE_FLAVOR
}

export function normalizeVanillaCakePointColor(productId: ProductId, value?: VanillaCakePointColor | string) {
  if (!isCakePointColorProduct(productId)) return DEFAULT_VANILLA_CAKE_POINT_COLOR
  return VANILLA_CAKE_POINT_COLOR_OPTIONS.some((option) => option.value === value) ? value as VanillaCakePointColor : DEFAULT_VANILLA_CAKE_POINT_COLOR
}

export function normalizeStoredVanillaCakeSheet(productId: ProductId, value?: VanillaCakeSheet | string) {
  if (!isCreamLayerCakeProduct(productId)) return DEFAULT_VANILLA_CAKE_SHEET
  return value === 'vanilla' || value === 'chocolate' ? value : VANILLA_FRESH_CREAM_CAKE_SHEET
}

export function normalizeStoredVanillaCakeFlavor(productId: ProductId, value?: VanillaCakeFlavor | string) {
  if (!isCreamLayerCakeProduct(productId)) return 'triple-berry'
  if (value === 'plain' || LEGACY_VANILLA_CAKE_FLAVOR_OPTIONS.some((option) => option.value === value)) {
    return value as VanillaCakeFlavor
  }
  return DEFAULT_VANILLA_CAKE_FLAVOR
}

export function formatVanillaCakeSheet(value?: VanillaCakeSheet | string) {
  return VANILLA_CAKE_SHEET_OPTIONS.find((option) => option.value === value)?.label || VANILLA_CAKE_SHEET_OPTIONS[0].label
}

export function formatVanillaCakeFlavor(value?: VanillaCakeFlavor | string) {
  return [...VANILLA_CAKE_FLAVOR_OPTIONS, ...LEGACY_VANILLA_CAKE_FLAVOR_OPTIONS].find((option) => option.value === value)?.label || VANILLA_CAKE_FLAVOR_OPTIONS[0].label
}

export function formatVanillaCakePointColor(value?: VanillaCakePointColor | string) {
  return VANILLA_CAKE_POINT_COLOR_OPTIONS.find((option) => option.value === value)?.label || VANILLA_CAKE_POINT_COLOR_OPTIONS[0].label
}

export function isFreshLemonCupcakeProduct(productId: ProductId) {
  return productId.startsWith('fresh-lemon-cupcakes-')
}

export function getFreshLemonCupcakePackSize(productId: ProductId) {
  if (!isFreshLemonCupcakeProduct(productId)) return null
  const packSize = Number(productId.split('-').at(-1))
  return [4, 6, 8, 12, 16].includes(packSize) ? packSize : null
}

export function normalizeChocolateIcingCount(productId: ProductId, value?: number | null) {
  const packSize = getFreshLemonCupcakePackSize(productId)
  if (!packSize) return 0
  const count = Number(value || 0)
  if (!Number.isFinite(count)) return 0
  return Math.min(packSize, Math.max(0, Math.floor(count)))
}

export function getLemonIcingCount(productId: ProductId, chocolateIcingCount?: number | null) {
  const packSize = getFreshLemonCupcakePackSize(productId)
  if (!packSize) return 0
  return packSize - normalizeChocolateIcingCount(productId, chocolateIcingCount)
}

export function getChocolateIcingSurcharge(productId: ProductId, chocolateIcingCount?: number | null) {
  const count = normalizeChocolateIcingCount(productId, chocolateIcingCount)
  return fromCurrencyCents(count * LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS)
}

export function isCupcakeDozenProduct(productId: ProductId) {
  return productId === 'cupcake-dozen'
}

export function isCupcakeProduct(productId: ProductId) {
  return CUPCAKE_PRODUCT_IDS.includes(productId)
}

export function getCupcakePackSize(productId: ProductId) {
  return CUPCAKE_PACK_SIZES[productId] || null
}

export function normalizeCupcakeFinish(productId: ProductId, value?: CupcakeFinish | string) {
  if (!isCupcakeProduct(productId)) return DEFAULT_CUPCAKE_FINISH
  return CUPCAKE_FINISH_OPTIONS.some((option) => option.value === value)
    ? value as CupcakeFinish
    : DEFAULT_CUPCAKE_FINISH
}

export function getCupcakeFinishPrice(productId: ProductId, cupcakeFinish?: CupcakeFinish | string) {
  const prices = CUPCAKE_FINISH_PRICES[productId]
  if (!prices) return null
  return prices[normalizeCupcakeFinish(productId, cupcakeFinish)]
}

export function normalizeCupcakeFinishCounts(
  productId: ProductId,
  vanillaCreamCount?: number | null,
  partyDecorationCount?: number | null,
) {
  if (!isCupcakeDozenProduct(productId)) return { vanillaCreamCount: 0, partyDecorationCount: 0 }
  const normalize = (value?: number | null) => {
    const count = Number(value || 0)
    if (!Number.isFinite(count)) return 0
    return Math.min(CUPCAKE_PACK_SIZE, Math.max(0, Math.floor(count)))
  }
  const vanilla = normalize(vanillaCreamCount)
  const party = Math.min(normalize(partyDecorationCount), CUPCAKE_PACK_SIZE - vanilla)
  return { vanillaCreamCount: vanilla, partyDecorationCount: party }
}

export function getCupcakeFinishSurcharge(
  productId: ProductId,
  vanillaCreamCount?: number | null,
  partyDecorationCount?: number | null,
) {
  const counts = normalizeCupcakeFinishCounts(productId, vanillaCreamCount, partyDecorationCount)
  return fromCurrencyCents(
    counts.vanillaCreamCount * CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS +
    counts.partyDecorationCount * CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS,
  )
}

export function getProductGroupByProductId(productId: ProductId) {
  return PRODUCT_GROUPS.find((group) => group.productIds.includes(productId))
    || LEGACY_AU_PRODUCT_GROUPS.find((group) => group.productIds.includes(productId))
    || PRODUCT_GROUPS[0]
}

export type ReservationPriceOptions = {
  cacaoPercent?: CacaoPercent
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  cupcakeFinish?: CupcakeFinish
  chocolateIcingCount?: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
}

export function getProductById(productId?: string) {
  return (PRODUCTS[(productId as ProductId) || DEFAULT_PRODUCT_ID] || PRODUCTS[DEFAULT_PRODUCT_ID])!
}

export function formatCacaoLabel(cacaoPercent: CacaoPercent) {
  return CACAO_OPTIONS.find((item) => item.value === cacaoPercent)?.label || `${cacaoPercent}%`
}

export const CAKE_SIZE_OPTIONS = marketConfig.cakeSizeOptions
export const CHOCOLATE_TYPE_OPTIONS = marketConfig.chocolateTypeOptions
export const POUND_ADDON_OPTIONS = marketConfig.poundAddonOptions

export function getCakeSizeOption(cakeSize?: CakeSize) {
  return CAKE_SIZE_OPTIONS.find((item) => item.value === cakeSize) || CAKE_SIZE_OPTIONS[0]
}

export function formatCakeSizeLabel(cakeSize?: CakeSize) {
  return getCakeSizeOption(cakeSize).label
}

export function normalizeCakeSize(productId: ProductId, cakeSize?: CakeSize) {
  const product = getProductById(productId)
  if (!product.usesSizeOptions) return DEFAULT_CAKE_SIZE
  if (cakeSize && Object.hasOwn(product.sizePrices, cakeSize)) return cakeSize
  const firstConfiguredSize = Object.keys(product.sizePrices)[0] as CakeSize | undefined
  return firstConfiguredSize || DEFAULT_CAKE_SIZE
}

export function getChocolateTypeOption(chocolateType?: ChocolateType) {
  return CHOCOLATE_TYPE_OPTIONS.find((item) => item.value === chocolateType) || CHOCOLATE_TYPE_OPTIONS[0]
}

export function formatChocolateTypeLabel(chocolateType?: ChocolateType) {
  return getChocolateTypeOption(chocolateType).label
}

export function normalizeChocolateType(productId: ProductId, chocolateType?: ChocolateType) {
  const product = getProductById(productId)
  if (!product.usesChocolateTypeOptions) return DEFAULT_CHOCOLATE_TYPE
  return getChocolateTypeOption(chocolateType).value
}

export function usesReservationChocolateType(productId: ProductId, poundAddon?: PoundAddon) {
  const product = getProductById(productId)
  return product.usesChocolateTypeOptions || (product.usesPoundAddonOptions && poundAddon === 'extra-chocolate')
}

export function normalizeReservationChocolateType(
  productId: ProductId,
  chocolateType?: ChocolateType,
  poundAddon?: PoundAddon,
) {
  if (!usesReservationChocolateType(productId, poundAddon)) return DEFAULT_CHOCOLATE_TYPE
  return getChocolateTypeOption(chocolateType).value
}

function normalizeOptionKey(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

export function getPoundAddonOption(poundAddon?: PoundAddon | string) {
  const normalized = normalizeOptionKey(poundAddon)
  return (
    POUND_ADDON_OPTIONS.find((item) => {
      const valueKey = normalizeOptionKey(item.value)
      const labelKey = normalizeOptionKey(item.label)
      return valueKey === normalized || labelKey === normalized
    }) || POUND_ADDON_OPTIONS[0]
  )
}

export function formatPoundAddonLabel(poundAddon?: PoundAddon | string) {
  return getPoundAddonOption(poundAddon).label
}

export function normalizePoundAddon(productId: ProductId, poundAddon?: PoundAddon | string) {
  const product = getProductById(productId)
  if (!product.usesPoundAddonOptions) return DEFAULT_POUND_ADDON
  return getPoundAddonOption(poundAddon).value
}

function normalizePriceOptions(optionsOrCacao?: ReservationPriceOptions | CacaoPercent, cakeSize?: CakeSize): Required<ReservationPriceOptions> {
  if (typeof optionsOrCacao === 'string') {
    return {
      cacaoPercent: optionsOrCacao,
      cakeSize: cakeSize || DEFAULT_CAKE_SIZE,
      chocolateType: DEFAULT_CHOCOLATE_TYPE,
      poundAddon: DEFAULT_POUND_ADDON,
      cupcakeFinish: DEFAULT_CUPCAKE_FINISH,
      chocolateIcingCount: 0,
      vanillaCreamCount: 0,
      partyDecorationCount: 0,
    }
  }
  return {
    cacaoPercent: optionsOrCacao?.cacaoPercent || '기본',
    cakeSize: optionsOrCacao?.cakeSize || DEFAULT_CAKE_SIZE,
    chocolateType: optionsOrCacao?.chocolateType || DEFAULT_CHOCOLATE_TYPE,
    poundAddon: optionsOrCacao?.poundAddon || DEFAULT_POUND_ADDON,
    cupcakeFinish: optionsOrCacao?.cupcakeFinish || DEFAULT_CUPCAKE_FINISH,
    chocolateIcingCount: optionsOrCacao?.chocolateIcingCount || 0,
    vanillaCreamCount: optionsOrCacao?.vanillaCreamCount || 0,
    partyDecorationCount: optionsOrCacao?.partyDecorationCount || 0,
  }
}

export function getReservationUnitPrice(
  productId: ProductId,
  optionsOrCacao?: ReservationPriceOptions | CacaoPercent,
  legacyCakeSize?: CakeSize,
) {
  const product = getProductById(productId)
  const options = normalizePriceOptions(optionsOrCacao, legacyCakeSize)
  const cakeSize = normalizeCakeSize(product.id, options.cakeSize)
  const chocolateType = normalizeChocolateType(product.id, options.chocolateType)
  const poundAddon = normalizePoundAddon(product.id, options.poundAddon)
  const cupcakePrice = getCupcakeFinishPrice(product.id, options.cupcakeFinish)
  const sizePrice = cupcakePrice ?? (product.usesSizeOptions ? product.sizePrices[cakeSize] || getCakeSizeOption(cakeSize).price : product.price)
  const cacaoOption = CACAO_OPTIONS.find((item) => item.value === options.cacaoPercent)
  const chocolateOption = getChocolateTypeOption(chocolateType)
  const addonOption = getPoundAddonOption(poundAddon)

  return (
    sizePrice +
    (product.usesCacaoOptions ? cacaoOption?.extraPrice || 0 : 0) +
    (product.usesChocolateTypeOptions ? chocolateOption.extraPrice : 0) +
    (product.usesPoundAddonOptions ? addonOption.extraPrice : 0) +
    getChocolateIcingSurcharge(product.id, options.chocolateIcingCount)
  )
}

export function getReservationPrice(
  productId: ProductId,
  optionsOrCacao?: ReservationPriceOptions | CacaoPercent,
  quantity = 1,
  legacyCakeSize?: CakeSize,
) {
  return getReservationUnitPrice(productId, optionsOrCacao, legacyCakeSize) * quantity
}

export const DEFAULT_SETTINGS = marketConfig.defaultSettings

export const CACAO_OPTIONS = marketConfig.cacaoOptions

export { PAYMENT_STATUSES, RESERVATION_STATUSES }
