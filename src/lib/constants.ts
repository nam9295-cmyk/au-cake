import { marketConfig, PAYMENT_STATUSES, RESERVATION_STATUSES } from './market.js'
import type { CacaoPercent, CakeSize, ChocolateType, PoundAddon, ProductId } from './types.js'

export const PRODUCT_NAME = marketConfig.copy.productName

export const DEFAULT_PRODUCT_ID: ProductId = 'pave-cake'
export const DEFAULT_CAKE_SIZE: CakeSize = '15cm'
export const DEFAULT_CHOCOLATE_TYPE: ChocolateType = 'dark'
export const DEFAULT_POUND_ADDON: PoundAddon = 'none'
export const MAX_RESERVATION_QUANTITY = 5
export const PROMO_CODE = 'chocolate'
export const LEMON_PROMO_CODE = 'lemoni'
export const PROMO_DISCOUNT_RATE = 0.1
export const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'
export const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'
export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50

const CHEESECAKE_PROMO_PRODUCT_IDS: ProductId[] = ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake']
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

export type ProductGroupId = 'pave' | 'pound-cupcake' | 'cheesecake' | 'fresh-lemon-cupcakes'
export type ProductGroup = {
  id: ProductGroupId
  defaultProductId: ProductId
  productIds: ProductId[]
}

export const PRODUCT_GROUPS: ProductGroup[] = [
  { id: 'pave', defaultProductId: 'pave-cake', productIds: ['pave-cake'] },
  { id: 'pound-cupcake', defaultProductId: 'pound-cake', productIds: ['pound-cake', 'cupcake-dozen'] },
  {
    id: 'cheesecake',
    defaultProductId: 'choco-basque-cheesecake',
    productIds: ['choco-basque-cheesecake', 'pave-choco-basque-cheesecake'],
  },
  ...(marketConfig.market === 'AU' ? [{
    id: 'fresh-lemon-cupcakes' as const,
    defaultProductId: 'fresh-lemon-cupcakes-12' as const,
    productIds: ['fresh-lemon-cupcakes-6', 'fresh-lemon-cupcakes-8', 'fresh-lemon-cupcakes-12', 'fresh-lemon-cupcakes-16'] as ProductId[],
  }] : []),
]

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

export function getProductGroupByProductId(productId: ProductId) {
  return PRODUCT_GROUPS.find((group) => group.productIds.includes(productId)) || PRODUCT_GROUPS[0]
}

export type ReservationPriceOptions = {
  cacaoPercent?: CacaoPercent
  cakeSize?: CakeSize
  chocolateType?: ChocolateType
  poundAddon?: PoundAddon
  chocolateIcingCount?: number
}

export function getProductById(productId?: string) {
  return PRODUCTS[(productId as ProductId) || DEFAULT_PRODUCT_ID] || PRODUCTS[DEFAULT_PRODUCT_ID]
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
  return getCakeSizeOption(cakeSize).value
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
      chocolateIcingCount: 0,
    }
  }
  return {
    cacaoPercent: optionsOrCacao?.cacaoPercent || '기본',
    cakeSize: optionsOrCacao?.cakeSize || DEFAULT_CAKE_SIZE,
    chocolateType: optionsOrCacao?.chocolateType || DEFAULT_CHOCOLATE_TYPE,
    poundAddon: optionsOrCacao?.poundAddon || DEFAULT_POUND_ADDON,
    chocolateIcingCount: optionsOrCacao?.chocolateIcingCount || 0,
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
  const sizePrice = product.usesSizeOptions ? product.sizePrices[cakeSize] || getCakeSizeOption(cakeSize).price : product.price
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
