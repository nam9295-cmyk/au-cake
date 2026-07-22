import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const setup = readFileSync(new URL('../scripts/setup-appwrite.mjs', import.meta.url), 'utf8')
const seo = readFileSync(new URL('../src/lib/seo.ts', import.meta.url), 'utf8')
const generatedSeo = readFileSync(new URL('../scripts/generate-seo-pages.mjs', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/lib/repository.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const calendar = readFileSync(new URL('../src/components/WeekendDatePicker.tsx', import.meta.url), 'utf8')
const reserve = app.slice(app.indexOf('function ClassReservePage'), app.indexOf('function ClassCompletePage'))
const landing = app.slice(app.indexOf('function ClassesPage'), app.indexOf('function ClassReservePage'))

test('kids class landing presents Basic, Advanced and weekend-only wording without visible Holiday copy', () => {
  assert.match(landing, /Basic Cake Class/)
  assert.match(landing, /Advanced 2-Tier Cake Class/)
  assert.match(landing, /Saturday and Sunday|weekend/i)
  assert.doesNotMatch(landing, /school holiday|Holiday/)
  assert.match(landing, /Price Guide/)
})

test('class reserve contract offers Basic from Kindy, Advanced from Year 2, two package slots and exact extension warning', () => {
  assert.match(reserve, /basic-advanced-package/)
  assert.match(reserve, /advancedClassDate/)
  assert.match(reserve, /advancedClassTime/)
  assert.match(reserve, /CLASS_EXTENSION_WARNING/)
  assert.match(reserve, /Year 2/)
  assert.match(reserve, /Year 6/)
  assert.match(reserve, /Kindy/)
  assert.match(reserve, /Basic · Kindy–Year 6/)
  assert.match(reserve, /Advanced · Year 2–6 only/)
  assert.match(reserve, /isWeekendClassDate/)
  assert.ok((reserve.match(/<WeekendDatePicker/g) || []).length >= 2)
  assert.doesNotMatch(reserve, /type="date"/)
  assert.match(calendar, /aria-haspopup="dialog"/)
  assert.match(calendar, /role="dialog"/)
  assert.match(calendar, /Escape/)
  assert.match(calendar, /pointerdown/)
  assert.match(css, /\.weekend-date-picker/)
  assert.match(css, /\.weekend-calendar-day:disabled/)
  const selectionCards = reserve.slice(reserve.indexOf('course-plan-title'), reserve.indexOf('session-detail-title'))
  assert.doesNotMatch(selectionCards, /formatCurrency|AUD\s*\d/)
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

test('kids class SEO distinguishes Basic Kindy–Year 6 from Advanced Year 2–6 and keeps writes server-authoritative', () => {
  const classesSeo = seo.slice(seo.indexOf("'/classes':"), seo.indexOf("'/reviews':"))
  assert.doesNotMatch(classesSeo, /school holiday|Holiday/)
  assert.match(classesSeo, /weekend/i)
  assert.match(classesSeo, /Kindy/)
  assert.match(classesSeo, /Years 2[–-]6/)
  assert.match(repository, /export async function createClassReservation[\s\S]*if \(isAppwriteConfigured\)[\s\S]*executeReservationApi<ClassReservation>\('create-class'/)
  assert.match(setup, /APPWRITE_RESERVATION_WRITE_MODE === 'direct' \? 'direct' : 'function'/)
  assert.match(repository, /Query\.equal\('advancedClassDate', filters\.classDate\)/)
  assert.match(repository, /documentGroups\.flat\(\)\.map[\s\S]*document\.\$id/)
  const generatedClasses = generatedSeo.slice(generatedSeo.indexOf("'/classes':"), generatedSeo.indexOf("'/reviews':"))
  assert.doesNotMatch(generatedClasses, /school holiday|Holiday|Launch prices/i)
  assert.match(generatedClasses, /weekend/i)
  assert.match(generatedClasses, /Kindy/)
  assert.match(generatedClasses, /Years 2[–-]6/)
  assert.match(generatedClasses, /Basic Cake Class/)
  assert.match(generatedClasses, /Advanced 2-Tier Cake Class/)
  assert.match(generatedClasses, /Price Guide/)
})

test('class admin surfaces plan, both sessions, extensions and cent pricing audit', () => {
  const admin = app.slice(app.indexOf('function AdminClassesPage'), app.indexOf('function ReviewInviteButton'))
  const drawer = app.slice(app.indexOf('function ClassReservationDrawer'), app.indexOf('function ReservationDrawer'))
  for (const source of [admin, drawer]) {
    assert.match(source, /getClassCoursePlanLabel/)
    assert.match(source, /advancedClassDate/)
    assert.match(source, /extensionMinutes/)
    assert.match(source, /subtotalCents/)
    assert.match(source, /discountCents/)
    assert.match(source, /totalPriceCents/)
  }
})