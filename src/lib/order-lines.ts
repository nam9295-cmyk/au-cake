import {
  CUPCAKE_PACK_SIZE,
  formatCakeSizeLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  formatVanillaCakePointColor,
  getLemonIcingCount,
  getProductById,
  isCheesecakeProduct,
  isCupcakeDozenProduct,
  isFreshLemonCupcakeProduct,
  isVanillaFreshCreamCakeProduct,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizeVanillaCakePointColor,
  usesReservationChocolateType,
} from './constants.js'
import { marketConfig } from './market.js'
import type { CakeOrderLineRequest, CakeOrderLineResult, Reservation } from './types.js'

export type ReservationOrderLine = CakeOrderLineRequest & Partial<Pick<
  CakeOrderLineResult,
  'unitPriceCents' | 'subtotalCents' | 'discountPercent' | 'discountCents' | 'totalPriceCents'
>>

export function getReservationOrderLines(reservation: Reservation): ReservationOrderLine[] {
  if (reservation.orderLines?.length) return reservation.orderLines
  return [{
    productId: reservation.productId,
    cakeSize: reservation.cakeSize,
    chocolateType: reservation.chocolateType,
    poundAddon: reservation.poundAddon,
    chocolateIcingCount: reservation.chocolateIcingCount || 0,
    vanillaCreamCount: reservation.vanillaCreamCount || 0,
    partyDecorationCount: reservation.partyDecorationCount || 0,
    vanillaCakeSheet: reservation.vanillaCakeSheet || 'vanilla',
    vanillaCakeFlavor: reservation.vanillaCakeFlavor || 'triple-berry',
    ...(isVanillaFreshCreamCakeProduct(reservation.productId)
      ? { vanillaCakePointColor: normalizeVanillaCakePointColor(reservation.productId, reservation.vanillaCakePointColor) }
      : {}),
    quantity: reservation.quantity,
    ...(reservation.totalPriceCents !== undefined ? { totalPriceCents: reservation.totalPriceCents } : {}),
  }]
}

export function getReservationLineCount(reservation: Reservation) {
  return reservation.orderLineCount ?? getReservationOrderLines(reservation).length
}

export function getReservationItemCount(reservation: Reservation) {
  return reservation.orderItemCount
    ?? getReservationOrderLines(reservation).reduce((total, line) => total + line.quantity, 0)
}

function formatLinePrice(cents: number) {
  if (marketConfig.market === 'AU') return `AUD ${(cents / 100).toFixed(2)}`
  return new Intl.NumberFormat(marketConfig.locale, {
    style: 'currency',
    currency: marketConfig.currency,
    ...marketConfig.currencyOptions,
  }).format(cents / 100)
}

export function formatOrderLineSummary(line: ReservationOrderLine) {
  const product = getProductById(line.productId)
  const details: string[] = [product.name]
  if (product.usesSizeOptions || isCheesecakeProduct(product.id)) details.push(formatCakeSizeLabel(line.cakeSize))
  if (product.id === 'vanilla-fresh-cream-cake') {
    details.push('Chocolate sheet')
    details.push(line.vanillaCakeFlavor === 'nutella-chocolate-chip' ? 'Nutella chocolate chip' : 'Triple berry')
    details.push(`Point colour: ${formatVanillaCakePointColor(line.vanillaCakePointColor)}`)
  }
  if (usesReservationChocolateType(product.id, line.poundAddon)) details.push(formatChocolateTypeLabel(line.chocolateType))
  if (product.usesPoundAddonOptions) details.push(formatPoundAddonLabel(line.poundAddon))
  if (isFreshLemonCupcakeProduct(product.id)) {
    details.push(`Fresh lemon zest icing ${getLemonIcingCount(product.id, line.chocolateIcingCount)} / Dark couverture chocolate ${normalizeChocolateIcingCount(product.id, line.chocolateIcingCount)}`)
  }
  if (isCupcakeDozenProduct(product.id)) {
    const counts = normalizeCupcakeFinishCounts(product.id, line.vanillaCreamCount, line.partyDecorationCount)
    details.push(`Basic ${CUPCAKE_PACK_SIZE - counts.vanillaCreamCount - counts.partyDecorationCount} / Vanilla cream ${counts.vanillaCreamCount} / Party decoration ${counts.partyDecorationCount}`)
  }
  details.push(`x${line.quantity}`)
  if (Number.isSafeInteger(line.totalPriceCents)) details.push(formatLinePrice(line.totalPriceCents as number))
  return details.join(' · ')
}
