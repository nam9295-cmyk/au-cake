// Compatibility policy captured at Stage 2 from existing browser readers.
// Stored totals are validated and preserved, never repriced. New-order policy
// changes must not automatically alter this historical acceptance contract.
import type { BrownieCreamOption, CacaoPercent, CakeSize, ChocolateType, CupcakeFinish, PoundAddon, ProductId, VanillaCakeFlavor, VanillaCakePointColor, VanillaCakeSheet, ChocolateExtra, CakeOrderLineRequest, CakeOrderLineResult } from './types.js'
import { storedMarketConfig as marketConfig } from './stored-order-catalog.js'

const STORED_PRODUCT_IDS = new Set<string>(["pave-cake","vanilla-fresh-cream-cake","buttercream-cake","fresh-strawberry-vanilla-cream-cake","fresh-strawberry-chocolate-cream-cake","pound-cake","cupcake-dozen","cupcake-half-dozen","choco-basque-cheesecake","pave-choco-basque-cheesecake","eiffel-tower-basque-cheesecake","brownie-cheesecake","pave-brownie-cheesecake","eiffel-tower-brownie-cheesecake","fresh-lemon-cupcakes-6","fresh-lemon-cupcakes-8","fresh-lemon-cupcakes-12","fresh-lemon-cupcakes-16","smore-stick"])
export function isStoredCakeOrderProductId(value: unknown): boolean {
  return typeof value === 'string' && STORED_PRODUCT_IDS.has(value)
}

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

export const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'

export const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'

export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50

export const CUPCAKE_PACK_SIZE = 12

export const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50

export const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100

const CUPCAKE_PRODUCT_IDS: ProductId[] = ['cupcake-half-dozen', 'cupcake-dozen']

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

export function getValidPromoCode(productId: ProductId, code?: string, now = new Date()) {
  const normalizedCode = code?.trim().toLowerCase()
  if (!normalizedCode) return null
  const promo = PROMOTIONS.find((candidate) => candidate.code === normalizedCode && candidate.productIds.includes(productId))
  if (!promo || sydneyDateValue(now) > promo.expiresOn) return null
  return promo.code
}

export const PRODUCTS = marketConfig.products

const CURRENT_WHOLE_CAKE_SIZE_PRICES: Partial<Record<ProductId, Partial<Record<CakeSize, number>>>> = {
  'pave-cake': { '6in': 79, '8in': 109, '10in': 159 },
  'buttercream-cake': { '6in': 75, '8in': 99, '10in': 145 },
  'fresh-strawberry-vanilla-cream-cake': { '6in': 65, '8in': 89, '10in': 129 },
  'fresh-strawberry-chocolate-cream-cake': { '6in': 69, '8in': 95, '10in': 135 },
}

export function isCreamLayerCakeProduct(productId: ProductId) {
  return productId === 'vanilla-fresh-cream-cake' || productId === 'buttercream-cake'
}

export function isCakePointColorProduct(productId: ProductId) {
  return isCreamLayerCakeProduct(productId)
}

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

export type ReservationPriceOptions = {
  cacaoPercent?: CacaoPercent
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  cupcakeFinish?: CupcakeFinish
  brownieCreamOption?: BrownieCreamOption
  chocolateIcingCount?: number
  vanillaCreamCount?: number
  partyDecorationCount?: number
}

export function getProductById(productId?: string) {
  return (PRODUCTS[(productId as ProductId) || DEFAULT_PRODUCT_ID] || PRODUCTS[DEFAULT_PRODUCT_ID])!
}

export const CAKE_SIZE_OPTIONS = marketConfig.cakeSizeOptions

export const CHOCOLATE_TYPE_OPTIONS = marketConfig.chocolateTypeOptions

export const POUND_ADDON_OPTIONS = marketConfig.poundAddonOptions

export function getCakeSizeOption(cakeSize?: CakeSize) {
  return CAKE_SIZE_OPTIONS.find((item) => item.value === cakeSize) || CAKE_SIZE_OPTIONS[0]
}

export function normalizeCakeSize(productId: ProductId, cakeSize?: CakeSize) {
  const product = getProductById(productId)
  if (!product.usesSizeOptions) return DEFAULT_CAKE_SIZE
  if (cakeSize && Object.hasOwn(CURRENT_WHOLE_CAKE_SIZE_PRICES[product.id] || {}, cakeSize)) return cakeSize
  if (cakeSize && Object.hasOwn(product.sizePrices, cakeSize)) return cakeSize
  const firstConfiguredSize = Object.keys(product.sizePrices)[0] as CakeSize | undefined
  return firstConfiguredSize || DEFAULT_CAKE_SIZE
}

export function getChocolateTypeOption(chocolateType?: ChocolateType) {
  return CHOCOLATE_TYPE_OPTIONS.find((item) => item.value === chocolateType) || CHOCOLATE_TYPE_OPTIONS[0]
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
      brownieCreamOption: DEFAULT_BROWNIE_CREAM_OPTION,
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
    brownieCreamOption: optionsOrCacao?.brownieCreamOption || DEFAULT_BROWNIE_CREAM_OPTION,
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
  const sizePrice = cupcakePrice ?? (product.usesSizeOptions
    ? (CURRENT_WHOLE_CAKE_SIZE_PRICES[product.id]?.[cakeSize] ?? product.sizePrices[cakeSize] ?? getCakeSizeOption(cakeSize).price)
    : product.price)
  const cacaoOption = CACAO_OPTIONS.find((item) => item.value === options.cacaoPercent)
  const chocolateOption = getChocolateTypeOption(chocolateType)
  const addonOption = getPoundAddonOption(poundAddon)

  return (
    sizePrice +
    (product.usesCacaoOptions ? cacaoOption?.extraPrice || 0 : 0) +
    (product.usesChocolateTypeOptions ? chocolateOption.extraPrice : 0) +
    (product.usesPoundAddonOptions ? addonOption.extraPrice : 0) +
    getChocolateIcingSurcharge(product.id, options.chocolateIcingCount) +
    getBrownieCreamPrice(product.id, options.brownieCreamOption)
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

export const CACAO_OPTIONS = marketConfig.cacaoOptions

export const DEFAULT_BROWNIE_CREAM_OPTION: BrownieCreamOption = 'none'

export const BROWNIE_FRESH_CREAM_PRICE = 20

export const BROWNIE_CREAM_OPTIONS: ReadonlyArray<{
  value: BrownieCreamOption
  label: string
  labelKo: string
  extraPrice: number
}> = [
  { value: 'none', label: 'No fresh cream', labelKo: '생크림 선택 안 함', extraPrice: 0 },
  { value: 'fresh-cream', label: 'Fresh cream', labelKo: '생크림 추가', extraPrice: BROWNIE_FRESH_CREAM_PRICE },
]

export function isBrownieFreshCreamEligibleProduct(productId: ProductId) {
  return productId === 'brownie-cheesecake'
}

export function normalizeBrownieCreamOption(
  productId: ProductId,
  value?: BrownieCreamOption | string,
): BrownieCreamOption {
  if (!isBrownieFreshCreamEligibleProduct(productId)) return DEFAULT_BROWNIE_CREAM_OPTION
  return value === 'fresh-cream' ? 'fresh-cream' : DEFAULT_BROWNIE_CREAM_OPTION
}

export function getBrownieCreamOption(
  productId: ProductId,
  value?: BrownieCreamOption | string,
) {
  const normalized = normalizeBrownieCreamOption(productId, value)
  return BROWNIE_CREAM_OPTIONS.find((option) => option.value === normalized) || BROWNIE_CREAM_OPTIONS[0]
}

export function getBrownieCreamPrice(
  productId: ProductId,
  value?: BrownieCreamOption | string,
) {
  return getBrownieCreamOption(productId, value).extraPrice
}

export type ChocolateExtraOption = {
  value: ChocolateExtra
  price: number
  label: string
  labelKo: string
  description: string
  descriptionKo: string
}

const ELIGIBLE_CHOCOLATE_EXTRA_PRODUCT_IDS: readonly ProductId[] = [
  'pave-cake',
  'buttercream-cake',
  'pound-cake',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
]

export const CHOCOLATE_EXTRA_OPTIONS: readonly ChocolateExtraOption[] = [
  {
    value: 'none',
    price: 0,
    label: 'None',
    labelKo: '추가 안 함',
    description: 'No additional chocolate item.',
    descriptionKo: '별도 초콜릿 추가 구성 없음.',
  },
  {
    value: 'eiffel-6',
    price: 10,
    label: 'Eiffel Tower Chocolates · 6 pieces',
    labelKo: '에펠탑 초콜릿 · 6개',
    description: 'Six Eiffel Tower chocolates to enjoy alongside your cake.',
    descriptionKo: '케이크와 함께 즐길 수 있는 에펠탑 초콜릿 6개 구성.',
  },
  {
    value: 'pave-100g',
    price: 12,
    label: 'Pavé Chocolate · 100g tub',
    labelKo: '파베 초콜릿 · 100g 통',
    description: 'Rich, smooth pavé chocolate to enjoy by the spoonful, spread over your cake, or share on the side.',
    descriptionKo: '부드럽고 진한 파베 초콜릿을 그대로 떠먹거나, 케이크에 발라 먹거나, 곁들여 함께 즐길 수 있습니다.',
  },
  {
    value: 'combo',
    price: 20,
    label: 'Chocolate Extra Set',
    labelKo: '초콜릿 추가 세트',
    description: '6 Eiffel Tower chocolates + 100g Pavé Chocolate. Save AUD 2.00.',
    descriptionKo: '에펠탑 초콜릿 6개 + 파베 초콜릿 100g 통 · AUD 2.00 할인.',
  },
]

export const DEFAULT_CHOCOLATE_EXTRA: ChocolateExtra = 'none'

export function isChocolateExtraEligibleProduct(productId: ProductId) {
  return ELIGIBLE_CHOCOLATE_EXTRA_PRODUCT_IDS.includes(productId)
}

export function getChocolateExtraOption(value?: ChocolateExtra | string) {
  return CHOCOLATE_EXTRA_OPTIONS.find((option) => option.value === value) || CHOCOLATE_EXTRA_OPTIONS[0]
}

export function normalizeChocolateExtra(productId: ProductId, value?: ChocolateExtra | string): ChocolateExtra {
  if (!isChocolateExtraEligibleProduct(productId)) return DEFAULT_CHOCOLATE_EXTRA
  return getChocolateExtraOption(value).value
}

export function getChocolateExtraPrice(value?: ChocolateExtra | string) {
  return getChocolateExtraOption(value).price
}

export const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50

export const INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS = 10_000

const INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT: Partial<Record<ProductId, number>> = {
  'cupcake-half-dozen': 6,
  'cupcake-dozen': 12,
  'fresh-lemon-cupcakes-6': 6,
  'fresh-lemon-cupcakes-8': 8,
  'fresh-lemon-cupcakes-12': 12,
  'fresh-lemon-cupcakes-16': 16,
}

export function isIndividualPackagingEligibleProduct(productId: ProductId) {
  return INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT[productId] !== undefined
}

export function getIndividualPackagingPieceCount(productId: ProductId, quantity: number) {
  if (!isIndividualPackagingEligibleProduct(productId) || !Number.isSafeInteger(quantity) || quantity < 1) return 0
  const packSize = INDIVIDUAL_PACKAGING_PIECES_BY_PRODUCT[productId] || 0
  const pieces = packSize * quantity
  return Number.isSafeInteger(pieces) ? pieces : 0
}

export type CakeServingProfile = 'gateau' | 'genoise'

const HISTORICAL_WHOLE_CAKE_SIZES = ['15cm', '19cm', '22cm'] as const

const HISTORICAL_WHOLE_CAKE_UNIT_PRICE_CENTS: Readonly<Partial<Record<ProductId, Readonly<Record<string, number>>>>> = {
  'pave-cake': { '15cm': 7900, '19cm': 9900, '22cm': 13700 },
  'buttercream-cake': { '15cm': 7400, '19cm': 9400, '22cm': 12800 },
}

const CURRENT_WHOLE_CAKE_PROFILES: Readonly<Partial<Record<ProductId, CakeServingProfile>>> = {
  'pave-cake': 'gateau',
  'buttercream-cake': 'gateau',
  'fresh-strawberry-vanilla-cream-cake': 'genoise',
  'fresh-strawberry-chocolate-cream-cake': 'genoise',
}

export function getCakeServingProfile(productId: ProductId): CakeServingProfile | null {
  return CURRENT_WHOLE_CAKE_PROFILES[productId] || null
}

export function isCurrentWholeCakeProduct(productId: ProductId): boolean {
  return getCakeServingProfile(productId) !== null
}

export function isHistoricalWholeCakeSize(productId: ProductId, cakeSize: CakeSize): boolean {
  return isCurrentWholeCakeProduct(productId) && HISTORICAL_WHOLE_CAKE_SIZES.includes(cakeSize as typeof HISTORICAL_WHOLE_CAKE_SIZES[number])
}

export function getHistoricalWholeCakeUnitPrice(productId: ProductId, cakeSize: CakeSize): number | null {
  return isHistoricalWholeCakeSize(productId, cakeSize)
    ? HISTORICAL_WHOLE_CAKE_UNIT_PRICE_CENTS[productId]?.[cakeSize] ?? null
    : null
}

export function isHistoricalWholeCakeUnitPrice(productId: ProductId, cakeSize: CakeSize, unitPriceCents: number): boolean {
  return getHistoricalWholeCakeUnitPrice(productId, cakeSize) === unitPriceCents
}

export function normalizeStoredCakeSize(cakeSize: CakeSize | undefined): CakeSize {
  return cakeSize || '15cm'
}

function invalidResponse(): never {
  throw new Error('RESERVATION_API_INVALID_RESPONSE')
}

export function getOrderLineBulkDiscountPercent(line: Pick<CakeOrderLineRequest, 'productId' | 'quantity'>): 0 | 10 | 20 {
  return line.productId === 'smore-stick' ? line.quantity >= 12 ? 20 : line.quantity >= 6 ? 10 : 0 : 0
}

export function getOrderLineBulkDiscountCents(line: Pick<CakeOrderLineResult, 'productId' | 'quantity' | 'subtotalCents'>): number {
  // Smore has an exact 45c/90c discount per piece. Do not overflow an
  // otherwise valid safe-integer subtotal by multiplying it by 10 or 20.
  const discountCents = line.productId === 'smore-stick'
    ? line.quantity * (450 * getOrderLineBulkDiscountPercent(line) / 100)
    : 0
  if (!Number.isSafeInteger(discountCents)) invalidResponse()
  return discountCents
}
