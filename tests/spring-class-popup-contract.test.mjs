import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const popup = await readFile(new URL('../src/components/SpringClassCampaignDialog.tsx', import.meta.url), 'utf8').catch(() => '')
const home = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const campaign = await readFile(new URL('../src/lib/class-campaign.ts', import.meta.url), 'utf8')

test('the public Home page has no automatic Spring class campaign popup', () => {
  assert.doesNotMatch(home, /SpringClassCampaignDialog/)
  assert.equal(popup, '')
})

test('popup-only styles and session dismissal code are retired', () => {
  assert.doesNotMatch(css, /spring-class-popup/)
  assert.doesNotMatch(campaign, /SPRING_CLASS_POPUP_SESSION_KEY|isSpringClassPopupDismissed|dismissSpringClassPopup/)
})
