import type { ClassAgeGroup, ClassBookingType, ClassCoursePlan, ClassExtensionMinutes, ClassPartySize, ClassReservation, ClassReservationFilters, ClassReservationInput, ClassType } from './types.js'
import { escapeCsvCell } from './csv.js'
import { MARKET_CONFIG } from './market.js'

export const CLASS_TYPE_ID = 'school-holiday-private-cake-class' as const
export const ADVANCED_CLASS_TYPE_ID = 'advanced-2-tier-cake-class' as const
export const CLASS_TYPE_IDS: readonly ClassType[] = [CLASS_TYPE_ID, 'cupcake-chocolate-class', ADVANCED_CLASS_TYPE_ID]
export const CLASS_SESSION_TIMES = ['10:00', '13:00', '16:00'] as const
export const BASIC_CLASS_SCHOOL_YEARS = ['Kindy', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'] as const
export const ADVANCED_CLASS_SCHOOL_YEARS = ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'] as const
/** Safe fallback for legacy booked-slot rows that have no duration. */
export const CLASS_SESSION_DURATION_MINUTES = 120
export const CLASS_BASIC_DURATION_MINUTES = 90
export const CLASS_ADVANCED_DURATION_MINUTES = 120
export const CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS = 2000
export const CLASS_PACKAGE_DISCOUNT_PERCENT = 5
export const CLASS_EXTENSION_WARNING = 'Please consider your child’s focus and stamina before adding 30 minutes. For boys in particular, please choose this option carefully, as the longer session can feel demanding.'
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

export function getClassDurationMinutes(plan: 'basic' | 'advanced', extensionMinutes: ClassExtensionMinutes = 0) {
  return (plan === 'advanced' ? CLASS_ADVANCED_DURATION_MINUTES : CLASS_BASIC_DURATION_MINUTES) + extensionMinutes
}

export function calculateClassPricing({
  coursePlan,
  bookingType,
  extensionMinutes = 0,
  advancedExtensionMinutes = 0,
}: {
  coursePlan: ClassCoursePlan
  bookingType: ClassBookingType
  extensionMinutes?: ClassExtensionMinutes
  advancedExtensionMinutes?: ClassExtensionMinutes
}) {
  const participantCount = bookingType === '2-friends' ? 2 : 1
  const basicBaseCents = Math.round(getClassBookingPrice(bookingType) * 100)
  const advancedBaseCents = 15900
  const baseCents = coursePlan === 'advanced'
    ? advancedBaseCents
    : coursePlan === 'basic-advanced-package'
      ? basicBaseCents + advancedBaseCents
      : basicBaseCents
  const extensionCents = extensionMinutes === 30
    ? CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS * participantCount
    : 0
  const advancedExtensionCents = coursePlan === 'basic-advanced-package' && advancedExtensionMinutes === 30
    ? CLASS_EXTENSION_PRICE_PER_PARTICIPANT_CENTS
    : 0
  const discountPercent = coursePlan === 'basic-advanced-package' ? CLASS_PACKAGE_DISCOUNT_PERCENT : 0
  const discountCents = Math.round(baseCents * discountPercent / 100)
  const subtotalCents = baseCents + extensionCents + advancedExtensionCents
  return {
    subtotalCents,
    discountPercent,
    discountCents,
    totalPriceCents: subtotalCents - discountCents,
  }
}

export function isWeekendClassDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.toISOString().slice(0, 10) !== value) return false
  return date.getUTCDay() === 0 || date.getUTCDay() === 6
}

export function resolveWeekendClassDate(currentDate: string, requestedDate: string) {
  return isWeekendClassDate(requestedDate) ? requestedDate : currentDate
}

export interface ClassCalendarDay {
  isoDate: string
  dayNumber: number
  inCurrentMonth: boolean
  isWeekend: boolean
  disabled: boolean
}

function parseClassCalendarMonth(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!match) throw new Error(`Invalid class calendar month: ${monthKey}`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
  if (date.toISOString().slice(0, 7) !== monthKey) throw new Error(`Invalid class calendar month: ${monthKey}`)
  return date
}

export function shiftClassCalendarMonth(monthKey: string, offset: number) {
  const month = parseClassCalendarMonth(monthKey)
  month.setUTCMonth(month.getUTCMonth() + offset)
  return month.toISOString().slice(0, 7)
}

export function getClassCalendarMonthLabel(monthKey: string, locale = 'en-AU') {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(parseClassCalendarMonth(monthKey))
}

export function getBookingCalendarMonthDays(monthKey: string, minDate: string, weekendsOnly: boolean): ClassCalendarDay[] {
  const month = parseClassCalendarMonth(monthKey)
  const gridStart = new Date(month)
  gridStart.setUTCDate(1 - month.getUTCDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setUTCDate(gridStart.getUTCDate() + index)
    const isoDate = date.toISOString().slice(0, 10)
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
    const inCurrentMonth = isoDate.slice(0, 7) === monthKey
    return {
      isoDate,
      dayNumber: date.getUTCDate(),
      inCurrentMonth,
      isWeekend,
      disabled: !inCurrentMonth || (weekendsOnly && !isWeekend) || isoDate < minDate,
    }
  })
}

export function getClassCalendarMonthDays(monthKey: string, minDate: string): ClassCalendarDay[] {
  return getBookingCalendarMonthDays(monthKey, minDate, true)
}

export function getClassCoursePlanLabel(coursePlan: ClassCoursePlan = 'basic') {
  if (coursePlan === 'advanced') return 'Advanced'
  if (coursePlan === 'basic-advanced-package') return 'Basic + Advanced Package'
  return 'Basic'
}

export function getClassTypeLabel(classType: ClassType) {
  if (classType === 'advanced-2-tier-cake-class') return 'Advanced 2-Tier Cake Class'
  return classType === 'cupcake-chocolate-class' ? 'Basic Cupcakes & Chocolate Class' : 'Basic Cake Class'
}

export function getClassSchoolYears(coursePlan: ClassCoursePlan) {
  return coursePlan === 'basic' ? [...BASIC_CLASS_SCHOOL_YEARS] : [...ADVANCED_CLASS_SCHOOL_YEARS]
}

export function isClassSchoolYearAllowed(coursePlan: ClassCoursePlan, schoolYear: string) {
  return getClassSchoolYears(coursePlan).includes(schoolYear as never)
}

export function getClassAgeGroupForSchoolYear(schoolYear: string): ClassAgeGroup {
  if (schoolYear === 'Kindy' || schoolYear === 'Year 1') return 'kindy-year-2'
  if (schoolYear === 'Year 2') return 'year-2'
  return 'year-3-6'
}

export function getClassBookingType(ageGroup: ClassAgeGroup, partySize: ClassPartySize): ClassBookingType {
  if (partySize === 2) return '2-friends'
  return ageGroup === 'kindy-year-2' || ageGroup === 'year-2' ? 'year-1-2' : '1-child'
}

export function normalizeClassReservationInput(input: ClassReservationInput): ClassReservationInput {
  const request = { ...input }
  delete request.partySize
  if ((request.coursePlan || 'basic') !== 'basic-advanced-package') {
    delete request.advancedClassDate
    delete request.advancedClassTime
    delete request.advancedExtensionMinutes
  }
  return request
}

export function filterClassReservationsForAdmin(reservations: ClassReservation[], filters?: ClassReservationFilters) {
  if (!filters) return reservations
  const search = filters.search.trim().toLowerCase()
  return reservations.filter((reservation) => {
    if (filters.classDate && reservation.classDate !== filters.classDate && reservation.advancedClassDate !== filters.classDate) return false
    if (filters.status && reservation.status !== filters.status) return false
    if (filters.paymentStatus && reservation.paymentStatus !== filters.paymentStatus) return false
    if (!search) return true
    return (
      reservation.parentName.toLowerCase().includes(search) ||
      reservation.childName.toLowerCase().includes(search) ||
      reservation.parentPhone.includes(search) ||
      reservation.reservationNumber.toLowerCase().includes(search)
    )
  })
}

export function getClassDepositAmount() {
  return CLASS_DEPOSIT_AMOUNT
}

export type ClassBookedSlot = (Pick<ClassReservation, 'classDate' | 'classTime' | 'durationMinutes'> & { status?: ClassReservation['status'] }) | string

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
  durationMinutes: number
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
    return entry === classDate && isValidClassDate(entry)
      ? { classTime: null, durationMinutes: CLASS_SESSION_DURATION_MINUTES }
      : null
  }
  if (!entry || typeof entry !== 'object') return null

  const slot = entry as Record<string, unknown>
  if (slot.status === 'Cancelled' || slot.classDate !== classDate || !isValidClassDate(slot.classDate)) return null
  const durationMinutes = Number.isInteger(slot.durationMinutes) && Number(slot.durationMinutes) > 0
    ? Number(slot.durationMinutes)
    : CLASS_SESSION_DURATION_MINUTES
  if (slot.classTime === undefined || slot.classTime === null || slot.classTime === '') return { classTime: null, durationMinutes }
  if (typeof slot.classTime !== 'string') return null
  if (!slot.classTime.trim()) return null
  if (classTimeToMinutes(slot.classTime) === null) return null
  return { classTime: slot.classTime, durationMinutes }
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
      && pickupMinutes <= classStartMinutes + slot.durationMinutes
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

export function isCakePickupDateUnavailable(
  pickupDate: string,
  pickupTimes: readonly string[],
  bookedSlots: readonly ClassBookedSlot[],
  pickupOpenings: readonly CakePickupOpening[] = [],
) {
  return pickupTimes.length === 0
    || filterCakePickupTimesForClass(pickupDate, pickupTimes, bookedSlots, pickupOpenings).length === 0
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

function formatClassSessionLine(date: string, time: string, durationMinutes: number, extensionMinutes: ClassExtensionMinutes = 0) {
  const extension = extensionMinutes === 30 ? ' · includes 30-minute extension' : ''
  return `${date} ${time} · ${durationMinutes} minutes${extension}`
}

function buildClassPricingAudit(reservation: ClassReservation) {
  const totalPriceCents = reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)
  const subtotalCents = reservation.subtotalCents ?? totalPriceCents
  const discountCents = reservation.discountCents || 0
  const discountLine = discountCents > 0
    ? `\nPackage discount: ${reservation.discountPercent || 5}% (-${formatClassCurrency(discountCents / 100)})`
    : ''
  return `Subtotal: ${formatClassCurrency(subtotalCents / 100)}${discountLine}\nTotal: ${formatClassCurrency(totalPriceCents / 100)}`
}

export function buildClassPaymentMessage(reservation: ClassReservation) {
  const packageSession = reservation.coursePlan === 'basic-advanced-package' && reservation.advancedClassDate && reservation.advancedClassTime
    ? `\nAdvanced session:\n${formatClassSessionLine(reservation.advancedClassDate, reservation.advancedClassTime, reservation.advancedDurationMinutes || 120, reservation.advancedExtensionMinutes)}\n`
    : ''
  return `Hi ${reservation.parentName}, thank you for your booking for ${formatClassChildNames(reservation)}

Course:
${getClassCoursePlanLabel(reservation.coursePlan)} · ${getClassTypeLabel(reservation.classType)}

Requested session:
${formatClassSessionLine(reservation.classDate, reservation.classTime, reservation.durationMinutes || CLASS_SESSION_DURATION_MINUTES, reservation.extensionMinutes)}
${packageSession}
Price:
${buildClassPricingAudit(reservation)}

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
  const advancedSession = reservation.coursePlan === 'basic-advanced-package' && reservation.advancedClassDate && reservation.advancedClassTime
    ? `\nAdvanced session:\n${formatClassSessionLine(reservation.advancedClassDate, reservation.advancedClassTime, reservation.advancedDurationMinutes || 120, reservation.advancedExtensionMinutes)}\n`
    : ''
  return `Hi ${reservation.parentName}, ${formatClassChildNames(reservation)}'s cake class booking is confirmed.

Course:
${getClassCoursePlanLabel(reservation.coursePlan)} · ${getClassTypeLabel(reservation.classType)}

Date/time:
${formatClassSessionLine(reservation.classDate, reservation.classTime, reservation.durationMinutes || CLASS_SESSION_DURATION_MINUTES, reservation.extensionMinutes)}
${advancedSession}
Price:
${buildClassPricingAudit(reservation)}

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
    'Course plan',
    'Advanced class date',
    'Advanced class time',
    'Duration minutes',
    'Advanced duration minutes',
    'Extension minutes',
    'Advanced extension minutes',
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
    'Subtotal cents',
    'Discount percent',
    'Discount cents',
    'Total price cents',
    'Total price',
    'Deposit amount',
    'Admin memo',
  ]
  const rows = reservations.map((reservation) => [
    reservation.reservationNumber,
    reservation.createdAt,
    reservation.classDate,
    reservation.classTime,
    getClassCoursePlanLabel(reservation.coursePlan),
    reservation.advancedClassDate || '',
    reservation.advancedClassTime || '',
    String(reservation.durationMinutes || CLASS_SESSION_DURATION_MINUTES),
    reservation.advancedDurationMinutes ? String(reservation.advancedDurationMinutes) : '',
    String(reservation.extensionMinutes || 0),
    String(reservation.advancedExtensionMinutes || 0),
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
    String(reservation.subtotalCents ?? Math.round(reservation.totalPrice * 100)),
    String(reservation.discountPercent || 0),
    String(reservation.discountCents || 0),
    String(reservation.totalPriceCents ?? Math.round(reservation.totalPrice * 100)),
    String(reservation.totalPrice),
    String(reservation.depositAmount),
    reservation.adminMemo,
  ])
  return [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n')
}
