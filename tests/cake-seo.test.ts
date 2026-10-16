import { RENEWAL_CARDS } from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { getAuPublicContent, getPublicRoutePage } from '../src/lib/public-content.js'
import { getSeoConfig } from '../src/lib/seo.js'
import { getPageFromPath } from '../src/lib/app-routes.js'

const SITE_URL = 'https://au.verygood-chocolate.com'
const publicContent = getAuPublicContent()

test('Custom Cake runtime SEO stays indexable without becoming a catalogue product', () => {
  const config = getSeoConfig('/cakes/custom-cake')
  assert.equal(config.title, 'Custom Cake Sydney | Bespoke Celebration Cakes | verygood chocolate')
  assert.equal(config.description, 'Bespoke custom cakes made to order in Sydney. Choose your size, share your design references and request a personalised cake for pre-arranged pickup in Melrose Park.')
  assert.equal(config.canonical, `${SITE_URL}/cakes/custom-cake`)
  assert.notEqual(config.noindex, true)
  assert.equal(config.structuredData?.some(item => item['@type'] === 'Product') ?? false, false)
  assert.equal(getSeoConfig('/cakes/not-a-real-cake').noindex, true)
  assert.equal(getSeoConfig('/cakes/not-a-real-cake').title, 'Page Not Found | verygood chocolate')
})

test('Custom Cake directory URLs resolve to the order UI and canonical SEO after direct load or refresh', () => {
  for (const path of ['/cakes/custom-cake', '/cakes/custom-cake/']) {
    assert.equal(getPageFromPath(path), 'custom-cake', path)
    assert.equal(getSeoConfig(path).title, 'Custom Cake Sydney | Bespoke Celebration Cakes | verygood chocolate', path)
    assert.equal(getSeoConfig(path).canonical, `${SITE_URL}/cakes/custom-cake`, path)
    assert.notEqual(getSeoConfig(path).noindex, true, path)
  }
  assert.equal(getPageFromPath('/cakes/not-a-real-cake/'), 'not-found')
})

function structuredTypes(path: string) {
  return getSeoConfig(path).structuredData?.map((entry) => entry['@type']) || []
}


test('renewal menu and current detail routes use AU self canonicals', () => {
 for(const path of ['/', '/cakes','/chocolates','/celebrate',...Object.values(RENEWAL_CARDS).flat().map(c=>c.href.split('?')[0])]) {
  const config=getSeoConfig(path);assert.notEqual(config.noindex,true);assert.equal(config.canonical,`${SITE_URL}${path==='/'?'':path}`)
 }
 for(const path of ['/cakes/lemon-cake','/cakes/fresh-strawberry-vanilla-cream-cake'])assert.equal(getSeoConfig(path).noindex,true)
})

test('homepage owns the approved Sydney chocolate cake metadata', () => {
  const config = getSeoConfig('/')
  assert.equal(config.title, 'Chocolate Cakes Sydney | Melrose Park Pickup | verygood chocolate')
  assert.equal(config.description, 'Made-to-order cakes and chocolate creations in Sydney. Explore our menu, custom cakes and business enquiries.')
  assert.deepEqual(structuredTypes('/'), ['Organization', 'WebSite', 'ItemList', 'FAQPage'])
  const organization = config.structuredData?.find((entry) => entry['@type'] === 'Organization')
  const faq = config.structuredData?.find((entry) => entry['@type'] === 'FAQPage')
  assert.deepEqual(organization?.sameAs, ['https://www.instagram.com/verygood_syd/'])
  assert.deepEqual(faq?.mainEntity, publicContent.home.faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })))
})

test('all indexable runtime SEO uses the canonical lowercase brand', () => {
  for (const path of [
    '/',
    '/cakes',
    '/classes',
    '/reviews',
    ...Object.keys(publicContent.cakePages).map((slug) => '/cakes/' + slug),
  ]) {
    const serialized = JSON.stringify(getSeoConfig(path))
    assert.match(getSeoConfig(path).title, /verygood chocolate/)
    assert.doesNotMatch(serialized, /Very Good Chocolate|Verygood Chocolate/)
  }
})

test('all noindex runtime SEO uses the canonical lowercase brand', () => {
  for (const path of [
    '/cart',
    '/reserve',
    '/complete',
    '/lookup',
    '/class-reserve',
    '/class-complete',
    '/calendar',
    '/review',
    '/review.html',
    '/admin',
    '/admin/login',
    '/admin/reservations',
    '/admin/classes',
    '/admin/reviews',
    '/not-found',
  ]) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, true, path)
    assert.match(config.title, /verygood chocolate/, path)
    assert.doesNotMatch(JSON.stringify(config), /Very Good Chocolate|Verygood Chocolate/, path)
  }
})

test('runtime route metadata comes from the typed public-content adapter', () => {
  for (const path of ['/', '/reviews'] as const) {
    const page = getPublicRoutePage(path)
    assert.ok(page)
    assert.equal(getSeoConfig(path).title, page.title)
    assert.equal(getSeoConfig(path).description, path === '/' ? 'Made-to-order cakes and chocolate creations in Sydney. Explore our menu, custom cakes and business enquiries.' : page.description)
  }
})

test('closed classes publish archive metadata without a recruitment Offer', () => {
  const config = getSeoConfig('/classes')
  assert.match(config.title, /Archive/)
  assert.doesNotMatch(JSON.stringify(config.structuredData), /AggregateOffer|"offers"/)
})

test('renewal metadata preserves supplied product images and does not invent missing photos',()=>{
 for(const card of Object.values(RENEWAL_CARDS).flat()) {
  const config=getSeoConfig(card.href.split('?')[0]);assert.ok(config.description);assert.ok(config.title)
  if(card.image)assert.ok(config.image?.startsWith(SITE_URL))
 }
})

test('renewal metadata does not publish a purchasable offer while launch and provisional prices await approval',()=>{
 for(const card of [RENEWAL_CARDS.cakes[4],RENEWAL_CARDS.celebrate[1]])assert.doesNotMatch(JSON.stringify(getSeoConfig(card.href.split('?')[0])), /"offers"|InStock|115.00|155.00/)
})

test('legacy grouped and Basque pages are noindex WebPage compatibility views', () => {
  const paths = [
    '/cakes/chocolate-pound-cake-and-cupcakes',
    '/cakes/chocolatiers-basque-cheesecake',
    '/cakes/buttercream-cake',
    '/cakes/fresh-strawberry-chocolate-cream-cake',
  ]
  for (const path of paths) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, true, path)
    assert.deepEqual(structuredTypes(path), ['WebPage', 'BreadcrumbList'], path)
    assert.equal(config.ogType, 'website', path)
  }
})

test('renewal catalogue exposes five cards including separate whole and loaf links',()=>{
 const page=getSeoConfig('/cakes').structuredData?.[0]
 const items=(page?.mainEntity as {itemListElement:Array<{url:string}>}).itemListElement
 assert.deepEqual(items.map(i=>i.url),RENEWAL_CARDS.cakes.map(c=>SITE_URL+c.href))
})

test('legacy Vanilla page remains a noindex compatibility view without Product Offer JSON-LD', () => {
  const config = getSeoConfig('/cakes/vanilla-fresh-cream-cake')
  assert.equal(config.noindex, true)
  assert.equal(config.canonical, `${SITE_URL}/cakes/vanilla-fresh-cream-cake`)
  assert.deepEqual(structuredTypes('/cakes/vanilla-fresh-cream-cake'), ['WebPage', 'BreadcrumbList'])
  assert.equal(config.structuredData?.some((entry) => entry['@type'] === 'Product'), false)
  assert.equal(JSON.stringify(config.structuredData).includes('offers'), false)
  assert.equal(config.ogType, 'website')
})

test('Brownie Product publishes the supplied Brownie image with its actual dimensions', () => {
  const config = getSeoConfig('/cakes/brownie-cheesecake')
  const image = `${SITE_URL}/products/details/brownie-cheesecake/hero-1080.webp`
  assert.equal(config.image, image)
  assert.equal(config.imageWidth, 1080)
  assert.equal(config.imageHeight, 1012)
})

test('Signature Product publishes its descriptive canonical product image', () => {
  const config = getSeoConfig('/cakes/signature-gateau-au-chocolat')
  const image = `${SITE_URL}/products/signature-gateau-au-chocolat-sydney.webp`
  assert.equal(config.image, image)
})

test('all noindex operational routes remain directly loadable metadata pages', () => {
  for (const path of [
    '/cart',
    '/reserve',
    '/complete',
    '/lookup',
    '/class-reserve',
    '/class-complete',
    '/calendar',
    '/review',
    '/admin',
    '/admin/login',
    '/admin/reservations',
    '/admin/classes',
    '/admin/reviews',
  ]) {
    const config = getSeoConfig(path)
    assert.equal(config.noindex, true, path)
    assert.equal(config.structuredData, undefined, path)
  }
})

test('SEO-04 retired slash and html aliases preserve the retirement page and canonical',()=>{
 for(const suffix of ['', '/', '.html']){
  const path='/cakes/lemon-cake'+suffix
  assert.equal(getPageFromPath(path),'cake-detail')
  assert.equal(getSeoConfig(path).canonical,SITE_URL+'/cakes/lemon-cake')
  assert.equal(getSeoConfig(path).noindex,true)
 }
})

test('SEO-07 class archive aliases keep the same visible page and canonical',()=>{
 for(const path of ['/classes','/classes/','/classes.html']){
  assert.equal(getPageFromPath(path),'classes')
  assert.equal(getSeoConfig(path).canonical,SITE_URL+'/classes')
 }
})
