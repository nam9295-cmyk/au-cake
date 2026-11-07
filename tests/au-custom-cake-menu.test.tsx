import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuLanguageProvider } from '../src/components/AuLanguage'
import { AuServiceLandingPage } from '../src/pages/AuServiceLandingPage'
import { CustomCakePage } from '../src/pages/CustomCakePage'

for (const language of ['en', 'ko'] as const) {
  test(`four distinct service cards lead to tier-specific cake forms and private enquiries (${language})`, () => {
    Object.assign(globalThis, { window: { location: new URL('https://example.test/custom-cakes?service=private-class&tier=double') } })
    const html = renderToStaticMarkup(<AuLanguageProvider language={language} setLanguage={() => {}}><AuServiceLandingPage kind="custom-cakes" /></AuLanguageProvider>)
    for (const id of ['custom-single', 'custom-double', 'private-class-single', 'private-class-double']) {
      const card = html.match(new RegExp(`<article[^>]*data-menu-id="${id}"[^>]*>([\\s\\S]*?)</article>`))?.[1]
      assert.ok(card, id)
      assert.match(card, /<img[^>]*alt="[^"]+"/)
      assert.match(card, /<h[23]/)
      assert.match(card, /<p/)
      assert.match(card, /<a[^>]*href=/)
    }
    assert.match(html, /href="\/cakes\/custom-cake\?tier=double"/)
    const enquiry = html.match(/<section[^>]*id="private-class-enquiry"[^>]*>([\s\S]*?)<\/section>/)?.[1]
    assert.ok(enquiry)
    assert.match(enquiry, language === 'en' ? /Private Cake Class · Two Tiers/ : /프라이빗 케이크 클래스 · 2단/)
    assert.match(enquiry, language === 'en' ? /Enquire for pricing/ : /수업료 문의/)
    assert.match(enquiry, /https:\/\/www.instagram.com\/verygood_syd\//)
    assert.doesNotMatch(enquiry, /<form|\$\d|\/reserve/)
  })
}
test('direct custom cake entry restores the requested tier with a safe default', () => {
  for (const [query, expected] of [['?tier=double', 'Double (4in+6in)'], ['?tier=single', 'Single (6in)'], ['?tier=invalid', 'Single (6in)']]) {
    Object.assign(globalThis, { window: { location: new URL(`https://example.test/cakes/custom-cake${query}`) } })
    const html = renderToStaticMarkup(<CustomCakePage language="en" navigate={() => {}} setLanguage={() => {}} cartItemCount={0} onComplete={() => {}} />)
    assert.ok(html.includes(expected), query)
  }
})
