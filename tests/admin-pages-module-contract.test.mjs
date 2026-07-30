import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const reviewInviteSource = await readSource('../src/ReviewInviteButton.tsx')
const reservationDrawerSource = await readSource('../src/ReservationDrawer.tsx')
const classReservationDrawerSource = await readSource('../src/ClassReservationDrawer.tsx')

test('App delegates admin drawers to explicit top-level modules while admin pages remain inline', () => {
  assert.match(appSource, /from '\.\/ReservationDrawer'/)
  assert.match(appSource, /from '\.\/ClassReservationDrawer'/)
  assert.doesNotMatch(appSource, /function (?:ReviewInviteButton|ReservationDrawer|ClassReservationDrawer)\b/)

  assert.match(appSource, /function AdminDashboardPage\b/)
  assert.match(appSource, /function AdminReservationsPage\b/)
  assert.match(appSource, /function AdminClassesPage\b/)
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
  for (const source of [reviewInviteSource, reservationDrawerSource, classReservationDrawerSource]) {
    assert.doesNotMatch(source, /from '\.\/App'/)
    assert.doesNotMatch(source, /from '\.\/pages\//)
  }

  assert.match(reviewInviteSource, /from '\.\/lib\/review-messages'/)
  assert.match(reviewInviteSource, /from '\.\/lib\/review-repository'/)
  assert.match(reservationDrawerSource, /from '\.\/lib\/admin-reservation-edit'/)
  assert.match(classReservationDrawerSource, /from '\.\/lib\/class-utils'/)
})
