import { getProductById } from './constants.js'
import { formatClassBookingType } from './class-utils.js'
import type { ClassReservation, Reservation } from './types.js'

export type CalendarGridDay = {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

export type AdminCalendarEvent =
  | {
      kind: 'cake'
      id: string
      date: string
      time: string
      title: string
      subtitle: string
      isCancelled: boolean
      reservation: Reservation
    }
  | {
      kind: 'class'
      id: string
      date: string
      time: string
      title: string
      subtitle: string
      isCancelled: boolean
      reservation: ClassReservation
    }

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
  if (productId === 'pound-cake') return 'Pound'
  if (productId === 'cupcake-dozen') return 'Cupcake'
  return getProductById(productId).name
}

function mapCakeReservation(reservation: Reservation): AdminCalendarEvent {
  const product = getProductById(reservation.productId)
  return {
    kind: 'cake',
    id: reservation.id,
    date: reservation.pickupDate,
    time: reservation.pickupTime,
    title: `${reservation.customerName} · ${product.name}`,
    subtitle: `${shortProductName(reservation.productId)} x${reservation.quantity} · ${reservation.paymentStatus}`,
    isCancelled: reservation.status === '취소',
    reservation,
  }
}

function mapClassReservation(reservation: ClassReservation): AdminCalendarEvent {
  const secondChildText = reservation.secondChildName ? ' +1' : ''
  return {
    kind: 'class',
    id: reservation.id,
    date: reservation.classDate,
    time: reservation.classTime,
    title: `Kids Class · ${reservation.childName}${secondChildText}`,
    subtitle: `${formatClassBookingType(reservation.bookingType)} · ${reservation.paymentStatus}`,
    isCancelled: reservation.status === 'Cancelled',
    reservation,
  }
}

export function buildAdminCalendarEvents(
  cakeReservations: Reservation[],
  classReservations: ClassReservation[],
): AdminCalendarEvent[] {
  return [...cakeReservations.map(mapCakeReservation), ...classReservations.map(mapClassReservation)].sort((a, b) => {
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
    .reduce((total, event) => total + event.reservation.quantity, 0)
  const classCount = activeEvents.filter((event) => event.kind === 'class').length

  if (cakeCount === 0 && classCount === 0) return ''
  return [`Cake ${cakeCount}`, `Class ${classCount}`].filter((label) => !label.endsWith(' 0')).join(' · ')
}
