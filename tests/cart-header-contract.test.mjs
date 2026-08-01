import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

const siteChromeSource = await readSource('../src/components/SiteChrome.tsx')
const appSource = await readSource('../src/App.tsx')
const cssSource = await readSource('../src/index.css')
const adminLoginSource = await readSource('../src/AdminLoginPage.tsx')
const customerPageSources = await Promise.all([
  '../src/pages/HomePage.tsx',
  '../src/pages/ClassesPage.tsx',
  '../src/pages/ReservePage.tsx',
  '../src/pages/CompletePage.tsx',
  '../src/pages/LookupPage.tsx',
  '../src/pages/ClassReservePage.tsx',
  '../src/pages/ClassCompletePage.tsx',
].map(readSource))

test('SiteHeader exposes an optional availability-first Order link with an exact accessible item count', () => {
  assert.match(siteChromeSource, /ShoppingBag/)
  assert.match(siteChromeSource, /cartItemCount\?: number/)
  assert.match(siteChromeSource, /cartItemCount !== undefined/)
  assert.match(siteChromeSource, /className="cart-nav-button"/)
  assert.match(siteChromeSource, /href="\/cart"/)
  assert.match(siteChromeSource, /rel="nofollow"/)
  assert.match(siteChromeSource, /navigate\(['"]cart['"]\)/)
  assert.match(siteChromeSource, /Open order, .*items/)
  assert.match(siteChromeSource, /주문 목록 열기/)
  assert.match(siteChromeSource, /cartItemCount > 99 \? ['"]99\+['"]/)
  assert.match(siteChromeSource, /cartItemCount > 0[\s\S]*className="cart-nav-count"[\s\S]*aria-hidden="true"/)
  assert.match(siteChromeSource, /className="cart-nav-label"[\s\S]*Order/)
  assert.match(siteChromeSource, /주문/)
})

test('App owns total quantity once and passes it to every customer-facing header path', () => {
  assert.equal((appSource.match(/useCart\(\)/g) || []).length, 1)
  assert.match(appSource, /itemCount: cartItemCount/)
  assert.doesNotMatch(appSource, /cartItemCount\s*=\s*cartLines\.length/)
  assert.match(appSource, /<HomePage[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<ClassesPage[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<ClassReservePage[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<ClassCompletePage[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<ReservePage[\s\S]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<CompletePage[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(appSource, /<LookupPage[^>]*cartItemCount=\{cartItemCount\}/)

  const directPublicHeaders = appSource.match(/<SiteHeader navigate=\{navigate\} language=\{language\} setLanguage=\{setLanguage\} cartItemCount=\{cartItemCount\} \/>/g) || []
  assert.equal(directPublicHeaders.length, 5)
})

test('page-owned customer headers require and forward total quantity while admin login stays cart-free', () => {
  for (const source of customerPageSources) {
    assert.match(source, /cartItemCount: number/)
    assert.match(source, /<SiteHeader[^>]*cartItemCount=\{cartItemCount\}/)
  }
  assert.doesNotMatch(adminLoginSource, /cartItemCount/)
})

test('Order badge keeps the existing forest palette and stays compact without mobile overflow', () => {
  assert.match(cssSource, /\.site-header nav \.cart-nav-button\s*\{[\s\S]*position:\s*relative[\s\S]*gap:/)
  assert.match(cssSource, /\.cart-nav-count\s*\{[\s\S]*min-width:\s*20px[\s\S]*min-height:\s*20px/)
  assert.match(cssSource, /\.cart-nav-count\s*\{[\s\S]*(?:var\(--forest|var\(--cream)/)
  assert.doesNotMatch(cssSource, /\.cart-nav-count\s*\{[^}]*#(?:edc5c4|c52d3a|ff0000)/i)
  assert.match(cssSource, /@media \(max-width: 600px\)[\s\S]*\.site-header nav \.cart-nav-button[\s\S]*min-width:\s*(?:36|40)px[\s\S]*\.cart-nav-label\s*\{[\s\S]*display:\s*none/)

  const compactPublicHeader = cssSource.lastIndexOf('/* Keep the public Order control visible on compact headers. */')
  const legacyNoWrap = cssSource.indexOf('Keep the enlarged public brand mark')
  assert.ok(compactPublicHeader > legacyNoWrap)
  assert.match(cssSource.slice(compactPublicHeader), /\.app-shell:not\(:has\(\.kids-class-page\)\)[\s\S]*\.site-header nav\s*\{[\s\S]*min-width:\s*0[\s\S]*flex-wrap:\s*wrap/)

  const hiddenKidsLinks = cssSource.indexOf('.app-shell:has(.kids-class-page) .site-header nav :is(button, a):nth-child(n + 2)')
  const restoredClassCart = cssSource.lastIndexOf('.app-shell:has(.kids-class-page) .site-header nav a.cart-nav-button')
  assert.ok(restoredClassCart > hiddenKidsLinks)
  assert.match(cssSource.slice(restoredClassCart), /display:\s*inline-flex/)
  assert.match(cssSource.slice(restoredClassCart), /\.app-shell:has\(\.class-reserve-page\) \.site-header nav[\s\S]*display:\s*flex/)
  assert.match(cssSource.slice(restoredClassCart), /:not\(\.cart-nav-button\)[\s\S]*display:\s*none/)
})
