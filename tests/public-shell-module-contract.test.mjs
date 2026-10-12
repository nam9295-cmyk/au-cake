import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readExpandedCss } from './helpers/read-expanded-css.mjs'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')

const appSource = await readSource('../src/App.tsx')
const chromeSource = await readSource('../src/components/SiteChrome.tsx')
const homeSource = await readSource('../src/pages/HomePage.tsx')
const cssSource = await readExpandedCss(new URL('../src/index.css', import.meta.url))
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

test('AU Home delegates catalogue display and preserves the existing Hero and KR Home', () => {
  assert.match(homeSource, /from '\.\.\/lib\/au-home'/)
  assert.match(homeSource, /<AuHeroVideo/)
  assert.match(homeSource, /<AuRedesignHeader[^>]*cartItemCount=\{cartItemCount\}/)
  assert.match(homeSource, /marketConfig.market === 'AU' \?\s*\(\s*<AuHomePage/)
  assert.match(homeSource, /:\s*\(\s*<LegacyHomePage/)
})

test('fixed public overlays do not overlap or widen the document', () => {
  assert.match(indexSource, /html:has\(\.analytics-consent\) #vg-chat-launcher\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*max-width:\s*100vw/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*contain:\s*inline-size/s)
  assert.match(cssSource, /\.announcement-ticker\s*\{[^}]*overflow-x:\s*clip/s)
  assert.match(cssSource, /\.cake-detail-purchase h1\s*\{[^}]*overflow-wrap:\s*anywhere/s)
})
