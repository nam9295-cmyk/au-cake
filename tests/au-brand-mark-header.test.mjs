import { readFileSync } from 'node:fs'
import { readExpandedCssSync } from './helpers/read-expanded-css.mjs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const chrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
const css = readExpandedCssSync(new URL('../src/index.css', import.meta.url))
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const notFoundHtml = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8')
const header = chrome.slice(chrome.indexOf('export function SiteHeader'), chrome.indexOf('export function SiteFooter'))

test('AU public header uses the supplied wordmark at desktop and mobile sizes', () => {
  assert.match(chrome, /import headerLogo from '\.\.\/assets\/header-logo\.svg'/)
  assert.match(header, /<img\s+className="brand-mark"\s+src=\{headerLogo\}\s+alt="verygood chocolate"/)
  assert.match(header, /alt="verygood chocolate"/)
  assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*156px[\s\S]*?height:\s*40px/)
  assert.match(css, /@media \(max-width: 767px\)\s*\{[\s\S]*?\.site-header \.brand-mark\s*\{[\s\S]*?width:\s*min\(132px, 100%\)[\s\S]*?height:\s*48px/)
  assert.match(css, /@media \(max-width: 600px\)\s*\{[\s\S]*?\.site-header nav\s*\{[\s\S]*?flex-wrap:\s*nowrap/)
})

test('mobile header uses the supplied wordmark and places it below the open drawer layer', () => {
  assert.match(header, /className="brand-mark"\s+src=\{headerLogo\}/)
  assert.match(css, /\.site-header \.brand-button\s*\{[\s\S]*?z-index:\s*50/)
  assert.match(css, /\.mobile-navigation-drawer\s*\{[\s\S]*?z-index:\s*51/)
  assert.match(css, /\.mobile-menu-toggle,[\s\S]*?\.site-header nav\s*\{[\s\S]*?z-index:\s*52/)
})

test('public desktop header removes the Admin link while retaining the Order entry', () => {
  const desktopNav = header.slice(header.indexOf('<nav>'), header.indexOf('</nav>'))

  assert.match(desktopNav, /className="cart-nav-button"/)
  assert.doesNotMatch(desktopNav, /admin-nav-button|admin-login/)
})

test('mobile header raises its wordmark and menu control to the Order action baseline', () => {
  assert.match(css, /\.mobile-menu-toggle\s*\{[\s\S]*?transform:\s*translateY\(-6px\)/)
  assert.match(css, /\.site-header \.brand-button\s*\{[\s\S]*?transform:\s*translateY\(-15px\)/)
})

test('AU mobile header keeps navigation in an accessible drawer around the centred brand and cart', () => {
  assert.match(header, /className="mobile-menu-toggle"/)
  assert.match(header, /aria-expanded=\{mobileMenuOpen\}/)
  assert.match(header, /mobile-navigation-drawer/)
  assert.match(header, /className="mobile-navigation-language"/)
  assert.match(header, /className="cart-nav-button"/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.site-header\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/)
})

test('mobile customer drawer excludes admin navigation', () => {
  const drawerStart = header.indexOf('mobile-navigation-drawer')
  const drawerEnd = header.indexOf('{language && setLanguage', drawerStart)
  const mobileDrawer = header.slice(drawerStart, drawerEnd)

  assert.ok(drawerStart >= 0)
  assert.ok(drawerEnd > drawerStart)
  assert.doesNotMatch(mobileDrawer, /admin-nav-button|admin-login/)
})

test('mobile customer drawer is a partial-width panel that can animate from the left', () => {
  assert.match(header, /mobile-navigation-drawer.*is-open/s)
  assert.match(css, /\.mobile-navigation-drawer\s*\{[\s\S]*?visibility:\s*hidden/)
  assert.match(css, /\.mobile-navigation-panel\s*\{[\s\S]*?width:\s*min\(72vw, 340px\)[\s\S]*?transform:\s*translateX\(-104%\)/)
  assert.match(css, /\.mobile-navigation-drawer\.is-open\s+\.mobile-navigation-panel\s*\{[\s\S]*?transform:\s*translateX\(0\)/)
})

test('HTML shell fallbacks use the canonical lowercase brand', () => {
  for (const html of [indexHtml, notFoundHtml]) {
    assert.match(html, /verygood chocolate/)
    assert.doesNotMatch(html, /Very Good Chocolate|Verygood Chocolate/)
  }
})
