import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuLanguageProvider } from '../src/components/AuLanguage'
import { AuRedesignHeader } from '../src/components/AuRedesignChrome'
import AuBusinessServicePage from '../src/pages/AuBusinessServicePage'
import KoreaCustomerStoriesPage from '../src/pages/KoreaCustomerStoriesPage'
import { HomeCustomerStories } from '../src/components/CustomerStories'
import { AuCategoryPage } from '../src/pages/AuCategoryPage'
import type { Language } from '../src/lib/i18n'

function render(language: Language, child: ReactNode) {
  return renderToStaticMarkup(createElement(AuLanguageProvider, {
    language, setLanguage() {}, children: child,
  }))
}
test('shared header exposes the selected language and an accessible compact alternative', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = render(language, createElement(AuRedesignHeader, { cartItemCount: 2 }))
    assert.match(html, new RegExp(`lang="${language}" aria-pressed="true"`))
    assert.match(html, /aria-label="Language \/ 언어"/)
    assert.match(html, language === 'en' ? /한국어로 보기/ : /영어로 보기/)
    assert.match(html, /CART \[2\]/)
    assert.match(html, /href="\/business\/events"/)
    assert.match(html, /href="\/classes"/)
  }
})
test('service language changes copy without changing photographs, contact or destination links', () => {
  for (const [slug, headline] of [
    ['events', '함께 나누는 자리를 위한 디저트.'],
    ['cafe-supply', '카페를 위한 디저트 컬렉션.'],
    ['consulting', '메뉴에서 시작되는 고객 경험.'],
  ]) {
    const en = render('en', createElement(AuBusinessServicePage, { slug }))
    const ko = render('ko', createElement(AuBusinessServicePage, { slug }))
    assert.ok(ko.includes(headline), `${slug} has a Korean heading`)
    assert.deepEqual([...ko.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]),
      [...en.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]))
  }
})
test('Korean customer stories display preserved original reviews and localized archive controls', () => {
  const en = render('en', createElement(HomeCustomerStories))
  const ko = render('ko', createElement(HomeCustomerStories))
  assert.match(en, /GOOD WORDS, SHARED\./)
  assert.match(ko, /고객이 전하는 이야기/)
  assert.match(ko, /후기 전체 보기/)
  assert.match(ko, /Baemin · Korea/)
  assert.doesNotMatch(ko, /au-story-mobile-excerpt/)
  assert.match(render('ko', createElement(KoreaCustomerStoriesPage)), /후기 검색/)
})
test('AU category follows the existing language while keeping actual catalogue prices and routes', () => {
  const en = render('en', createElement(AuCategoryPage, { category: 'cakes', language: 'en' }))
  const ko = render('ko', createElement(AuCategoryPage, { category: 'cakes', language: 'ko' }))
  assert.match(ko, /축하의 순간을 위해 주문 제작하는 수제 케이크/)
  assert.deepEqual([...en.matchAll(/href="([^"]+)"/g)].map(m => m[1]),
    [...ko.matchAll(/href="([^"]+)"/g)].map(m => m[1]))
})
