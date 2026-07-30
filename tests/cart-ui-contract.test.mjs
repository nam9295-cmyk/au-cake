import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const cartPageSource = await readSource('../src/CartPage.tsx')
const appSource = await readSource('../src/App.tsx')
const reserveSource = await readSource('../src/pages/ReservePage.tsx')

test('CartPage has localized empty, single-line, and multi-line request states', () => {
  assert.match(cartPageSource, /Your cart/)
  assert.match(cartPageSource, /장바구니/)
  assert.match(cartPageSource, /lines\.length === 0/)
  assert.match(cartPageSource, /const canContinue = lines\.length === 1/)
  assert.match(cartPageSource, /lines\.length > 1/)
  assert.match(cartPageSource, /Only one cake configuration can be requested at a time/)
  assert.match(cartPageSource, /한 번에 한 가지 케이크 구성만 요청할 수 있어요/)
  assert.match(cartPageSource, /No payment is taken now\. Jenny will confirm availability and send payment details\./)
  assert.match(cartPageSource, /지금 결제되지 않습니다\. Jenny가 가능 여부를 확인한 뒤 결제 정보를 안내합니다\./)
  assert.match(cartPageSource, /disabled=\{!canContinue\}/)
})

test('CartPage quantity and removal callbacks always receive the rendered line exact key', () => {
  assert.match(cartPageSource, /onUpdate\(line\.lineKey, line\.selection\.quantity - 1\)/)
  assert.match(cartPageSource, /onUpdate\(line\.lineKey, line\.selection\.quantity \+ 1\)/)
  assert.match(cartPageSource, /onRemove\(line\.lineKey\)/)
  assert.match(cartPageSource, /onContinue\(lines\[0\]\)/)
  assert.match(cartPageSource, /MAX_RESERVATION_QUANTITY/)
  assert.match(cartPageSource, /getCartEstimatedSubtotal\(lines\)/)
  assert.doesNotMatch(cartPageSource, /as Reservation/)
})

test('App owns cart once and renders the direct cart route in the unchanged public shell', () => {
  assert.match(appSource, /import CartPage from ['"]\.\/CartPage['"]/)
  assert.match(appSource, /import \{ useCart \} from ['"]\.\/CartProvider['"]/)
  assert.equal((appSource.match(/useCart\(\)/g) || []).length, 1)
  assert.match(appSource, /page === ['"]cart['"][\s\S]*<SiteHeader[\s\S]*<CartPage/)
  assert.match(appSource, /<CartPage[\s\S]*lines=\{cartLines\}[\s\S]*onUpdate=\{updateCartLine\}[\s\S]*onRemove=\{removeCartLine\}/)
  assert.match(appSource, /!isPrivatePage && <SiteFooter/)
})

test('cart-to-reserve handoff copies one selection and removes only that successful origin line', () => {
  assert.match(appSource, /const cartOriginLineKeyRef = useRef<string \| null>\(null\)/)
  assert.match(appSource, /setReservationSelection\(\{ \.\.\.line\.selection \}\)/)
  assert.match(appSource, /cartOriginLineKeyRef\.current = line\.lineKey/)
  assert.match(appSource, /const originLineKey = cartOriginLineKeyRef\.current[\s\S]*if \(originLineKey\) \{[\s\S]*removeCartLine\(originLineKey\)[\s\S]*cartOriginLineKeyRef\.current = null/)
  assert.equal((appSource.match(/removeCartLine\(/g) || []).length, 1)
  assert.doesNotMatch(reserveSource, /catch[\s\S]{0,600}removeCartLine/)
})

test('same-route direct reserve navigation remounts the form instead of retaining a stale cart selection', () => {
  assert.match(appSource, /const \[reservationSessionKey, setReservationSessionKey\] = useState\(0\)/)
  assert.match(appSource, /nextPage === ['"]reserve['"][\s\S]*setReservationProductId\(DEFAULT_PRODUCT_ID\)[\s\S]*setReservationSelection\(null\)[\s\S]*setReservationSessionKey\(\(current\) => current \+ 1\)/)
  assert.match(appSource, /const requestCakeSelection = useCallback[\s\S]*setReservationSessionKey\(\(current\) => current \+ 1\)[\s\S]*pushPage\(['"]reserve['"]\)/)
  assert.match(appSource, /const continueCartLine = useCallback[\s\S]*setReservationSessionKey\(\(current\) => current \+ 1\)[\s\S]*pushPage\(['"]reserve['"]\)/)
  assert.match(appSource, /<ReservePage[\s\S]*key=\{reservationSessionKey\}/)
})

test('ordinary and history navigation clear cart origin while detail request still goes straight to reserve', () => {
  assert.match(appSource, /const pushPage = useCallback/)
  assert.match(appSource, /const navigate = useCallback[\s\S]*cartOriginLineKeyRef\.current = null[\s\S]*nextPage === ['"]reserve['"][\s\S]*setReservationProductId\(DEFAULT_PRODUCT_ID\)[\s\S]*setReservationSelection\(null\)[\s\S]*pushPage\(nextPage\)/)
  assert.match(appSource, /const handlePop = \(\) => \{[\s\S]*cartOriginLineKeyRef\.current = null[\s\S]*setPathname\(window\.location\.pathname\)/)
  assert.match(appSource, /const requestCakeSelection = useCallback[\s\S]*setReservationProductId\(selection\.productId\)[\s\S]*setReservationSelection\(selection\)[\s\S]*cartOriginLineKeyRef\.current = null[\s\S]*pushPage\(['"]reserve['"]\)/)
})
