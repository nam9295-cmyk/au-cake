// Existing server-only contact, date and coupon-code input primitives; no persistence or pricing.
import { ReservationApiError } from './reservation-error.js'

export const MARKET_TIMEZONE = 'Australia/Sydney'

export const GENERATED_REVIEW_COUPON_ANIMALS = [
  'FOX', 'CAT', 'DOG', 'OWL', 'PIG', 'BEE', 'COW', 'CUB', 'EMU', 'HEN', 'KOI', 'PUP', 'RAM', 'YAK', 'APE',
]

export const REVIEW_COUPON_ANIMALS = [...GENERATED_REVIEW_COUPON_ANIMALS, 'JENNIE']

export const REVIEW_COUPON_FRUITS = [
  'KIWI', 'FIG', 'LIME', 'PEAR', 'PLUM', 'APPLE', 'GRAPE', 'GUAVA', 'LEMON', 'MANGO', 'MELON', 'PEACH',
]

export const REVIEW_COUPON_PATTERN = new RegExp(
  `^(?:${GENERATED_REVIEW_COUPON_ANIMALS.join('|')})(?:${REVIEW_COUPON_FRUITS.join('|')})[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$`,
)

export const MANUAL_REVIEW_COUPON_PATTERN = /^JENNIE[A-Z0-9]{5}$/

export const SAFE_LAST4_PATTERN = /^[A-Z0-9]{4}$/

export function fail(code, status = 400) {
  throw new ReservationApiError(code, status)
}

export function normalizeReviewCouponCode(value) {
  if (typeof value !== 'string') fail('PROMO_CODE_INVALID')
  const normalized = value.trim().toUpperCase()
  if (!REVIEW_COUPON_PATTERN.test(normalized) && !MANUAL_REVIEW_COUPON_PATTERN.test(normalized)) fail('PROMO_CODE_INVALID')
  return normalized
}

export function requiredText(value, { min = 1, max, code }) {
  if (typeof value !== 'string') fail(code)
  const text = value.trim()
  if (text.length < min || (max !== undefined && text.length > max)) fail(code)
  return text
}

export function optionalText(value, { max, code }) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(code)
  const text = value.trim()
  if (text.length > max) fail(code)
  return text
}

export function normalizeAustralianMobile(value) {
  if (typeof value !== 'string') return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 9 && digits.startsWith('4')) return `0${digits}`
  if (digits.length === 11 && digits.startsWith('61')) return `0${digits.slice(2)}`
  return digits
}

export function validateAustralianMobile(value, code = 'INVALID_PHONE') {
  const phone = normalizeAustralianMobile(value)
  if (!/^04\d{8}$/.test(phone)) fail(code)
  return phone
}

export function validateEmail(value) {
  const email = requiredText(value, { max: 120, code: 'INVALID_EMAIL' }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_EMAIL')
  return email
}

export function isValidDateValue(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function zonedDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const number = (type) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
  }
}

export function sydneyDateValue(date = new Date()) {
  const { year, month, day } = zonedDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDaysToDateValue(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function sydneyTimeCode(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MARKET_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value || '00'
  return `${value('hour')}${value('minute')}${value('second')}`
}

export function zonedTimestamp(dateValue, timeValue) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!dateMatch || !timeMatch || !isValidDateValue(dateValue)) return null

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (target.hour > 23 || target.minute > 59) return null

  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  let timestamp = targetAsUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = zonedDateParts(new Date(timestamp))
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

  const resolved = zonedDateParts(new Date(timestamp))
  return Object.entries(target).every(([key, value]) => resolved[key] === value) ? timestamp : null
}

export function minutes(value) {
  if (typeof value !== 'string') return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}
