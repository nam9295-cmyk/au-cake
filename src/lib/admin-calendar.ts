import { getCupcakePackSize, getProductById, isCupcakeProduct } from './constants.js'
import { formatCupcakeFinishText } from './i18n.js'
import { getReservationItemCount, getReservationOrderLines } from './order-lines.js'
import { formatClassBookingType, getClassCoursePlanLabel, getClassTypeLabel } from './class-utils.js'
import type { CustomCakeLine, CustomCakeLookupResponse } from './custom-cake-contract.js'
import type { ClassReservation, Reservation } from './types.js'

export type CalendarGridDay = {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

type RegularCakeDashboardEvent = {
  kind: 'cake'
  id: string
  date: string
  time: string
  title: string
  subtitle: string
  isCancelled: boolean
  itemCount: number
  isCustomCake: false
  reservation: Reservation
}

export type CustomCakeDashboardEvent = {
  kind: 'cake'
  id: string
  date: string
  time: string
  title: string
  subtitle: string
  isCancelled: boolean
  itemCount: number
  isCustomCake: true
}

type ClassDashboardEvent = {
  kind: 'class'
  id: string
  date: string
  time: string
  title: string
  subtitle: string
  isCancelled: boolean
  reservation: ClassReservation
}

export type AdminCalendarEvent = RegularCakeDashboardEvent | CustomCakeDashboardEvent | ClassDashboardEvent

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function toInputDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toCalendarMonth(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function currentCalendarMonth() {
  return toCalendarMonth(new Date())
}

export function shiftCalendarMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return toCalendarMonth(new Date(year, monthNumber - 1 + delta, 1))
}

export function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${year}년 ${monthNumber}월`
}

export function getCalendarGridDays(month: string, today = toInputDate(new Date())): CalendarGridDay[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDate = new Date(year, monthNumber - 1, 1)
  const lastDate = new Date(year, monthNumber, 0)
  const gridStart = new Date(firstDate)
  gridStart.setDate(firstDate.getDate() - firstDate.getDay())
  const gridEnd = new Date(lastDate)
  gridEnd.setDate(lastDate.getDate() + (6 - lastDate.getDay()))

  const days: CalendarGridDay[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const date = toInputDate(cursor)
    days.push({
      date,
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === monthNumber - 1,
      isToday: date === today,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function shortProductName(productId: Reservation['productId']) {
  if (productId === 'pave-cake') return 'Pave'
  if (productId === 'pound-cake') return 'Gâteau'
  if (productId === 'cupcake-half-dozen' || productId === 'cupcake-dozen') return 'Cupcake'
  return getProductById(productId).name
}

function mapCakeReservation(reservation: Reservation): RegularCakeDashboardEvent {
  const product = getProductById(reservation.productId)
  const orderLines = getReservationOrderLines(reservation)
  const isMultiLine = orderLines.length > 1
  const cupcakeSummary = isCupcakeProduct(reservation.productId) && reservation.cupcakeFinish !== undefined
    ? `${getCupcakePackSize(reservation.productId) === 6 ? 'Half Dozen' : 'Dozen'} · ${formatCupcakeFinishText(reservation.cupcakeFinish, 'en')}`
    : null
  return {
    kind: 'cake',
    id: reservation.id,
    date: reservation.pickupDate,
    time: reservation.pickupTime,
    title: isMultiLine
      ? `${reservation.customerName} · ${getReservationItemCount(reservation)} items`
      : `${reservation.customerName} · ${product.name}`,
    subtitle: isMultiLine
      ? `${orderLines.map((line) => `${shortProductName(line.productId)} x${line.quantity}`).join(' + ')} · ${reservation.paymentStatus}`
      : `${shortProductName(reservation.productId)}${cupcakeSummary ? ` · ${cupcakeSummary}` : ''} x${reservation.quantity} · ${reservation.paymentStatus}`,
    isCancelled: reservation.status === '취소',
    itemCount: getReservationItemCount(reservation),
    isCustomCake: false,
    reservation,
  }
}

function customCakeStatusLabel(status: CustomCakeLookupResponse['status']) {
  return {
    requested: 'Requested',
    quoted: 'Quoted',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status]
}

function mapCustomCakeRequest(request: CustomCakeLookupResponse): CustomCakeDashboardEvent | null {
  const cakeLines = request.lines.filter((line): line is CustomCakeLine => line.kind === 'custom-cake')
  if (cakeLines.length === 0) return null
  const itemCount = cakeLines.reduce((total, line) => total + line.quantity, 0)
  const selectionSummary = cakeLines
    .map((line) => `${line.tier === 'single' ? 'Single' : 'Double'} ${line.size} ×${line.quantity}`)
    .join(' + ')

  return {
    kind: 'cake',
    id: `custom-cake:${request.requestNumber}`,
    date: request.pickup.pickupDate,
    time: request.pickup.pickupTime,
    title: `Custom Cake · ${selectionSummary}`,
    subtitle: customCakeStatusLabel(request.status),
    isCancelled: request.status === 'cancelled',
    itemCount,
    isCustomCake: true,
  }
}

/** Converts an authenticated admin response to the PII-free schedule shape used by Dashboard. */
export function buildCustomCakeDashboardEvents(requests: CustomCakeLookupResponse[]): CustomCakeDashboardEvent[] {
  return requests.map(mapCustomCakeRequest).filter((event): event is CustomCakeDashboardEvent => event !== null)
}

function classCalendarAudit(reservation: ClassReservation, extensionMinutes = 0) {
  const parts: string[] = []
  if (extensionMinutes === 30) parts.push('+30 min extension')
  if ((reservation.discountCents || 0) > 0) parts.push(`${reservation.discountPercent || 5}% off`)
  const totalCents = reservation.totalPriceCents ?? (reservation.coursePlan ? Math.round(reservation.totalPrice * 100) : undefined)
  if (totalCents !== undefined) parts.push(`AUD ${(totalCents / 100).toFixed(2)}`)
  return parts
}

function mapClassReservation(reservation: ClassReservation): AdminCalendarEvent[] {
  const secondChildText = reservation.secondChildName ? ' +1' : ''
  const planLabel = reservation.coursePlan === 'basic-advanced-package' ? 'Package · Basic' : getClassCoursePlanLabel(reservation.coursePlan)
  const primarySubtitle = reservation.coursePlan
    ? [planLabel, `${reservation.durationMinutes || 120} min`, ...classCalendarAudit(reservation, reservation.extensionMinutes), reservation.paymentStatus].join(' · ')
    : `${formatClassBookingType(reservation.bookingType)} · ${reservation.paymentStatus}`
  const primary = {
    kind: 'class',
    id: reservation.id,
    date: reservation.classDate,
    time: reservation.classTime,
    title: `${getClassTypeLabel(reservation.classType)} · ${reservation.childName}${secondChildText}`,
    subtitle: primarySubtitle,
    isCancelled: reservation.status === 'Cancelled',
    reservation,
  } satisfies AdminCalendarEvent
  if (reservation.coursePlan !== 'basic-advanced-package' || !reservation.advancedClassDate || !reservation.advancedClassTime) return [primary]
  return [primary, {
    kind: 'class',
    id: `${reservation.id}:advanced`,
    date: reservation.advancedClassDate,
    time: reservation.advancedClassTime,
    title: `Advanced 2-Tier Cake Class · ${reservation.childName}`,
    subtitle: ['Package · Advanced', `${reservation.advancedDurationMinutes || 120} min`, ...classCalendarAudit(reservation, reservation.advancedExtensionMinutes), reservation.paymentStatus].join(' · '),
    isCancelled: reservation.status === 'Cancelled',
    reservation,
  }]
}

export function buildAdminCalendarEvents(
  cakeReservations: Reservation[],
  classReservations: ClassReservation[],
  customCakeEvents: CustomCakeDashboardEvent[] = [],
): AdminCalendarEvent[] {
  const events: AdminCalendarEvent[] = [
    ...cakeReservations.map(mapCakeReservation),
    ...classReservations.flatMap(mapClassReservation),
    ...customCakeEvents,
  ]
  return events.sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date)
    if (dateOrder !== 0) return dateOrder
    const timeOrder = a.time.localeCompare(b.time)
    if (timeOrder !== 0) return timeOrder
    if (a.kind !== b.kind) return a.kind === 'cake' ? -1 : 1
    return a.id.localeCompare(b.id)
  })
}

export function getDailyCalendarSummary(events: AdminCalendarEvent[]) {
  const activeEvents = events.filter((event) => !event.isCancelled)
  const cakeCount = activeEvents
    .filter((event): event is Extract<AdminCalendarEvent, { kind: 'cake' }> => event.kind === 'cake')
    .reduce((total, event) => total + event.itemCount, 0)
  const classCount = activeEvents.filter((event) => event.kind === 'class').length

  if (cakeCount === 0 && classCount === 0) return ''
  return [`Cake ${cakeCount}`, `Class ${classCount}`].filter((label) => !label.endsWith(' 0')).join(' · ')
}
