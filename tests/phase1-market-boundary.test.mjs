import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { rolldown } from 'rolldown'
import postcss from 'postcss'

const baseline = '398093eab6474e94200ab33121916780e7450b9b'
const cached = new Map()

function render(market, original = false) {
  const key = `${market}-${original}`
  if (!cached.has(key)) cached.set(key, renderPages(market, original))
  return cached.get(key)
}

async function renderPages(market, original) {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-market-'))
  const bundle = await rolldown({
    input: 'phase1-render-test', platform: 'node',
    transform: { jsx: { runtime: 'automatic' }, define: { 'import.meta.env': JSON.stringify({ VITE_MARKET: market }) } },
    plugins: [{
      name: 'phase1-render',
      resolveId(id) { if (id === 'phase1-render-test') return resolve('phase1-render-test.ts') },
      load(id) {
        if (id.endsWith('/phase1-render-test.ts')) return `
          import React from 'react';
          import { renderToStaticMarkup } from 'react-dom/server';
          import CakesPage from './src/CakesPage';
          import CakeDetailPage from './src/CakeDetailPage';
          import { CustomCakePage } from './src/pages/CustomCakePage';
          import { HomePage } from './src/pages/HomePage';
          import { AuCategoryPage } from './src/pages/AuCategoryPage';
          import { AuChocolatePage } from './src/pages/AuChocolatePage';
          import { getPageFromPath } from './src/lib/app-routes';
          import { getSeoConfig } from './src/lib/seo';
          const props = { language: '${market === 'KR' ? 'ko' : 'en'}', navigate() {},
            navigateToCake() {}, setLanguage() {}, cartItemCount: 2, onComplete() {},
            onOpenCake() {}, onBack() {}, onBrowseCakes() {}, onAddToOrder() {}, onViewOrder() {} };
          const html = (component, extra = {}) => renderToStaticMarkup(React.createElement(component, {...props, ...extra}));
          console.log(JSON.stringify({ cakes: html(CakesPage), cake: html(CakeDetailPage, {slug: 'pave-chocolate-cake'}),
            cupcake: html(CakeDetailPage, {slug: 'chocolate-cupcakes'}), custom: html(CustomCakePage), home: html(HomePage),
            chocolates: html(AuCategoryPage, {category: 'chocolates'}),
            chocolate: html(AuChocolatePage, {slug: 'almond-chocoball'}),
            chocolateSeo: ['/chocolates', '/chocolates/almond-chocoball'].map(getSeoConfig),
            routes: ['/chocolates', '/chocolates/almond-chocoball', '/chocolates/pave-chocolate', '/chocolates/eiffel-tower-chocolate', '/chocolates/unknown'].map(getPageFromPath) }));
        `
        const relative = id.replace(`${resolve('.')}/`, '')
        if (original && ['src/CakesPage.tsx', 'src/CakeDetailPage.tsx', 'src/pages/CustomCakePage.tsx', 'src/pages/HomePage.tsx'].includes(relative)) {
          return execFileSync('git', ['show', `${baseline}:${relative}`], { encoding: 'utf8' })
        }
        if (/\.(png|jpg|webp|svg)$/.test(id)) return 'export default "test-image"'
      },
    }],
  })
  try {
    const file = join(directory, 'render.mjs')
    await bundle.write({ file, format: 'esm', codeSplitting: false })
    return JSON.parse(execFileSync(process.execPath, [file], { encoding: 'utf8', env: { ...process.env, VITE_MARKET: market } }))
  } finally {
    await bundle.close()
    await rm(directory, { recursive: true, force: true })
  }
}

test('AU category exposes the editorial grid with only seven purchasable catalogue entries', async () => {
  const { cakes } = await render('AU')
  assert.match(cakes, /au-redesign-category/)
  assert.equal((cakes.match(/data-au-product=/g) || []).length, 7)
  assert.doesNotMatch(cakes, /href="\/cakes\/bento-cake"/)
  assert.match(cakes, /href="\/chocolates"/)
})

test('AU detail selects cake and party templates while retaining real option controls', async () => {
  const { cake, cupcake } = await render('AU')
  assert.match(cake, /data-au-template="cake"/)
  assert.match(cake, /CHOCOLATE EXTRAS/)
  assert.match(cake, /Add to Cart/)
  assert.equal((cake.match(/<h1/g) || []).length, 1)
  assert.match(cupcake, /data-au-template="party"/)
  assert.match(cupcake, /Pack Size/)
  assert.match(cupcake, /name="individualPackaging"/)
  assert.match(cupcake, /AUD 0\.50 per piece/)
  assert.match(cupcake, /PARTY, CELEBRATION/)
})

test('AU custom introduction explains original design without adding an unsupported upload or enabled submit', async () => {
  const { custom } = await render('AU')
  for (const heading of ['SEND 3 REFERENCES', 'TELL US THE OCCASION', 'WE DESIGN FOR YOU', 'RECEIVE YOUR QUOTE']) assert.ok(custom.includes(heading))
  assert.match(custom, /not reproduce/)
  assert.match(custom, /id="custom-cake-request-form"/)
  assert.match(custom, /type="submit"[^>]*disabled/)
  assert.doesNotMatch(custom, /type="file"/)
})

test('unavailable Home services cannot navigate to a fake inquiry or order', async () => {
  const { home } = await render('AU')
  const services = [...home.matchAll(/<article[^>]*data-au-coming-soon="service"[^>]*>([\s\S]*?)<\/article>/g)]
  assert.equal(services.length, 2)
  for (const [, service] of services) {
    assert.match(service, /Coming Soon/)
    assert.doesNotMatch(service, /<a|<button|INQUIRE/)
  }
})

test('AU Home has a public heading, a reachable collection anchor and keyboard-operable best products', async () => {
  const { home } = await render('AU')
  assert.equal((home.match(/<h1\b/g) || []).length, 1)
  assert.doesNotMatch(home, /COPY TBD/)
  assert.match(home, /id="au-collection"/)
  for (const className of ['rd-best-photo-frame', 'rd-best-action-row']) {
    const links = [...home.matchAll(new RegExp(`<a[^>]*class="${className}"[^>]*href="(/cakes/[^\"]+)"`, 'g'))]
    assert.equal(links.length, 3)
  }
})

test('chocolate preview routes exist only in AU and unknown products fail closed', async () => {
  assert.deepEqual((await render('AU')).routes, ['chocolates', 'chocolate-detail', 'chocolate-detail', 'chocolate-detail', 'not-found'])
  assert.deepEqual((await render('KR')).routes, Array(5).fill('not-found'))
})

test('chocolate previews show only confirmed weight/price and never offer quantity or Add to Cart', async () => {
  const { chocolates, chocolate } = await render('AU')
  assert.equal((chocolates.match(/data-au-product=/g) || []).length, 3)
  assert.match(chocolate, /80g net weight/)
  assert.match(chocolate, /AUD 12\.00/)
  assert.match(chocolate, /Coming Soon/)
  assert.doesNotMatch(chocolate, /Add to Cart|Increase quantity|5\+1|black tub/i)
  const kr = await render('KR')
  assert.equal(kr.chocolates, '')
  assert.equal(kr.chocolate, '')
})

test('all Phase 1 CSS rules require an AU-only shell', () => {
  const css = postcss.parse(readFileSync('src/styles/au-phase1.css', 'utf8'))
  css.walkRules((rule) => {
    for (const selector of rule.selectors) assert.ok(/\.au-(?:redesign|home)-shell\b/.test(selector), `Unscoped: ${selector}`)
  })
})

test('chocolate previews have truthful AU metadata, not a 404 title or purchasable offer', async () => {
  for (const seo of (await render('AU')).chocolateSeo) {
    assert.match(seo.title, /Coming Soon/)
    assert.equal(seo.noindex, true)
    assert.doesNotMatch(JSON.stringify(seo), /"offers"|InStock/)
  }
  for (const seo of (await render('KR')).chocolateSeo) assert.match(seo.title, /Not Found/)
})

test('KR Home, category, cake, cupcake and custom render byte-for-byte like the checkpoint', async () => {
  const current = await render('KR')
  const previous = await render('KR', true)
  for (const key of ['home', 'cakes', 'cake', 'cupcake', 'custom']) {
    assert.equal(current[key], previous[key], `KR ${key} changed`)
    assert.doesNotMatch(current[key], /au-redesign-|data-au-template/)
  }
})
