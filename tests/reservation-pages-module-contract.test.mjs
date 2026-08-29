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
const repositorySource = await readSource('../src/lib/repository.ts')

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

test('Cake reservation availability is self-contained and does not wait for Class or legacy-opening reads', () => {
  assert.match(reserveSource, /Cake pick-up · Every day 08:00–20:00/)
  assert.match(reserveSource, /케이크 픽업 · 매일 08:00–20:00/)
  assert.doesNotMatch(reserveSource, /(?:listClassBookedSlots|listCakePickupOpenings|filterCakePickupTimesForClass|isCakePickupBlockedByClass|isCakePickupDateUnavailable)/)
  assert.doesNotMatch(reserveSource, /(?:pickupAvailabilityLoading|pickupAvailabilityError|pickupAvailabilityRefetchKey)/)
})

test('current Whole Cake reservation selector uses the shared 6in, 8in, 10in serving source', () => {
  assert.match(reserveSource, /getCurrentWholeCakeSizeOptions/)
  assert.match(reserveSource, /const reserveCakeSizeOptions = currentWholeCakeSizeOptions\.length/)
  assert.match(reserveSource, /reserveCakeSizeOptions\.map/)
})

test('Cake submission paths do not await Class, school-window, or legacy-opening availability', () => {
  const createCakeOrderSource = repositorySource.slice(
    repositorySource.indexOf('export async function createCakeOrder'),
    repositorySource.indexOf('export async function createReservation'),
  )
  const createReservationSource = repositorySource.slice(
    repositorySource.indexOf('export async function createReservation'),
    repositorySource.indexOf('export function toReservationList'),
  )
  for (const source of [createCakeOrderSource, createReservationSource]) {
    assert.doesNotMatch(source, /(?:listClassBookedSlots|listCakePickupOpenings|isCakePickupBlockedByClass|isSchoolPickupWindowClosed)/)
  }
})

test('cake reservation page requires a normalized customer email for booking details and review rewards', () => {
  assert.match(reserveSource, /customerEmail: ''/)
  assert.match(reserveSource, /type="email"/)
  assert.match(reserveSource, /autoComplete="email"/)
  assert.match(reserveSource, /maxLength=\{120\}/)
  assert.match(reserveSource, /We’ll send your booking details and review reward to this address\./)
  assert.match(reserveSource, /예약 안내와 리뷰 리워드를 이 주소로 보내드려요\./)
  assert.match(reserveSource, /review reward\/coupon delivery/)
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

test('completion and lookup render every authoritative order line with legacy fallback', () => {
  assert.match(productDetailsSource, /export function OrderDetailRows\b/)
  assert.match(productDetailsSource, /orderReservation\.orderLines\?\.length[\s\S]*\[reservation\]/)
  assert.match(productDetailsSource, /pricedLine\.totalPriceCents/)
  assert.match(completeSource, /<OrderDetailRows reservation=\{reservation\}/)
  assert.match(lookupSource, /<OrderDetailRows reservation=\{reservation\}/)
  assert.match(completeSource, /reservation\.totalPriceCents[\s\S]*\/ 100/)
  assert.match(lookupSource, /totalPriceCents[\s\S]*\/ 100/)
  assert.match(repositorySource, /orderLines = payload\.orderLines\?\.map/)
  assert.match(repositorySource, /'totalPriceCents'/)
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
