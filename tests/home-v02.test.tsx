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

test('home renders video before the single new headline, Best, stories, collection and separate custom entry', () => {
  const html = home()
  assert.match(html, /<h1[^>]*>CHOCOLATE, CAKES &amp; CELEBRATIONS\.<\/h1>/)
  const markers = [
    'rd-hero-photo-wrap',
    '<h1',
    'id="best"',
    'au-stories-home',
    'au-v02-craft',
    'id="au-collection"',
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
  assert.match(html, /href="\/#au-collection"[^>]*>EXPLORE THE MENU/)
  assert.match(html, /href="\/#business"[^>]*>BUSINESS ENQUIRIES/)
})

test('Whole Cakes defaults to four catalogue products; Custom and Coming Soon are not falsely orderable', () => {
  const html = home()
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>WHOLE CAKES/)
  assert.equal((html.match(/data-home-product=/g) || []).length, 4)
  for (const slug of [
    'pave-chocolate-cake',
    'signature-gateau-au-chocolat',
    'fresh-strawberry-vanilla-cream-cake',
    'brownie-cheesecake',
  ]) {
    assert.match(html, new RegExp(`href="/cakes/${slug}"`))
  }
  assert.doesNotMatch(html, /href="\/cakes\/bento-cake"/)
  assert.match(html, /href="\/cakes\/custom-cake"/)
})

test('shared AU header has the same four primary destinations and paused classes stay auxiliary', () => {
  const html = render(<AuRedesignHeader cartItemCount={2} />)
  const nav = html.match(
    /<nav[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/,
  )![1]
  assert.deepEqual(
    [...nav.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
    ['/#story', '/#au-collection', '/cakes/custom-cake', '/#business'],
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

test('Home-only membership preserves catalogue price, route, Coming Soon and Best order', () => {
  const collections = getAuHomeCollections('en')
  assert.deepEqual(
    collections.map((category) =>
      category.products.map((product) => product.id),
    ),
    [
      [
        'pave',
        'signature-gateau',
        'fresh-strawberry-vanilla-cream',
        'brownie-cheesecake',
      ],
      ['cupcake', 'fresh-lemon-cupcakes', 'bento-cake'],
      [
        'almond-chocoball',
        'pave-chocolate',
        'eiffel-tower-chocolate',
        'smore-stick',
      ],
    ],
  )
  const products = collections.flatMap((category) => category.products)
  assert.equal(new Set(products.map((product) => product.id)).size, 11)
  assert.equal(
    products.find((product) => product.id === 'bento-cake')?.href,
    null,
  )
  assert.equal(
    products.find((product) => product.id === 'smore-stick')?.href,
    '/cakes/smore-stick',
  )
  assert.deepEqual(
    getAuHomeBest('en').map((product) => product.id),
    ['signature-gateau', 'pave', 'brownie-cheesecake'],
  )
  for (const [id, amount] of [
    ['pave', '79'],
    ['signature-gateau', '45'],
    ['fresh-strawberry-vanilla-cream', '65'],
    ['brownie-cheesecake', '85'],
    ['almond-chocoball', '12'],
    ['smore-stick', '4.50'],
  ]) {
    assert.ok(
      products.find((product) => product.id === id)?.price.includes(amount),
      id,
    )
  }
})
