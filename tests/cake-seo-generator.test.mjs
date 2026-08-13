import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const generatorPath = fileURLToPath(new URL('../scripts/generate-seo-pages.mjs', import.meta.url))
const llmsPath = fileURLToPath(new URL('../public/llms.txt', import.meta.url))
const site = 'https://au.verygood-chocolate.com'
const cakeSlugs = [
  'chocolate-pound-cake-and-cupcakes',
  'pave-chocolate-cake',
  'chocolatiers-basque-cheesecake',
  'lemon-cake',
  'vanilla-fresh-cream-cake',
]

const template = `<!doctype html>
<html lang="en-AU">
  <head>
    <title>Template</title>
    <meta name="description" content="Template description" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${site}/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Template" />
    <meta property="og:description" content="Template description" />
    <meta property="og:url" content="${site}/" />
    <meta property="og:image" content="${site}/og-image.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:title" content="Template" />
    <meta name="twitter:description" content="Template description" />
    <meta name="twitter:image" content="${site}/og-image.jpg" />
  </head>
  <body><div id="root"></div></body>
</html>`

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json" data-vg-structured-data="static">([^<]+)<\/script>/g)]
    .map((match) => JSON.parse(match[1]))
}

async function generate() {
  const workdir = await mkdtemp(join(tmpdir(), 'au-cake-seo-generator-'))
  const dist = join(workdir, 'dist')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), template)
  const result = spawnSync(process.execPath, [generatorPath], { cwd: workdir, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return { workdir, dist }
}

test('SEO generator writes shared homepage content, cake pages, and AU sitemap', async () => {
  const { dist } = await generate()
  const home = await readFile(join(dist, 'index.html'), 'utf8')
  assert.match(home, /<title>Chocolate Cakes Sydney \| Melrose Park Pickup \| Very Good<\/title>/)
  assert.match(home, /<h1>Made-to-Order Chocolate Cakes in Sydney<\/h1>/)
  assert.match(home, /Pave cake, chocolate Basque cheesecake, pound cake and cupcakes from AUD 45/)
  assert.match(home, /Chocolate Pound Cake &amp; Cupcakes/)
  assert.match(home, /Chocolate Pound Cake AUD 45; Chocolate Cupcakes \(1 dozen\) AUD 55\./)
  assert.match(home, /id="how-ordering-works"/)
  assert.doesNotMatch(home, /\.seo-fallback\s*\{\s*display:\s*none/)

  const catalogue = await readFile(join(dist, 'cakes.html'), 'utf8')
  assert.match(catalogue, /<link rel="canonical" href="https:\/\/au\.verygood-chocolate\.com\/cakes"/)
  assert.match(catalogue, /<h1>Choose Your Cake<\/h1>/)

  const generatedSitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  for (const path of ['/', '/cakes', ...cakeSlugs.map((slug) => `/cakes/${slug}`), '/classes', '/reviews']) {
    assert.match(generatedSitemap, new RegExp(`<loc>${(path === '/' ? site : `${site}${path}`).replaceAll('.', '\\.')}</loc>`), path)
  }
  for (const excluded of ['/cart', '/reserve', '/lookup', '/admin', '/guides']) {
    assert.doesNotMatch(generatedSitemap, new RegExp(`<loc>[^<]*${excluded}`), excluded)
  }
})

test('cake generator uses the final per-page schema contract and real product WebPs', async () => {
  const { dist } = await generate()
  const expectations = new Map([
    ['pave-chocolate-cake', { type: 'Product', price: 75, og: 'product', image: 'pave-chocolate-cake-sydney.webp' }],
    ['chocolatiers-basque-cheesecake', { type: 'Product', price: 55, og: 'product', image: 'chocolatiers-basque-cheesecake-sydney.webp' }],
    ['lemon-cake', { type: 'Product', price: 36, og: 'product', image: 'lemon-cake-sydney.webp' }],
    ['vanilla-fresh-cream-cake', { type: 'Product', price: 75, og: 'product', image: 'vanilla-cake-sydney.webp' }],
  ])

  for (const [slug, expected] of expectations) {
    const html = await readFile(join(dist, 'cakes', `${slug}.html`), 'utf8')
    const data = jsonLd(html)
    const product = data.find((entry) => entry['@type'] === 'Product')
    assert.ok(product, slug)
    assert.equal(product.offers['@type'], 'Offer', slug)
    assert.equal(product.offers.price, expected.price, slug)
    assert.equal(data.some((entry) => entry['@type'] === 'AggregateOffer' || entry['@type'] === 'ProductGroup'), false, slug)
    assert.match(html, new RegExp(`<meta property="og:type" content="${expected.og}"`), slug)
    if (expected.image) assert.match(html, new RegExp(`/products/${expected.image}`), slug)
    else assert.equal(Object.hasOwn(product, 'image'), false, slug)
  }

  const combined = await readFile(join(dist, 'cakes', 'chocolate-pound-cake-and-cupcakes.html'), 'utf8')
  assert.deepEqual(jsonLd(combined).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(combined, /Chocolate Pound Cake AUD 45; Chocolate Cupcakes \(1 dozen\) AUD 55\./)
  assert.match(combined, /products\/chocolate-pound-cake-sydney\.webp/)
  assert.match(combined, /<meta property="og:type" content="website"/)

  const paveHtml = await readFile(join(dist, 'cakes', 'pave-chocolate-cake.html'), 'utf8')
  const vanillaHtml = await readFile(join(dist, 'cakes', 'vanilla-fresh-cream-cake.html'), 'utf8')
  assert.match(paveHtml, /Choose a size · dark chocolate only/)
  assert.doesNotMatch(paveHtml, /milk chocolate/i)
  assert.match(vanillaHtml, /chocolate cake sheet/)
  assert.match(vanillaHtml, /products\/vanilla-cake-sydney\.webp/)
})

test('normal operational routes are generated noindex pages while unknown guides are not generated', async () => {
  const { dist } = await generate()
  for (const path of ['cart', 'reserve', 'complete', 'lookup', 'admin', 'admin/login', 'admin/reservations']) {
    const html = await readFile(join(dist, `${path}.html`), 'utf8')
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/)
  }
  await assert.rejects(stat(join(dist, 'guides.html')))
  await assert.rejects(stat(join(dist, 'guides', 'chocolate-cake-size-guide-sydney.html')))
})

test('llms text exposes only grounded public catalogue and ordering facts', async () => {
  const llms = await readFile(llmsPath, 'utf8')
  assert.match(llms, /^# Very Good Chocolate Sydney/m)
  assert.match(llms, /Melrose Park/)
  assert.match(llms, /Lemon Cake: 6 pieces AUD 36; 8 pieces AUD 45; 12 pieces AUD 65; 16 pieces AUD 85\./)
  assert.match(llms, /Submitting a request does not confirm an order/)
  assert.match(llms, /https:\/\/au\.verygood-chocolate\.com\/cakes\/lemon-cake/)
  assert.doesNotMatch(llms, /\/admin|customer name|mobile number/i)
})
