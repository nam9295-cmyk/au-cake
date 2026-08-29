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

test('Strawberry Whole Cakes use supplied card images, Quick View close-ups and detail galleries', () => {
  assert.match(catalog, /defaultProductId:\s*'fresh-strawberry-vanilla-cream-cake'/)
  assert.match(catalog, /id:\s*'fresh-strawberry-vanilla-cream'[\s\S]*?isPhotoComingSoon:\s*false/)
  assert.match(home, /import \{ getAuPublicContent, getPublicCakePage \} from '\.\.\/lib\/public-content'/)
  assert.match(home, /'fresh-strawberry-vanilla-cream-cake':\s*'\/products\/details\/fresh-strawberry-vanilla-cream-cake-detail-01\.webp'/)
  assert.match(home, /'fresh-strawberry-chocolate-cream-cake':\s*'\/products\/details\/fresh-strawberry-chocolate-cream-cake-detail-01\.webp'/)
  assert.match(detail, /'fresh-strawberry-vanilla-cream':\s*\['fresh-strawberry-vanilla-cream-side',\s*'fresh-strawberry-vanilla-cream-detail'\]/)
  assert.match(detail, /'fresh-strawberry-chocolate-cream':\s*\['fresh-strawberry-chocolate-cream-side',\s*'fresh-strawberry-chocolate-cream-detail'\]/)
  assert.match(detailPage, /'fresh-strawberry-vanilla-cream-side':\s*'\/products\/fresh-strawberry-vanilla-cream-cake-sydney\.webp'/)
  assert.match(detailPage, /'fresh-strawberry-chocolate-cream-side':\s*'\/products\/fresh-strawberry-chocolate-cream-cake-sydney\.webp'/)
  assert.doesNotMatch(home, /label:\s*'Vanilla Fresh Cream Cake'/)
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
  assert.match(reserve, /option\.description && !isVanillaFreshCreamCakeProduct\(selectedProduct\.id\)\s*&&\s*<span>\{option\.description\}<\/span>/)
  assert.match(reserve, /selectedProduct\.usesSizeOptions && \(/)
  assert.match(reserve, /isCakePointColorProduct\(selectedProduct\.id\) && \(/)
  assert.doesNotMatch(reserve, /name="vanillaCakeFlavor"/)
  assert.doesNotMatch(reserve, /VANILLA_CAKE_FLAVOR_OPTIONS\.map/)
  assert.match(reserve, /form\.cakeSize === option\.value/)
  assert.match(reserve, /form\.vanillaCakePointColor === option\.value/)
  assert.doesNotMatch(reserve, /name="vanillaCakeSheet"/)
  assert.doesNotMatch(reserve, /VANILLA_CAKE_SHEET_OPTIONS\.map/)
})

test('Strawberry Whole Cake catalogue cards exist only for the AU market', () => {
  assert.match(catalog, /id:\s*'fresh-strawberry-vanilla-cream'/)
  assert.match(home, /marketConfig\.market === 'AU'[\s\S]*?getAuCakeCatalogGroups\(language\)/)
})

test('AU catalogue grouping declares the final eight-product presentation order', () => {
  const groups = catalog.slice(catalog.indexOf('const AU_CAKE_CATALOG_GROUPS'))
  assert.match(groups, /catalogIds: \['pave', 'buttercream'\][\s\S]*catalogIds: \['signature-gateau', 'cupcake'\][\s\S]*catalogIds: \['fresh-strawberry-vanilla-cream', 'fresh-strawberry-chocolate-cream'\][\s\S]*catalogIds: \['fresh-lemon-cupcakes', 'brownie-cheesecake'\]/)
})

test('grouped catalogue stays two-column on mobile, tablet and desktop', () => {
  assert.match(css, /\.cake-catalog-group-products\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.doesNotMatch(css, /\.cake-catalog-group-products\s*\{[^}]*grid-template-columns:\s*1fr/s)
})
