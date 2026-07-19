import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('homepage showcase uses compact button cards, a shared dialog, and a conditional archive handoff', () => {
  const section = read('src/PublicReviewsSection.tsx')
  const card = read('src/PublicReviewCard.tsx')
  assert.match(section, /listPublicReviewsPage/)
  assert.match(section, /page\.hasMore/)
  assert.match(section, /onViewAll/)
  assert.match(section, /<PublicReviewCard/)
  assert.match(section, /<PublicReviewDialog/)
  assert.match(card, /<button/)
  assert.match(card, /aria-haspopup="dialog"/)
  assert.match(card, /review\.thumbnailUrl/)
  assert.match(card, /loading="lazy"/)
  assert.doesNotMatch(card, /autoPlay|setInterval/)
})

test('review detail is a portal dialog with full photo, keyboard handling, focus restoration, and scroll lock', () => {
  const dialog = read('src/PublicReviewDialog.tsx')
  assert.match(dialog, /createPortal/)
  assert.match(dialog, /role="dialog"/)
  assert.match(dialog, /aria-modal="true"/)
  assert.match(dialog, /aria-labelledby/)
  assert.match(dialog, /event\.key === 'Escape'/)
  assert.match(dialog, /event\.key === 'Tab'/)
  assert.match(dialog, /document\.body\.style\.overflow/)
  assert.match(dialog, /opener\?\.focus/)
  assert.match(dialog, /review\.photoUrl/)
  assert.match(dialog, /onBackdrop/)
})

test('archive requests six reviews at a time, appends cursor pages, and reuses cards and dialog', () => {
  const archive = read('src/ReviewsArchive.tsx')
  assert.match(archive, /limit: 6/)
  assert.match(archive, /cursor:/)
  assert.match(archive, /previous\.reviews/)
  assert.match(archive, /Load more/)
  assert.match(archive, /<PublicReviewCard/)
  assert.match(archive, /<PublicReviewDialog/)
})

test('home and classes hand off to one indexable reviews route with generated SEO and sitemap coverage', () => {
  const app = read('src/App.tsx')
  const routes = read('src/lib/app-routes.ts')
  const generatedSeo = read('scripts/generate-seo-pages.mjs')
  const sitemap = read('public/sitemap.xml')
  assert.match(app, /page === 'reviews'.*<ReviewsArchive/s)
  assert.equal((app.match(/onViewAll=\{\(\) => navigate\('reviews'\)\}/g) || []).length, 2)
  assert.equal((app.match(/functionEndpoint=\{appwriteConfig\.publicEndpoint\}/g) || []).length, 3)
  assert.match(routes, /if \(path === '\/reviews'\) return 'reviews'/)
  assert.match(generatedSeo, /'\/reviews': \{[\s\S]*robots: 'index, follow'/)
  assert.match(sitemap, /<loc>https:\/\/au\.verygood-chocolate\.com\/reviews<\/loc>/)
})

test('review CSS clamps home excerpts and makes the mobile detail a real full-screen view', () => {
  const css = read('src/index.css')
  assert.match(css, /-webkit-line-clamp:\s*3/)
  assert.match(css, /\.public-review-dialog/)
  assert.match(css, /height:\s*100dvh/)
  assert.match(css, /env\(safe-area-inset-top\)/)
  assert.match(css, /\.public-reviews-grid\.is-archive/)
  assert.match(css, /\.public-review-dialog-backdrop\s*\{[\s\S]*z-index:\s*2147483600/)
  assert.doesNotMatch(css, /\.public-review[^}]*animation:\s*[^n]/s)
})
