import type { ClassBookingType, ClassReservation } from './types.js'
import { MARKET_CONFIG } from './market.js'

export const CLASS_TYPE_ID = 'school-holiday-private-cake-class' as const
export const CLASS_SESSION_TIMES = ['10:00', '13:00', '16:00'] as const
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

export function getClassDepositAmount() {
  return CLASS_DEPOSIT_AMOUNT
}

export type ClassBookedSlot = Pick<ClassReservation, 'classDate' | 'classTime'> | string

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

Date/time:
${reservation.classDate} ${reservation.classTime}

${buildClassSafetyNotes()}

Location:
1 Bundil Blvd, Melrose Park, Sydney

We're excited to see you soon.
Thank you:)`
}

export function formatClassBookingType(bookingType: ClassBookingType) {
  if (bookingType === 'year-1-2') return 'Year 1-2'
  if (bookingType === '2-friends') return '2 kids / siblings / friends'
  return 'Year 3-6'
}

export function classReservationsToCsv(reservations: ClassReservation[]) {
  const headers = [
    'Booking number',
    'Created at',
    'Class date',
    'Class time',
    'Booking type',
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
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
}
