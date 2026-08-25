import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as i18n from '../src/lib/i18n.js'
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

test('Spring campaign selects the next non-past scheduled date in Sydney', () => {
  assert.equal(getNextSpringClassDate(new Date('2026-08-23T00:00:00.000Z')), '2026-09-26')
  assert.equal(getNextSpringClassDate(new Date('2026-09-26T13:59:59.000Z')), '2026-09-26')
  assert.equal(getNextSpringClassDate(new Date('2026-09-26T14:00:00.000Z')), '2026-10-03')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T13:59:59.000Z')), '2026-10-03')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T14:00:00.000Z')), '2026-10-10')
  assert.equal(getNextSpringClassDate(new Date('2026-10-10T13:00:00.000Z')), null)
})

test('Spring class booking allows the three scheduled Saturdays while the campaign is open', () => {
  const beforeCampaign = new Date('2026-08-23T00:00:00.000Z')
  assert.equal(isSpringClassBookingDateAllowed('2026-09-26', beforeCampaign), true)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-03', beforeCampaign), true)
  assert.equal(isSpringClassBookingDateAllowed('2026-10-10', beforeCampaign), true)
  for (const value of ['2026-09-27', '2026-10-04', '2026-10-11', 'not-a-date']) {
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
    dates: ['Saturday 26 September', 'Saturday 3 October', 'Saturday 10 October'],
    sessions: '10:00 · 13:00 · 16:00',
    courseOptions: [
      'Basic · Create Your Own Cake',
      'Cupcakes & Pavé Chocolate',
      'Advanced · 2-Tier Cake',
    ],
    discountNotes: [
      'Returning students receive 5% off.',
      'Book Basic + Advanced together and receive 5% off the base class fees.',
    ],
    note: 'Private sessions · Maximum 2 children',
    primaryCta: 'Book a spring class',
    secondaryAction: 'Not now',
    calloutTitle: 'Spring vacation bookings open',
    calloutDates: 'Saturday 26 September · Saturday 3 & Saturday 10 October',
    calloutSessions: 'Three sessions: 10:00 · 13:00 · 16:00',
    closed: 'Spring vacation class bookings are now closed.',
  })
  assert.deepEqual(getSpringClassCampaignCopy('ko'), {
    eyebrow: '봄방학 한정 클래스',
    title: 'SPRING VACATION CLASS BOOKING OPEN',
    body: 'Melrose Park에서 진행하는 봄방학 토요일 케이크 클래스 예약이 열렸습니다.',
    dates: ['9월 26일 토요일', '10월 3일 토요일', '10월 10일 토요일'],
    sessions: '10:00 · 13:00 · 16:00',
    courseOptions: [
      'Basic · 나만의 케이크 만들기',
      '컵케이크 & 파베 초콜릿',
      'Advanced · 2단 케이크',
    ],
    discountNotes: [
      '재수강 학생 5% 할인',
      'Basic + Advanced를 함께 예약하면 기본 수업료 5% 할인이 적용됩니다.',
    ],
    note: '프라이빗 클래스 · 최대 2명',
    primaryCta: '봄방학 클래스 예약하기',
    secondaryAction: '나중에 보기',
    calloutTitle: '봄방학 클래스 예약 오픈',
    calloutDates: '9월 26일·10월 3일·10월 10일 토요일',
    calloutSessions: '10:00 · 13:00 · 16:00 세 타임',
    closed: '봄방학 클래스 예약이 마감되었습니다.',
  })
})

test('class customer copy provides Korean labels for the reservation flow', () => {
  const getClassPageCopy = (i18n as unknown as {
    getClassPageCopy?: (language: 'en' | 'ko') => {
      reserve: { title: string; submit: string; parentDetails: string }
      complete: { title: string; backToClasses: string }
    }
  }).getClassPageCopy

  assert.equal(typeof getClassPageCopy, 'function')
  const copy = getClassPageCopy!('ko')
  assert.equal(copy.reserve.title, '키즈 클래스 예약 요청')
  assert.equal(copy.reserve.submit, '예약 요청 보내기')
  assert.equal(copy.reserve.parentDetails, '보호자 정보')
  assert.equal(copy.complete.title, '예약 요청을 보냈습니다')
  assert.equal(copy.complete.backToClasses, '클래스 안내로 돌아가기')
})

test('shared Korean navigation uses a Korean kids-class label and neutral language helper', () => {
  const cakeCopy = (i18n as unknown as {
    cakeCopy: (language: 'en' | 'ko') => { kidsNav: string; languageHelp: string }
  }).cakeCopy

  assert.equal(cakeCopy('ko').kidsNav, '키즈 클래스')
  assert.equal(cakeCopy('ko').languageHelp, '언어 선택')
})
