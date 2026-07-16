import { formatCakeSizeLabel, formatCacaoLabel, formatChocolateTypeLabel, formatPoundAddonLabel, getLemonIcingCount, getProductById, isFreshLemonCupcakeProduct, normalizeChocolateIcingCount, usesReservationChocolateType } from './constants.js'
import { marketConfig } from './market.js'
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

export function isPickupTimeAllowed(dateValue: string, timeValue: string, now = new Date()) {
  if (zonedPickupTimestamp(dateValue, timeValue) === null) return false

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
    ? `아이싱: 레몬 ${lemonCount}개 / 초코 ${chocolateCount}개\n`
    : `Icing mix: Lemon ${lemonCount} / Chocolate ${chocolateCount}\n`
}

export function buildSmsMessage(reservation: Reservation, settings: StoreSettings = marketConfig.defaultSettings) {
  const product = getProductById(reservation.productId)
  const labels = marketConfig.smsLabels

  if (marketConfig.market === 'AU') {
    return `${labels.title}

Thank you for your order ${reservation.customerName}. (${reservation.customerPhone})

${labels.reservationNumber}: ${reservation.reservationNumber}
${labels.productName}: ${product.name}
${(product.usesSizeOptions || product.id === 'choco-basque-cheesecake' || product.id === 'pave-choco-basque-cheesecake') ? `${labels.size}: ${formatCakeSizeLabel(reservation.cakeSize)}\n` : ''}${labels.quantity}: ${reservation.quantity}${marketConfig.copy.quantityUnit}
${product.usesCacaoOptions ? `${labels.cacao}: ${formatCacaoLabel(reservation.cacaoPercent)}\n` : ''}${usesReservationChocolateType(product.id, reservation.poundAddon) ? `Chocolate: ${formatChocolateTypeLabel(reservation.chocolateType)}\n` : ''}${product.usesPoundAddonOptions ? `Finish: ${formatPoundAddonLabel(reservation.poundAddon)}\n` : ''}${isFreshLemonCupcakeProduct(product.id) ? formatLemonIcingMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${labels.pickupDate}: ${reservation.pickupDate}
${labels.pickupTime}: ${reservation.pickupTime}
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
${(product.usesSizeOptions || product.id === 'choco-basque-cheesecake' || product.id === 'pave-choco-basque-cheesecake') ? `${labels.size}: ${formatCakeSizeLabel(reservation.cakeSize)}\n` : ''}${product.usesCacaoOptions ? `${labels.cacao}: ${formatCacaoLabel(reservation.cacaoPercent)}\n` : ''}${usesReservationChocolateType(product.id, reservation.poundAddon) ? `Chocolate: ${formatChocolateTypeLabel(reservation.chocolateType)}\n` : ''}${product.usesPoundAddonOptions ? `Finish: ${formatPoundAddonLabel(reservation.poundAddon)}\n` : ''}${isFreshLemonCupcakeProduct(product.id) ? formatLemonIcingMix(reservation, marketConfig.locale.startsWith('ko')) : ''}${labels.pickupDate}: ${reservation.pickupDate}
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
  const headers = marketConfig.csvHeaders
  const rows = reservations.map((reservation) => [
    reservation.createdAt,
    reservation.reservationNumber,
    reservation.customerName,
    reservation.customerPhone,
    getProductById(reservation.productId).name,
    (getProductById(reservation.productId).usesSizeOptions || reservation.productId === 'choco-basque-cheesecake' || reservation.productId === 'pave-choco-basque-cheesecake') ? formatCakeSizeLabel(reservation.cakeSize) : '-',
    getProductById(reservation.productId).usesCacaoOptions ? formatCacaoLabel(reservation.cacaoPercent) : '-',
    usesReservationChocolateType(getProductById(reservation.productId).id, reservation.poundAddon) ? formatChocolateTypeLabel(reservation.chocolateType) : '-',
    getProductById(reservation.productId).usesPoundAddonOptions ? formatPoundAddonLabel(reservation.poundAddon) : '-',
    isFreshLemonCupcakeProduct(reservation.productId)
      ? `Lemon ${getLemonIcingCount(reservation.productId, reservation.chocolateIcingCount)} / Chocolate ${normalizeChocolateIcingCount(reservation.productId, reservation.chocolateIcingCount)}`
      : '-',
    String(reservation.quantity),
    reservation.pickupDate,
    reservation.pickupTime,
    reservation.requestNote,
    reservation.status,
    reservation.paymentStatus,
    String(reservation.totalPrice),
    reservation.adminMemo,
  ])
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}
