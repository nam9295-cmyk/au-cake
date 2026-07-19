import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const appwriteSource = await readFile(new URL('../src/lib/appwrite.ts', import.meta.url), 'utf8')
const reviewPageSource = await readFile(new URL('../src/ReviewPage.tsx', import.meta.url), 'utf8')

test('review route is gated before Chatwoot token, analytics, listeners, SDK, or launcher creation', () => {
  const reviewGate = indexHtml.indexOf('pathname === "/review"')
  assert.ok(reviewGate >= 0, 'missing /review Chatwoot gate')
  for (const marker of [
    'WEBSITE_TOKEN',
    'window.gtag',
    'addEventListener("chatwoot:',
    'createElement("script")',
    'id = "vg-chat-launcher"',
  ]) {
    assert.ok(reviewGate < indexHtml.indexOf(marker), `${marker} must be after the review gate`)
  }
  assert.doesNotMatch(indexHtml, /<button[^>]+id="vg-chat-launcher"/)
})

test('generated review.html pathname is included in the early Chatwoot isolation gate', () => {
  const reviewGate = indexHtml.indexOf('pathname === "/review"')
  const aliasGate = indexHtml.indexOf('pathname === "/review.html"')
  assert.ok(aliasGate > reviewGate, 'missing /review.html Chatwoot gate')
  assert.ok(aliasGate < indexHtml.indexOf('WEBSITE_TOKEN'), '/review.html gate must run before Chatwoot configuration')
})

test('App uses the shared route parser and suppresses settings and analytics by resolved review page', () => {
  assert.match(appSource, /getPageFromPath\(window\.location\.pathname\)/)
  assert.match(appSource, /shouldLoadStoreSettings\(page\)/)
  assert.match(appSource, /page !== 'review'.*trackPageView/)
  assert.match(appSource, /if \(page === 'review'\) return <ReviewPage onOrderCake=\{orderCakeFromReview\} \/>/)
})

test('non-review routes retain the lazy Chatwoot launcher contract', () => {
  assert.match(indexHtml, /websiteToken:\s*WEBSITE_TOKEN/)
  assert.match(indexHtml, /launcher\.addEventListener\("click", openChat\)/)
  assert.match(indexHtml, /window\.gtag\("event", "chat_open"/)
  assert.match(indexHtml, /BASE_URL \+ "\/packs\/js\/sdk\.js"/)
})

test('ReviewPage observes fragment changes, resets customer state, and submits the token bound to the loaded generation', () => {
  assert.match(reviewPageSource, /addEventListener\('hashchange',\s*handleHashChange\)/)
  assert.match(reviewPageSource, /resetReviewState\(\)/)
  assert.match(reviewPageSource, /token:\s*loadState\.binding\.token/)
  assert.doesNotMatch(reviewPageSource, /async function submit[\s\S]*?extractReviewToken\(window\.location\.hash\)/)
})

test('ReviewPage localizes and restores html lang and cleans up clipboard timers', () => {
  assert.match(reviewPageSource, /document\.documentElement\.lang\s*=\s*getReviewDocumentLanguage\(language\)/)
  assert.match(reviewPageSource, /document\.documentElement\.lang\s*=\s*previousLanguage/)
  assert.match(reviewPageSource, /copyTimerRef/)
  assert.match(reviewPageSource, /clearTimeout\(copyTimerRef\.current\)/)
})

test('review demo booking paths are development-only and invite copying uses the HTTP-safe fallback', () => {
  assert.match(reviewPageSource, /import\.meta\.env\.DEV\s*&&\s*isReviewDemoMode/)
  assert.match(appSource, /reviewDemoMode=\{import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_REVIEW_DEMO_MODE === 'true'\}/)
  assert.match(appSource, /copyAdminRewardMessage\(buildReviewRequestMessage\(/)
})

test('review API function id has a production-safe default when Cloudflare omits the optional override', () => {
  assert.match(appwriteSource, /reviewApiFunctionId:\s*import\.meta\.env\.VITE_REVIEW_API_FUNCTION_ID\s*\|\|\s*'review-api'/)
})
