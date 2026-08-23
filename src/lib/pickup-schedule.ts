type PickupWindow = Readonly<{
  open: string
  close: string
}>

export const AU_CAKE_PICKUP_ALLOWED_WEEKDAYS = [5, 6, 0] as const

export const AU_CAKE_PICKUP_SCHEDULE = Object.freeze({
  timezone: 'Australia/Sydney',
  intervalMinutes: 15,
  weekdays: Object.freeze({
    0: Object.freeze({ open: '08:00', close: '20:00' }),
    5: Object.freeze({ open: '18:00', close: '20:00' }),
    6: Object.freeze({ open: '08:00', close: '20:00' }),
  }),
})

function isoWeekday(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.toISOString().slice(0, 10) !== value) return null
  return date.getUTCDay()
}

function timeMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function formatTime(minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
  const minute = String(minutes % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

function pickupWindowForDate(dateValue: string): PickupWindow | null {
  const weekday = isoWeekday(dateValue)
  if (weekday === null || !Object.hasOwn(AU_CAKE_PICKUP_SCHEDULE.weekdays, weekday)) return null
  return AU_CAKE_PICKUP_SCHEDULE.weekdays[weekday as keyof typeof AU_CAKE_PICKUP_SCHEDULE.weekdays]
}

export function getAuCakePickupTimeOptions(dateValue: string) {
  const window = pickupWindowForDate(dateValue)
  if (!window) return []
  const openMinutes = timeMinutes(window.open)
  const closeMinutes = timeMinutes(window.close)
  if (openMinutes === null || closeMinutes === null || openMinutes > closeMinutes) return []

  const options: string[] = []
  for (let minutes = openMinutes; minutes <= closeMinutes; minutes += AU_CAKE_PICKUP_SCHEDULE.intervalMinutes) {
    options.push(formatTime(minutes))
  }
  return options
}

export function isAuCakePickupServiceTime(dateValue: string, timeValue: string) {
  const window = pickupWindowForDate(dateValue)
  const pickupMinutes = timeMinutes(timeValue)
  if (!window || pickupMinutes === null) return false
  const openMinutes = timeMinutes(window.open)
  const closeMinutes = timeMinutes(window.close)
  return openMinutes !== null
    && closeMinutes !== null
    && pickupMinutes >= openMinutes
    && pickupMinutes <= closeMinutes
    && (pickupMinutes - openMinutes) % AU_CAKE_PICKUP_SCHEDULE.intervalMinutes === 0
}
