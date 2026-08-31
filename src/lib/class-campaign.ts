import type { Language } from './i18n.js'

export interface SpringClassCampaign {
  enabled: boolean
  timezone: 'Australia/Sydney'
  allowedDates: readonly string[]
  sessionTimes: readonly string[]
  visibleThrough: string
}

export const SPRING_CLASS_CAMPAIGN_2026: SpringClassCampaign = Object.freeze({
  enabled: true,
  timezone: 'Australia/Sydney',
  allowedDates: Object.freeze(['2026-09-26', '2026-10-03', '2026-10-10']),
  sessionTimes: Object.freeze(['10:00', '13:00', '16:00']),
  visibleThrough: '2026-10-10',
})

export function getSydneyDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SPRING_CLASS_CAMPAIGN_2026.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function isSpringClassCampaignActive(
  now = new Date(),
  campaign: SpringClassCampaign = SPRING_CLASS_CAMPAIGN_2026,
) {
  return campaign.enabled && getSydneyDateValue(now) <= campaign.visibleThrough
}

export function isSpringClassBookingDateAllowed(
  value: string,
  now = new Date(),
  campaign: SpringClassCampaign = SPRING_CLASS_CAMPAIGN_2026,
) {
  if (!isSpringClassCampaignActive(now, campaign)) return false
  return value >= getSydneyDateValue(now) && campaign.allowedDates.includes(value)
}

export function getNextSpringClassDate(
  now = new Date(),
  campaign: SpringClassCampaign = SPRING_CLASS_CAMPAIGN_2026,
) {
  if (!isSpringClassCampaignActive(now, campaign)) return null
  const today = getSydneyDateValue(now)
  return campaign.allowedDates.find((value) => value >= today) || null
}

export function getSpringClassCampaignCopy(language: Language) {
  if (language === 'ko') {
    return {
      dates: ['9월 26일 토요일', '10월 3일 토요일', '10월 10일 토요일'],
      sessions: '10:00 · 13:00 · 16:00',
      calloutTitle: '봄방학 클래스 예약 오픈',
      calloutDates: '9월 26일·10월 3일·10월 10일 토요일',
      calloutSessions: '10:00 · 13:00 · 16:00 세 타임',
      closed: '봄방학 클래스 예약이 마감되었습니다.',
    } as const
  }
  return {
    dates: ['Saturday 26 September', 'Saturday 3 October', 'Saturday 10 October'],
    sessions: '10:00 · 13:00 · 16:00',
    calloutTitle: 'Spring vacation bookings open',
    calloutDates: 'Saturday 26 September · Saturday 3 & Saturday 10 October',
    calloutSessions: 'Three sessions: 10:00 · 13:00 · 16:00',
    closed: 'Spring vacation class bookings are now closed.',
  } as const
}
