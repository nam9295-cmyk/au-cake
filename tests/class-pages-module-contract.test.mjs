import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const adminDashboardSource = await readSource('../src/AdminDashboardPage.tsx')
const classesSource = await readSource('../src/pages/ClassesPage.tsx')
const classReserveSource = await readSource('../src/pages/ClassReservePage.tsx')
const classCompleteSource = await readSource('../src/pages/ClassCompletePage.tsx')
const reserveSource = await readSource('../src/pages/ReservePage.tsx')
const completeSource = await readSource('../src/pages/CompletePage.tsx')
const bankAccountSource = await readSource('../src/components/BankAccountBox.tsx')
const todayHookSource = await readSource('../src/hooks/useTodayInputValue.ts')

test('App delegates all class customer pages to explicit page modules', () => {
  assert.match(appSource, /from '\.\/pages\/ClassesPage'/)
  assert.match(appSource, /from '\.\/pages\/ClassReservePage'/)
  assert.match(appSource, /from '\.\/pages\/ClassCompletePage'/)
  assert.doesNotMatch(appSource, /function (?:ClassesPage|ClassReservePage|ClassCompletePage)\b/)

  assert.match(classesSource, /export function ClassesPage\b/)
  assert.match(classReserveSource, /export function ClassReservePage\b/)
  assert.match(classCompleteSource, /export function ClassCompletePage\b/)
})

test('class reservation keeps its weekend default private and shares reusable leaf dependencies with customer reservation owners', () => {
  assert.match(classReserveSource, /function nextWeekendClassDate\b/)
  assert.doesNotMatch(appSource, /function nextWeekendClassDate\b/)
  assert.match(bankAccountSource, /export function BankAccountBox\b/)
  assert.match(reserveSource, /from '\.\.\/components\/BankAccountBox'/)
  assert.match(completeSource, /from '\.\.\/components\/BankAccountBox'/)
  assert.match(classReserveSource, /from '\.\.\/components\/BankAccountBox'/)
  assert.match(classCompleteSource, /from '\.\.\/components\/BankAccountBox'/)
  assert.doesNotMatch(appSource, /function BankAccountBox\b/)

  assert.match(todayHookSource, /export function useTodayInputValue\b/)
  assert.match(adminDashboardSource, /from '\.\/hooks\/useTodayInputValue'/)
  assert.match(classReserveSource, /from '\.\.\/hooks\/useTodayInputValue'/)
  assert.doesNotMatch(appSource, /from '\.\/hooks\/useTodayInputValue'/)
  assert.doesNotMatch(appSource, /function useTodayInputValue\b/)
  assert.doesNotMatch(adminDashboardSource, /function useTodayInputValue\b/)
  assert.doesNotMatch(classReserveSource, /function useTodayInputValue\b/)
})
