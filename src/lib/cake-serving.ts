import { AU_CAKE_SIZE_LABELS } from './market.js'
import type { CakeSize, ProductId } from './types.js'

export type CakeServingProfile = 'gateau' | 'genoise'

export const CURRENT_WHOLE_CAKE_SIZES = ['6in', '8in', '10in'] as const
const HISTORICAL_WHOLE_CAKE_SIZES = ['15cm', '19cm', '22cm'] as const
const HISTORICAL_WHOLE_CAKE_UNIT_PRICE_CENTS: Readonly<Partial<Record<ProductId, Readonly<Record<string, number>>>>> = {
  'pave-cake': { '15cm': 7900, '19cm': 9900, '22cm': 13700 },
  'buttercream-cake': { '15cm': 7400, '19cm': 9400, '22cm': 12800 },
}

type CurrentWholeCakeSize = typeof CURRENT_WHOLE_CAKE_SIZES[number]

const CURRENT_WHOLE_CAKE_PROFILES: Readonly<Partial<Record<ProductId, CakeServingProfile>>> = {
  'pave-cake': 'gateau',
  'buttercream-cake': 'gateau',
  'fresh-strawberry-vanilla-cream-cake': 'genoise',
  'fresh-strawberry-chocolate-cream-cake': 'genoise',
}

const CURRENT_SERVING_LABELS: Readonly<Record<CakeServingProfile, Readonly<Record<CurrentWholeCakeSize, string>>>> = {
  gateau: {
    '6in': '6" | serves approx. 8–10',
    '8in': '8" | serves approx. 14–18',
    '10in': '10" | serves approx. 24–28',
  },
  genoise: {
    '6in': '6" | serves approx. 6–8',
    '8in': '8" | serves approx. 10–14',
    '10in': '10" | serves approx. 16–20',
  },
}

export function isCurrentWholeCakeSize(value: CakeSize | string | undefined): value is CurrentWholeCakeSize {
  return CURRENT_WHOLE_CAKE_SIZES.includes(value as CurrentWholeCakeSize)
}

export function getCakeServingProfile(productId: ProductId): CakeServingProfile | null {
  return CURRENT_WHOLE_CAKE_PROFILES[productId] || null
}

export function isCurrentWholeCakeProduct(productId: ProductId): boolean {
  return getCakeServingProfile(productId) !== null
}

export function formatCurrentCakeSizeLabel(productId: ProductId, cakeSize: CakeSize): string | null {
  const profile = getCakeServingProfile(productId)
  if (!profile || !isCurrentWholeCakeSize(cakeSize)) return null
  return CURRENT_SERVING_LABELS[profile][cakeSize]
}

export function getCurrentWholeCakeSizeOptions(productId: ProductId): readonly CurrentWholeCakeSize[] {
  return isCurrentWholeCakeProduct(productId) ? CURRENT_WHOLE_CAKE_SIZES : []
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

export function formatStoredCakeSizeLabel(productId: ProductId, cakeSize: CakeSize): string {
  if (cakeSize === '15cm' || cakeSize === '19cm' || cakeSize === '22cm') return AU_CAKE_SIZE_LABELS[cakeSize]
  return formatCurrentCakeSizeLabel(productId, cakeSize) || String(cakeSize || '')
}

export function normalizeStoredCakeSize(cakeSize: CakeSize | undefined): CakeSize {
  return cakeSize || '15cm'
}
