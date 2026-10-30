import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomePage } from '../src/pages/HomePage'
import { AuRedesignHeader } from '../src/components/AuRedesignChrome'
import { AuLanguageProvider } from '../src/components/AuLanguage'
import { getSeoConfig } from '../src/lib/seo'
import { getAuHomeBest, getAuHomeCollections } from '../src/lib/au-home'

const render = (element: React.ReactNode) =>
  renderToStaticMarkup(
    <AuLanguageProvider language="en" setLanguage={() => {}}>
      {element}
    </AuLanguageProvider>,
  )
const home = () =>
  render(
    <HomePage
      language="en"
      setLanguage={() => {}}
      navigate={() => {}}
      navigateToCake={() => {}}
      cartItemCount={2}
    />,
  )

test('home renders video before the single new headline, Best, collection, stories and separate custom entry', () => {
  const html = home()
  assert.match(html, /<h1[^>]*>CHOCOLATE, CAKES &amp; CELEBRATIONS\.<\/h1>/)
  const markers = [
    'rd-hero-photo-wrap',
    '<h1',
    'id="best"',
    'id="au-collection"',
    'au-v02-craft',
    'au-stories-home',
    'id="custom-cakes"',
    'id="business"',
    'id="story"',
  ]
  let position = -1
  for (const marker of markers) {
    const next = html.indexOf(marker)
    assert.ok(next > position, `${marker} follows the preceding section`)
    position = next
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.match(html, /SIGNATURE FAVOURITES · BEST \[4\]/)
  assert.equal((html.match(/class="au-v02-best-card"/g) || []).length, 4)
  assert.match(html, /href="\/#au-collection"[^>]*>EXPLORE THE MENU/)
  assert.match(html, /href="\/#business"[^>]*>BUSINESS ENQUIRIES/)
})

test('Whole Cakes defaults to four catalogue products; Custom and Coming Soon are not falsely orderable', () => {
  const html = home()
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>Cake &amp; Bake/)
  assert.equal((html.match(/data-home-product=/g) || []).length, 4)
  for (const slug of [
    'pave-chocolate-cake',
    'signature-gateau-au-chocolat',
    'brownie-cheesecake\\?form=loaf',
    'brownie-cheesecake\\?form=whole',
  ]) {
    assert.match(html, new RegExp(`href="/cakes/${slug}"`))
  }
  assert.doesNotMatch(html, /href="\/cakes\/bento-cake"/)
  assert.match(html, /href="\/cakes\/custom-cake"/)
})

test('shared AU header includes Journal alongside existing destinations and paused classes stay auxiliary', () => {
  const html = render(<AuRedesignHeader cartItemCount={2} />)
  const nav = html.match(
    /<nav[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/,
  )![1]
  assert.deepEqual(
    [...nav.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
    ['/cakes','/chocolates','/celebrate','/custom-cakes','/business','/journal'],
  )
  assert.doesNotMatch(nav, /\/classes/)
  assert.match(html, /Temporarily Paused/)
  assert.match(html, /href="\/classes"/)
  assert.match(html, /href="\/reviews"/)
  assert.match(html, /href="\/lookup"/)
  assert.match(html, /Language \/ 언어/)
  assert.match(html, /href="\/cart"/)
})

test('AU home SEO description agrees with the visible hero without altering existing public routes', () => {
  assert.equal(
    getSeoConfig('/').description,
    'Made-to-order cakes and chocolate creations in Sydney. Explore our menu, custom cakes and business enquiries.',
  )
  assert.equal(
    getSeoConfig('/cakes/custom-cake').canonical,
    'https://au.verygood-chocolate.com/cakes/custom-cake',
  )
})

test('Home membership agrees with the four/four/four renewal catalogue',()=>{
 const groups=getAuHomeCollections('en');assert.deepEqual(groups.map(g=>g.products.length),[4,4,4])
 assert.equal(groups[1].products[0].id,'mochi');assert.equal(groups[1].products[0].price,'From AUD 8.00 each');assert.equal(getAuHomeCollections('ko')[1].products[0].price,'개당 AUD 8.00부터')
 assert.deepEqual(getAuHomeBest('en').map(p=>p.id),['mochi','pave','gateau-loaf','brownie-whole'])
 for (const language of ['en', 'ko'] as const) {
  const best = getAuHomeBest(language)
  const mochi = getAuHomeCollections(language)[1].products.find(product => product.id === 'mochi')
  assert.deepEqual(best[0], mochi)
  assert.equal(best[0]?.href, '/chocolates/chocolate-mochi')
 }
 const products=groups.flatMap(g=>g.products)
 for(const [id,amount]of [['pave','75'],['brownie-whole','82'],['brownie-loaf','58'],['smore','25']])assert.ok(products.find(p=>p.id===id)?.price.includes(amount))
})

// SSR-rendered card exercises bilingual markup; session lifecycle/Escape tested in Chrome.
test('Chocolate Mochi modal is bilingual and respects session and Sydney-day dismissal', async () => {
  const { MochiLaunchNotice } = await import('../src/components/MochiLaunchNotice')
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let hiddenDay = ''
  let seen = false
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => hiddenDay } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => seen ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) : null } })
  try {
    for (const language of ['en', 'ko'] as const) {
      const html = renderToStaticMarkup(<MochiLaunchNotice language={language} />)
      assert.match(html, /aria-labelledby="mochi-launch-title"/)
      assert.match(html, /href="\/chocolates\/chocolate-mochi"/)
      assert.match(html, language === 'ko' ? /파베 모찌, 예약 시작!/ : /Chocolate Mochi Pre-orders Are Open!/)
      assert.match(html, language === 'ko' ? /공지 닫기/ : /Dismiss announcement/)
      assert.match(html, /<dialog/); assert.match(html, language === 'ko' ? /오늘 하루 안 보기/ : /Don&#x27;t show again today/)
    }
    hiddenDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    assert.equal(renderToStaticMarkup(<MochiLaunchNotice language="en" />), '')
    hiddenDay = '2000-01-01'
    assert.match(renderToStaticMarkup(<MochiLaunchNotice language="en" />), /<dialog/)
    seen = true
    assert.equal(renderToStaticMarkup(<MochiLaunchNotice language="en" />), '')
  } finally {
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal)
    else Reflect.deleteProperty(globalThis, 'localStorage')
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})
