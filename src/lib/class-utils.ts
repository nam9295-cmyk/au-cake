import type { ClassBookingType, ClassReservation } from './types.js'

export const CLASS_TYPE_ID = 'school-holiday-private-cake-class' as const
export const CLASS_SESSION_TIMES = ['10:00-11:30', '13:00-14:30'] as const
export const CLASS_DEPOSIT_AMOUNT = 50

export const CLASS_STATUS_OPTIONS = ['Requested', 'Confirmed', 'Completed', 'Cancelled'] as const
export const CLASS_PAYMENT_STATUS_OPTIONS = [
  'Pending deposit',
  'Deposit paid',
  'Fully paid',
  'Refund required',
] as const

const CLASS_BOOKING_PRICES: Record<ClassBookingType, number> = {
  '1-child': 109,
  '2-friends': 198,
}

function formatAud(value: number) {
  return `AUD ${value.toFixed(2)}`
}

export function getClassBookingPrice(bookingType: ClassBookingType) {
  return CLASS_BOOKING_PRICES[bookingType]
}

export function getClassDepositAmount() {
  return CLASS_DEPOSIT_AMOUNT
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

export function buildClassDepositMessage(reservation: ClassReservation) {
  return `Hi ${reservation.parentName}, thank you for your cake class request for ${reservation.childName}.

Requested session:
${reservation.classDate} ${reservation.classTime}

We'll check availability and send payment details shortly.
Your spot is confirmed once the ${formatAud(reservation.depositAmount)} deposit has been received.

Verygood Chocolate AU`
}

export function buildClassConfirmationMessage(reservation: ClassReservation) {
  return `Hi ${reservation.parentName}, ${reservation.childName}'s cake class booking is confirmed.

Date/time:
${reservation.classDate} ${reservation.classTime}

Location:
Melrose Park, Sydney
The full address will be sent before the class.

Please note:
- Please arrive 5 minutes early
- Long hair should be tied back
- Clothes may get chocolate/cream on them
- Please let us know immediately if there are any allergies or dietary concerns

We're excited to see you soon.

Verygood Chocolate AU`
}

export function formatClassBookingType(bookingType: ClassBookingType) {
  return bookingType === '2-friends' ? '2 friends / siblings' : '1 child'
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
