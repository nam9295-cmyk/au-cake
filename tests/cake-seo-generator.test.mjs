import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const generatorPath = fileURLToPath(new URL('../scripts/generate-seo-pages.mjs', import.meta.url))
const llmsPath = fileURLToPath(new URL('../public/llms.txt', import.meta.url))
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
    <link rel="canonical" href="https://au.verygood-chocolate.com/" />
    <meta property="og:title" content="Template" />
    <meta property="og:description" content="Template description" />
    <meta property="og:url" content="https://au.verygood-chocolate.com/" />
    <meta name="twitter:title" content="Template" />
    <meta name="twitter:description" content="Template description" />
  </head>
  <body><div id="root"></div></body>
</html>`

test('SEO generator writes the cake catalogue and every canonical cake detail page', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'au-cake-seo-generator-'))
  const dist = join(workdir, 'dist')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), template)
  const sitemap = '<?xml version="1.0"?><urlset><url><loc>https://au.verygood-chocolate.com/</loc></url></urlset>'
  await writeFile(join(dist, 'sitemap.xml'), sitemap)

  const result = spawnSync(process.execPath, [generatorPath], {
    cwd: workdir,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const catalogue = await readFile(join(dist, 'cakes.html'), 'utf8')
  assert.match(catalogue, /<link rel="canonical" href="https:\/\/au\.verygood-chocolate\.com\/cakes"/)
  assert.match(catalogue, /<h1>Choose Your Cake<\/h1>/)

  const cart = await readFile(join(dist, 'cart.html'), 'utf8')
  assert.match(cart, /<title>Your Cart \| Verygood Chocolate<\/title>/)
  assert.match(cart, /<meta name="robots" content="noindex, nofollow"/)
  const generatedSitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  assert.notEqual(generatedSitemap, sitemap)
  for (const path of ['/', '/cakes', ...cakeSlugs.map((slug) => `/cakes/${slug}`), '/classes', '/reviews']) {
    const loc = path === '/' ? 'https://au.verygood-chocolate.com/' : `https://au.verygood-chocolate.com${path}`
    assert.match(generatedSitemap, new RegExp(`<loc>${loc.replaceAll('.', '\\.')}<\\/loc>`), path)
  }
  for (const privatePath of ['/cart', '/reserve', '/lookup', '/admin']) {
    assert.doesNotMatch(generatedSitemap, new RegExp(`<loc>[^<]*${privatePath}`), privatePath)
  }

  for (const slug of cakeSlugs) {
    const detail = await readFile(join(dist, 'cakes', `${slug}.html`), 'utf8')
    assert.match(detail, new RegExp(`canonical" href="https://au\\.verygood-chocolate\\.com/cakes/${slug}"`))
    assert.match(detail, /<main class="seo-fallback">/)
    assert.match(detail, /<meta property="og:type" content="product"/)
    assert.match(detail, /<script type="application\/ld\+json" data-vg-structured-data="static">/)
    assert.match(detail, /"@type":"Product"/)
    assert.match(detail, /"@type":"BreadcrumbList"/)
  }

  const lemon = await readFile(join(dist, 'cakes', 'lemon-cake.html'), 'utf8')
  assert.match(lemon, /products\/lemon-cake\.jpg/)
  assert.match(lemon, /<meta property="og:image:type" content="image\/jpeg"/)
  assert.match(lemon, /<meta property="og:image:width" content="1200"/)
  assert.match(lemon, /<meta property="og:image:height" content="630"/)
  assert.match(lemon, /Boxes of 6, 8, 12 or 16/)
  const lemonProductJson = lemon.match(/<script type="application\/ld\+json" data-vg-structured-data="static">([^<]*"@type":"Product"[^<]*)<\/script>/)?.[1]
  assert.ok(lemonProductJson)
  const lemonProduct = JSON.parse(lemonProductJson)
  assert.equal(lemonProduct.offers.lowPrice, 36)
  assert.equal(lemonProduct.offers.highPrice, 93)
  assert.equal(Object.hasOwn(lemonProduct.offers, 'availability'), false)

  const vanilla = await readFile(join(dist, 'cakes', 'vanilla-fresh-cream-cake.html'), 'utf8')
  const vanillaProductJson = vanilla.match(/<script type="application\/ld\+json" data-vg-structured-data="static">([^<]*"@type":"Product"[^<]*)<\/script>/)?.[1]
  assert.ok(vanillaProductJson)
  assert.equal(Object.hasOwn(JSON.parse(vanillaProductJson), 'image'), false)
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
