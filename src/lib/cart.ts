import { DEFAULT_CUPCAKE_FINISH, DEFAULT_VANILLA_CAKE_POINT_COLOR, MAX_RESERVATION_QUANTITY, isCupcakeProduct } from './constants.js'
import { getCakeCatalogEntryByProductId } from './cake-catalog.js'
import {
  getCakeDetailSelectionTotal,
  selectCakeDetailProduct,
  type CakeDetailSelection,
} from './cake-detail.js'
import { isCakePointColorProduct } from './constants.js'
import { getIndividualPackagingPricing, isIndividualPackagingEligibleProduct } from './individual-packaging.js'
import type {
  CakeSize,
  ChocolateType,
  PoundAddon,
  ProductId,
  VanillaCakeFlavor,
  VanillaCakePointColor,
  VanillaCakeSheet,
} from './types.js'

export const CART_STORAGE_KEY = 'verygood-au-cake-cart-v1'
export const CART_STORAGE_VERSION = 1 as const

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type CartLine = {
  lineKey: string
  selection: CakeDetailSelection
}

export function normalizeCartQuantity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_RESERVATION_QUANTITY, Math.max(1, Math.floor(value)))
}

export function normalizeCartSelection(selection: CakeDetailSelection): CakeDetailSelection | null {
  if (!getCakeCatalogEntryByProductId(selection.productId)) return null
  const normalized = selectCakeDetailProduct(selection, selection.productId)
  return {
    ...normalized,
    quantity: normalizeCartQuantity(selection.quantity),
  }
}

export function getCartLineKey(selection: CakeDetailSelection) {
  const normalized = normalizeCartSelection(selection)
  if (!normalized) return null
  const identity: unknown[] = [
    normalized.productId,
    normalized.cakeSize,
    normalized.chocolateType,
    normalized.poundAddon,
    normalized.chocolateIcingCount,
    normalized.vanillaCreamCount,
    normalized.partyDecorationCount,
    normalized.vanillaCakeSheet,
    normalized.vanillaCakeFlavor,
  ]
  if (isCakePointColorProduct(normalized.productId)) {
    identity.push(normalized.vanillaCakePointColor || DEFAULT_VANILLA_CAKE_POINT_COLOR)
  }
  if (isCupcakeProduct(normalized.productId)) identity.push(normalized.cupcakeFinish)
  if (isIndividualPackagingEligibleProduct(normalized.productId)) identity.push(normalized.individualPackaging)
  return JSON.stringify(identity)
}

export function addCartLine(lines: readonly CartLine[], selection: CakeDetailSelection): CartLine[] {
  const normalized = normalizeCartSelection(selection)
  if (!normalized) return [...lines]
  const lineKey = getCartLineKey(normalized)
  if (!lineKey) return [...lines]
  const existing = lines.find((line) => line.lineKey === lineKey)

  if (!existing) return [...lines, { lineKey, selection: normalized }]

  return lines.map((line) => line.lineKey === lineKey
    ? {
        lineKey,
        selection: {
          ...normalized,
          quantity: normalizeCartQuantity(line.selection.quantity + normalized.quantity),
        },
      }
    : line)
}

export function getCartTotalQuantity(lines: readonly CartLine[]) {
  return lines.reduce((total, line) => total + line.selection.quantity, 0)
}

export function getCartEstimatedSubtotal(lines: readonly CartLine[]) {
  return lines.reduce((subtotal, line) => subtotal + getCakeDetailSelectionTotal(line.selection), 0)
}

export function getCartEstimatedPricing(lines: readonly CartLine[]) {
  const productSubtotalCents = Math.round(getCartEstimatedSubtotal(lines) * 100)
  const packaging = getIndividualPackagingPricing(lines.map((line) => line.selection))
  return {
    productSubtotalCents,
    ...packaging,
    totalPriceCents: productSubtotalCents + packaging.individualPackagingFeeCents,
  }
}

export function updateCartLineQuantity(
  lines: readonly CartLine[],
  lineKey: string,
  quantity: number,
): CartLine[] {
  return lines.map((line) => line.lineKey === lineKey
    ? {
        ...line,
        selection: {
          ...line.selection,
          quantity: normalizeCartQuantity(quantity),
        },
      }
    : line)
}

export function removeCartLine(lines: readonly CartLine[], lineKey: string): CartLine[] {
  return lines.filter((line) => line.lineKey !== lineKey)
}

export function subtractSubmittedCartLines(
  lines: readonly CartLine[],
  submitted: readonly CartLine[],
): CartLine[] {
  const submittedQuantities = new Map<string, number>()
  for (const line of submitted) {
    submittedQuantities.set(
      line.lineKey,
      (submittedQuantities.get(line.lineKey) || 0) + line.selection.quantity,
    )
  }

  return lines.flatMap((line) => {
    const submittedQuantity = submittedQuantities.get(line.lineKey)
    if (!submittedQuantity) return [line]
    const remainingQuantity = line.selection.quantity - submittedQuantity
    if (remainingQuantity <= 0) return []
    return [{
      ...line,
      selection: { ...line.selection, quantity: remainingQuantity },
    }]
  })
}

function toPersistedSelection(selection: CakeDetailSelection): CakeDetailSelection | null {
  const normalized = normalizeCartSelection(selection)
  if (!normalized) return null
  return {
    productId: normalized.productId,
    cakeSize: normalized.cakeSize,
    chocolateType: normalized.chocolateType,
    poundAddon: normalized.poundAddon,
    cupcakeFinish: normalized.cupcakeFinish,
    chocolateIcingCount: normalized.chocolateIcingCount,
    vanillaCreamCount: normalized.vanillaCreamCount,
    partyDecorationCount: normalized.partyDecorationCount,
    vanillaCakeSheet: normalized.vanillaCakeSheet,
    vanillaCakeFlavor: normalized.vanillaCakeFlavor,
    ...(isCakePointColorProduct(normalized.productId)
      ? { vanillaCakePointColor: normalized.vanillaCakePointColor }
      : {}),
    individualPackaging: normalized.individualPackaging,
    quantity: normalized.quantity,
  }
}

export function serializeCartLines(lines: readonly CartLine[]) {
  return JSON.stringify({
    version: CART_STORAGE_VERSION,
    lines: lines.flatMap((line) => {
      const selection = toPersistedSelection(line.selection)
      return selection ? [selection] : []
    }),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSelection(value: unknown): CakeDetailSelection | null {
  if (!isRecord(value)) return null

  const {
    productId,
    cakeSize,
    chocolateType,
    poundAddon,
    cupcakeFinish,
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    vanillaCakeSheet,
    vanillaCakeFlavor,
    vanillaCakePointColor,
    individualPackaging,
    quantity,
  } = value

  if (
    typeof productId !== 'string' ||
    typeof cakeSize !== 'string' ||
    typeof chocolateType !== 'string' ||
    typeof poundAddon !== 'string' ||
    (cupcakeFinish !== undefined && typeof cupcakeFinish !== 'string') ||
    typeof chocolateIcingCount !== 'number' || !Number.isFinite(chocolateIcingCount) ||
    typeof vanillaCreamCount !== 'number' || !Number.isFinite(vanillaCreamCount) ||
    typeof partyDecorationCount !== 'number' || !Number.isFinite(partyDecorationCount) ||
    typeof vanillaCakeSheet !== 'string' ||
    typeof vanillaCakeFlavor !== 'string' ||
    (vanillaCakePointColor !== undefined && typeof vanillaCakePointColor !== 'string') ||
    (individualPackaging !== undefined && typeof individualPackaging !== 'boolean') ||
    typeof quantity !== 'number' || !Number.isFinite(quantity)
  ) return null

  const currentProduct = getCakeCatalogEntryByProductId(productId as ProductId)
  if (!currentProduct) return null

  return normalizeCartSelection({
    productId: productId as ProductId,
    cakeSize: cakeSize as CakeSize,
    chocolateType: chocolateType as ChocolateType,
    poundAddon: poundAddon as PoundAddon,
    cupcakeFinish: (typeof cupcakeFinish === 'string' ? cupcakeFinish : DEFAULT_CUPCAKE_FINISH) as CakeDetailSelection['cupcakeFinish'],
    chocolateIcingCount,
    vanillaCreamCount,
    partyDecorationCount,
    vanillaCakeSheet: vanillaCakeSheet as VanillaCakeSheet,
    vanillaCakeFlavor: vanillaCakeFlavor as VanillaCakeFlavor,
    ...(vanillaCakePointColor === undefined ? {} : {
      vanillaCakePointColor: vanillaCakePointColor as VanillaCakePointColor,
    }),
    individualPackaging: individualPackaging === true,
    quantity,
  })
}

export function parseCartLines(serialized: string | null | undefined): CartLine[] {
  if (!serialized) return []

  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value) || value.version !== CART_STORAGE_VERSION || !Array.isArray(value.lines)) return []

    return value.lines.reduce<CartLine[]>((lines, candidate) => {
      const selection = parseSelection(candidate)
      return selection ? addCartLine(lines, selection) : lines
    }, [])
  } catch {
    return []
  }
}

export function loadCartLines(storage: StorageLike): CartLine[] {
  try {
    return parseCartLines(storage.getItem(CART_STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveCartLines(storage: StorageLike, lines: readonly CartLine[]): void {
  try {
    storage.setItem(CART_STORAGE_KEY, serializeCartLines(lines))
  } catch {
    // Keep the in-memory cart usable when browser storage is unavailable or full.
  }
}
