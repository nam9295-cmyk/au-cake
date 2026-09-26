export type ChocolateProductId = 'almond-chocoball-80g' | 'almond-chocoball-6pack' | 'almond-chocoball-black-tub-2x80g' | 'pave-chocolate-100g' | 'eiffel-tower-chocolate-6'
export interface ChocolateProduct {
  readonly id: ChocolateProductId
  readonly name: string
  readonly saleUnit: string
  readonly unitPriceCents: number
  readonly couponEligible: boolean
  readonly family: 'almond-chocoball' | 'pave-chocolate' | 'eiffel-tower-chocolate'
}
export const CHOCOLATE_PRODUCTS_V1: Readonly<Record<ChocolateProductId, ChocolateProduct>>
export const CHOCOLATE_PRODUCTS: typeof CHOCOLATE_PRODUCTS_V1
export const CHOCOLATE_OPTIONS_V1: Readonly<{
  cakeSize: '15cm'; chocolateType: 'dark'; poundAddon: 'none'; cupcakeFinish: 'basic';
  chocolateIcingCount: 0; chocolateExtra: 'none'; brownieCreamOption: 'none';
  vanillaCreamCount: 0; partyDecorationCount: 0; vanillaCakeSheet: 'vanilla';
  vanillaCakeFlavor: 'triple-berry'; vanillaCakePointColor: 'pink'; individualPackaging: false;
}>
export const CHOCOLATE_EXTRA_PRICES_CENTS: Readonly<{ none: 0; 'eiffel-6': 1000; 'pave-100g': 1200; combo: 2000 }>
export function getChocolateProduct(productId: unknown): ChocolateProduct | undefined
export function isChocolateProductId(productId: unknown): productId is ChocolateProductId
export function isProductCouponEligible(productId: string): boolean
