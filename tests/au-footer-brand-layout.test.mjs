import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const chrome = readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const footerStart = chrome.indexOf('export function SiteFooter')
const footerEnd = chrome.indexOf('export function VanillaFreshCreamCakeSilhouette')
const footer = footerStart >= 0 && footerEnd > footerStart ? chrome.slice(footerStart, footerEnd) : ''

test('public routes mount a responsive branded footer with the supplied cutout assets', () => {
  assert.match(chrome, /import tigerImg from '\.\.\/assets\/tiger\.png'/)
  assert.match(chrome, /import heartLogoImg from '\.\.\/assets\/heart_logo\.png'/)
  assert.match(app, /!isPrivatePage && <SiteFooter navigate=\{navigate\} language=\{language\} \/>/)
  assert.match(footer, /<footer className="site-footer">/)
  assert.match(footer, /className="site-footer-tiger" src=\{tigerImg\}/)
  assert.match(footer, /className="site-footer-heart" src=\{heartLogoImg\}/)
  assert.match(footer, /Made to order by our chocolatier/)
  assert.match(footer, /Chocolate-first cakes, prepared in small batches and finished by hand in Melrose Park\./)
  assert.match(footer, /쇼콜라티에가 주문에 맞춰 만드는 케이크/)
  assert.doesNotMatch(footer, /Pre-arranged Melrose Park pick-up|settings\.storeAddress/)
  assert.match(footer, /navigate\('reserve'\)/)
})

test('mobile footer raises small side illustrations beside the lower information', () => {
  const footerRule = css.match(/\.site-footer\s*\{([^}]*)\}/)
  assert.ok(footerRule, 'missing footer rule')
  assert.match(footerRule[1], /background:\s*var\(--forest\)/)
  assert.match(footerRule[1], /overflow:\s*hidden/)
  assert.match(css, /\.site-footer-heart\s*\{[\s\S]*?bottom:\s*-\d+px[\s\S]*?width:\s*clamp\(300px, 27vw, 430px\)/)

  const mobileStart = css.lastIndexOf('@media (max-width: 560px)')
  const mobile = mobileStart >= 0 ? css.slice(mobileStart) : ''
  assert.ok(mobile, 'missing mobile footer styles')
  assert.match(mobile, /\.site-footer\s*\{[\s\S]*?min-height:\s*604px[\s\S]*?padding:\s*82px 28px 184px/)

  const mobileContent = mobile.match(/\.site-footer-content\s*\{([^}]*)\}/)
  assert.ok(mobileContent, 'missing mobile footer content rule')
  assert.match(mobileContent[1], /width:\s*min\(100%, 292px\)/)
  assert.doesNotMatch(mobileContent[1], /background:/)
  assert.doesNotMatch(mobileContent[1], /padding:/)

  assert.match(mobile, /\.site-footer-nav\s*\{[\s\S]*?flex-direction:\s*column[\s\S]*?align-items:\s*center[\s\S]*?gap:\s*8px/)
  assert.match(mobile, /\.site-footer-tiger\s*\{[\s\S]*?left:\s*-18px[\s\S]*?top:\s*246px[\s\S]*?width:\s*clamp\(88px, 28vw, 104px\)/)
  assert.match(mobile, /\.site-footer-heart\s*\{[\s\S]*?right:\s*-22px[\s\S]*?top:\s*282px[\s\S]*?width:\s*clamp\(124px, 39vw, 144px\)/)
})
