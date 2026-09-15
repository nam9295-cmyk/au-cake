import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as i18n from '../src/lib/i18n.js'
import {
  SPRING_CLASS_CAMPAIGN_2026,
  getNextSpringClassDate,
  getSpringClassCampaignCopy,
  isSpringClassBookingDateAllowed,
  isSpringClassCampaignActive,
} from '../src/lib/class-campaign.js'

test('campaign opens every holiday date and excludes adjacent dates', () => {
  const now = new Date('2026-09-15T00:00:00Z')
  for (let day = 0; day < 17; day++) {
    const date = new Date(Date.UTC(2026, 8, 26 + day)).toISOString().slice(0, 10)
    assert.equal(isSpringClassBookingDateAllowed(date, now), true, date)
  }
  for (const date of ['2026-09-25', '2026-10-13', 'invalid']) assert.equal(isSpringClassBookingDateAllowed(date, now), false)
  assert.equal(getNextSpringClassDate(now), '2026-09-26')
  assert.equal(getNextSpringClassDate(new Date('2026-09-26T14:00:00Z')), '2026-09-27')
  assert.equal(getNextSpringClassDate(new Date('2026-10-03T14:00:00Z')), '2026-10-04')
})

test('campaign ends after October 12 in Sydney and retains the kill switch', () => {
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-12T12:59:59Z')), true)
  assert.equal(isSpringClassCampaignActive(new Date('2026-10-12T13:00:00Z')), false)
  assert.equal(getNextSpringClassDate(new Date('2026-10-12T13:00:00Z')), null)
  assert.equal(isSpringClassCampaignActive(new Date('2026-09-15T00:00:00Z'), { ...SPRING_CLASS_CAMPAIGN_2026, enabled: false }), false)
  assert.equal(isSpringClassBookingDateAllowed('2026-09-26', new Date('2026-09-27T00:00:00Z')), false)
})

test('campaign copy explains the daily date window in both languages', () => {
  assert.equal(getSpringClassCampaignCopy('en').calloutDates, '26 September–12 October, every day')
  assert.equal(getSpringClassCampaignCopy('ko').calloutDates, '9월 26일–10월 12일 매일')
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
