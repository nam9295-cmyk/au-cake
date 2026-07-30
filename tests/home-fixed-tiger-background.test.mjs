import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const chrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('the fixed tiger wallpaper is mounted on the home route only', () => {
  assert.match(chrome, /export function HomeTigerBackground\(\)/)
  assert.match(chrome, /<div className="home-tiger-background" aria-hidden="true" \/>/)
  assert.match(app, /\{page === 'home' && <HomeTigerBackground \/>\}/)
  assert.match(app, /page === 'home' \? ' home-shell' : ''/)
  assert.doesNotMatch(app, /!isPrivatePage && <HomeTigerBackground \/>/)
})

test('the desktop wallpaper is a single fixed non-interactive image behind transparent home content', () => {
  const backgroundRule = css.match(/\.home-tiger-background\s*\{([^}]*)\}/)
  assert.ok(backgroundRule, 'missing home tiger background rule')
  assert.match(backgroundRule[1], /position:\s*fixed/)
  assert.match(backgroundRule[1], /inset:\s*0/)
  assert.match(backgroundRule[1], /pointer-events:\s*none/)
  assert.match(backgroundRule[1], /background-image:\s*url\(['"]\.\/assets\/tiger-pattern-desktop\.webp['"]\)/)
  assert.match(backgroundRule[1], /background-repeat:\s*no-repeat/)
  assert.match(backgroundRule[1], /background-position:\s*center/)
  assert.match(backgroundRule[1], /background-size:\s*cover/)
  assert.match(backgroundRule[1], /opacity:\s*0\.09/)

  const homeShellRule = css.match(/\.app-shell\.home-shell\s*\{([^}]*)\}/)
  assert.ok(homeShellRule, 'missing transparent home shell rule')
  assert.match(homeShellRule[1], /position:\s*relative/)
  assert.match(homeShellRule[1], /background:\s*transparent/)
})

test('small screens use the dedicated mobile wallpaper at lower opacity', () => {
  const mobileStart = css.indexOf('@media (max-width: 767px)')
  const mobile = mobileStart >= 0 ? css.slice(mobileStart) : ''
  assert.ok(mobile, 'missing mobile tiger wallpaper breakpoint')
  assert.match(mobile, /\.home-tiger-background\s*\{[\s\S]*?background-image:\s*url\(['"]\.\/assets\/tiger-pattern-mobile\.webp['"]\)[\s\S]*?opacity:\s*0\.09/)
})
