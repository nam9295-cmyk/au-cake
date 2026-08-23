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
  allowedDates: Object.freeze(['2026-10-03', '2026-10-10']),
  sessionTimes: Object.freeze(['10:00', '13:00', '16:00']),
  visibleThrough: '2026-10-10',
})

export const SPRING_CLASS_POPUP_SESSION_KEY = 'verygood-spring-class-2026-dismissed'

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

type PopupStorageReader = Pick<Storage, 'getItem'>
type PopupStorageWriter = Pick<Storage, 'setItem'>

export function isSpringClassPopupDismissed(storage: PopupStorageReader | null | undefined) {
  try {
    return storage?.getItem(SPRING_CLASS_POPUP_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissSpringClassPopup(storage: PopupStorageWriter | null | undefined) {
  try {
    storage?.setItem(SPRING_CLASS_POPUP_SESSION_KEY, '1')
  } catch {
    // Storage can be disabled by browser privacy settings. Closing must still work.
  }
}

export function getSpringClassCampaignCopy(language: Language) {
  if (language === 'ko') {
    return {
      eyebrow: '봄방학 한정 클래스',
      title: 'SPRING VACATION CLASS BOOKING OPEN',
      body: 'Melrose Park에서 진행하는 봄방학 토요일 케이크 클래스 예약이 열렸습니다.',
      dates: ['10월 3일 토요일', '10월 10일 토요일'],
      sessions: '10:00 · 13:00 · 16:00',
      note: '프라이빗 클래스 · 최대 2명',
      primaryCta: '봄방학 클래스 예약하기',
      secondaryAction: '나중에 보기',
      calloutTitle: '봄방학 클래스 예약 오픈',
      calloutDates: '10월 3일·10월 10일 토요일',
      calloutSessions: '10:00 · 13:00 · 16:00 세 타임',
      closed: '봄방학 클래스 예약이 마감되었습니다.',
    } as const
  }
  return {
    eyebrow: 'LIMITED SPRING CLASSES',
    title: 'SPRING VACATION CLASS BOOKING OPEN',
    body: 'Bookings are now open for two limited Saturday cake classes in Melrose Park.',
    dates: ['Saturday 3 October', 'Saturday 10 October'],
    sessions: '10:00 · 13:00 · 16:00',
    note: 'Private sessions · Maximum 2 children',
    primaryCta: 'Book a spring class',
    secondaryAction: 'Not now',
    calloutTitle: 'Spring vacation bookings open',
    calloutDates: 'Saturday 3 & Saturday 10 October',
    calloutSessions: 'Three sessions: 10:00 · 13:00 · 16:00',
    closed: 'Spring vacation class bookings are now closed.',
  } as const
}
