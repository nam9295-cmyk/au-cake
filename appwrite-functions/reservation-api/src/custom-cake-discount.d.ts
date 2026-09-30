import type { CustomCakeQuote, ManualDiscount, ManualDiscountSelection, QuoteAmounts } from '../../../src/lib/custom-cake-contract'
import type { SmorePricedLine } from '../../../src/lib/cake-wire-types'
export function validateManualDiscountSelection(value: ManualDiscountSelection | null): void
export function calculateCustomCakeManualDiscount(baseQuote: Pick<QuoteAmounts, 'baseCents' | 'cakeDiscountCents' | 'paidSmoreTotalCents' | 'paidSmoreQuantity'>, paidSmoreLines: SmorePricedLine[], designExtraCents: number | null, figurineExtraCents: number | null, selection: ManualDiscountSelection | null): ManualDiscount | null
export function validateCustomCakeManualDiscountQuote(quote: CustomCakeQuote, paidSmoreLines: SmorePricedLine[]): void
