import { formatCurrency } from './utils.js'

export const SMORE_STICK_UNIT_PRICE_CENTS = 450

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
  const qty = Math.max(1, Math.floor(quantity || 1))
  const baseTotalCents = qty * SMORE_STICK_UNIT_PRICE_CENTS

  let discountPercent: 0 | 10 | 20 = 0
  if (qty >= 12) {
    discountPercent = 20
  } else if (qty >= 6) {
    discountPercent = 10
  }

  const discountCents = Math.round((baseTotalCents * discountPercent) / 100)
  const finalTotalCents = baseTotalCents - discountCents

  let discountLabel = ''
  if (discountPercent > 0) {
    discountLabel = language === 'ko'
      ? `${discountPercent}% 대량 할인 적용`
      : `${discountPercent}% bulk discount applied`
  }

  return {
    quantity: qty,
    unitPriceCents: SMORE_STICK_UNIT_PRICE_CENTS,
    baseTotalCents,
    discountPercent,
    discountCents,
    finalTotalCents,
    formattedBaseTotal: formatCurrency(baseTotalCents / 100),
    formattedFinalTotal: formatCurrency(finalTotalCents / 100),
    discountLabel,
  }
}
