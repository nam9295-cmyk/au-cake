// Current new-order catalog and option/promotion constants. Independent of stored-order compatibility snapshots.
import { ACTIVE_CAKE_ORDER_PRODUCT_IDS } from './active-cake-products.js'

export const PROMO_CODE = 'chocolate'

export const LEMON_PROMO_CODE = 'lemoni'

export const PROMO_DISCOUNT_RATE = 0.1

export const LEMON_CHOCOLATE_ICING_SURCHARGE_CENTS = 50

export const CUPCAKE_PACK_SIZE = 12

export const CUPCAKE_VANILLA_CREAM_SURCHARGE_CENTS = 50

export const CUPCAKE_PARTY_DECORATION_SURCHARGE_CENTS = 100

export const INDIVIDUAL_PACKAGING_FEE_CENTS_PER_PIECE = 50

export const INDIVIDUAL_PACKAGING_FREE_FROM_PRODUCT_SUBTOTAL_CENTS = 10_000

export const BROWNIE_FRESH_CREAM_SURCHARGE_CENTS = 2_000

export const CUPCAKE_PRODUCT_IDS = new Set(['cupcake-half-dozen', 'cupcake-dozen'])

export const CUPCAKE_FINISH_PRICES_CENTS = {
  'cupcake-half-dozen': {
    basic: 3100,
    'vanilla-fresh-cream': 3600,
    'chocolate-buttercream': 4100,
  },
  'cupcake-dozen': {
    basic: 5500,
    'vanilla-fresh-cream': 6400,
    'chocolate-buttercream': 7300,
  },
}

export const CUPCAKE_FINISHES = new Set(['basic', 'vanilla-fresh-cream', 'chocolate-buttercream'])

export const VANILLA_CAKE_SHEETS = new Set(['chocolate'])

export const VANILLA_CAKE_FLAVORS = new Set(['plain'])

export const LEGACY_VANILLA_CAKE_FLAVORS = new Set(['triple-berry', 'nutella-chocolate-chip'])

export const VANILLA_CAKE_POINT_COLORS = new Set(['pink', 'red', 'green', 'yellow', 'blue', 'purple', 'orange', 'white'])

export const CREAM_LAYER_CAKE_PRODUCT_IDS = new Set(['vanilla-fresh-cream-cake', 'buttercream-cake'])

export const STRAWBERRY_CREAM_CAKE_PRODUCT_IDS = new Set([
  'fresh-strawberry-vanilla-cream-cake',
  'fresh-strawberry-chocolate-cream-cake',
])

export const CHOCOLATE_EXTRA_PRICES_CENTS = Object.freeze({
  none: 0,
  'eiffel-6': 1000,
  'pave-100g': 1200,
  combo: 2000,
})

export const BROWNIE_CREAM_OPTIONS = new Set(['none', 'fresh-cream'])

export const BROWNIE_CHEESECAKE_PRODUCT_IDS = new Set(['brownie-cheesecake', 'pave-brownie-cheesecake'])

export const BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS = new Set(['brownie-cheesecake'])

export const CHOCOLATE_EXTRA_ELIGIBLE_PRODUCT_IDS = new Set([
  'pave-cake',
  'buttercream-cake',
  'pound-cake',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
])

export const CAKE_SIZE_LABELS = {
  '6in': '6"',
  '8in': '8"',
  '10in': '10"',
  '15cm': '6" | serves 8',
  '19cm': '7.5" | serves 14',
  '22cm': '9" | serves 22',
}

export const CHOCOLATE_PROMO_EXPIRES_ON = '2026-07-15'

export const LEMONI_PROMO_EXPIRES_ON = '2026-07-16'

export const CHEESECAKE_PROMO_PRODUCT_IDS = new Set([
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
])

export const FRESH_LEMON_CUPCAKE_PRODUCT_IDS = new Set([
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
])

export const INDIVIDUAL_PACKAGING_PRODUCT_PIECES = Object.freeze({
  'cupcake-half-dozen': 6,
  'cupcake-dozen': 12,
  'fresh-lemon-cupcakes-6': 6,
  'fresh-lemon-cupcakes-8': 8,
  'fresh-lemon-cupcakes-12': 12,
  'fresh-lemon-cupcakes-16': 16,
})

export const PROMOTIONS = [
  { code: PROMO_CODE, expiresOn: CHOCOLATE_PROMO_EXPIRES_ON, productIds: CHEESECAKE_PROMO_PRODUCT_IDS },
  { code: LEMON_PROMO_CODE, expiresOn: LEMONI_PROMO_EXPIRES_ON, productIds: FRESH_LEMON_CUPCAKE_PRODUCT_IDS },
]

export const MAX_RESERVATION_QUANTITY = 5

export const PRODUCTS = {
  'smore-stick': { basePrice: 4.5, sizePrices: {}, usesSize: false, usesFinish: false },
  'pave-cake': {
    basePrice: 79,
    sizePrices: { '6in': 79, '8in': 109, '10in': 159 },
    legacySizePrices: { '15cm': 79, '19cm': 99, '22cm': 137 },
    usesSize: true,
    usesFinish: false,
  },
  'vanilla-fresh-cream-cake': {
    basePrice: 69,
    sizePrices: {},
    legacySizePrices: { '15cm': 69, '19cm': 89, '22cm': 119 },
    usesSize: true,
    usesFinish: false,
  },
  'buttercream-cake': {
    basePrice: 74,
    sizePrices: { '6in': 75, '8in': 99, '10in': 145 },
    legacySizePrices: { '15cm': 74, '19cm': 94, '22cm': 128 },
    usesSize: true,
    usesFinish: false,
  },
  'fresh-strawberry-vanilla-cream-cake': {
    basePrice: 65,
    sizePrices: { '6in': 65, '8in': 89, '10in': 129 },
    usesSize: true,
    usesFinish: false,
  },
  'fresh-strawberry-chocolate-cream-cake': {
    basePrice: 69,
    sizePrices: { '6in': 69, '8in': 95, '10in': 135 },
    usesSize: true,
    usesFinish: false,
  },
  'pound-cake': {
    basePrice: 45,
    sizePrices: {},
    usesSize: false,
    usesFinish: true,
  },
  'cupcake-half-dozen': {
    basePrice: 31,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'cupcake-dozen': {
    basePrice: 55,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'choco-basque-cheesecake': {
    basePrice: 55,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'pave-choco-basque-cheesecake': {
    basePrice: 65,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'eiffel-tower-basque-cheesecake': {
    basePrice: 70,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'brownie-cheesecake': {
    basePrice: 85,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'pave-brownie-cheesecake': {
    basePrice: 95,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'eiffel-tower-brownie-cheesecake': {
    basePrice: 70,
    sizePrices: {},
    usesSize: false,
    usesFinish: false,
  },
  'fresh-lemon-cupcakes-6': { basePrice: 36, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-8': { basePrice: 45, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-12': { basePrice: 65, sizePrices: {}, usesSize: false, usesFinish: false },
  'fresh-lemon-cupcakes-16': { basePrice: 85, sizePrices: {}, usesSize: false, usesFinish: false },
}

export const FINISH_PRICES = {
  none: 0,
  'extra-chocolate': 7,
  'vanilla-cream': 10,
}

if (ACTIVE_CAKE_ORDER_PRODUCT_IDS.some((productId) => !Object.hasOwn(PRODUCTS, productId))) {
  throw new Error('ACTIVE_CAKE_ORDER_PRODUCT_CATALOG_MISMATCH')
}
