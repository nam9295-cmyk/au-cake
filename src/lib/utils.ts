import { formatCakeSizeLabel, formatCacaoLabel, formatChocolateTypeLabel, formatPoundAddonLabel, getProductById, PRODUCT_NAME, usesReservationChocolateType } from './constants.js'
import { marketConfig } from './market.js'
import type { Reservation, StoreSettings } from './types.js'

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

export function addDaysInputValue(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

export function generateReservationNumber(date = new Date()) {
  const ymd = dateInputValue(date).replaceAll('-', '')
  const time = timeCodeValue(date)
  const suffix = Math.floor(Math.random() * 900 + 100)
  // Existing reservations used the legacy VG-C-YYYYMMDD prefix. Lookup remains exact-match,
  // so historical numbers are still valid; new reservations include the market code.
  return `${marketConfig.reservationCodePrefix}-${ymd}-${time}${suffix}`
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

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

export function normalizePhone(phone: string) {
  if (marketConfig.market === 'AU') return phone.replace(/[^\d+ -]/g, '').trim()
  return phone.replace(/[^\d-]/g, '')
}

export function isValidPhone(phone: string) {
  return marketConfig.phoneRegex.test(phone.trim())
}

export function buildSmsMessage(reservation: Reservation, settings: StoreSettings = marketConfig.defaultSettings) {
  const product = getProductById(reservation.productId)
  const labels = marketConfig.smsLabels
  return `${labels.title}

${labels.greeting}
${labels.body}

${labels.reservationNumber}: ${reservation.reservationNumber}
${labels.productName}: ${PRODUCT_NAME} ${product.name}
${product.usesSizeOptions ? `${labels.size}: ${formatCakeSizeLabel(reservation.cakeSize)}\n` : ''}${product.usesCacaoOptions ? `${labels.cacao}: ${formatCacaoLabel(reservation.cacaoPercent)}\n` : ''}${usesReservationChocolateType(product.id, reservation.poundAddon) ? `Chocolate: ${formatChocolateTypeLabel(reservation.chocolateType)}\n` : ''}${product.usesPoundAddonOptions ? `Finish: ${formatPoundAddonLabel(reservation.poundAddon)}\n` : ''}${labels.pickupDate}: ${reservation.pickupDate}
${labels.pickupTime}: ${reservation.pickupTime}
${labels.quantity}: ${reservation.quantity}${marketConfig.copy.quantityUnit}
${labels.customerName}: ${reservation.customerName}

${marketConfig.copy.reservationCompleteText}

${labels.address}: ${settings.storeAddress}
${labels.contact}: ${settings.storePhone}

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
    getProductById(reservation.productId).usesSizeOptions ? formatCakeSizeLabel(reservation.cakeSize) : '-',
    getProductById(reservation.productId).usesCacaoOptions ? formatCacaoLabel(reservation.cacaoPercent) : '-',
    usesReservationChocolateType(getProductById(reservation.productId).id, reservation.poundAddon) ? formatChocolateTypeLabel(reservation.chocolateType) : '-',
    getProductById(reservation.productId).usesPoundAddonOptions ? formatPoundAddonLabel(reservation.poundAddon) : '-',
    String(reservation.quantity),
    reservation.pickupDate,
    reservation.pickupTime,
    reservation.requestNote,
    reservation.status,
    reservation.paymentStatus,
    String(reservation.totalPrice),
    reservation.adminMemo,
  ])
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}
