import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuLanguageProvider } from '../src/components/AuLanguage'
import { AuNavigation } from '../src/components/AuNavigation'
import { AuServiceLandingPage } from '../src/pages/AuServiceLandingPage'
import { HomePage } from '../src/pages/HomePage'

const render = (element: React.ReactNode, language: 'en' | 'ko') => renderToStaticMarkup(
  <AuLanguageProvider language={language} setLanguage={() => {}}>{element}</AuLanguageProvider>,
)
const links = (html: string) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]

for (const language of ['en', 'ko'] as const) {
  test(`custom cake landing leads to the enquiry form and keeps class information paused (${language})`, () => {
    const html = render(<AuServiceLandingPage kind="custom-cakes" />, language)
    assert.match(html, language === 'en' ? /<h1[^>]*>Custom Cakes<\/h1>/ : /<h1[^>]*>커스텀 케이크<\/h1>/)
    assert.match(html, /<img\b/)
    assert.ok(links(html).some(([, href]) => href === '/cakes/custom-cake'))
    assert.ok(links(html).some(([, href]) => href === 'https://www.instagram.com/verygood_syd/'))
    const classes = html.match(/<section\b[^>]*aria-labelledby="service-classes-title"[^>]*>([\s\S]*?)<\/section>/)?.[1]
    assert.ok(classes, 'class information has its own named section')
    assert.match(classes, /Basic/)
    assert.match(classes, /Advanced/)
    assert.match(classes, language === 'en' ? /Currently paused/ : /현재 휴강 중/)
    assert.ok(links(classes).some(([, href, label]) => href === '/classes' && /archive|아카이브/i.test(label)))
    assert.doesNotMatch(classes, /<button\b|href="(?:\/reserve|\/classes\/reserve|\/class-reserve)/)
    assert.doesNotMatch(html, /href="\/custom-cakes"/)
  })

  test(`business landing presents the three services and keeps café supply coming soon (${language})`, () => {
    const html = render(<AuServiceLandingPage kind="business" />, language)
    assert.match(html, language === 'en' ? /<h1[^>]*>Business<\/h1>/ : /<h1[^>]*>비즈니스<\/h1>/)
    const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map((match) => match[1])
    assert.equal(articles.length, 3)
    for (const slug of ['cafe-supply', 'events', 'consulting']) {
      const service = articles.find((article) => article.includes(`href="/business/${slug}"`))
      assert.ok(service, `${slug} has a working detail destination`)
      assert.match(service, /<img\b[^>]*alt="[^"]+"/)
      assert.match(service, /<h2\b/)
      assert.match(service, /<p\b/)
      if (slug === 'cafe-supply') assert.match(service, language === 'en' ? /Coming Soon/ : /준비 중/)
    }
    assert.ok(links(html).some(([, href]) => href === 'https://www.instagram.com/verygood_syd/'))
    assert.doesNotMatch(html, /<form\b|href="\/reserve"|href="\/business"/)
  })

  test(`kids classes remain visible in the menu and home with a separate archive action (${language})`, () => {
    const menu = render(<AuNavigation cartItemCount={0} />, language)
      .match(/<div class="au-v02-menu-secondary">([\s\S]*?)<\/nav>/)?.[1]
    const home = render(<HomePage language={language} setLanguage={() => {}} navigate={() => {}}
      navigateToCake={() => {}} cartItemCount={0} />, language)
      .match(/<div class="au-v02-footer-links">([\s\S]*?)<\/nav>/)?.[1]
    for (const html of [menu, home]) {
      assert.ok(html)
      assert.match(html, language === 'en' ? /Kids Classes|KIDS CLASSES/ : /키즈 클래스/)
      assert.match(html, language === 'en'
        ? /Currently paused\. Next school holiday dates will be announced once confirmed\./
        : /현재 휴강 중입니다\. 다음 방학 일정은 확정 후 안내합니다\./)
      assert.ok(links(html).some(([, href, label]) => href === '/classes' && /archive|아카이브/i.test(label)))
      assert.ok(links(html).every(([, , label]) => !/Currently paused\.|현재 휴강 중입니다\./.test(label)))
      assert.doesNotMatch(html, /href="(?:\/classes\/reserve|\/class-reserve)"/)
    }
  })
}
