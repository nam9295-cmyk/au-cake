import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const chromeSource = await readSource('../src/components/SiteChrome.tsx')
const homeSource = await readSource('../src/pages/HomePage.tsx')
const cssSource = await readSource('../src/index.css')
const indexSource = await readSource('../index.html')

test('App delegates the public shell and home page to explicit modules', () => {
  assert.match(appSource, /from '\.\/components\/SiteChrome'/)
  assert.match(appSource, /from '\.\/pages\/HomePage'/)
  assert.doesNotMatch(appSource, /function (?:AnnouncementTicker|PickupLocationCard|AnalyticsConsentBanner|HomeTigerBackground|SiteHeader|SiteFooter|VanillaFreshCreamCakeSilhouette|HomePage)\b/)

  for (const component of [
    'AnnouncementTicker',
    'PickupLocationCard',
    'AnalyticsConsentBanner',
    'HomeTigerBackground',
    'SiteHeader',
    'SiteFooter',
    'VanillaFreshCreamCakeSilhouette',
  ]) {
    assert.match(chromeSource, new RegExp(`export function ${component}\\b`))
  }

  assert.match(homeSource, /export function HomePage\b/)
})

test('HomePage owns its catalogue and hero asset dependencies', () => {
  assert.match(homeSource, /from '\.\.\/lib\/cake-catalog'/)
  assert.match(homeSource, /from '\.\.\/assets\/hero-cake-2\.webp'/)
  assert.doesNotMatch(homeSource, /from '\.\.\/assets\/basquecheesecake\.webp'/)
  assert.match(homeSource, /<SiteHeader/)
  assert.match(homeSource, /<PickupLocationCard/)
  assert.match(homeSource, /getPublicCakePage\('brownie-cheesecake'\)\?\.imagePath/)
  assert.match(homeSource, /getPublicCakePage\('vanilla-fresh-cream-cake'\)\?\.imagePath/)
})

test('fixed public overlays do not overlap or widen the document', () => {
  assert.match(indexSource, /html:has\(\.analytics-consent\) #vg-chat-launcher\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*max-width:\s*100vw/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*contain:\s*inline-size/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*overflow-x:\s*clip/s)
  assert.match(cssSource, /\.cake-detail-purchase h1\s*\{[^}]*overflow-wrap:\s*anywhere/s)
})
