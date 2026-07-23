import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const home = app.slice(app.indexOf('function HomePage'), app.indexOf('function ClassesPage'))
const reserve = app.slice(app.indexOf('function ReservePage'), app.indexOf('function CompletePage'))

test('photo-less Vanilla Fresh Cream Cake uses only a black SVG silhouette with COMING SOON while Order Now stays active', () => {
  assert.match(app, /function VanillaFreshCreamCakeSilhouette\(/)
  assert.match(app, /className="vanilla-fresh-cream-silhouette"/)
  assert.match(app, />COMING SOON</)
  assert.match(css, /\.vanilla-fresh-cream-silhouette\s*\{[\s\S]*color:\s*#000/)
  assert.match(home, /productId:\s*'vanilla-fresh-cream-cake'/)
  assert.match(home, /isPhotoComingSoon:\s*true/)
  assert.match(home, /card\.isPhotoComingSoon\s*\?\s*<VanillaFreshCreamCakeSilhouette/)
  assert.match(home, /onClick=\{\(\) => onReserveProduct\(card\.productId\)\}/)
  assert.match(home, /productId:\s*'vanilla-fresh-cream-cake' as ProductId,\s*image:\s*'',\s*isPhotoComingSoon:\s*true/)
})

test('reservation selection renders the Vanilla Fresh Cream Cake silhouette rather than another product image', () => {
  assert.match(reserve, /isVanillaFreshCreamCakeProduct\(selectedProduct\.id\)\s*\?\s*<VanillaFreshCreamCakeSilhouette/)
  assert.match(reserve, /group\.id === 'vanilla-fresh-cream'[\s\S]*?<VanillaFreshCreamCakeSilhouette/)
})

test('Vanilla Fresh Cream Cake size choices show only approved size, serves, and price facts', () => {
  assert.match(reserve, /!isVanillaFreshCreamCakeProduct\(selectedProduct\.id\)\s*&&\s*<span>\{optionText\.description\}<\/span>/)
})

test('Vanilla Fresh Cream Cake catalogue card exists only for the AU market', () => {
  assert.match(home, /\.\.\.\(marketConfig\.market === 'AU' \? \[\s*\{\s*id: 'vanilla-fresh-cream'/)
})

test('AU catalogue cards follow the approved pound, pave, basque, lemon, vanilla order', () => {
  const order = ['pound-cupcake', 'pave', 'cheesecake', 'fresh-lemon-cupcakes', 'vanilla-fresh-cream']
  const positions = order.map((id) => home.indexOf(`id: '${id}'`))
  assert.equal(positions.every((position) => position >= 0), true)
  assert.deepEqual([...positions].sort((left, right) => left - right), positions)
})
