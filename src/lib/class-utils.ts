import type { ClassAgeGroup, ClassBookingType, ClassPartySize, ClassReservation, ClassType } from './types.js'
import { escapeCsvCell } from './csv.js'
import { MARKET_CONFIG } from './market.js'

export const CLASS_TYPE_ID = 'school-holiday-private-cake-class' as const
export const CLASS_TYPE_IDS: readonly ClassType[] = [CLASS_TYPE_ID, 'cupcake-chocolate-class']
export const CLASS_SESSION_TIMES = ['10:00', '13:00', '16:00'] as const
export const CLASS_SESSION_DURATION_MINUTES = 120
export const CLASS_DEPOSIT_AMOUNT = 0
export const CLASS_PAYMENT_SETTINGS = MARKET_CONFIG.AU.defaultSettings

export const CLASS_STATUS_OPTIONS = ['Requested', 'Confirmed', 'Completed', 'Cancelled'] as const
export const CLASS_PAYMENT_STATUS_OPTIONS = [
  'Payment pending',
  'Fully paid',
  'Refund required',
  'Pending deposit',
  'Deposit paid',
] as const

const CLASS_BOOKING_PRICES: Record<ClassBookingType, number> = {
  'year-1-2': 99,
  '1-child': 109,
  '2-friends': 198,
}

export function getClassBookingPrice(bookingType: ClassBookingType) {
  return CLASS_BOOKING_PRICES[bookingType]
}

export function getClassTypeLabel(classType: ClassType) {
  return classType === 'cupcake-chocolate-class' ? '4 Cupcakes & Chocolate Class' : 'Chocolate Cake Course'
}

export function getClassBookingType(ageGroup: ClassAgeGroup, partySize: ClassPartySize): ClassBookingType {
  if (partySize === 2) return '2-friends'
  return ageGroup === 'kindy-year-2' ? 'year-1-2' : '1-child'
}

export function getClassDepositAmount() {
  return CLASS_DEPOSIT_AMOUNT
}

export type ClassBookedSlot = Pick<ClassReservation, 'classDate' | 'classTime'> | string

export type CakePickupOpening = {
  pickupDate: string
  pickupTime: string
}

function getBookedSlotDate(entry: ClassBookedSlot) {
  return typeof entry === 'string' ? entry : entry.classDate
}

function getBookedSlotTime(entry: ClassBookedSlot) {
  return typeof entry === 'string' ? '' : entry.classTime
}

function isBookedSlotEntryActive(entry: ClassBookedSlot) {
  return typeof entry === 'string' || !('status' in entry) || entry.status !== 'Cancelled'
}

export function isClassSessionTimeBooked(classDate: string, classTime: string, reservations: ClassBookedSlot[]) {
  if (!classDate || !classTime) return false
  return reservations.some((reservation) => {
    if (getBookedSlotDate(reservation) !== classDate || !isBookedSlotEntryActive(reservation)) return false
    const bookedTime = getBookedSlotTime(reservation)
    // Legacy public availability rows only had classDate. Treat those as whole-day blocks
    // until the Appwrite booked-slot migration has rewritten them with classTime.
    return !bookedTime || bookedTime === classTime
  })
}

export function isClassDateBooked(classDate: string, reservations: ClassBookedSlot[]) {
  if (!classDate) return false
  return CLASS_SESSION_TIMES.every((time) => isClassSessionTimeBooked(classDate, time, reservations))
}

export function getAvailableClassSessionTimes(classDate: string, reservations: ClassBookedSlot[]) {
  if (!classDate) return [...CLASS_SESSION_TIMES]
  return CLASS_SESSION_TIMES.filter((time) => !isClassSessionTimeBooked(classDate, time, reservations))
}

export function getClassSlotAvailability(classDate: string, reservations: ClassBookedSlot[]) {
  const availableTimes = getAvailableClassSessionTimes(classDate, reservations)
  const bookedTimes = CLASS_SESSION_TIMES.filter((time) => !availableTimes.includes(time))
  return {
    classDate,
    availableTimes,
    bookedTimes,
    isFullyBooked: availableTimes.length === 0,
  }
}

type ActiveClassSlot = {
  classTime: string | null
}

function isValidClassDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function classTimeToMinutes(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function isKnownClassSessionTime(value: string): value is (typeof CLASS_SESSION_TIMES)[number] {
  return CLASS_SESSION_TIMES.some((classTime) => classTime === value)
}

function activeClassSlotForDate(entry: unknown, classDate: string): ActiveClassSlot | null {
  if (typeof entry === 'string') {
    return entry === classDate && isValidClassDate(entry) ? { classTime: null } : null
  }
  if (!entry || typeof entry !== 'object') return null

  const slot = entry as Record<string, unknown>
  if (slot.status === 'Cancelled' || slot.classDate !== classDate || !isValidClassDate(slot.classDate)) return null
  if (slot.classTime === undefined || slot.classTime === null || slot.classTime === '') return { classTime: null }
  if (typeof slot.classTime !== 'string') return null
  if (!slot.classTime.trim()) return null
  if (classTimeToMinutes(slot.classTime) === null) return null
  return { classTime: slot.classTime }
}

function hasExactCakePickupOpening(
  pickupDate: string,
  pickupTime: string,
  pickupOpenings: readonly CakePickupOpening[],
) {
  if (!Array.isArray(pickupOpenings)) return false
  return pickupOpenings.some((opening: unknown) => {
    if (!opening || typeof opening !== 'object') return false
    const candidate = opening as Record<string, unknown>
    return candidate.pickupDate === pickupDate && candidate.pickupTime === pickupTime
  })
}

export function isCakePickupBlockedByClass(
  pickupDate: string,
  pickupTime: string,
  bookedSlots: readonly ClassBookedSlot[],
  pickupOpenings: readonly CakePickupOpening[] = [],
) {
  if (!isValidClassDate(pickupDate)) return false
  const pickupMinutes = classTimeToMinutes(pickupTime)
  if (pickupMinutes === null) return false
  if (hasExactCakePickupOpening(pickupDate, pickupTime, pickupOpenings)) return false

  const entries = Array.isArray(bookedSlots) ? bookedSlots : []
  const activeSlots = entries
    .map((entry) => activeClassSlotForDate(entry, pickupDate))
    .filter((slot): slot is ActiveClassSlot => slot !== null)

  if (activeSlots.some((slot) => slot.classTime === null)) return true

  const bookedSessionTimes = new Set(
    activeSlots
      .map((slot) => slot.classTime)
      .filter((classTime): classTime is string => classTime !== null && isKnownClassSessionTime(classTime)),
  )
  if (CLASS_SESSION_TIMES.every((classTime) => bookedSessionTimes.has(classTime))) return true

  return activeSlots.some((slot) => {
    if (slot.classTime === null) return false
    const classStartMinutes = classTimeToMinutes(slot.classTime)
    return classStartMinutes !== null
      && pickupMinutes >= classStartMinutes
      && pickupMinutes <= classStartMinutes + CLASS_SESSION_DURATION_MINUTES
  })
}

export function filterCakePickupTimesForClass(
  pickupDate: string,
  pickupTimes: readonly string[],
  bookedSlots: readonly ClassBookedSlot[],
  pickupOpenings: readonly CakePickupOpening[] = [],
) {
  const times = Array.isArray(pickupTimes) ? pickupTimes : []
  return times.filter(
    (pickupTime) => !isCakePickupBlockedByClass(pickupDate, pickupTime, bookedSlots, pickupOpenings),
  )
}

function formatClassCurrency(value: number) {
  return `AUD ${value.toFixed(2)}`
}

export function buildClassPaymentDetails(totalPrice?: number) {
  const amountLine = totalPrice === undefined ? '' : `\nAmount due: ${formatClassCurrency(totalPrice)}`
  return `${CLASS_PAYMENT_SETTINGS.bankName} ${CLASS_PAYMENT_SETTINGS.bankAccount}
Account name: ${CLASS_PAYMENT_SETTINGS.accountHolder}${amountLine}`
}

function dateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
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
    timeZone: 'Australia/Sydney',
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

export function generateClassReservationNumber(date = new Date()) {
  const ymd = dateInputValue(date).replaceAll('-', '')
  const time = timeCodeValue(date)
  const suffix = Math.floor(Math.random() * 900 + 100)
  return `VG-KC-AU-${ymd}-${time}${suffix}`
}

function formatClassChildNames(reservation: ClassReservation) {
  const secondChildName = reservation.secondChildName.trim()
  return secondChildName ? `${reservation.childName} and ${secondChildName}` : reservation.childName
}

function buildClassSafetyNotes() {
  return `Please note:
- Please arrive 5 minutes early
- Long hair should be tied back
- Clothes may get chocolate/cream on them
- Please let us know immediately if there are any allergies or dietary concerns
- If your child has a favourite figure, doll, LEGO, or small toy, please bring it along. It can help them create their own special cake.`
}

export function buildClassPaymentMessage(reservation: ClassReservation) {
  return `Hi ${reservation.parentName}, thank you for your booking for ${formatClassChildNames(reservation)}

Course:
${getClassTypeLabel(reservation.classType)}

Requested session:
${reservation.classDate} ${reservation.classTime}

The session is currently available.

Please use the payment details below:
${buildClassPaymentDetails(reservation.totalPrice)}

Once your payment is confirmed, we will send you a final confirmation message!

${buildClassSafetyNotes()}

Location:
1 Bundil Blvd, Melrose Park, Sydney

We're excited to see you soon.
Thank you:)`
}

export const buildClassDepositMessage = buildClassPaymentMessage

export function buildClassConfirmationMessage(reservation: ClassReservation) {
  return `Hi ${reservation.parentName}, ${formatClassChildNames(reservation)}'s cake class booking is confirmed.

Course:
${getClassTypeLabel(reservation.classType)}

Date/time:
${reservation.classDate} ${reservation.classTime}

${buildClassSafetyNotes()}

Location:
1 Bundil Blvd, Melrose Park, Sydney

We're excited to see you soon.
Thank you:)`
}

export function formatClassBookingType(bookingType: ClassBookingType) {
  if (bookingType === 'year-1-2') return 'Kindy–Year 2'
  if (bookingType === '2-friends') return '2 children'
  return 'Year 3–6'
}

export function classReservationsToCsv(reservations: ClassReservation[]) {
  const headers = [
    'Booking number',
    'Created at',
    'Class date',
    'Class time',
    'Booking type',
    'Class name',
    'Parent name',
    'Parent mobile',
    'Parent email',
    'Child name',
    'Child age',
    'School year',
    'Second child name',
    'Second child age',
    'Second child school year',
    'Allergy note',
    'Emergency contact',
    'Pick-up person',
    'Parent consent',
    'Photo consent',
    'Cancellation agreement',
    'Status',
    'Payment status',
    'Total price',
    'Deposit amount',
    'Admin memo',
  ]
  const rows = reservations.map((reservation) => [
    reservation.reservationNumber,
    reservation.createdAt,
    reservation.classDate,
    reservation.classTime,
    formatClassBookingType(reservation.bookingType),
    getClassTypeLabel(reservation.classType),
    reservation.parentName,
    reservation.parentPhone,
    reservation.parentEmail,
    reservation.childName,
    String(reservation.childAge),
    reservation.schoolYear,
    reservation.secondChildName,
    reservation.secondChildAge === null ? '' : String(reservation.secondChildAge),
    reservation.secondChildSchoolYear,
    reservation.allergyNote,
    reservation.emergencyContact,
    reservation.pickupPerson,
    reservation.parentConsent ? 'yes' : 'no',
    reservation.photoConsent ? 'yes' : 'no',
    reservation.cancellationAgreement ? 'yes' : 'no',
    reservation.status,
    reservation.paymentStatus,
    String(reservation.totalPrice),
    String(reservation.depositAmount),
    reservation.adminMemo,
  ])
  return [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n')
}
