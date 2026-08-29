export const CURRENT_WHOLE_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  'pave-cake',
  'buttercream-cake',
  'fresh-strawberry-vanilla-cream-cake',
  'fresh-strawberry-chocolate-cream-cake',
])

export const CURRENT_SECONDARY_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  'pound-cake',
  'cupcake-half-dozen',
  'cupcake-dozen',
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
])

export const ACTIVE_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  ...CURRENT_WHOLE_CAKE_ORDER_PRODUCT_IDS,
  ...CURRENT_SECONDARY_CAKE_ORDER_PRODUCT_IDS,
])

export const COMPAT_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  ...ACTIVE_CAKE_ORDER_PRODUCT_IDS,
  'vanilla-fresh-cream-cake',
])

export const STORED_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  ...COMPAT_CAKE_ORDER_PRODUCT_IDS,
  'eiffel-tower-brownie-cheesecake',
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
])

const ACTIVE_CAKE_ORDER_PRODUCT_ID_SET = new Set(ACTIVE_CAKE_ORDER_PRODUCT_IDS)
const COMPAT_CAKE_ORDER_PRODUCT_ID_SET = new Set(COMPAT_CAKE_ORDER_PRODUCT_IDS)
const STORED_CAKE_ORDER_PRODUCT_ID_SET = new Set(STORED_CAKE_ORDER_PRODUCT_IDS)

export function isActiveCakeOrderProductId(value) {
  return typeof value === 'string' && ACTIVE_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}

export function isCompatCakeOrderProductId(value) {
  return typeof value === 'string' && COMPAT_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}

export function isStoredCakeOrderProductId(value) {
  return typeof value === 'string' && STORED_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}
