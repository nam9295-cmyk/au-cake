export const SMORE_SET_QUANTITIES = [10, 25, 50] as const
export const DEFAULT_SMORE_SET_QUANTITY = SMORE_SET_QUANTITIES[0]

export function isValidSmoreQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity) && SMORE_SET_QUANTITIES.includes(quantity as typeof SMORE_SET_QUANTITIES[number])
}
