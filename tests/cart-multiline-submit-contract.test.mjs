import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const repository = readFileSync(new URL('../src/lib/repository.ts', import.meta.url), 'utf8')
const cartPage = readFileSync(new URL('../src/CartPage.tsx', import.meta.url), 'utf8')
const reservePage = readFileSync(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const cartProvider = readFileSync(new URL('../src/CartProvider.tsx', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function block(source, startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start + startText.length)
  assert.ok(start >= 0 && end > start, `${startText} block not found`)
  return source.slice(start, end)
}

test('repository capability gate fails closed and caches only the strict health result', () => {
  assert.match(repository, /export function supportsCakeOrderLines\(\): Promise<boolean>/)
  assert.match(repository, /if \(!shouldUseReservationApi\('all'\)\) return Promise\.resolve\(false\)/)
  assert.match(repository, /executeReservationApi\('health', undefined, parseReservationApiCapabilities\)/)
  assert.match(repository, /\.catch\(\(\) => false\)/)
})

test('repository multi-line create is function-only with no local or direct Appwrite fallback', () => {
  const createOrder = block(repository, 'export async function createCakeOrder', 'export async function createReservation')
  assert.match(createOrder, /if \(!await supportsCakeOrderLines\(\)\) throw new Error\(CAKE_ORDER_LINES_UNAVAILABLE_ERROR\)/)
  assert.match(createOrder, /executeReservationApi<CakeOrderReservation>\('create-cake', buildCakeOrderRequest\(input\), parseCakeOrderResult\)/)
  assert.match(createOrder, /isSchoolPickupWindowClosed|isPickupTimeAllowed|isCakePickupBlockedByClass/)
  assert.doesNotMatch(createOrder, /databases\.createDocument|writeLocalReservations|createReservation\(/)
})

test('cart enables multiple selections only after capability success and never sequentially falls back', () => {
  assert.match(cartPage, /cakeOrderLinesAvailable: boolean \| null/)
  assert.match(cartPage, /lines\.length === 1 \|\| \(lines\.length > 1 && cakeOrderLinesAvailable === true\)/)
  assert.match(cartPage, /onContinue: \(\) => void/)
  assert.doesNotMatch(cartPage, /Promise\.all|for \(.*createReservation|forEach\(.*onContinue/)
})

test('App snapshots exact cart lines and subtracts only that quantity after success', () => {
  assert.match(app, /cartOriginLinesRef = useRef<CartLine\[\]>\(\[\]\)/)
  assert.match(app, /setReservationOrderLines\(snapshot\.length > 1 \? snapshot\.map\(\(line\) => \(\{ \.\.\.line\.selection \}\)\) : null\)/)
  assert.match(app, /cartOriginLinesRef\.current = snapshot/)
  assert.match(app, /removeSubmittedCartLines\(originLines\)/)
  assert.match(cartProvider, /setLines\(\(current\) => subtractSubmittedCartLines\(current, submitted\)\)/)
  assert.match(app, /initialOrderLines=\{reservationOrderLines\}/)
})

test('cake runner exits before KR tests when the AU compile or contract chain fails', () => {
  assert.match(packageJson.scripts['test:cake'], /tests\/cake-seo-generator\.test\.mjs \|\| exit \$\?;/)
})

test('ReservePage reuses the shared customer and pickup form while multi-line products stay read-only', () => {
  assert.match(reservePage, /initialOrderLines: readonly CakeDetailSelection\[\] \| null/)
  assert.match(reservePage, /const isMultiOrder = orderSelections !== null/)
  assert.match(reservePage, /className="multi-order-summary"/)
  assert.match(styles, /\.multi-order-summary\s*\{[^}]*border:/s)
  assert.match(styles, /\.multi-order-summary li\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s)
  assert.match(reservePage, /\{!isMultiOrder && \(<>/)
  assert.match(reservePage, /await createCakeOrder\(/)
  assert.match(reservePage, /orderLines: orderSelections\.map/)
  assert.match(reservePage, /packagingPricing\.selectedPackagingPieces > 0/)
  assert.match(reservePage, /getIndividualPackagingPieceCount\(selection\.productId, selection\.quantity\)/)
  assert.match(reservePage, /CAKE_ORDER_LINES_UNAVAILABLE_ERROR/)
})
