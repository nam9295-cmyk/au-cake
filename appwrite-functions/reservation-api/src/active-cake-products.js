export const ACTIVE_CAKE_ORDER_PRODUCT_IDS = Object.freeze([
  'pave-cake',
  'pound-cake',
  'cupcake-dozen',
  'choco-basque-cheesecake',
  'pave-choco-basque-cheesecake',
  'eiffel-tower-basque-cheesecake',
  'fresh-lemon-cupcakes-6',
  'fresh-lemon-cupcakes-8',
  'fresh-lemon-cupcakes-12',
  'fresh-lemon-cupcakes-16',
  'vanilla-fresh-cream-cake',
])

const ACTIVE_CAKE_ORDER_PRODUCT_ID_SET = new Set(ACTIVE_CAKE_ORDER_PRODUCT_IDS)

export function isActiveCakeOrderProductId(value) {
  return typeof value === 'string' && ACTIVE_CAKE_ORDER_PRODUCT_ID_SET.has(value)
}
