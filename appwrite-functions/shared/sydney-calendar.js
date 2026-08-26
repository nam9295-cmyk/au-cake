export const SYDNEY_TIME_ZONE = 'Australia/Sydney'

const formatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function validDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RangeError('Sydney calendar date must be valid')
  }
  return value
}

export function getSydneyDateParts(value) {
  const date = validDate(value)
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]))
  return { ...parts, millisecond: date.getUTCMilliseconds() }
}

function partsAsUtc(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond)
}

function candidatesFor(parts) {
  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(getSydneyDateParts(new Date(instant))) - instant)
  }
  return [...offsets].map((offset) => target - offset)
    .filter((candidate) => partsAsUtc(getSydneyDateParts(new Date(candidate))) === target)
    .sort((left, right) => left - right)
}

function fromSydneyParts(parts) {
  const candidates = candidatesFor(parts)
  if (candidates.length > 0) return new Date(candidates[0])

  const target = partsAsUtc(parts)
  const offsets = new Set()
  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = target + hours * 3_600_000
    offsets.add(partsAsUtc(getSydneyDateParts(new Date(instant))) - instant)
  }
  const sortedOffsets = [...offsets].sort((left, right) => left - right)
  const gap = sortedOffsets.at(-1) - sortedOffsets[0]
  const shifted = new Date(target + gap)
  const shiftedParts = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  const shiftedCandidates = candidatesFor(shiftedParts)
  if (gap <= 0 || shiftedCandidates.length === 0) throw new RangeError('Sydney date-time could not be resolved')
  return new Date(shiftedCandidates[0])
}

export function addSydneyCalendarDays(value, days) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()) || !Number.isInteger(days)) {
    throw new RangeError('Sydney calendar date and days must be valid')
  }
  const parts = getSydneyDateParts(value)
  const shifted = new Date(partsAsUtc({ ...parts, day: parts.day + days }))
  const target = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  return fromSydneyParts(target)
}

export function formatSydneyDateKey(value) {
  const parts = getSydneyDateParts(value)
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function isSydneyReminderWindow(value) {
  return getSydneyDateParts(value).hour === 10
}
