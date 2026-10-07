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
          import { getAuChocolatePreviews } from './src/lib/au-chocolate-preview';
          import { auChocolateAssets } from './src/lib/au-chocolate-assets';
          const props = { language: '${market === 'KR' ? 'ko' : 'en'}', navigate() {},
            navigateToCake() {}, setLanguage() {}, cartItemCount: 2, onComplete() {},
            onOpenCake() {}, onBack() {}, onBrowseCakes() {}, onAddToOrder() {}, onViewOrder() {} };
          const html = (component, extra = {}) => renderToStaticMarkup(React.createElement(component, {...props, ...extra}));
          console.log(JSON.stringify({
            productDetails: Object.fromEntries(['pave-chocolate-cake', 'signature-gateau-au-chocolat', 'chocolate-cupcakes', 'lemon-cake', 'bento-cake', 'fresh-strawberry-vanilla-cream-cake', 'brownie-cheesecake', 'smore-stick'].map(slug => [slug, html(CakeDetailPage, {slug})])),
            cakes: html(CakesPage), cake: html(CakeDetailPage, {slug: 'pave-chocolate-cake'}),
            smore: html(CakeDetailPage, {slug: 'smore-stick'}),
            cupcake: html(CakeDetailPage, {slug: 'chocolate-cupcakes'}), custom: html(CustomCakePage), home: html(HomePage),
            chocolates: html(AuCategoryPage, {category: 'chocolates'}),
            chocolate: html(AuChocolatePage, {slug: 'almond-chocoball'}),
            chocolateDetails: ['almond-chocoball', 'pave-chocolate', 'eiffel-tower-chocolate'].map(slug => html(AuChocolatePage, {slug})),
            chocolateProducts: getAuChocolatePreviews().map(product => ({...product, photography: auChocolateAssets[product.slug]})),
            chocolateSeo: ['/chocolates', '/chocolates/almond-chocoball', '/chocolates/pave-chocolate', '/chocolates/eiffel-tower-chocolate'].map(getSeoConfig),
            routes: ['/chocolates', '/chocolates/almond-chocoball', '/chocolates/pave-chocolate', '/chocolates/eiffel-tower-chocolate', '/chocolates/unknown'].map(getPageFromPath) }));
        `
        const relative = id.replace(`${resolve('.')}/`, '')
        if (original && ['src/CakesPage.tsx', 'src/CakeDetailPage.tsx', 'src/pages/CustomCakePage.tsx', 'src/pages/HomePage.tsx', 'src/lib/smore.ts', 'src/lib/smore-quantity.ts'].includes(relative)) {
          return execFileSync('git', ['show', `${baseline}:${relative}`], { encoding: 'utf8' })
        }
        if (/\.(png|jpg|webp|svg)$/.test(id)) return `export default ${JSON.stringify(relative)}`
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

test('AU Cakes excludes S’more while Chocolates includes its existing cake-detail route', async () => {
  const { cakes, chocolates, home } = await render('AU')
  assert.match(cakes, /au-redesign-category/)
  assert.equal((cakes.match(/data-au-product=/g) || []).length, 6)
  assert.doesNotMatch(cakes, /href="\/cakes\/bento-cake"/)
  assert.doesNotMatch(cakes, /data-au-product="smore-stick"/)
  assert.match(chocolates, /CHOCOLATES <span>\[4\]<\/span>/)
  assert.equal((chocolates.match(/data-au-product=/g) || []).length, 4)
  assert.match(chocolates, /data-au-product="smore-stick"[\s\S]*?href="\/cakes\/smore-stick"/)
  assert.doesNotMatch(chocolates, /href="\/chocolates\/smore-stick"/)
  assert.match(home, /data-au-product="smore-stick"[\s\S]*?href="\/cakes\/smore-stick"/)
  assert.doesNotMatch(home, /GATHER &amp; CELEBRATE/)
  assert.match(cakes, /href="\/chocolates"/)
})

test('all nine AU details use shared editorial presentation while retaining their actual purchase controls', async () => {
  const au = await render('AU')
  for (const [slug, html] of Object.entries(au.productDetails)) {
    assert.match(html, new RegExp(`data-au-product-detail="${slug}"`), slug)
    assert.equal((html.match(/<h1/g) || []).length, 1, slug)
    assert.match(html, /srcSet=|srcset=/, slug)
    assert.doesNotMatch(html, /VIDEO PLACEHOLDER|Valrhona|single-origin|California|Madagascar|Tahitian|insulated|complimentary/, slug)
    if (slug === 'bento-cake') {
      assert.match(html, /COMING SOON|Coming soon|Coming Soon/)
      assert.doesNotMatch(html, /ADD TO ORDER|Add to order|Add to Cart/)
    } else {
      assert.match(html, /ADD TO ORDER|Add to order|Add to Cart/)
      assert.match(html, /aria-label="Increase quantity"/)
      assert.match(html, /class="au-pave-sticky-order"/, `${slug}: mobile purchase access`)
    }
  }
  assert.match(au.chocolate, /data-au-product-detail="almond-chocoball"/)
  assert.match(au.chocolate, /class="au-pave-sticky-order"/)
  const cupcakeRelated = au.productDetails['chocolate-cupcakes'].split('class="au-pave-related-grid"')[1]
  assert.match(cupcakeRelated, /href="\/cakes\/lemon-cake"[\s\S]*href="\/cakes\/signature-gateau-au-chocolat"[\s\S]*href="\/cakes\/pave-chocolate-cake"/)
  for (const sku of ['80g', '6 PACK', 'BLACK TUB']) assert.ok(au.chocolate.includes(sku))
  assert.match(au.cupcake, /name="individualPackaging"/)
  assert.match(au.smore, /6–11 sticks: 10% off/)
  assert.match(au.smore, /12\+ sticks: 20% bulk discount/)
  const kr = await render('KR')
  for (const html of Object.values(kr.productDetails)) assert.doesNotMatch(html, /data-au-product-detail|au-product-detail/)
})

test('Brownie purchase uses one unified three-choice finish selector with current prices', async () => {
  const brownie = (await render('AU')).productDetails['brownie-cheesecake']
  const finish = brownie.match(/<fieldset class="cake-detail-fieldset is-brownie-finish">([\s\S]*?)<\/fieldset>/)?.[1]
  assert.ok(finish)
  assert.equal((finish.match(/<button\b/g) || []).length, 3)
  assert.match(finish, /<legend>1\. SELECT FINISH OPTION<\/legend>/)
  assert.doesNotMatch(brownie, /<legend>Fresh cream<\/legend>/)
  assert.match(finish, /Basic Finish[\s\S]*?Caramelized Top[\s\S]*?\$85\.00 AUD[\s\S]*?Vanilla Cream[\s\S]*?\+AUD 20\.00[\s\S]*?\$105\.00 AUD[\s\S]*?Pavé Chocolate[\s\S]*?\+AUD 10\.00[\s\S]*?\$95\.00 AUD/)
})

test('AU detail selects cake and party templates while retaining real option controls', async () => {
  const { cake, cupcake } = await render('AU')
  assert.match(cake, /data-au-template="pave"/)
  assert.match(cake, /PAIR WITH ARTISAN CHOCOLATES/)
  assert.match(cake, /ADD TO ORDER/)
  assert.equal((cake.match(/<h1/g) || []).length, 1)
  assert.match(cupcake, /data-au-template="party"/)
  assert.match(cupcake, /Pack Size/)
  assert.match(cupcake, /name="individualPackaging"/)
  assert.match(cupcake, /AUD 0\.50 per piece/)
  assert.match(cupcake, /PARTY, CELEBRATION/)
})

test('AU S’more breadcrumb points back to Chocolates while other Cake and KR routes stay unchanged', async () => {
  const au = await render('AU')
  const kr = await render('KR')
  assert.match(au.smore, /<nav class="cake-detail-breadcrumb"[^>]*><button[^>]*>.*?Back to chocolates<\/button><\/nav>/)
  assert.doesNotMatch(au.smore, /Back to cakes/)
  assert.match(au.cake, /<nav class="au-pave-breadcrumb"[^>]*>.*?aria-label="Back to cakes"/)
  assert.match(kr.smore, /class="cake-detail-not-found"/)
  assert.match(kr.cake, /class="cake-detail-not-found"/)
  assert.doesNotMatch(kr.smore, /Back to chocolates/)
})

test('Pavé presentation uses approved facts, current prices, matching imagery and real related routes', async () => {
  const { cake, cupcake, smore } = await render('AU')
  assert.match(cake, /57\.9% dark couverture chocolate/)
  for (const price of ['79.00', '109.00', '159.00', '12.00', '10.00', '20.00']) assert.ok(cake.includes(price), price)
  assert.doesNotMatch(cake, /70%|single-origin|Valrhona|VIDEO PLACEHOLDER|COMING SOON|insulated|complimentary|15cm|18cm|21cm/)
  const story = cake.slice(cake.indexOf('class="au-pave-story"'))
  const sections = [...story.matchAll(/<section class="(au-pave-[^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(sections, ['au-pave-hook', 'au-pave-inside', 'au-pave-texture', 'au-pave-video', 'au-pave-occasions', 'au-pave-packaging', 'au-pave-practical', 'au-pave-related'])
  const occasion = story.match(/<section class="au-pave-occasions"[\s\S]*?<\/section>/)[0]
  assert.deepEqual([...occasion.matchAll(/src="\/products\/pave-detail\/(.*?)-960.webp"/g)].map((match) => match[1]), ['party', 'occasion', 'birthday', 'gathering'])
  const video = story.match(/<section class="au-pave-video"[\s\S]*?<\/section>/)[0]
  assert.match(video, /angle-960.webp/)
  assert.match(video, /<video[^>]*src="\/products\/pave-detail\/cake-party-zoom.mp4"/)
  assert.doesNotMatch(video, /controls=|<button/)
  assert.match(video, /preload="none"/)
  assert.match(video, /muted=""/)
  assert.match(video, /loop=""/)
  assert.doesNotMatch(video, /autoPlay|autoplay/)
  assert.equal([...cake.matchAll(/class="au-pave-option-price"/g)].length, 6)
  const related = story.match(/<section class="au-pave-related"[\s\S]*?<\/section>/)[0]
  assert.deepEqual([...related.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/cakes/signature-gateau-au-chocolat', '/cakes/brownie-cheesecake', '/chocolates/almond-chocoball'])
  assert.match(related, /\/products\/chocolates\/almond-chocoball.webp/)
  assert.doesNotMatch(cupcake + smore, /pave-detail\/hero/)
  assert.match(cupcake + smore, /au-product-detail/)
  const css = postcss.parse(readFileSync('src/styles/au-pave-detail.css', 'utf8'))
  css.walkRules((rule) => { for (const selector of rule.selectors) assert.ok(selector.includes('.au-pave-detail'), selector) })
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

test('chocolate routes show approved sale units and real add-to-order controls', async () => {
  const { home, chocolates, chocolate, chocolateDetails, chocolateProducts } = await render('AU')
  assert.doesNotMatch(home, /80g · Preview|100g · Preview|6 pieces · Preview/)
  assert.equal((chocolates.match(/data-au-product=/g) || []).length, 4)
  assert.doesNotMatch(chocolates, /coming soon|preview/i)
  assert.match(chocolate, /80g/)
  assert.match(chocolate, /AUD 12\.00/)
  assert.match(chocolate, /Add to order/)
  assert.match(chocolate, /BLACK TUB/)
  const confirmed = [
    { slug: 'almond-chocoball', packLabel: '80g', price: 'AUD 12.00' },
    { slug: 'pave-chocolate', packLabel: '100g', price: 'AUD 12.00' },
    { slug: 'eiffel-tower-chocolate', packLabel: '6 pieces', price: 'AUD 10.00' },
  ]
  assert.deepEqual(chocolateProducts.map(({ slug, packLabel, price }) => ({ slug, packLabel, price })), confirmed)
  for (const detail of chocolateDetails) {
    const hero = detail.match(/<section class="(?:au-redesign-chocolate-hero|au-pave-hero)">([\s\S]*?)<\/section>/)[1]
    assert.match(hero, /Add to order/)
    assert.match(hero, /<legend>Quantity<\/legend>/)
    assert.match(hero, /aria-label="Increase quantity"/)
    assert.doesNotMatch(hero, /Coming Soon/)
  }
  for (const [index, { slug, packLabel, price }] of confirmed.entries()) {
    const card = chocolates.match(new RegExp(`<article[^>]*data-au-product="${slug}"[^>]*>([\\s\\S]*?)<\\/article>`))[1]
    assert.doesNotMatch(card, /Preview/)
    const hero = chocolateDetails[index].match(/<section class="(?:au-redesign-chocolate-hero|au-pave-hero)">([\s\S]*?)<\/section>/)[1]
    const related = chocolateDetails.find((detail, detailIndex) => detailIndex !== index && detail.includes(`data-au-product="${slug}"`))?.match(new RegExp(`<article[^>]*data-au-product="${slug}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]
    for (const markup of [card, hero, ...(related ? [related] : [])]) {
      assert.ok(markup.includes(packLabel), `${slug}: missing confirmed pack size`)
      assert.ok(markup.includes(price), `${slug}: missing confirmed price`)
      assert.doesNotMatch(markup, /PRICE TBD|6 pieces net weight/)
    }
  }
  const kr = await render('KR')
  assert.equal(kr.chocolates, '')
  assert.equal(kr.chocolate, '')
  assert.deepEqual(kr.chocolateDetails, ['', '', ''])
  assert.deepEqual(kr.chocolateProducts, [])
})

test('AU chocolate detail renders button variants and a bounded quantity stepper', async () => {
  const { chocolateDetails } = await render('AU')
  const almond = chocolateDetails[0]
  assert.doesNotMatch(almond, /<select\b/)
  const variants = almond.match(/<div class="cake-detail-options au-chocolate-variants">([\s\S]*?)<\/div>/)[1]
  assert.equal((variants.match(/aria-pressed="(?:true|false)"/g) || []).length, 3)
  assert.equal((variants.match(/aria-pressed="true"/g) || []).length, 1)
  for (const text of ['80g', '6 PACK', 'BLACK TUB', 'AUD 12.00', 'AUD 60.00', 'AUD 25.00']) {
    assert.ok(almond.includes(text), `Almond option missing ${text}`)
  }
  assert.doesNotMatch(almond, /Coupons do not apply to this six pack/)
  for (const detail of chocolateDetails) {
    assert.doesNotMatch(detail, /<select\b/)
    assert.match(detail, /aria-label="Decrease quantity"[^>]*disabled/)
    assert.match(detail, /aria-label="Increase quantity"/)
    assert.match(detail, /<output[^>]*>1<\/output>/)
  }
})

test('AU Home filters chocolates inline while standalone category navigation remains available', async () => {
  const { home, cakes, chocolates } = await render('AU')
  const homeRail = home.match(/<nav[^>]*aria-label="Collection categories"[^>]*>([\s\S]*?)<\/nav>/)[1]
  const homeHeader = home.match(/<nav[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/)[1]
  assert.match(homeRail, /<button[^>]*aria-pressed="false"[^>]*><span>CHOCOLATES<\/span><span[^>]*>\[4\]<\/span><\/button>/)
  assert.match(homeRail, /GÂTEAU SHARING<\/span><span[^>]*>\[3\]<\/span>/)
  assert.doesNotMatch(homeRail, /GATHER/)
  assert.doesNotMatch(homeRail, /href="\/chocolates"/)
  assert.match(homeRail, /ALL PRODUCTS<\/span><span[^>]*>\[12\]<\/span>/)
  assert.match(homeHeader, /href="\/chocolates">CHOCOLATES<\/a>/)
  for (const category of [cakes, chocolates]) {
    const rail = category.match(/<nav[^>]*aria-label="Product categories"[^>]*>([\s\S]*?)<\/nav>/)[1]
    assert.match(rail, /href="\/cakes"[^>]*>CAKES \[6\]<\/a>/)
    assert.match(rail, /href="\/chocolates"[^>]*>CHOCOLATES \[4\]<\/a>/)
  }
})

test('chocolate Home, list, detail and related cards share each product photography mapping', async () => {
  const { home, chocolates, chocolateDetails, chocolateProducts } = await render('AU')
  for (const [index, product] of chocolateProducts.entries()) {
    assert.equal(product.photography.src, `/products/chocolates/${product.slug}.webp`)
    const photo = readFileSync(`public${product.photography.src}`)
    assert.equal(photo.toString('ascii', 0, 4), 'RIFF')
    assert.equal(photo.toString('ascii', 8, 12), 'WEBP')
    assert.ok(product.photography.alt)
    assert.ok(product.photography.caption)
    assert.doesNotMatch(`${product.photography.alt} ${product.photography.caption}`, /coming soon|reference photo|may differ/i)
    assert.doesNotMatch(product.photography.src, /\/Users\/|https?:|pave-chocolate-cake|hero-cake/)
    const card = chocolates.match(new RegExp(`<article[^>]*data-au-product="${product.slug}"[^>]*>([\\s\\S]*?)<\\/article>`))[1]
    const homeCard = home.match(new RegExp(`<article[^>]*data-au-product="${product.slug}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]
    assert.ok(homeCard, `${product.slug}: missing Home collection card`)
    assert.ok(homeCard.includes(`href="/chocolates/${product.slug}"`))
    assert.ok(homeCard.includes(product.packLabel))
    assert.ok(homeCard.includes(product.price))
    assert.doesNotMatch(homeCard, /Preview/)
    for (const markup of [homeCard, card, ...(index === 0 ? [] : [chocolateDetails[index]])]) {
      assert.ok(markup.includes(`src="${product.photography.src}"`))
      assert.ok(markup.includes(`alt="${product.photography.alt}"`))
    }
    if (index === 0) assert.match(chocolateDetails[index], /src="\/products\/details\/almond\/hero-\d+.webp"/)
    else assert.ok(chocolateDetails[index].includes(product.photography.caption))
    const otherDetail = chocolateDetails.find((detail, detailIndex) => detailIndex !== index && detail.includes(`data-au-product="${product.slug}"`))
    if (otherDetail) {
      const related = otherDetail.match(new RegExp(`<article[^>]*data-au-product="${product.slug}"[^>]*>([\\s\\S]*?)<\\/article>`))[1]
      assert.ok(related.includes(`src="${product.photography.src}"`))
    }
  }
})

test('all Phase 1 CSS rules require an AU-only shell', () => {
  const css = postcss.parse(readFileSync('src/styles/au-phase1.css', 'utf8'))
  css.walkRules((rule) => {
    for (const selector of rule.selectors) assert.ok(/\.au-(?:redesign|home)-shell\b/.test(selector), `Unscoped: ${selector}`)
  })
})

test('chocolate previews have truthful AU metadata, not a 404 title or purchasable offer', async () => {
  for (const seo of (await render('AU')).chocolateSeo) {
    assert.match(seo.title, /chocolat/i)
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
