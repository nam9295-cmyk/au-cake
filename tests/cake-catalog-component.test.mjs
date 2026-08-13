import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const homeSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const cakesSource = await readFile(new URL('../src/CakesPage.tsx', import.meta.url), 'utf8')

test('home catalogue renders its five cards from the shared AU cake catalog', () => {
  assert.match(homeSource, /getAuCakeCatalogCards\(language\)/)
  assert.doesNotMatch(homeSource, /const catalogCards = \[/)
})

test('catalogue cards render their canonical image paths', () => {
  assert.match(homeSource, /src=\{card\.imagePath\}/)
  assert.match(cakesSource, /src=\{card\.imagePath\}/)
  assert.doesNotMatch(cakesSource, /cakeListImages/)
  assert.match(homeSource, /card\.isPhotoComingSoon/)
})

test('new Lemon Cake catalogue photo is also used in the home hero', () => {
  assert.match(homeSource, /image:\s*getPublicCakePage\('lemon-cake'\)\?\.imagePath/)
  assert.doesNotMatch(homeSource, /import freshLemonCupcakesHeroImg/)
})

test('quick view uses dedicated replaceable detail-shot files', () => {
  assert.match(homeSource, /'pound-cake':\s*'\/products\/details\/chocolate-pound-cake-quick-view\.webp'/)
  assert.match(homeSource, /'pave-cake':\s*'\/products\/details\/pave-chocolate-cake-quick-view\.webp'/)
  assert.match(homeSource, /'basque-cheesecake':\s*'\/products\/details\/chocolatiers-basque-cheesecake-quick-view\.webp'/)
  assert.match(homeSource, /'lemon-cake':\s*'\/products\/details\/lemon-cake-quick-view\.webp'/)
  assert.match(homeSource, /'vanilla-fresh-cream-cake':\s*'\/products\/details\/vanillacake-quickview\.webp'/)
  assert.match(homeSource, /imageUrl=\{quickViewImages\[quickViewCard\.imageKey\]\}/)
})

test('home catalogue cards show only image, title, price, and one action', async () => {
  assert.match(homeSource, /className="product-card-quick-view"/)
  assert.match(homeSource, /aria-haspopup="dialog"/)
  assert.match(homeSource, /className="product-card-title"/)
  assert.match(homeSource, /className="product-card-price"/)
  assert.match(homeSource, /className="secondary-button full-width"/)
  assert.doesNotMatch(homeSource, /card\.features\.map/)
  assert.doesNotMatch(homeSource, /<dt>\{copy\.options\}<\/dt>/)
})

test('cake quick view is an accessible portal dialog with concise content and detail handoff', async () => {
  const dialogSource = await readFile(new URL('../src/ProductQuickViewDialog.tsx', import.meta.url), 'utf8')

  assert.match(homeSource, /<ProductQuickViewDialog/)
  assert.match(dialogSource, /createPortal/)
  assert.match(dialogSource, /role="dialog"/)
  assert.match(dialogSource, /aria-modal="true"/)
  assert.match(dialogSource, /aria-labelledby/)
  assert.match(dialogSource, /aria-describedby/)
  assert.match(dialogSource, /event\.key === 'Escape'/)
  assert.match(dialogSource, /event\.key === 'Tab'/)
  assert.match(dialogSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(dialogSource, /opener\?\.focus/)
  assert.match(dialogSource, /card\.description/)
  assert.match(dialogSource, /card\.features\.slice\(0, 3\)/)
  assert.match(dialogSource, /onChooseOptions/)
})

test('cake quick view floats as a compact animated product card on desktop and mobile', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.product-quick-view-backdrop/)
  assert.match(css, /\.product-quick-view-dialog/)
  assert.match(css, /\.product-quick-view-layout/)
  assert.match(css, /\.product-card-quick-view/)
  assert.match(css, /\.product-quick-view-dialog\s*\{[^}]*width:\s*min\(720px,\s*calc\(100% - 40px\)\)/s)
  assert.match(css, /animation:\s*product-quick-view-backdrop-in\s+420ms/)
  assert.match(css, /animation:\s*product-quick-view-card-in\s+620ms/)
  assert.match(css, /@keyframes product-quick-view-card-in/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-dialog\s*\{[^}]*width:\s*calc\(100% - 28px\)[^}]*max-height:\s*calc\(100dvh - 24px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.product-quick-view-backdrop,[\s\S]*\.product-quick-view-dialog\s*\{[^}]*animation-duration:\s*0\.01ms/)

  const backdropRules = [...css.matchAll(/\.product-quick-view-backdrop\s*\{([^}]*)\}/g)].map((match) => match[1])
  assert.ok(backdropRules.length >= 2, 'desktop and mobile quick view backdrops must both be explicit')
  assert.ok(backdropRules.every((rule) => !rule.includes('rgba(22, 67, 52')), 'quick view backdrop must not tint the page green')
  assert.match(backdropRules[0], /background:\s*rgba\(54, 54, 54, 0\.16\)/)
  assert.match(backdropRules[1], /background:\s*rgba\(54, 54, 54, 0\.14\)/)

  const desktopContent = css.match(/\.product-quick-view-content\s*\{[^}]*padding:\s*(\d+)px\s+\d+px\s+(\d+)px;/)
  assert.ok(desktopContent, 'desktop quick view content needs explicit compact vertical padding')
  assert.ok(Number(desktopContent[1]) <= 40, 'floating card needs compact desktop top padding')
  assert.ok(Number(desktopContent[2]) <= 28, 'floating card needs compact desktop bottom padding')
})

test('quick view photography fills its frame and mobile copy stays compact', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(css, /\.product-quick-view-image-wrap > img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*max-height:\s*none[^}]*object-fit:\s*cover/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-image-wrap\s*\{[^}]*height:\s*min\(42dvh,\s*320px\)[^}]*min-height:\s*240px[^}]*max-height:\s*320px/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-content\s*\{[^}]*padding:\s*16px 14px calc\(16px \+ env\(safe-area-inset-bottom\)\)/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-description\s*\{[^}]*font-size:\s*12px[^}]*line-height:\s*1\.35/s)
  assert.doesNotMatch(css, /@media \(max-width: 767px\)[\s\S]*\.product-quick-view-image-wrap > img\s*\{[^}]*width:\s*min\(76%,\s*280px\)/s)
})
