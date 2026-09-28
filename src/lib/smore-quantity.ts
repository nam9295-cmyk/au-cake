// This is the Appwrite Int32 persistence ceiling, not a customer-facing business maximum.
export const SMORE_STORAGE_MAX_QUANTITY = 2_147_483_647

export function isValidSmoreQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity)
    && quantity >= 1
    && quantity <= SMORE_STORAGE_MAX_QUANTITY
}
