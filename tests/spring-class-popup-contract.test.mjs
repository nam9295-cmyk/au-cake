import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const popup = await readFile(new URL('../src/components/SpringClassCampaignDialog.tsx', import.meta.url), 'utf8').catch(() => '')
const home = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('Spring class popup is mounted only by the public Home page and books the class route', () => {
  assert.match(home, /SpringClassCampaignDialog/)
  assert.match(home, /onBook=\{\(\) => navigate\('class-reserve'\)\}/)
  assert.doesNotMatch(app, /SpringClassCampaignDialog/)
})

test('Spring popup owns accessible modal, keyboard, focus, scroll and session dismissal behavior', () => {
  assert.match(popup, /role="dialog"/)
  assert.match(popup, /aria-modal="true"/)
  assert.match(popup, /aria-labelledby="spring-class-dialog-title"/)
  assert.match(popup, /closeButtonRef/)
  assert.match(popup, /event\.key === 'Escape'/)
  assert.match(popup, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(popup, /previouslyFocusedRef\.current\?\.focus/)
  assert.match(popup, /window\.sessionStorage/)
  assert.match(popup, /dismissSpringClassPopup/)
  assert.match(popup, /isSpringClassCampaignActive/)
})

test('Spring popup has isolated mobile-safe styles and respects reduced motion', () => {
  assert.match(css, /\.spring-class-popup-backdrop/)
  assert.match(css, /\.spring-class-popup-dialog/)
  assert.match(css, /max-height:/)
  assert.match(css, /@media \(max-width:[\s\S]*\.spring-class-popup-dialog/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.spring-class-popup-dialog/)
})
