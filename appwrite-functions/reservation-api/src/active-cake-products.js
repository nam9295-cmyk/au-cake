export const ACTIVE_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  'pave-cake',
  'vanilla-fresh-cream-cake',
  'buttercream-cake',
  'pound-cake',
  'cupcake-half-dozen',
  'cupcake-dozen',
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
  'brownie-cheesecake',
  'pave-brownie-cheesecake',
  'eiffel-tower-brownie-cheesecake',
])

export const STORED_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  ...ACTIVE_CAKE_ORDER_PRODUCT_IDS,
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
])

const ACTIVE_CAKE_ORDER_PRODUCT_ID_SET = new Set(ACTIVE_CAKE_ORDER_PRODUCT_IDS)
const STORED_CAKE_ORDER_PRODUCT_ID_SET = new Set(STORED_CAKE_ORDER_PRODUCT_IDS)

export function isActiveCakeOrderProductId(value) {
  return typeof value === 'string' && ACTIVE_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}

export function isStoredCakeOrderProductId(value) {
  return typeof value === 'string' && STORED_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}
