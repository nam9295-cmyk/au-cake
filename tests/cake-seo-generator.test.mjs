import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import auPublicPages from '../src/content/au-public-pages.json' with { type: 'json' }
import { renderAuLlms } from '../scripts/render-au-llms.mjs'

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  assert.match(
    home,
    new RegExp('<title>' + escapeRegExp(auPublicPages.home.title) + '</title>'),
  )
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
    const page = auPublicPages.cakePages[slug]
    assert.ok(product, slug)
    assert.match(html, new RegExp('<title>' + escapeRegExp(page.title) + '</title>'))
    assert.equal(product?.description, page.description)
    assert.match(html, new RegExp(escapeRegExp(page.description)))
    assert.match(html, new RegExp('<meta property="og:image:type" content="' + page.imageType + '"'))
    assert.match(html, new RegExp('<meta property="og:image:width" content="' + page.imageWidth + '"'))
    assert.match(html, new RegExp('<meta property="og:image:height" content="' + page.imageHeight + '"'))
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

test('all indexable artifacts keep canonical brand, schema, canonical URLs, and English-only indexing', async () => {
  const { dist } = await generate()
  const paths = ['/', '/cakes', ...cakeSlugs.map((slug) => `/cakes/${slug}`), '/classes', '/reviews']

  for (const path of paths) {
    const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`
    const html = await readFile(join(dist, file), 'utf8')
    const canonical = path === '/' ? site : site + path
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)" \/>/g)]
    assert.equal(canonicals.length, 1, path)
    assert.equal(canonicals[0][1], canonical, path)
    assert.doesNotMatch(html, /Very Good Chocolate|Verygood Chocolate/, path)
    assert.doesNotMatch(html, /hreflang=/i, path)

    const data = jsonLd(html)
    for (const entity of data) {
      const serialized = JSON.stringify(entity)
      assert.notEqual(entity['@type'], 'LocalBusiness', path)
      assert.doesNotMatch(serialized, /PostalAddress|streetAddress|aggregateRating|"review"\s*:/, path)
    }
  }

  const classes = await readFile(join(dist, 'classes.html'), 'utf8')
  const course = jsonLd(classes).find((entry) => entry['@type'] === 'Course')
  assert.ok(course)
  assert.equal(course.offers.lowPrice, 99)
  assert.equal(course.offers.highPrice, 254.6)
  assert.match(classes, new RegExp(escapeRegExp(auPublicPages.classes.extensionSummary)))

  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  assert.doesNotMatch(sitemap, /\/ko(?:\/|<)/)

  const runtimeSeo = await readFile(new URL('../src/lib/seo.ts', import.meta.url), 'utf8')
  assert.match(runtimeSeo, /setMeta\('meta\[property="og:image"\]', 'content', image\)/)
  assert.match(runtimeSeo, /setMeta\('meta\[property="og:image:type"\]', 'content', imageType\)/)
  assert.match(runtimeSeo, /setMeta\('meta\[property="og:image:width"\]', 'content', String\(imageWidth\)\)/)
  assert.match(runtimeSeo, /setMeta\('meta\[property="og:image:height"\]', 'content', String\(imageHeight\)\)/)
})

test('normal operational routes are generated noindex pages while unknown guides are not generated', async () => {
  const { dist } = await generate()
  for (const path of [
    'cart',
    'reserve',
    'complete',
    'lookup',
    'class-reserve',
    'class-complete',
    'calendar',
    'review',
    'admin',
    'admin/login',
    'admin/reservations',
    'admin/classes',
    'admin/reviews',
  ]) {
    const html = await readFile(join(dist, `${path}.html`), 'utf8')
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/)
    assert.match(html, /verygood chocolate/)
    assert.doesNotMatch(html, /Very Good Chocolate|Verygood Chocolate/)
  }
  await assert.rejects(stat(join(dist, 'guides.html')))
  await assert.rejects(stat(join(dist, 'guides', 'chocolate-cake-size-guide-sydney.html')))
})

test('llms text exposes only grounded public catalogue and ordering facts', async () => {
  const { dist } = await generate()
  const llms = await readFile(join(dist, 'llms.txt'), 'utf8')
  const checkedInLlms = await readFile(llmsPath, 'utf8')
  assert.equal(checkedInLlms, renderAuLlms(auPublicPages))
  assert.equal(llms, renderAuLlms(auPublicPages))
  assert.equal(llms, checkedInLlms)
  assert.match(llms, /^# verygood chocolate Sydney/m)
  assert.match(llms, /Choose a size · dark chocolate only/)
  assert.doesNotMatch(llms, /dark or milk|milk chocolate/i)
  assert.match(llms, /Made with a chocolate cake sheet and vanilla fresh cream/)
  assert.match(llms, /Triple berry or Nutella chocolate chip/)
  assert.doesNotMatch(llms, /vanilla or chocolate cake sheet|photo is coming soon/i)
  assert.match(llms, /AUD 99–254\.60/)
  assert.match(llms, /AUD 20 per participant, per class/)
  assert.doesNotMatch(llms, /\/admin|customer name|mobile number/i)
})
