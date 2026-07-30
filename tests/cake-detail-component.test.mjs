import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../src/CakeDetailPage.tsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('home catalogue opens shared cake detail routes instead of skipping to the request form', () => {
  assert.match(homeSource, /navigateToCake\(card\.slug\)/)
  assert.match(appSource, /<CakeDetailPage/)
  assert.match(appSource, /<CakesPage/)
})

test('direct navigation between cake slugs remounts the detail state for the new product', () => {
  assert.match(appSource, /<CakeDetailPage[\s\S]*?key=\{currentCakeSlug\}/)
})

test('shared detail template contains gallery, purchase panel and verified information sections', () => {
  assert.match(detailSource, /cake-detail-gallery/)
  assert.match(detailSource, /cake-detail-purchase/)
  assert.match(detailSource, /cake-detail-trust/)
  assert.match(detailSource, /cake-detail-accordion/)
  assert.doesNotMatch(detailSource, /Free delivery|Delivery tomorrow|Look & taste guarantee/)
})

test('detail add-to-order contract is controlled by App and never reaches into cart context', () => {
  assert.match(detailSource, /onAddToOrder: \(selection: CakeDetailSelection\) => void/)
  assert.match(detailSource, /onViewOrder: \(\) => void/)
  assert.doesNotMatch(detailSource, /\bonRequest\b/)
  assert.doesNotMatch(detailSource, /\buseCart\b/)
  assert.match(appSource, /add: addCartLine/)
  assert.match(appSource, /<CakeDetailPage[\s\S]*onAddToOrder=\{addCartLine\}[\s\S]*onViewOrder=\{\(\) => navigate\(['"]cart['"]\)\}/)
  assert.doesNotMatch(appSource, /requestCakeSelection/)
})

test('adding shows exact bilingual status and View order action', () => {
  assert.match(detailSource, /const \[addedToOrder, setAddedToOrder\] = useState\(false\)/)
  assert.match(detailSource, /function addToOrder\(\) \{[\s\S]*onAddToOrder\(selection\)[\s\S]*setAddedToOrder\(true\)[\s\S]*\}/)
  assert.match(detailSource, /Add to order/)
  assert.match(detailSource, /주문에 담기/)
  assert.match(detailSource, /Added to your order\./)
  assert.match(detailSource, /주문에 담았어요\./)
  assert.match(detailSource, /View order/)
  assert.match(detailSource, /주문 보기/)
  assert.match(detailSource, /className="cake-detail-added"[\s\S]*role="status"[\s\S]*onClick=\{onViewOrder\}/)
})

test('added feedback resets whenever options, quantity, or product variant changes', () => {
  assert.match(detailSource, /function updateSelection\([\s\S]*setAddedToOrder\(false\)[\s\S]*setSelection/)
  assert.match(detailSource, /function chooseProduct\([\s\S]*setAddedToOrder\(false\)[\s\S]*setSelection/)
  assert.match(detailSource, /onClick=\{\(\) => updateSelection\(\{ quantity: selection\.quantity - 1 \}\)\}/)
  assert.match(detailSource, /onClick=\{\(\) => updateSelection\(\{ quantity: selection\.quantity \+ 1 \}\)\}/)
})

test('detail template has explicit narrow-screen layout and accessible controls', () => {
  assert.match(detailSource, /aria-live="polite"/)
  assert.match(detailSource, /aria-pressed=/)
  assert.match(detailSource, /aria-label=/)
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.cake-detail-hero/)
  assert.match(cssSource, /\.cake-detail-option:focus-visible/)
})
