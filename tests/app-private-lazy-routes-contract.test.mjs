import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

const namedPrivatePages = [
  ['AdminLoginPage', './AdminLoginPage'],
  ['AdminDashboardPage', './AdminDashboardPage'],
  ['AdminReservationsPage', './AdminReservationsPage'],
  ['AdminClassesPage', './AdminClassesPage'],
]

const defaultPrivatePages = [
  ['AdminReviewsPage', './AdminReviewsPage'],
  ['ReadOnlyCalendarPage', './ReadOnlyCalendarPage'],
]

const eagerModules = [
  './CakeDetailPage',
  './CakesPage',
  './ReviewPage',
  './ReviewsArchive',
  './components/SiteChrome',
  './pages/ClassCompletePage',
  './pages/ClassReservePage',
  './pages/ClassesPage',
  './pages/CompletePage',
  './pages/HomePage',
  './pages/LookupPage',
  './pages/ReservePage',
]

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('exactly six private route modules use React.lazy with the required export adapters', () => {
  for (const [component, modulePath] of [...namedPrivatePages, ...defaultPrivatePages]) {
    assert.doesNotMatch(
      appSource,
      new RegExp(`^import(?:[\\s\\S]*?)from ['"]${escapeRegExp(modulePath)}['"]`, 'm'),
      `${component} must not have a static import`,
    )
  }

  for (const [component, modulePath] of namedPrivatePages) {
    assert.match(
      appSource,
      new RegExp(
        `const ${component} = lazy\\(\\(\\) =>\\s*import\\('${escapeRegExp(modulePath)}'\\)\\.then\\(\\(\\{ ${component} \\}\\) => \\(\\{ default: ${component} \\}\\)\\)\\s*\\)`,
      ),
      `${component} must adapt its named export`,
    )
  }

  for (const [component, modulePath] of defaultPrivatePages) {
    assert.match(
      appSource,
      new RegExp(`const ${component} = lazy\\(\\(\\) => import\\('${escapeRegExp(modulePath)}'\\)\\)`),
      `${component} must lazy-load its default export directly`,
    )
  }

  assert.equal((appSource.match(/\blazy\(\(\) =>\s*import\(/g) || []).length, 6)
})

test('review, public, and booking route modules stay eager', () => {
  for (const modulePath of eagerModules) {
    assert.match(appSource, new RegExp(`from ['"]${escapeRegExp(modulePath)}['"]`), `${modulePath} must stay eager`)
    assert.doesNotMatch(appSource, new RegExp(`import\\(['"]${escapeRegExp(modulePath)}['"]\\)`))
  }
})

test('the review early return remains before the private Suspense boundary', () => {
  const reviewReturn = appSource.indexOf("if (page === 'review') return <ReviewPage")
  const privateSuspense = appSource.indexOf('<Suspense')

  assert.ok(reviewReturn >= 0, 'missing review early return')
  assert.ok(privateSuspense > reviewReturn, 'private Suspense must remain after the review early return')
})

test('one accessible neutral fallback and Suspense boundary are limited to private route renders', () => {
  const fallback = appSource.match(/function PrivateRouteFallback\(\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(fallback, /role="status"/)
  assert.match(fallback, /aria-live="polite"/)
  assert.match(fallback, />Loading…</)
  assert.doesNotMatch(fallback, /<(?:nav|header|footer|button|a)\b/)
  assert.doesNotMatch(fallback, /navigate|settings|language|reservation|customer|admin/i)

  assert.equal((appSource.match(/<Suspense\b/g) || []).length, 1)
  assert.equal((appSource.match(/fallback=\{<PrivateRouteFallback \/>\}/g) || []).length, 1)

  const privateBoundary = appSource.match(/\{isPrivatePage && \(\s*<Suspense fallback=\{<PrivateRouteFallback \/>\}>([\s\S]*?)<\/Suspense>\s*\)\}/)?.[1] || ''
  assert.ok(privateBoundary, 'private route renders must own the Suspense boundary')

  for (const [component] of [...namedPrivatePages, ...defaultPrivatePages]) {
    assert.match(privateBoundary, new RegExp(`<${component}\\b`), `${component} must render inside private Suspense`)
  }

  for (const component of ['ReviewPage', 'HomePage', 'CakesPage', 'CakeDetailPage', 'ClassesPage', 'ClassReservePage', 'ClassCompletePage', 'ReservePage', 'CompletePage', 'LookupPage', 'SiteHeader', 'SiteFooter']) {
    assert.doesNotMatch(privateBoundary, new RegExp(`<${component}\\b`), `${component} must stay outside private Suspense`)
  }
})
