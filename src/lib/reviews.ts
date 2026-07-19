import type { PublicReview, Review, ReviewRating, ReviewRewardPercent } from './types.js'

const REVIEW_TIME_ZONE = 'Australia/Sydney'
const INVITE_VALID_DAYS = 30
const COUPON_VALID_DAYS = 60

const sydneyDateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: REVIEW_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type SydneyDateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

function getSydneyDateTimeParts(value: Date): SydneyDateTimeParts {
  const parts = Object.fromEntries(
    sydneyDateTimeFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: value.getUTCMilliseconds(),
  }
}

function partsAsUtc(parts: SydneyDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
}

function partsEqual(left: SydneyDateTimeParts, right: SydneyDateTimeParts): boolean {
  return partsAsUtc(left) === partsAsUtc(right)
}

function findSydneyDateTimeCandidates(parts: SydneyDateTimeParts): { candidates: number[]; offsets: number[] } {
  const targetAsUtc = partsAsUtc(parts)
  const offsets = new Set<number>()

  for (let hours = -48; hours <= 48; hours += 1) {
    const instant = targetAsUtc + hours * 60 * 60 * 1000
    offsets.add(partsAsUtc(getSydneyDateTimeParts(new Date(instant))) - instant)
  }

  const candidates = [...offsets]
    .map((offset) => targetAsUtc - offset)
    .filter((candidate) => partsEqual(getSydneyDateTimeParts(new Date(candidate)), parts))
    .sort((left, right) => left - right)

  return { candidates, offsets: [...offsets].sort((left, right) => left - right) }
}

function fromSydneyDateTimeParts(parts: SydneyDateTimeParts): Date {
  const { candidates, offsets } = findSydneyDateTimeCandidates(parts)

  if (candidates.length > 0) {
    return new Date(candidates[0])
  }

  const gap = offsets.at(-1)! - offsets[0]
  const shifted = new Date(partsAsUtc(parts) + gap)
  const shiftedParts: SydneyDateTimeParts = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  const shiftedCandidates = findSydneyDateTimeCandidates(shiftedParts).candidates

  if (gap <= 0 || shiftedCandidates.length === 0) {
    throw new RangeError('Sydney date-time could not be resolved')
  }

  return new Date(shiftedCandidates[0])
}

function addSydneyCalendarDays(value: Date, days: number): Date {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('Review expiry date must be valid')
  }

  const parts = getSydneyDateTimeParts(value)
  const shifted = new Date(partsAsUtc({ ...parts, day: parts.day + days }))

  return fromSydneyDateTimeParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  })
}

export function calculateReviewRewardPercent(review: Pick<Review, 'photoFileId'>): ReviewRewardPercent {
  return review.photoFileId?.trim() ? 10 : 5
}

export function isReviewRating(value: unknown): value is ReviewRating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

export function getReviewInviteExpiresAt(createdAt: Date): Date {
  return addSydneyCalendarDays(createdAt, INVITE_VALID_DAYS)
}

export function getReviewCouponExpiresAt(createdAt: Date): Date {
  return addSydneyCalendarDays(createdAt, COUPON_VALID_DAYS)
}

export function toPublicReview(review: Review & { photoUrl?: string | null }): PublicReview {
  if (!review.publishConsent || review.moderationStatus !== 'published') {
    const error = new Error('Review requires publish consent and published moderation status') as Error & {
      code: string
    }
    error.code = 'REVIEW_NOT_PUBLIC'
    throw error
  }

  const displayName = review.displayName?.trim()

  return {
    id: review.id,
    sourceType: review.sourceType,
    rating: review.rating,
    body: review.body,
    displayName: displayName || (review.sourceType === 'cake' ? 'Verified cake order' : 'Verified class booking'),
    photoUrl: review.photoUrl ?? null,
    createdAt: review.createdAt,
    incentivised: true,
  }
}
