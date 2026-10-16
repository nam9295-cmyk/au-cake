import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import auPublicPages from '../src/content/au-public-pages.json' with { type: 'json' }
import serviceRoutes from '../src/content/au-service-routes.json' with { type: 'json' }
import { renderRenewalLlms } from '../appwrite-functions/reservation-api/src/au-renewal-seo.js'

const generatorPath = fileURLToPath(new URL('../scripts/generate-seo-pages.mjs', import.meta.url))
const llmsPath = fileURLToPath(new URL('../public/llms.txt', import.meta.url))
const robotsPath = fileURLToPath(new URL('../public/robots.txt', import.meta.url))
const manifestPath = fileURLToPath(new URL('../public/site.webmanifest', import.meta.url))
const indexPath = fileURLToPath(new URL('../index.html', import.meta.url))
const site = 'https://au.verygood-chocolate.com'
const cakeSlugs = Object.keys(auPublicPages.cakePages)

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
    <script type="module" crossorigin src="/assets/app.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/app.css" />
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

test('SEO generator writes renewal categories, details and current sitemap',async()=>{
 const {dist}=await generate()
 const sitemap=await readFile(join(dist,'sitemap.xml'),'utf8')
 for(const path of ['cakes','chocolates','celebrate','custom-cakes','business','cakes/levain-cookies','cakes/brownie-cupcakes','chocolates/chocolate-mochi']) {
  const html=await readFile(join(dist,path+'.html'),'utf8');assert.equal((html.match(/<h1/g)||[]).length,1);assert.ok(sitemap.includes(site+'/'+path))
 }
 assert.doesNotMatch(sitemap, /cakes\/lemon-cake|cakes\/fresh-strawberry-vanilla-cream-cake/)
})

test('Custom Cake has a standalone directory entry with app assets for direct loads and refreshes', async () => {
  const { dist } = await generate()
  const entry = join(dist, 'cakes/custom-cake/index.html')
  assert.ok((await stat(entry).catch(() => null))?.isFile(), 'Custom Cake direct-load artifact must exist')
  const html = await readFile(entry, 'utf8')
  assert.match(html, /<title>Custom Cake Sydney \| Bespoke Celebration Cakes \| verygood chocolate<\/title>/)
  assert.match(html, /<meta name="robots" content="index, follow"/)
  assert.match(html, /<link rel="canonical" href="https:\/\/au\.verygood-chocolate\.com\/cakes\/custom-cake"/)
  assert.match(html, /<h1>Custom Cake Sydney<\/h1>/)
  assert.match(html, /Bespoke cakes made to order/)
  assert.match(html, /From AUD \$159/)
  assert.match(html, /Pre-arranged pickup in Melrose Park/)
  assert.match(html, /<div id="root">/)
  assert.match(html, /<script type="module" crossorigin src="\/assets\/app.js"><\/script>/)
  assert.match(html, /<link rel="stylesheet" crossorigin href="\/assets\/app.css" \/>/)
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  assert.equal(sitemap.split('<loc>https://au.verygood-chocolate.com/cakes/custom-cake</loc>').length - 1, 1)
  const catalogue = await readFile(join(dist, 'cakes.html'), 'utf8')
  assert.doesNotMatch(catalogue, /\/cakes\/custom-cake/)
  assert.equal(jsonLd(html).some(item => item['@type'] === 'Product'), false)
  await assert.rejects(stat(join(dist, 'cakes/not-a-real-cake/index.html')), { code: 'ENOENT' })
  await assert.rejects(stat(join(dist, 'cakes/not-a-real-cake.html')), { code: 'ENOENT' })
})

test('public crawl metadata permits search while reserving AI training and private flows retain crawlable noindex policy', async () => {
  const [robots, manifest, index] = await Promise.all([
    readFile(robotsPath, 'utf8'),
    readFile(manifestPath, 'utf8').catch(() => '{}').then(JSON.parse),
    readFile(indexPath, 'utf8'),
  ])

  assert.deepEqual(manifest, {
    name: 'verygood chocolate',
    short_name: 'verygood chocolate',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0eee9',
    theme_color: '#1f5a46',
    icons: [{ src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  })
  assert.match(index, /<link rel="apple-touch-icon" href="\/favicon\.png" \/>/)
  assert.match(index, /<link rel="manifest" href="\/site\.webmanifest" \/>/)
  assert.match(index, /<meta name="theme-color" content="#1f5a46" \/>/)
  assert.match(index, /<meta property="og:site_name" content="verygood chocolate" \/>/)
  assert.match(robots, /^Content-Signal: search=yes, ai-train=no, use=reference$/m)
  assert.doesNotMatch(robots, /ai-input=yes/)

  for (const crawler of ['Googlebot', 'Bingbot', 'OAI-SearchBot']) {
    const group = robots.split(/\n\s*\n/).find((entry) => entry.includes(`User-agent: ${crawler}`))
    assert.ok(group, `${crawler} needs an explicit robots group`)
    assert.match(group, /^Allow: \/$/m)
    assert.doesNotMatch(group, /^Disallow:/m, `${crawler} must be able to read noindex on private paths`)
  }
  for (const crawler of [
    'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
    'Applebot-Extended', 'Google-Extended',
  ]) assert.doesNotMatch(robots, new RegExp(`^User-agent: ${crawler}$`, 'm'))
  assert.match(robots, new RegExp(`Sitemap: ${escapeRegExp(site)}/sitemap\\.xml`))
})

test('generated public HTML exposes verified organization without invisible homepage FAQs, and one semantic top-level heading per indexable page', async () => {
  const { dist } = await generate()
  const home = await readFile(join(dist, 'index.html'), 'utf8')
  const homeData = jsonLd(home)
  const organization = homeData.find((entry) => entry['@type'] === 'Organization')
  const faq = homeData.find((entry) => entry['@type'] === 'FAQPage')
  assert.deepEqual(organization?.sameAs, ['https://www.instagram.com/verygood_syd/'])
  assert.equal(faq, undefined)
  assert.deepEqual(homeData.map(entry => entry['@type']), ['Organization', 'WebSite', 'ItemList'])

  for (const path of ['/', '/cakes', ...cakeSlugs.map((slug) => `/cakes/${slug}`), '/classes', '/reviews']) {
    const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`
    const html = await readFile(join(dist, file), 'utf8')
    assert.equal([...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length, 1, path)
    assert.equal([...html.matchAll(/<link rel="canonical" href="[^"]+" \/>/g)].length, 1, path)
  }
})

test('renewal static metadata avoids old prices and preserves compatibility routes', async () => {
 const {dist}=await generate()
 for(const path of ['cakes/pave-chocolate-cake','cakes/brownie-cheesecake','cakes/smore-stick','chocolates/chocolate-mochi']) {
  const html=await readFile(join(dist,path+'.html'),'utf8');assert.doesNotMatch(html, /InStock|"price":(?:79|85|4.5)/)
 }
  const combined = await readFile(join(dist, 'cakes', 'chocolate-pound-cake-and-cupcakes.html'), 'utf8')
  assert.deepEqual(jsonLd(combined).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(combined, /This collection has been separated into two cakes\./)
  assert.match(combined, /href="\/cakes\/signature-gateau-au-chocolat"/)
  assert.match(combined, /href="\/cakes\/chocolate-cupcakes"/)
  assert.match(combined, /products\/chocolate-pound-cake-sydney\.webp/)
  assert.match(combined, /<meta property="og:type" content="website"/)
  assert.match(combined, /<meta name="robots" content="noindex, nofollow"/)

  const basque = await readFile(join(dist, 'cakes', 'chocolatiers-basque-cheesecake.html'), 'utf8')
  assert.deepEqual(jsonLd(basque).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(basque, /<meta name="robots" content="noindex, nofollow"/)
  assert.match(basque, /href="\/cakes">View current cakes<\/a>/)

  const buttercreamHtml = await readFile(join(dist, 'cakes', 'buttercream-cake.html'), 'utf8')
  assert.deepEqual(jsonLd(buttercreamHtml).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(buttercreamHtml, /<meta name="robots" content="noindex, nofollow"/)

  const strawberryChocHtml = await readFile(join(dist, 'cakes', 'fresh-strawberry-chocolate-cream-cake.html'), 'utf8')
  assert.deepEqual(jsonLd(strawberryChocHtml).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(strawberryChocHtml, /<meta name="robots" content="noindex, nofollow"/)

  const paveHtml = await readFile(join(dist, 'cakes', 'pave-chocolate-cake.html'), 'utf8')
  const vanillaHtml = await readFile(join(dist, 'cakes', 'vanilla-fresh-cream-cake.html'), 'utf8')
  assert.match(paveHtml, /Pavé Whole Cake/)
  assert.match(paveHtml, /milk chocolate/i)
  assert.deepEqual(jsonLd(vanillaHtml).map((entry) => entry['@type']), ['WebPage', 'BreadcrumbList'])
  assert.match(vanillaHtml, /<meta name="robots" content="noindex, nofollow"/)
  assert.doesNotMatch(vanillaHtml, /"@type":"Offer"/)
  assert.doesNotMatch(vanillaHtml, /Choose a size|AUD \d+\.\d{2}|Request/i)
  assert.match(vanillaHtml, /href="\/cakes">View current cakes<\/a>/)
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
    assert.match(html, /<meta property="og:site_name" content="verygood chocolate" \/>/, path)
    assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/, path)
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
  assert.equal(jsonLd(classes).some(entry => entry['@type'] === 'Course'), false)
  assert.match(classes, /Archive/)
  assert.doesNotMatch(classes, /AggregateOffer|10:00, 13:00 and 16:00/)

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

test('llms text exposes current public menu, confirmed prices and archived classes', async () => {
 const {dist}=await generate()
 const llms=await readFile(join(dist,'llms.txt'),'utf8')
 assert.equal(llms,renderRenewalLlms(site));assert.equal(llms,await readFile(llmsPath,'utf8'))
 assert.match(llms,/Cake & Bake/);assert.match(llms,/Chocolate Mochi/);assert.match(llms,/Brownie Basque/)
 assert.match(llms,/75.00/);assert.match(llms,/82.00/);assert.match(llms,/Class archive/)
 assert.doesNotMatch(llms,/79.00|85.00|115.00|155.00|lemon-cake|18:00/)
 assert.match(llms,/Official Instagram:/);assert.doesNotMatch(llms,/\/admin|customer name|mobile number/i)
})

test('SEO-01/04: static retired/private/public robots are explicit and retired pages keep their routes',async()=>{
 const {dist}=await generate()
 for(const [path,robots] of [['cakes/lemon-cake','noindex, nofollow'],['cakes/fresh-strawberry-vanilla-cream-cake','noindex, nofollow'],['cart','noindex, nofollow'],['chocolates/chocolate-mochi','index, follow']]){
  const html=await readFile(join(dist,path+'.html'),'utf8');assert.ok(html.includes(`name="robots" content="${robots}"`),path)
  assert.doesNotMatch(html, /content="(?:undefined|null|)"/)
 }
})
test('SEO-07: classes initial document is an archive, without active Course offers',async()=>{
 const {dist}=await generate();const html=await readFile(join(dist,'classes.html'),'utf8')
 assert.match(html,/archive/i);assert.doesNotMatch(JSON.stringify(jsonLd(html)),/AggregateOffer|"offers"/)
 assert.match(html,/next.*(?:unconfirmed|announced|confirmed)/i)
 assert.match(html,/Basic.*1.*Advanced.*2/s)
})


test('SEO-01/04 all emitted documents have valid robots; sitemap contains only indexable canonicals',async()=>{
 const {dist}=await generate()
 for(const file of await readdir(dist,{recursive:true})){
  if(!file.endsWith('.html'))continue
  const html=await readFile(join(dist,file),'utf8')
  assert.match(html, /name="robots" content="(?:index, follow|noindex, nofollow)"/,file)
  assert.doesNotMatch(html, /name="robots" content="(?:undefined|null|)"/,file)
 }
 const sitemap=await readFile(join(dist,'sitemap.xml'),'utf8')
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1])
 assert.equal(new Set(urls).size,urls.length)
 for(const url of urls){
  const pathname=new URL(url).pathname
  const html=await readFile(join(dist,pathname==='/'?'index.html':pathname.slice(1)+'.html'),'utf8').catch(()=>readFile(join(dist,pathname.slice(1),'index.html'),'utf8'))
  assert.ok(html.includes('name="robots" content="index, follow"'),url)
  assert.ok(html.includes(`rel="canonical" href="${url}"`),url)
 }
 assert.doesNotMatch(urls.join("\n"),/\?|\/admin|\/cart|lemon-cake|bento-cake/)
})
