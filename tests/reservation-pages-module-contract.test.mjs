import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const reserveSource = await readSource('../src/pages/ReservePage.tsx')
const completeSource = await readSource('../src/pages/CompletePage.tsx')
const lookupSource = await readSource('../src/pages/LookupPage.tsx')
const productDetailsSource = await readSource('../src/components/ProductDetailRows.tsx')
const adminReservationsSource = await readSource('../src/AdminReservationsPage.tsx')
const constantsSource = await readSource('../src/lib/constants.ts')

test('App delegates customer reservation pages to explicit page modules', () => {
  assert.match(appSource, /from '\.\/pages\/ReservePage'/)
  assert.match(appSource, /from '\.\/pages\/CompletePage'/)
  assert.match(appSource, /from '\.\/pages\/LookupPage'/)
  assert.doesNotMatch(appSource, /function (?:ReservePage|CompletePage|LookupPage)\b/)

  assert.match(reserveSource, /export function ReservePage\b/)
  assert.match(completeSource, /export function CompletePage\b/)
  assert.match(lookupSource, /export function LookupPage\b/)

  for (const pageSource of [reserveSource, completeSource, lookupSource]) {
    assert.doesNotMatch(pageSource, /from '\.\.\/App'/)
  }
})

test('ReservePage privately owns its current-time hook', () => {
  assert.match(reserveSource, /function useCurrentTime\b/)
  assert.doesNotMatch(appSource, /function useCurrentTime\b/)
})

test('customer pages own customer display and lookup formatters', () => {
  assert.match(productDetailsSource, /export function ProductDetailRows\b/)
  assert.match(completeSource, /from '\.\.\/components\/ProductDetailRows'/)
  assert.match(lookupSource, /from '\.\.\/components\/ProductDetailRows'/)
  assert.doesNotMatch(appSource, /from '\.\/components\/ProductDetailRows'/)
  assert.match(lookupSource, /function formatReservationStatus\b/)
  assert.match(lookupSource, /function formatPaymentStatus\b/)
  assert.doesNotMatch(productDetailsSource, /function (?:formatReservationStatus|formatPaymentStatus|reservationCacaoText|reservationCakeSizeText|reservationChocolateText|reservationFinishText)\b/)
})

test('cheesecake product detection has one shared domain owner', () => {
  assert.match(constantsSource, /export function isCheesecakeProduct\b/)
  assert.match(reserveSource, /isCheesecakeProduct/)
  assert.match(productDetailsSource, /isCheesecakeProduct/)
  assert.match(adminReservationsSource, /isCheesecakeProduct/)
  assert.doesNotMatch(reserveSource, /function isCheesecakeProduct\b/)
  assert.doesNotMatch(productDetailsSource, /function isCheesecakeProduct\b/)
  assert.doesNotMatch(adminReservationsSource, /function isCheesecakeProduct\b/)
  assert.doesNotMatch(appSource, /function isCheesecakeProduct\b/)
  assert.doesNotMatch(appSource, /isCheesecakeProduct/)
})
