import { readFileSync } from 'node:fs'
import { readExpandedCssSync } from './helpers/read-expanded-css.mjs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const adminClasses = readFileSync(new URL('../src/AdminClassesPage.tsx', import.meta.url), 'utf8')
const classReservationDrawer = readFileSync(new URL('../src/ClassReservationDrawer.tsx', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../src/pages/ClassesPage.tsx', import.meta.url), 'utf8')
const reserve = readFileSync(new URL('../src/pages/ClassReservePage.tsx', import.meta.url), 'utf8')
const classCompleteSource = readFileSync(new URL('../src/pages/ClassCompletePage.tsx', import.meta.url), 'utf8')
const classCopy = readFileSync(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const campaign = readFileSync(new URL('../src/lib/class-campaign.ts', import.meta.url), 'utf8')
const setup = readFileSync(new URL('../scripts/setup-appwrite.mjs', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/lib/repository.ts', import.meta.url), 'utf8')
const css = readExpandedCssSync(new URL('../src/index.css', import.meta.url))
const calendar = readFileSync(new URL('../src/components/WeekendDatePicker.tsx', import.meta.url), 'utf8')
const publicContent = JSON.parse(
  readFileSync(new URL('../src/content/au-public-pages.json', import.meta.url), 'utf8'),
)

test('kids class landing presents Basic, Advanced and the Spring campaign dates without stale weekend copy', () => {
  assert.match(landing, /getClassPageCopy\(language\)/)
  assert.match(classCopy, /Basic Cake Class/)
  assert.match(classCopy, /Advanced 2-Tier Cake Class/)
  assert.match(landing, /getSpringClassCampaignCopy/)
  assert.match(landing, /calloutTitle/)
  assert.match(landing, /calloutDates/)
  assert.match(landing, /calloutSessions/)
  assert.doesNotMatch(classCopy, /school holiday|Holiday/)
  assert.doesNotMatch(classCopy, /Saturday and Sunday sessions|Weekend classes|Weekend spots/)
  assert.match(campaign, /Saturday 26 September · Saturday 3 & Saturday 10 October/)
  assert.match(campaign, /9월 26일·10월 3일·10월 10일 토요일/)
  assert.match(classCopy, /Price Guide/)
})

test('class reserve contract limits Basic and package dates to the Spring campaign and supports a closed state', () => {
  assert.match(reserve, /basic-advanced-package/)
  assert.match(reserve, /advancedClassDate/)
  assert.match(reserve, /advancedClassTime/)
  assert.match(reserve, /CLASS_EXTENSION_WARNING/)
  assert.match(reserve, /Year 2/)
  assert.match(reserve, /Year 6/)
  assert.match(reserve, /Kindy/)
  assert.match(reserve, /copy\.reserve\.basicSchoolGroup/)
  assert.match(reserve, /copy\.reserve\.advancedSchoolGroup/)
  assert.match(reserve, /getNextSpringClassDate/)
  assert.match(reserve, /isSpringClassBookingDateAllowed/)
  assert.match(reserve, /SPRING_CLASS_CAMPAIGN_2026/)
  assert.match(reserve, /initialVisibleMonth/)
  assert.match(reserve, /maxDate/)
  assert.match(reserve, /availabilityNote/)
  assert.match(reserve, /campaignCopy\.closed/)
  assert.doesNotMatch(reserve, /isWeekendClassDate|nextWeekendClassDate/)
  assert.doesNotMatch(reserve, /Saturday and Sunday only|Weekend Session|Saturday or Sunday/)
  assert.ok((reserve.match(/<WeekendDatePicker/g) || []).length >= 2)
  assert.doesNotMatch(reserve, /type="date"/)
  assert.match(calendar, /aria-haspopup="dialog"/)
  assert.match(calendar, /role="dialog"/)
  assert.match(calendar, /locale === 'ko-KR' \? ', 주말' : ', weekend'/)
  assert.match(calendar, /Escape/)
  assert.match(calendar, /pointerdown/)
  assert.match(css, /\.weekend-date-picker/)
  assert.match(css, /\.weekend-calendar-day:disabled/)
  const selectionCards = reserve.slice(reserve.indexOf('course-plan-title'), reserve.indexOf('session-detail-title'))
  assert.doesNotMatch(selectionCards, /formatCurrency|AUD\s*\d/)
})

test('class customer pages carry the selected language through the full booking flow', () => {
  assert.match(landing, /getClassPageCopy\(language\)/)
  assert.match(reserve, /getClassPageCopy\(language\)/)
  assert.match(reserve, /locale=\{language === 'ko' \? 'ko-KR' : 'en-AU'\}/)
  assert.match(reserve, /<BankAccountBox settings=\{CLASS_PAYMENT_SETTINGS\} totalPrice=\{price\} language=\{language\} \/>/)
  assert.doesNotMatch(reserve, /language="en"/)
  assert.match(classCompleteSource, /language: Language/)
  assert.match(classCompleteSource, /getClassPageCopy\(language\)/)
  assert.match(classCompleteSource, /reservation\?\.classType \|\| 'school-holiday-private-cake-class'/)
  assert.match(classCompleteSource, /reservation\?\.coursePlan \|\| 'basic'/)
  assert.match(classCompleteSource, /<BankAccountBox settings=\{CLASS_PAYMENT_SETTINGS\} totalPrice=\{reservation\?\.totalPrice\} language=\{language\} \/>/)
})

test('the shared demo notice follows the selected UI language', () => {
  assert.match(app, /language === 'ko' \? 'Appwrite 환경변수가 없어서 로컬 데모 저장소로 실행 중입니다\.' : 'Appwrite environment variables are missing, so the local demo store is active\.'/)
})

test('class Appwrite definitions include optional program audit fields and booked duration', () => {
  const reservationBlock = setup.slice(setup.indexOf('const classReservationAttributes'), setup.indexOf('const classBookedDateAttributes'))
  for (const key of [
    'coursePlan', 'extensionMinutes', 'advancedClassDate', 'advancedClassTime',
    'advancedExtensionMinutes', 'durationMinutes', 'advancedDurationMinutes',
    'subtotalCents', 'discountPercent', 'discountCents', 'totalPriceCents',
  ]) assert.match(reservationBlock, new RegExp(`key: ['\"]${key}['\"]`))
  const bookedBlock = setup.slice(setup.indexOf('const classBookedDateAttributes'), setup.indexOf('const reservationIndexes'))
  assert.match(bookedBlock, /key: ['\"]durationMinutes['\"]/)
  assert.match(setup, /advancedClassDate_idx/)
})

test('kids class public content stays canonical while writes remain server-authoritative', () => {
  const classes = publicContent.classes
  assert.match(classes.description, /26 September, 3 and 10 October 2026/i)
  assert.match(classes.description, /10:00, 13:00 and 16:00/)
  assert.match(classes.description, /Kindy/)
  assert.match(classes.description, /Years 2[–-]6/)
  assert.equal(classes.baseLowPrice, 99)
  assert.equal(classes.baseHighPrice, 254.6)
  assert.match(landing, /getClassPageCopy\(language\)/)
  assert.match(landing, /publicClassContent\.baseLowPrice/)
  assert.match(landing, /publicClassContent\.baseHighPrice/)
  assert.match(landing, /publicClassContent\.packageSummary/)
  assert.match(landing, /publicClassContent\.extensionSummary/)
  assert.match(repository, /export async function createClassReservation[\s\S]*if \(isAppwriteConfigured\)[\s\S]*executeReservationApi<ClassReservation>\('create-class'/)
  assert.match(setup, /APPWRITE_RESERVATION_WRITE_MODE === 'direct' \? 'direct' : 'function'/)
  assert.match(repository, /Query\.equal\('advancedClassDate', filters\.classDate\)/)
  assert.match(repository, /documentGroups\.flat\(\)\.map[\s\S]*document\.\$id/)
})

test('class admin surfaces plan, both sessions, extensions and cent pricing audit', () => {
  for (const source of [adminClasses, classReservationDrawer]) {
    assert.match(source, /getClassCoursePlanLabel/)
    assert.match(source, /advancedClassDate/)
    assert.match(source, /extensionMinutes/)
    assert.match(source, /subtotalCents/)
    assert.match(source, /discountCents/)
    assert.match(source, /totalPriceCents/)
  }
})
