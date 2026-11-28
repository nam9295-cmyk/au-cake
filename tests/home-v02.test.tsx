import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomePage } from '../src/pages/HomePage'
import { AuRedesignHeader } from '../src/components/AuRedesignChrome'
import { AuLanguageProvider } from '../src/components/AuLanguage'
import { getSeoConfig } from '../src/lib/seo'
import homeCopy from '../src/content/au-home-v02.json'
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

test('home places custom cake and private class menus directly after the product collection', () => {
  const html = home()
  assert.match(html, /<h1[^>]*>CHOCOLATE, CAKES &amp; CELEBRATIONS\.<\/h1>/)
  const markers = [
    'rd-hero-photo-wrap',
    '<h1',
    'id="best"',
    'id="au-collection"',
    'id="custom-cakes"',
    'au-v02-craft',
    'au-stories-home',
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
  assert.equal((html.match(/<section[^>]*id="au-collection"[\s\S]*?<\/section>/)?.[0].match(/data-home-product=/g) || []).length, 4)
  for (const slug of [
    'pave-chocolate-cake',
    'signature-gateau-au-chocolat',
    'brownie-cheesecake\\?form=loaf',
    'brownie-cheesecake\\?form=whole',
  ]) {
    assert.match(html, new RegExp(`href="/cakes/${slug}"`))
  }
  assert.doesNotMatch(html, /href="\/cakes\/bento-cake"/)
  assert.match(html, /href="\/custom-cakes"/)
  assert.doesNotMatch(html, /href="\/cakes\/custom-cake"/)
})

test('shared AU header includes Journal alongside existing destinations and highlights Instagram on desktop and mobile', () => {
  const html = render(<AuRedesignHeader cartItemCount={2} />)
  const nav = html.match(
    /<nav[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/,
  )![1]
  assert.deepEqual(
    [...nav.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
    ['/cakes','/chocolates','/celebrate','/custom-cakes','/business','/journal'],
  )
  assert.doesNotMatch(nav, /\/classes/)
  assert.doesNotMatch(html, /Temporarily Paused|href="\/(?:classes|reviews|lookup|#story)"/)
  const [desktop, mobile] = html.split('<dialog')
  for (const part of [desktop, mobile]) {
    assert.match(part, /href="https:\/\/www\.instagram\.com\/verygood_syd\/"/)
  }
  assert.match(html, /Language \/ 언어/)
  assert.match(html, /href="\/cart"/)
})

test('AU home SEO description agrees with the visible hero without altering existing public routes', () => {
  const seo = getSeoConfig('/')
  assert.equal(seo.description, homeCopy.description)
  assert.ok(home().includes(homeCopy.description))
  assert.equal(seo.image, new URL(homeCopy.poster.src, seo.canonical).href)
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
 for(const [id,amount]of [['pave','45'],['brownie-whole','49'],['brownie-loaf','58'],['smore','25']])assert.ok(products.find(p=>p.id===id)?.price.includes(amount))
})

// SSR-rendered card exercises bilingual markup; session lifecycle/Escape tested in Chrome.
test('Home notice switches at Sydney midnight and keeps bilingual campaign dismissals independent', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-29T23:59:59+11:00') })
  const { MiniCakeLaunchNotice } = await import('../src/components/MiniCakeLaunchNotice')
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const hiddenDays = new Map<string, string>()
  const seenDays = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => hiddenDays.get(key) } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => seenDays.get(key) } })
  try {
    for (const language of ['en', 'ko'] as const) {
      const html = renderToStaticMarkup(<MiniCakeLaunchNotice language={language} />)
      const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1]
      assert.ok(titleId && html.includes(`<h2 id="${titleId}">`))
      assert.match(html, /href="\/cakes\/brownie-cheesecake\?form=whole&amp;size=4in"/)
      assert.match(html, /href="\/cakes\/pave-chocolate-cake\?size=4in"/)
      assert.match(html, /basque-strawberry-popup.webp/)
      assert.match(html, /pave-strawberry-popup.webp/)
      assert.equal((html.match(/<dialog/g) || []).length, 1)
      assert.match(html, language === 'ko' ? /미니 홀케이크 출시!/ : /Mini Whole Cakes Are Here!/)
      assert.match(html, language === 'ko' ? /공지 닫기/ : /Dismiss announcement/)
      assert.match(html, /<dialog/); assert.match(html, language === 'ko' ? /오늘 하루 안 보기/ : /Don&#x27;t show again today/)
    }
    hiddenDays.set('au-mini-cake-launch-hidden-day', '2026-11-29')
    assert.equal(renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />), '')
    hiddenDays.clear()
    seenDays.set('au-mini-cake-launch-seen-v2', '2026-11-29')
    assert.equal(renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />), '')

    t.mock.timers.setTime(Date.parse('2026-11-30T00:00:00+11:00'))
    const stack = renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />)
    const dialogs = [...stack.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)].map(([markup]) => markup)
    assert.equal(dialogs.length, 2)
    assert.match(dialogs[0], /data-campaign="cakes"/)
    assert.match(dialogs[1], /data-campaign="almonds"/)
    const ids = [...stack.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    assert.equal(new Set(ids).size, ids.length)
    for (const dialog of dialogs) {
      for (const attribute of ['aria-labelledby', 'aria-describedby']) {
        const reference = dialog.match(new RegExp(`${attribute}="([^"]+)"`))?.[1]
        assert.ok(reference && dialog.includes(`id="${reference}"`))
      }
    }
    // A previously dismissed cake announcement cannot suppress the new campaign.
    hiddenDays.set('au-mini-cake-launch-hidden-day', '2026-11-30')
    seenDays.set('au-mini-cake-launch-seen-v2', '2026-11-30')
    for (const language of ['en', 'ko'] as const) {
      const html = renderToStaticMarkup(<MiniCakeLaunchNotice language={language} />)
      assert.match(html, /href="\/chocolates\/almond-chocoball\?offer=almond-triangle-gift-4x60g"/)
      const giftTitle = language === 'ko' ? '아몬드 초콜릿 4박스' : '4 Boxes of Almond Chocolates'
      const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1]
      assert.ok(titleId && html.includes(`<h2 id="${titleId}">${giftTitle}</h2>`))
      assert.match(html, language === 'ko' ? /블랙프라이데이 × 연말 얼리버드/ : /Black Friday × Holiday Early Bird/)
      assert.match(html, /<s>AUD 50<\/s>/)
      assert.match(html, /<strong>AUD 40<\/strong>/)
      assert.match(html, language === 'ko' ? /20% 할인/ : /20% off/)
      assert.match(html, language === 'ko' ? /12월 6일/ : /6 December/)
      assert.match(html, /gift-unboxing-480\.webp 480w, \/products\/almond\/gift-unboxing-960\.webp 960w/)
      assert.match(html, language === 'ko' ? /크림색 선물 상자의 뚜껑/ : /cream gift box lid/)
      assert.doesNotMatch(html, /strawberry-popup/)
    }
    hiddenDays.set('au-almond-gift-2026-hidden-day', '2026-11-30')
    assert.equal(renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />), '')
    hiddenDays.delete('au-mini-cake-launch-hidden-day')
    seenDays.delete('au-mini-cake-launch-seen-v2')
    const cakesOnly = renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />)
    assert.match(cakesOnly, /Mini Whole Cakes Are Here!/)
    assert.doesNotMatch(cakesOnly, /Black Friday/)
    t.mock.timers.setTime(Date.parse('2026-12-06T23:59:59+11:00'))
    assert.match(renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />), /Black Friday/)
    t.mock.timers.setTime(Date.parse('2026-12-07T00:00:00+11:00'))
    assert.match(renderToStaticMarkup(<MiniCakeLaunchNotice language="en" />), /Mini Whole Cakes Are Here!/)
  } finally {
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal)
    else Reflect.deleteProperty(globalThis, 'localStorage')
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

for (const language of ['en', 'ko'] as const) test(`home custom menus use collection categories and tier-specific destinations (${language})`, () => {
 const html=renderToStaticMarkup(<AuLanguageProvider language={language} setLanguage={()=>{}}><HomePage language={language} setLanguage={()=>{}} navigate={()=>{}} navigateToCake={()=>{}} cartItemCount={0}/></AuLanguageProvider>)
 const section=html.match(/<section[^>]*id="custom-cakes"[\s\S]*?<\/section>/)?.[0]
 assert.ok(section)
 assert.match(section,/class="[^"]*au-v02-collection[^"]*"/)
 assert.equal((section.match(/role="tab"/g)||[]).length,2)
 assert.match(section,language==='en'?/Private Classes/:/프라이빗 클래스/)
 assert.match(section,/href="\/cakes\/custom-cake\?tier=single"/)
 assert.match(section,/href="\/cakes\/custom-cake\?tier=double"/)
 assert.match(section,/href="\/custom-cakes"/)
 assert.match(section,/159\.00/)
 assert.match(section,/239\.00/)
 assert.doesNotMatch(html,/href="\/cakes\/custom-cake"/)
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])
 assert.equal(new Set(ids).size,ids.length,'collection tabs and panels have unique IDs')
})
