import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const adminLoginSource = await readSource('../src/AdminLoginPage.tsx')
const adminReservationsSource = await readSource('../src/AdminReservationsPage.tsx')
const adminClassesSource = await readSource('../src/AdminClassesPage.tsx')
const reviewInviteSource = await readSource('../src/ReviewInviteButton.tsx')
const reservationDrawerSource = await readSource('../src/ReservationDrawer.tsx')
const classReservationDrawerSource = await readSource('../src/ClassReservationDrawer.tsx')

test('App delegates the named admin pages and drawers to explicit top-level modules', () => {
  assert.match(appSource, /from '\.\/AdminLoginPage'/)
  assert.match(appSource, /from '\.\/AdminReservationsPage'/)
  assert.match(appSource, /from '\.\/AdminClassesPage'/)
  assert.match(appSource, /from '\.\/ReservationDrawer'/)
  assert.match(appSource, /from '\.\/ClassReservationDrawer'/)
  assert.doesNotMatch(appSource, /function (?:AdminLoginPage|AdminReservationsPage|AdminClassesPage|ReviewInviteButton|ReservationDrawer|ClassReservationDrawer)\b/)

  assert.match(appSource, /function AdminDashboardPage\b/)
  assert.match(appSource, /function AdminMonthlyCalendar\b/)
})

test('admin page modules export exact navigate-only page contracts', () => {
  for (const [source, signature] of [
    [adminLoginSource, /export function AdminLoginPage\(\{ navigate \}: \{ navigate: \(page: Page\) => void \}\)/],
    [adminReservationsSource, /export function AdminReservationsPage\(\{\s*navigate,\s*\}: \{\s*navigate: \(page: Page\) => void\s*\}\)/],
    [adminClassesSource, /export function AdminClassesPage\(\{ navigate \}: \{ navigate: \(page: Page\) => void \}\)/],
  ]) {
    assert.match(source, signature)
    assert.doesNotMatch(source, /from '\.\/App'/)
  }
})

test('reservation and class filter defaults plus reservation display helpers move to their private page owners', () => {
  assert.match(adminReservationsSource, /const initialFilters: ReservationFilters/)
  assert.doesNotMatch(appSource, /const initialFilters: ReservationFilters/)
  for (const helper of ['reservationCacaoText', 'reservationCakeSizeText', 'reservationChocolateText', 'reservationFinishText']) {
    assert.match(adminReservationsSource, new RegExp(`function ${helper}\\b`))
    assert.doesNotMatch(appSource, new RegExp(`function ${helper}\\b`))
  }

  assert.match(adminClassesSource, /const initialClassFilters: ClassReservationFilters/)
  assert.doesNotMatch(appSource, /const initialClassFilters: ClassReservationFilters/)
})

test('admin drawer modules export their components and share one ReviewInviteButton owner', () => {
  assert.match(reviewInviteSource, /export function ReviewInviteButton\b/)
  assert.match(reservationDrawerSource, /export function ReservationDrawer\b/)
  assert.match(classReservationDrawerSource, /export function ClassReservationDrawer\b/)

  for (const drawerSource of [reservationDrawerSource, classReservationDrawerSource]) {
    assert.match(drawerSource, /from '\.\/ReviewInviteButton'/)
    assert.doesNotMatch(drawerSource, /function ReviewInviteButton\b/)
  }
})

test('extracted admin components depend downward on explicit lib modules only', () => {
  for (const source of [adminLoginSource, adminReservationsSource, adminClassesSource, reviewInviteSource, reservationDrawerSource, classReservationDrawerSource]) {
    assert.doesNotMatch(source, /from '\.\/App'/)
    assert.doesNotMatch(source, /from '\.\/pages\//)
  }

  assert.match(adminLoginSource, /from '\.\/lib\/repository'/)
  assert.match(adminReservationsSource, /from '\.\/lib\/repository'/)
  assert.match(adminClassesSource, /from '\.\/lib\/class-utils'/)
  assert.match(adminReservationsSource, /from '\.\/ReservationDrawer'/)
  assert.match(adminClassesSource, /from '\.\/ClassReservationDrawer'/)
  assert.match(reviewInviteSource, /from '\.\/lib\/review-messages'/)
  assert.match(reviewInviteSource, /from '\.\/lib\/review-repository'/)
  assert.match(reservationDrawerSource, /from '\.\/lib\/admin-reservation-edit'/)
  assert.match(classReservationDrawerSource, /from '\.\/lib\/class-utils'/)
})
