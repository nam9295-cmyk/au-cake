import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuRenewalShop } from '../src/pages/AuRenewalShop'
import { CartProvider } from '../src/CartProvider'
import { AuLanguageContext } from '../src/lib/au-language'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { RENEWAL_CART_KEY } from '../src/lib/renewal-cart'

function renderCheckout(language: 'en' | 'ko', path = '/reserve', origin = 'https://example.test') {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage }
  const values = new Map([[RENEWAL_CART_KEY, JSON.stringify({ version: 1, lines: [{ lineId: 'test-cake', offerId: 'pave-cake', size: '6in', quantity: 1 }] })]])
  const storage = { get length() { return values.size }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
  Object.assign(globalThis, { window: { location: new URL(path, origin), localStorage: storage }, localStorage: storage })
  try {
    return renderToStaticMarkup(<AuLanguageContext.Provider value={{ language, setLanguage() {} }}><CartProvider>
      <AuRenewalShop path={path} settings={{ ...DEFAULT_SETTINGS, bankName: 'BSB 000111', bankAccount: 'Account 222333', accountHolder: 'TEST STORE' }} />
    </CartProvider></AuLanguageContext.Provider>)
  } finally { Object.assign(globalThis, previous) }
}

test('active AU cart and reserve show configured payment details and wait-for-instructions guidance before submission', () => {
  for (const path of ['/cart', '/reserve']) {
    const html = renderCheckout('en', path)
    assert.match(html, /BSB 000111/)
    assert.match(html, /Account 222333/)
    assert.match(html, /TEST STORE/)
    assert.match(html, /No payment is taken now/)
    assert.ok(html.indexOf('BSB 000111') < html.indexOf('Send request'))
    assert.doesNotMatch(html, /Payment amount|입금 금액|PayID/)
  }
})

test('active Renewal checkout has a blank-safe visual pickup calendar in both languages', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderCheckout(language)
    assert.doesNotMatch(html, /type="date"/)
    assert.match(html, /aria-haspopup="dialog"/)
    assert.match(html, /weekend-date-trigger/)
    assert.match(html, language === 'ko' ? /지금은 결제되지 않습니다/ : /No payment is taken now/)
  }
})

test('an unconfigured loopback preview allows inspecting pickup choices but cannot submit reservations', () => {
  for (const origin of ['http://localhost:4173', 'http://127.0.0.1:4173', 'http://[::1]:4173']) {
    const html = renderCheckout('en', '/reserve', origin)
    assert.match(html, /Local preview: you can select a pickup date and time\. Reservations cannot be sent\./)
    assert.match(html, /<button disabled="">Send request<\/button>/)
    assert.doesNotMatch(html, /Online requests for this selection are not open yet/)
  }
  assert.match(renderCheckout('ko', '/cart', 'http://127.0.0.1:4173'), /미리보기에서는 날짜와 시간만 선택할 수 있으며, 예약은 전송되지 않습니다/)
})

test('an unconfigured public site cannot opt into the local pickup preview', () => {
  const html = renderCheckout('en', '/reserve', 'https://au.verygood-chocolate.com')
  assert.doesNotMatch(html, /Local preview:/)
  assert.match(html, /Online requests for this selection are not open yet/)
  assert.match(html, /<button disabled="">Send request<\/button>/)
})
