import { formatCurrency } from './utils.js'

export const SMORE_STICK_UNIT_PRICE_CENTS = 450
export const SMORE_STICK_SET_UNIT_PRICES_CENTS: Record<10 | 25 | 50, number> = {
  10: 350,
  25: 300,
  50: 270,
}

export type SmorePricing = {
  quantity: number
  unitPriceCents: number
  baseTotalCents: number
  discountPercent: 0 | 10 | 20
  discountCents: number
  finalTotalCents: number
  formattedBaseTotal: string
  formattedFinalTotal: string
  discountLabel: string
}

export function calculateSmorePricing(quantity: number, language: 'en' | 'ko' = 'en'): SmorePricing {
  const qty = quantity === 25 || quantity === 50 ? quantity : 10
  const unitPriceCents = SMORE_STICK_SET_UNIT_PRICES_CENTS[qty]
  const baseTotalCents = qty * unitPriceCents
  const discountPercent = 0
  const discountCents = 0
  const finalTotalCents = baseTotalCents
  const discountLabel = language === 'ko' ? '세트 가격' : 'Set price'

  return {
    quantity: qty,
    unitPriceCents,
    baseTotalCents,
    discountPercent,
    discountCents,
    finalTotalCents,
    formattedBaseTotal: formatCurrency(baseTotalCents / 100),
    formattedFinalTotal: formatCurrency(finalTotalCents / 100),
    discountLabel,
  }
}
