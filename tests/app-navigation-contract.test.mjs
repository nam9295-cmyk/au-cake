import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('App stores the pathname so navigation between two cake detail URLs always rerenders', () => {
  assert.match(appSource, /const \[pathname, setPathname\] = useState\(\(\) => window\.location\.pathname\)/)
  assert.match(appSource, /const page = getPageFromPath\(pathname\)/)
  assert.match(appSource, /const handlePop = \(\) => \{[\s\S]*cartOriginLinesRef\.current = \[\][\s\S]*setReservationOrderLines\(null\)[\s\S]*setPathname\(window\.location\.pathname\)[\s\S]*\}/)
  assert.match(appSource, /window\.history\.pushState\(null, '', path\)[\s\S]*?setPathname\(path\)/)
  assert.match(appSource, /const currentCakeSlug = getCakeSlugFromPath\(pathname\) \|\| ''/)
  assert.doesNotMatch(appSource, /const \[page, setPage\]/)
})

test('SEO and analytics effects react to pathname changes, not only page category changes', () => {
  assert.match(appSource, /applySeo\(pathname\)/)
  assert.match(appSource, /trackPageView\(pathname\)/)
  assert.match(appSource, /\}, \[page, pathname\]\)/)
})

test('the UI language toggle updates only the document language', () => {
  assert.match(
    appSource,
    /if \(page === 'review'\) return[\s\S]*document\.documentElement\.lang = language\s*===\s*'ko'\s*\?\s*'ko'\s*:\s*getAuPublicContent\(\)\.site\.language/,
  )
  assert.match(appSource, /\}, \[language, page\]\)/)
  assert.doesNotMatch(appSource, /hreflang|\/ko\//)
})
