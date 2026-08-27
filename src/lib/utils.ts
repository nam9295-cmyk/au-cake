import {
  CUPCAKE_PACK_SIZE,
  formatCakeSizeLabel,
  formatCacaoLabel,
  formatChocolateTypeLabel,
  formatPoundAddonLabel,
  formatVanillaCakePointColor,
  getLemonIcingCount,
  getCupcakePackSize,
  getProductById,
  isCheesecakeProduct,
  isCupcakeProduct,
  isFreshLemonCupcakeProduct,
  isCreamLayerCakeProduct,
  normalizeChocolateIcingCount,
  normalizeCupcakeFinishCounts,
  usesReservationChocolateType,
} from './constants.js'
import { marketConfig } from './market.js'
import { formatCupcakeFinishText } from './i18n.js'
import { formatOrderLineSummary, getReservationItemCount, getReservationLineCount, getReservationOrderLines } from './order-lines.js'
import { getAuCakePickupTimeOptions, isAuCakePickupServiceTime } from './pickup-schedule.js'
import type { Reservation, StoreSettings } from './types.js'
import { escapeCsvCell } from './csv.js'

export function formatCurrency(value: number) {
  if (marketConfig.market === 'AU') return `AUD ${value.toFixed(2)}`

  return new Intl.NumberFormat(marketConfig.locale, {
    style: 'currency',
    currency: marketConfig.currency,
    ...marketConfig.currencyOptions,
  }).format(value)
}

export function dateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: marketConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || String(date.getFullYear())
  const month = parts.find((part) => part.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0')
  const day = parts.find((part) => part.type === 'day')?.value || String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeCodeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: marketConfig.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value || '00'
  const minute = parts.find((part) => part.type === 'minute')?.value || '00'
  const second = parts.find((part) => part.type === 'second')?.value || '00'
  return `${hour}${minute}${second}`
}

export function todayInputValue() {
  return dateInputValue(new Date())
}

export function addDaysToInputValue(dateValue: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) return dateValue

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addDaysInputValue(days: number) {
  return addDaysToInputValue(todayInputValue(), days)
}

export function generateReservationNumber(date = new Date()) {
  const ymd = dateInputValue(date).replaceAll('-', '')
  const time = timeCodeValue(date)
  const suffix = Math.floor(Math.random() * 900 + 100)
  // Existing reservations used the legacy VG-C-YYYYMMDD prefix. Lookup remains exact-match,
  // so historical numbers are still valid; new reservations include the market code.
  return `${marketConfig.reservationCodePrefix}-${ymd}-${time}${suffix}`
}

export function generateRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function isWeekend(dateValue: string) {
  const day = new Date(`${dateValue}T00:00:00`).getDay()
  return day === 0 || day === 6
}

export function timeOptionsForDate(dateValue: string, settings: StoreSettings) {
  if (marketConfig.market === 'AU') return getAuCakePickupTimeOptions(dateValue)
  const open = isWeekend(dateValue) ? settings.weekendOpen : settings.weekdayOpen
  const close = isWeekend(dateValue) ? settings.weekendClose : settings.weekdayClose
  const [openHour, openMinute] = open.split(':').map(Number)
  const [closeHour, closeMinute] = close.split(':').map(Number)
  const start = openHour * 60 + openMinute
  const end = closeHour * 60 + closeMinute
  const result: string[] = []

  for (let minutes = start; minutes <= end; minutes += 30) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    result.push(`${hh}:${mm}`)
  }

  return result
}

export const PICKUP_CUTOFF_HOUR = 20
export const LATE_ORDER_NEXT_DAY_START_MINUTES = 12 * 60
export const PICKUP_TIME_TOO_SOON_ERROR = 'PICKUP_TIME_TOO_SOON'
export const PICKUP_TIME_UNAVAILABLE_ERROR = 'PICKUP_TIME_UNAVAILABLE'

function zonedDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: marketConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  }
}

function zonedPickupTimestamp(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!dateMatch || !timeMatch) return null

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31 || target.hour > 23 || target.minute > 59) {
    return null
  }

  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  const normalizedTarget = new Date(targetAsUtc)
  if (
    normalizedTarget.getUTCFullYear() !== target.year ||
    normalizedTarget.getUTCMonth() !== target.month - 1 ||
    normalizedTarget.getUTCDate() !== target.day
  ) {
    return null
  }

  let timestamp = targetAsUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = zonedDateTimeParts(new Date(timestamp))
    const representedAsUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    )
    const adjustment = targetAsUtc - representedAsUtc
    timestamp += adjustment
    if (adjustment === 0) break
  }

  const resolved = zonedDateTimeParts(new Date(timestamp))
  return Object.entries(target).every(([key, value]) => resolved[key as keyof typeof resolved] === value) ? timestamp : null
}

export function isSchoolPickupWindowClosed(_dateValue: string, _timeValue: string) {
  // Daily Cake pickup availability is determined by the shared schedule only.
  void _dateValue
  void _timeValue
  return false
}

export function isCakePickupServiceTime(dateValue: string, timeValue: string) {
  if (marketConfig.market !== 'AU') return zonedPickupTimestamp(dateValue, timeValue) !== null
  return zonedPickupTimestamp(dateValue, timeValue) !== null
    && isAuCakePickupServiceTime(dateValue, timeValue)
}

export function isPickupTimeAllowed(dateValue: string, timeValue: string, now = new Date()) {
  if (zonedPickupTimestamp(dateValue, timeValue) === null) return false
  if (!isCakePickupServiceTime(dateValue, timeValue)) return false

  const today = dateInputValue(now)
  const tomorrow = addDaysToInputValue(today, 1)
  if (dateValue <= today) return false
  if (dateValue > tomorrow) return true

  const currentSydneyHour = zonedDateTimeParts(now).hour
  if (currentSydneyHour < PICKUP_CUTOFF_HOUR) return true

  const [pickupHour, pickupMinute] = timeValue.split(':').map(Number)
  return pickupHour * 60 + pickupMinute >= LATE_ORDER_NEXT_DAY_START_MINUTES
}

export function customerTimeOptionsForDate(dateValue: string, settings: StoreSettings, now = new Date()) {
  return timeOptionsForDate(dateValue, settings).filter((time) => isPickupTimeAllowed(dateValue, time, now))
}

export function firstCustomerPickupDate(settings: StoreSettings, now = new Date()) {
  const today = dateInputValue(now)
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = addDaysToInputValue(today, offset)
    if (customerTimeOptionsForDate(candidate, settings, now).length > 0) return candidate
  }
  return addDaysToInputValue(today, 1)
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

export function normalizePhone(phone: string) {
  if (marketConfig.market === 'AU') {
    const trimmed = phone.trim()
    const digits = trimmed.replace(/\D/g, '')

    if (digits.length === 9 && digits.startsWith('4')) return `0${digits}`
    if (digits.length === 11 && digits.startsWith('61')) return `0${digits.slice(2)}`

    return digits
  }
  return phone.replace(/[^\d-]/g, '')
}

export function isValidPhone(phone: string) {
  if (marketConfig.market === 'AU') {
    const digits = phone.replace(/\D/g, '')
    return /^04\d{8}$/.test(digits)
  }

  return marketConfig.phoneRegex.test(phone.trim())
}

function formatLemonIcingMix(reservation: Reservation, korean = false) {
  const lemonCount = getLemonIcingCount(reservation.productId, reservation.chocolateIcingCount)
  const chocolateCount = normalizeChocolateIcingCount(reservation.productId, reservation.chocolateIcingCount)
  return korean
    ? `마감 구성: 생레몬 제스트 아이싱 ${lemonCount}개 / 다크 커버춰 초콜릿 ${chocolateCount}개\n`
    : `Finishing mix: Fresh lemon zest icing ${lemonCount} / Dark couverture chocolate ${chocolateCount}\n`
}

function formatCupcakeFinishMix(reservation: Reservation, korean = false) {
  if (reservation.cupcakeFinish !== undefined) {
    const packSize = getCupcakePackSize(reservation.productId)
    return korean
      ? `구성: ${packSize === 6 ? '하프 더즌' : '더즌'} · ${packSize}개\n마감: ${formatCupcakeFinishText(reservation.cupcakeFinish, 'ko')}\n`
      : `Pack: ${packSize === 6 ? 'Half Dozen' : 'Dozen'} · ${packSize} cupcakes\nFinish: ${formatCupcakeFinishText(reservation.cupcakeFinish, 'en')}\n`
  }
  const counts = normalizeCupcakeFinishCounts(
    reservation.productId,
    reservation.vanillaCreamCount,
    reservation.partyDecorationCount,
  )
  const basicCount = CUPCAKE_PACK_SIZE - counts.vanillaCreamCount - counts.partyDecorationCount
  return korean
    ? `마감 구성: 기본 ${basicCount}개 / 바닐라 크림 ${counts.vanillaCreamCount}개 / 파티용 데코 ${counts.partyDecorationCount}개\n`
    : `Finishing mix: Basic ${basicCount} / Vanilla cream ${counts.vanillaCreamCount} / Party decoration ${counts.partyDecorationCount}\n`
}

function formatIndividualPackaging(reservation: Reservation, korean = false) {
  if (!reservation.individualPackaging) return ''
  const pieces = reservation.individualPackagingPieces || 0
  const fee = reservation.individualPackagingFeeCents === 0
    ? 'FREE'
    : formatCurrency((reservation.individualPackagingFeeCents || 0) / 100)
  return korean
    ? `개별 포장: ${pieces}개 · ${fee}\n`
    : `Individual packaging: ${pieces} pieces · ${fee}\n`
}

function formatAuCreamCakeDetails(reservation: Reservation) {
  if (!isCreamLayerCakeProduct(reservation.productId)) return ''
  const colour = formatVanillaCakePointColor(reservation.vanillaCakePointColor)
  if (reservation.productId === 'buttercream-cake') {
    return `Layers: Signature Gâteau au Chocolat layers\nFilling: Chocolate Buttercream\nCake colour: ${colour}\n`
  }
  if (reservation.vanillaCakeSheet === 'chocolate' && reservation.vanillaCakeFlavor === 'plain') {
    return `Layers: Signature Gâteau au Chocolat layers\nFilling: Vanilla fresh cream with real vanilla bean\nPoint colour: ${colour}\n`
  }
  const sheet = reservation.vanillaCakeSheet === 'vanilla' ? 'Vanilla cake sheet' : 'Chocolate cake sheet'
  const flavour = reservation.vanillaCakeFlavor === 'plain'
    ? 'Plain fresh cream (legacy)'
    : reservation.vanillaCakeFlavor === 'nutella-chocolate-chip' ? 'Nutella chocolate chip' : 'Triple berry'
  return `Cake sheet: ${sheet}\nFlavour: ${flavour}\nPoint colour: ${colour}\n`
}

export function buildSmsMessage(reservation: Reservation, settings: StoreSettings = marketConfig.defaultSettings) {
  const product = getProductById(reservation.productId)
  const labels = marketConfig.smsLabels
  const orderLines = getReservationOrderLines(reservation)

  if (marketConfig.market === 'AU' && orderLines.length > 1) {
    const itemLines = orderLines.map((line, index) => `${index + 1}. ${formatOrderLineSummary(line)}`).join('\n')
    return `${labels.title}

Thank you for your order ${reservation.customerName}. (${reservation.customerPhone})

${labels.reservationNumber}: ${reservation.reservationNumber}
Items:
${itemLines}
Total items: ${getReservationItemCount(reservation)}
Total: ${formatCurrency(reservation.totalPriceCents === undefined ? reservation.totalPrice : reservation.totalPriceCents / 100)}
${labels.pickupDate}: ${reservation.pickupDate}
${labels.pickupTime}: ${reservation.pickupTime}
Pick-up location: https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw

Thank you for your order:)
Have a verygood day!`
  }

  if (marketConfig.market === 'AU') {
    return `${labels.title}

Thank you for your order ${reservation.customerName}. (${reservation.customerPhone})

${labels.reservationNumber}: ${reservation.reservationNumber}
${labels.productName}: ${product.name}
${(product.usesSizeOptions || isCheesecakeProduct(product.id)) ? `${labels.size}: ${formatCakeSizeLabel(reservation.cakeSize)}\n` : ''}${labels.quantity}: ${reservation.quantity}${marketConfig.copy.quantityUnit}
${formatAuCreamCakeDetails(reservation)}${product.usesCacaoOptions ? `${labels.cacao}: ${formatCacaoLabel(reservation.cacaoPercent)}\n` : ''}${usesReservationChocolateType(product.id, reservation.poundAddon) ? `Chocolate: ${formatChocolateTypeLabel(reservation.chocolateType)}\n` : ''}${product.usesPoundAddonOptions ? `Finish: ${formatPoundAddonLabel(reservation.poundAddon)}\n` : ''}${isFreshLemonCupcakeProduct(product.id) ? formatLemonIcingMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${isCupcakeProduct(product.id) ? formatCupcakeFinishMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${formatIndividualPackaging(reservation, marketConfig.locale.startsWith('ko'))}${labels.pickupDate}: ${reservation.pickupDate}
${labels.pickupTime}: ${reservation.pickupTime}
Total: ${formatCurrency(reservation.totalPriceCents === undefined ? reservation.totalPrice : reservation.totalPriceCents / 100)}
Pick-up location: https://maps.app.goo.gl/bSVbF8M5BCdxJeDRA?g_st=iw

Thank you for your order:)
Have a verygood day!`
  }

  const contactLine = /TBC/i.test(settings.storePhone) ? '' : `${labels.contact}: ${settings.storePhone}\n`
  return `${labels.title}

${labels.greeting}
${labels.body}

${labels.reservationNumber}: ${reservation.reservationNumber}
${labels.productName}: ${product.name}
${(product.usesSizeOptions || isCheesecakeProduct(product.id)) ? `${labels.size}: ${formatCakeSizeLabel(reservation.cakeSize)}\n` : ''}${product.usesCacaoOptions ? `${labels.cacao}: ${formatCacaoLabel(reservation.cacaoPercent)}\n` : ''}${usesReservationChocolateType(product.id, reservation.poundAddon) ? `Chocolate: ${formatChocolateTypeLabel(reservation.chocolateType)}\n` : ''}${product.usesPoundAddonOptions ? `Finish: ${formatPoundAddonLabel(reservation.poundAddon)}\n` : ''}${isFreshLemonCupcakeProduct(product.id) ? formatLemonIcingMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${isCupcakeProduct(product.id) ? formatCupcakeFinishMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${labels.pickupDate}: ${reservation.pickupDate}
${labels.pickupTime}: ${reservation.pickupTime}
${labels.quantity}: ${reservation.quantity}${marketConfig.copy.quantityUnit}
${labels.customerName}: ${reservation.customerName}

${marketConfig.copy.reservationCompleteText}

${labels.address}: ${settings.storeAddress}
${contactLine}
${labels.thanks}
${marketConfig.copy.smsFooter}`
}

export function reservationsToCsv(reservations: Reservation[]) {
  const headers = [...marketConfig.csvHeaders.slice(0, 4), 'Email', ...marketConfig.csvHeaders.slice(4), 'Order line count', 'Order item count', 'Order items']
  const rows = reservations.map((reservation) => [
    reservation.createdAt,
    reservation.reservationNumber,
    reservation.customerName,
    reservation.customerPhone,
    reservation.customerEmail || '',
    getProductById(reservation.productId).name,
    (getProductById(reservation.productId).usesSizeOptions || isCheesecakeProduct(reservation.productId)) ? formatCakeSizeLabel(reservation.cakeSize) : '-',
    getProductById(reservation.productId).usesCacaoOptions ? formatCacaoLabel(reservation.cacaoPercent) : '-',
    usesReservationChocolateType(getProductById(reservation.productId).id, reservation.poundAddon) ? formatChocolateTypeLabel(reservation.chocolateType) : '-',
    getProductById(reservation.productId).usesPoundAddonOptions ? formatPoundAddonLabel(reservation.poundAddon) : '-',
    isFreshLemonCupcakeProduct(reservation.productId)
      ? `Fresh lemon zest icing ${getLemonIcingCount(reservation.productId, reservation.chocolateIcingCount)} / Dark couverture chocolate ${normalizeChocolateIcingCount(reservation.productId, reservation.chocolateIcingCount)}`
      : isCupcakeProduct(reservation.productId)
        ? formatCupcakeFinishMix(reservation).replace(/^Finishing mix: /, '').trim()
        : '-',
    String(reservation.quantity),
    reservation.pickupDate,
    reservation.pickupTime,
    reservation.requestNote,
    reservation.status,
    reservation.paymentStatus,
    formatCurrency(reservation.totalPrice),
    reservation.adminMemo,
    String(getReservationLineCount(reservation)),
    String(getReservationItemCount(reservation)),
    getReservationOrderLines(reservation).map(formatOrderLineSummary).join(' | '),
  ])
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}
