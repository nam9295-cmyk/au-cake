// Frozen September 2026 v1 contract. Never edit these historical definitions:
// introduce a new version when prices/options change, retaining this snapshot.
const CHOCOLATE_EXTRA_PRICES_V1 = Object.freeze({ none: 0, 'eiffel-6': 1000, 'pave-100g': 1200, combo: 2000 })

export const CHOCOLATE_PRODUCTS_V1 = Object.freeze(Object.fromEntries([
  ['almond-chocoball-80g', 'Almond Chocoball', '80g', 1200, true, 'almond-chocoball'],
  ['almond-chocoball-6pack', 'Almond Chocoball 6 Pack', '80g × 6', 6000, false, 'almond-chocoball'],
  ['almond-chocoball-black-tub-2x80g', 'Almond Chocoball Black Tub', '80g × 2', 2500, true, 'almond-chocoball'],
  ['pave-chocolate-100g', 'Pavé Chocolate', '100g', CHOCOLATE_EXTRA_PRICES_V1['pave-100g'], true, 'pave-chocolate'],
  ['eiffel-tower-chocolate-6', 'Eiffel Tower Chocolate', '6 pieces', CHOCOLATE_EXTRA_PRICES_V1['eiffel-6'], true, 'eiffel-tower-chocolate'],
].map(([id, name, saleUnit, unitPriceCents, couponEligible, family]) => [id, Object.freeze({ id, name, saleUnit, unitPriceCents, couponEligible, family })])))

export const CHOCOLATE_PRODUCTS = CHOCOLATE_PRODUCTS_V1

// Inert v1 transport fields only; these must never be rendered as cake options.
export const CHOCOLATE_OPTIONS_V1 = Object.freeze({
  cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
  chocolateIcingCount: 0, chocolateExtra: 'none', brownieCreamOption: 'none',
  vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla',
  vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink', individualPackaging: false,
})

export const CHOCOLATE_EXTRA_PRICES_CENTS = CHOCOLATE_EXTRA_PRICES_V1

export function getChocolateProduct(productId) {
  return typeof productId === 'string' && Object.hasOwn(CHOCOLATE_PRODUCTS, productId)
    ? CHOCOLATE_PRODUCTS[productId] : undefined
}

export function isChocolateProductId(productId) {
  return getChocolateProduct(productId) !== undefined
}

// Existing cake eligibility is unchanged; product validation belongs to callers.
export function isProductCouponEligible(productId) {
  return getChocolateProduct(productId)?.couponEligible ?? productId !== 'smore-stick'
}
