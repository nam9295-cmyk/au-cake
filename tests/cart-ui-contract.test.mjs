import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const cartPageSource = await readSource('../src/CartPage.tsx')
const appSource = await readSource('../src/App.tsx')
const reserveSource = await readSource('../src/pages/ReservePage.tsx')
const cssSource = await readSource('../src/index.css')

test('CartPage has the exact bilingual Phase B2a request copy', () => {
  for (const copy of [
    'Your order',
    '주문 목록',
    'Your order is empty.',
    '주문에 담긴 케이크가 없어요.',
    'Browse cakes',
    '케이크 보기',
    'Estimated subtotal',
    '예상 소계',
    'Continue to reservation',
    '주문 신청 계속하기',
    'To request now, keep one cake selection in your order. Multiple selections will be available soon.',
    '지금 신청하려면 한 가지 케이크 선택만 남겨 주세요. 여러 선택 동시 신청은 곧 제공됩니다.',
    'No payment is taken now. Jenny will confirm availability and send payment details after you submit your request.',
    '지금 결제되지 않습니다. 주문 신청 후 Jenny가 가능 여부를 확인하고 결제 정보를 안내합니다.',
  ]) {
    assert.ok(cartPageSource.includes(copy), copy)
  }

  assert.match(cartPageSource, /lines\.length === 0/)
  assert.match(cartPageSource, /const canContinue = lines\.length === 1/)
  assert.match(cartPageSource, /lines\.length > 1/)
  assert.match(cartPageSource, /disabled=\{!canContinue\}/)
})

test('CartPage uses semantic cart classes instead of borrowed detail and completion classes', () => {
  for (const className of [
    'cart-page',
    'cart-panel',
    'cart-list',
    'cart-line',
    'cart-line-heading',
    'cart-line-options',
    'cart-line-actions',
    'cart-quantity',
    'cart-summary',
    'cart-checkout-note',
    'cart-empty',
  ]) {
    assert.ok(cartPageSource.includes(className), className)
  }

  assert.doesNotMatch(cartPageSource, /className="(?:narrow-page|complete-panel|detail-list|cake-detail-order-summary|cake-detail-quantity|cake-detail-confirmation-note)"/)
})

test('CartPage responsive CSS stacks at 760px and protects 360px actions from overflow', () => {
  assert.match(cssSource, /\.cart-page\s*\{[\s\S]*max-width:/)
  assert.match(cssSource, /\.cart-(?:line|panel)[^{]*\{[\s\S]*min-width:\s*0/)
  assert.match(cssSource, /\.cart-quantity button\s*\{[\s\S]*min-height:\s*44px/)
  assert.match(cssSource, /\.cart-page :is\([^)]*button[^)]*\):focus-visible/)
  assert.match(cssSource, /\.cart-page \.primary-button:disabled/)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.cart-line[\s\S]*flex-direction:\s*column[\s\S]*\.cart-line-actions/)
  assert.match(cssSource, /@media \(max-width: 360px\)[\s\S]*\.cart-summary[\s\S]*\.cart-summary \.primary-button/)
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

test('App owns cart once, adds detail selections, and renders the direct cart route in the public shell', () => {
  assert.match(appSource, /import CartPage from ['"]\.\/CartPage['"]/)
  assert.match(appSource, /import \{ useCart \} from ['"]\.\/CartProvider['"]/)
  assert.equal((appSource.match(/useCart\(\)/g) || []).length, 1)
  assert.match(appSource, /add: addCartLine/)
  assert.match(appSource, /page === ['"]cart['"][\s\S]*<SiteHeader[\s\S]*<CartPage/)
  assert.match(appSource, /<CartPage[\s\S]*lines=\{cartLines\}[\s\S]*onUpdate=\{updateCartLine\}[\s\S]*onRemove=\{removeCartLine\}/)
  assert.match(appSource, /<CakeDetailPage[\s\S]*onAddToOrder=\{addCartLine\}[\s\S]*onViewOrder=\{\(\) => navigate\(['"]cart['"]\)\}/)
  assert.doesNotMatch(appSource, /requestCakeSelection/)
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

test('direct, review, and cart reserve entries retain fresh session-key behavior', () => {
  assert.match(appSource, /const \[reservationSessionKey, setReservationSessionKey\] = useState\(0\)/)
  assert.match(appSource, /nextPage === ['"]reserve['"][\s\S]*setReservationProductId\(DEFAULT_PRODUCT_ID\)[\s\S]*setReservationSelection\(null\)[\s\S]*setReservationSessionKey\(\(current\) => current \+ 1\)/)
  assert.match(appSource, /const continueCartLine = useCallback[\s\S]*setReservationSessionKey\(\(current\) => current \+ 1\)[\s\S]*pushPage\(['"]reserve['"]\)/)
  assert.match(appSource, /const orderCakeFromReview = useCallback[\s\S]*navigate\(['"]reserve['"]\)/)
  assert.match(appSource, /<ReservePage[\s\S]*key=\{reservationSessionKey\}/)
})

test('ordinary and history navigation clear cart origin without a direct detail request callback', () => {
  assert.match(appSource, /const pushPage = useCallback/)
  assert.match(appSource, /const navigate = useCallback[\s\S]*cartOriginLineKeyRef\.current = null[\s\S]*nextPage === ['"]reserve['"][\s\S]*setReservationProductId\(DEFAULT_PRODUCT_ID\)[\s\S]*setReservationSelection\(null\)[\s\S]*pushPage\(nextPage\)/)
  assert.match(appSource, /const handlePop = \(\) => \{[\s\S]*cartOriginLineKeyRef\.current = null[\s\S]*setPathname\(window\.location\.pathname\)/)
  assert.doesNotMatch(appSource, /requestCakeSelection/)
})
