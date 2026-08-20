import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const chrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const reserve = readFileSync(new URL('../src/pages/ReservePage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const catalog = readFileSync(new URL('../src/lib/cake-catalog.ts', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/lib/cake-detail.ts', import.meta.url), 'utf8')
const detailPage = readFileSync(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')


test('Vanilla Fresh Cream Cake uses its supplied photos across hero, catalogue and Quick View', () => {
  assert.match(catalog, /defaultProductId:\s*'vanilla-fresh-cream-cake'/)
  assert.match(catalog, /id:\s*'vanilla-fresh-cream'[\s\S]*?isPhotoComingSoon:\s*false/)
  assert.match(home, /import \{ getAuPublicContent, getPublicCakePage \} from '\.\.\/lib\/public-content'/)
  assert.match(home, /'vanilla-fresh-cream-cake':\s*'\/products\/details\/vanillacake-quickview\.webp'/)
  assert.match(home, /image:\s*getPublicCakePage\('vanilla-fresh-cream-cake'\)\?\.imagePath/)
  assert.match(home, /label:\s*'Vanilla Fresh Cream Cake'/)
  assert.match(home, /href=\{`\/cakes\/\$\{card\.slug\}`\}/)
  assert.match(home, /navigateToCake\(card\.slug\)/)
})

test('Vanilla Fresh Cream Cake detail gallery shows the full cake followed by its detail photo', () => {
  assert.match(detail, /'vanilla-side'/)
  assert.match(detail, /'vanilla-quick-view'/)
  assert.match(detail, /'vanilla-fresh-cream':\s*\['vanilla-side',\s*'vanilla-quick-view'\]/)
  assert.match(detailPage, /'vanilla-side':\s*'\/products\/vanilla-cake-sydney\.webp'/)
  assert.match(detailPage, /'vanilla-quick-view':\s*'\/products\/details\/vanillacake-quickview\.webp'/)
})

test('reservation selection uses the safe photo-coming silhouette for Vanilla and photo-pending products', () => {
  assert.match(reserve, /isVanillaFreshCreamCakeProduct\(selectedProduct\.id\) \|\| !selectedProductImage/)
  assert.match(reserve, /catalogCard\?\.isPhotoComingSoon[\s\S]*?<VanillaFreshCreamCakeSilhouette/)
})

test('Vanilla Fresh Cream Cake selects its size without retired flavour controls, while Buttercream shares point colours', () => {
  assert.match(reserve, /!isVanillaFreshCreamCakeProduct\(selectedProduct\.id\)\s*&&\s*<span>\{optionText\.description\}<\/span>/)
  assert.match(reserve, /selectedProduct\.usesSizeOptions && \(/)
  assert.match(reserve, /isCakePointColorProduct\(selectedProduct\.id\) && \(/)
  assert.doesNotMatch(reserve, /name="vanillaCakeFlavor"/)
  assert.doesNotMatch(reserve, /VANILLA_CAKE_FLAVOR_OPTIONS\.map/)
  assert.match(reserve, /form\.cakeSize === option\.value/)
  assert.match(reserve, /form\.vanillaCakePointColor === option\.value/)
  assert.doesNotMatch(reserve, /name="vanillaCakeSheet"/)
  assert.doesNotMatch(reserve, /VANILLA_CAKE_SHEET_OPTIONS\.map/)
})

test('Vanilla Fresh Cream Cake catalogue card exists only for the AU market', () => {
  assert.match(catalog, /id:\s*'vanilla-fresh-cream'/)
  assert.match(home, /marketConfig\.market === 'AU'[\s\S]*?getAuCakeCatalogCards\(language\)/)
})

test('AU catalogue cards follow the final seven-product order', () => {
  const order = ['pave', 'vanilla-fresh-cream', 'buttercream', 'cupcake', 'signature-gateau', 'fresh-lemon-cupcakes', 'brownie-cheesecake']
  const positions = order.map((id) => catalog.indexOf(`id: '${id}'`))
  assert.equal(positions.every((position) => position >= 0), true)
  assert.deepEqual([...positions].sort((left, right) => left - right), positions)
})

test('catalogue stacks on mobile and uses the existing responsive product grid', () => {
  const tabletStart = css.indexOf('@media (min-width: 768px) {')
  const desktopStart = css.indexOf('@media (min-width: 1100px)')
  const tabletCss = css.slice(tabletStart, desktopStart)
  const desktopCss = css.slice(desktopStart, css.indexOf('@media (max-width: 900px)'))
  assert.match(css.slice(0, tabletStart), /\.product-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*1fr;/)
  assert.match(tabletCss, /\.product-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(desktopCss, /\.product-grid\s*\{\s*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/)
})
