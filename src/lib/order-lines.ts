import {
  CUPCAKE_PACK_SIZE,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  formatVanillaCakeFlavor,
  formatVanillaCakePointColor,
  getLemonIcingCount,
  getProductById,
  isCheesecakeProduct,
  getCupcakePackSize,
  isCupcakeProduct,
  isFreshLemonCupcakeProduct,
  isCreamLayerCakeProduct,
  isCakePointColorProduct,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  normalizeVanillaCakePointColor,
  usesReservationChocolateType,
} from './constants.js'
import { formatStoredCakeSizeLabel } from './cake-serving.js'
import { marketConfig } from './market.js'
import { formatChocolateExtra } from './chocolate-extras.js'
import type { CakeOrderLineRequest, CakeOrderLineResult, Reservation } from './types.js'
import { getIndividualPackagingPieceCount } from './individual-packaging.js'

function cupcakeFinishLabel(value: CakeOrderLineRequest['cupcakeFinish']) {
  if (value === 'vanilla-fresh-cream') return 'Vanilla Fresh Cream'
  if (value === 'chocolate-buttercream') return 'Chocolate Buttercream'
  return 'Basic'
}

export type ReservationOrderLine = CakeOrderLineRequest & Partial<Pick<
  CakeOrderLineResult,
  'unitPriceCents' | 'chocolateExtraCents' | 'subtotalCents' | 'discountPercent' | 'discountCents' | 'individualPackagingPieces' | 'individualPackagingFeeCents' | 'totalPriceCents'
>>

export function getReservationOrderLines(reservation: Reservation): ReservationOrderLine[] {
  if (reservation.orderLines?.length) return reservation.orderLines
  return [{
    productId: reservation.productId,
    cakeSize: reservation.cakeSize,
    chocolateType: reservation.chocolateType,
    poundAddon: reservation.poundAddon,
    ...(reservation.cupcakeFinish === undefined ? {} : { cupcakeFinish: reservation.cupcakeFinish }),
    chocolateIcingCount: reservation.chocolateIcingCount || 0,
    vanillaCreamCount: reservation.vanillaCreamCount || 0,
    partyDecorationCount: reservation.partyDecorationCount || 0,
    vanillaCakeSheet: reservation.vanillaCakeSheet || 'vanilla',
    vanillaCakeFlavor: reservation.vanillaCakeFlavor || 'triple-berry',
    chocolateExtra: reservation.chocolateExtra || 'none',
    ...(isCakePointColorProduct(reservation.productId)
      ? { vanillaCakePointColor: normalizeVanillaCakePointColor(reservation.productId, reservation.vanillaCakePointColor) }
      : {}),
    individualPackaging: reservation.individualPackaging === true,
    quantity: reservation.quantity,
    ...(reservation.individualPackagingPieces === undefined ? {} : { individualPackagingPieces: reservation.individualPackagingPieces }),
    ...(reservation.individualPackagingFeeCents === undefined ? {} : { individualPackagingFeeCents: reservation.individualPackagingFeeCents }),
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

function isCurrentVanillaSelection(line: ReservationOrderLine) {
  return line.productId === 'vanilla-fresh-cream-cake'
    && line.vanillaCakeSheet === 'chocolate'
    && line.vanillaCakeFlavor === 'plain'
}

function formatHistoricalVanillaFlavor(value: ReservationOrderLine['vanillaCakeFlavor']) {
  return value === 'plain' ? 'Plain fresh cream (legacy)' : formatVanillaCakeFlavor(value)
}

function formatHistoricalVanillaSheet(value: ReservationOrderLine['vanillaCakeSheet']) {
  return value === 'vanilla' ? 'Vanilla cake sheet' : 'Chocolate cake sheet'
}

export function formatOrderLineSummary(line: ReservationOrderLine) {
  const product = getProductById(line.productId)
  const details: string[] = [product.name]
  if (product.usesSizeOptions || isCheesecakeProduct(product.id)) details.push(formatStoredCakeSizeLabel(product.id, line.cakeSize))
  if (isCreamLayerCakeProduct(product.id)) {
    if (product.id === 'buttercream-cake') {
      details.push('Signature Gâteau au Chocolat layers')
      details.push('Chocolate Buttercream')
      details.push(`Cake colour: ${formatVanillaCakePointColor(line.vanillaCakePointColor)}`)
    } else if (isCurrentVanillaSelection(line)) {
      details.push('Signature Gâteau au Chocolat layers')
      details.push('Vanilla fresh cream with real vanilla bean')
      details.push(`Point colour: ${formatVanillaCakePointColor(line.vanillaCakePointColor)}`)
    } else {
      details.push(formatHistoricalVanillaSheet(line.vanillaCakeSheet))
      details.push(formatHistoricalVanillaFlavor(line.vanillaCakeFlavor))
      details.push(`Point colour: ${formatVanillaCakePointColor(line.vanillaCakePointColor)}`)
    }
  }
  if (usesReservationChocolateType(product.id, line.poundAddon)) details.push(formatChocolateTypeLabel(line.chocolateType))
  if (product.usesPoundAddonOptions) details.push(formatPoundAddonLabel(line.poundAddon))
  if (isFreshLemonCupcakeProduct(product.id)) {
    details.push(`Fresh lemon zest icing ${getLemonIcingCount(product.id, line.chocolateIcingCount)} / Dark couverture chocolate ${normalizeChocolateIcingCount(product.id, line.chocolateIcingCount)}`)
  }
  if (isCupcakeProduct(product.id)) {
    const packSize = getCupcakePackSize(product.id)
    if (line.cupcakeFinish !== undefined) {
      details.push(`${packSize === 6 ? 'Half Dozen' : 'Dozen'} · ${packSize} cupcakes`)
      details.push(cupcakeFinishLabel(line.cupcakeFinish))
    } else {
      const counts = normalizeCupcakeFinishCounts(product.id, line.vanillaCreamCount, line.partyDecorationCount)
      details.push(`Basic ${CUPCAKE_PACK_SIZE - counts.vanillaCreamCount - counts.partyDecorationCount} / Vanilla cream ${counts.vanillaCreamCount} / Party decoration ${counts.partyDecorationCount}`)
    }
  }
  if (line.chocolateExtra && line.chocolateExtra !== 'none') {
    const extraPrice = line.chocolateExtraCents
    details.push(`${formatChocolateExtra(line.chocolateExtra, 'en')}${Number.isSafeInteger(extraPrice) ? ` · ${formatLinePrice(extraPrice as number)}` : ''}`)
  }
  if (line.individualPackaging) {
    const pieces = line.individualPackagingPieces ?? getIndividualPackagingPieceCount(line.productId, line.quantity)
    const fee = line.individualPackagingFeeCents
    details.push(`Individual packaging: ${pieces} pieces · ${fee === 0 ? 'FREE' : Number.isSafeInteger(fee) ? formatLinePrice(fee as number) : 'fee pending'}`)
  }
  details.push(`x${line.quantity}`)
  if (Number.isSafeInteger(line.totalPriceCents)) details.push(formatLinePrice(line.totalPriceCents as number))
  return details.join(' · ')
}
