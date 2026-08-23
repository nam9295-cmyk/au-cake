import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  SPRING_CLASS_CAMPAIGN_2026,
  SPRING_CLASS_POPUP_SESSION_KEY,
  dismissSpringClassPopup,
  getNextSpringClassDate,
  getSpringClassCampaignCopy,
  isSpringClassBookingDateAllowed,
  isSpringClassCampaignActive,
  isSpringClassPopupDismissed,
} from '../src/lib/class-campaign.js'

test('Spring campaign selects only the next non-past October date in Sydney', () => {
  assert.equal(getNextSpringClassDate(new Date('2026-08-23T00:00:00.000Z')), '2026-10-03')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T13:59:59.000Z')), '2026-10-03')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T14:00:00.000Z')), '2026-10-10')
  assert.equal(getNextSpringClassDate(new Date('2026-10-10T13:00:00.000Z')), null)
})

test('Spring class booking allows exactly 3 and 10 October while the campaign is open', () => {
  const beforeCampaign = new Date('2026-08-23T00:00:00.000Z')
  assert.equal(isSpringClassBookingDateAllowed('2026-10-03', beforeCampaign), true)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-10', beforeCampaign), true)
  for (const value of ['2026-09-26', '2026-10-04', '2026-10-11', 'not-a-date']) {
    assert.equal(isSpringClassBookingDateAllowed(value, beforeCampaign), false, value)
  }
  assert.equal(isSpringClassBookingDateAllowed('2026-10-03', new Date('2026-10-03T14:00:00.000Z')), false)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-10', new Date('2026-10-03T14:00:00.000Z')), true)
})

test('Spring campaign stays visible through 10 October Sydney and supports the kill switch', () => {
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-10T12:59:59.000Z')), true)
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-10T13:00:00.000Z')), false)
  assert.equal(isSpringClassCampaignActive(
    new Date('2026-08-23T00:00:00.000Z'),
    { ...SPRING_CLASS_CAMPAIGN_2026, enabled: false },
  ), false)
})

test('Spring popup dismissal lasts for one storage session and fails open safely', () => {
  const entries = new Map<string, string>()
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) },
  }

  assert.equal(isSpringClassPopupDismissed(storage), false)
  dismissSpringClassPopup(storage)
  assert.equal(entries.get(SPRING_CLASS_POPUP_SESSION_KEY), '1')
  assert.equal(isSpringClassPopupDismissed(storage), true)
  assert.equal(isSpringClassPopupDismissed({ getItem: () => { throw new Error('blocked') } }), false)
  assert.doesNotThrow(() => dismissSpringClassPopup({ setItem: () => { throw new Error('blocked') } }))
})

test('Spring campaign exposes the approved English and Korean customer copy', () => {
  assert.deepEqual(getSpringClassCampaignCopy('en'), {
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
  })
  assert.deepEqual(getSpringClassCampaignCopy('ko'), {
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
  })
})
