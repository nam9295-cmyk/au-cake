import test from 'node:test'
import assert from 'node:assert/strict'
import { RENEWAL_CARDS } from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
const seo=await import('../appwrite-functions/reservation-api/src/au-renewal-seo.js')
test('renewal machine-readable content uses current menu and never historical or provisional prices',()=>{
 assert.equal(typeof seo.renderRenewalLlms,'function')
 const content=seo.renderRenewalLlms('https://example.test',['- HOGIRL preserved'])
 for(const card of Object.values(RENEWAL_CARDS).flat())assert.ok(content.includes(card.href))
 assert.match(content,/75.00/);assert.match(content,/82.00/);assert.match(content,/Wednesday.*Friday.*09:00–16:00.*Saturday.*Sunday.*09:00–13:00/)
 assert.doesNotMatch(content,/79.00|85.00|115.00|155.00|4.50 \/ stick|lemon-cake|18:00/)
 assert.match(content,/HOGIRL preserved/)
})

import content from '../src/content/au-public-pages.json' with {type:'json'}
import sharp from 'sharp'
const pages=seo.renewalSeoPages('https://example.test',content)
test('SEO-01: all renewal pages explicitly declare indexability',()=>{
 for(const p of Object.values(pages)) assert.equal(p.robots,'index, follow')
})
test('SEO-02: Mochi initial content contains six current flavours, prices, real image and gift terms',()=>{
 const p=pages['/chocolates/chocolate-mochi'];assert.match(p.fallbackHtml,/<img[^>]+alt=/)
 for(const word of ['Strawberry','Green Grape','Mandarin','Banana','Butter','Original Pavé','10.00','9.50','8.50','8.00','0.50'])assert.ok(p.fallbackHtml.includes(word),word)
 assert.match(p.fallbackHtml,/free/i);assert.match(p.fallbackHtml,/refrigerat/i)
 assert.doesNotMatch(p.fallbackHtml,/Amande|signature.*35|Cookie reservations/i)
})
test('SEO-03: confirmed offers use correct units and Celebrate breadcrumbs; blocked products have no offers',()=>{
 for(const path of ['/cakes/levain-cookies','/cakes/brownie-cupcakes'])assert.doesNotMatch(JSON.stringify(pages[path].structuredData),/"offers"|InStock/)
 const p=pages['/cakes/smore-stick'];const product=p.structuredData.find(x=>x['@type']==='Product');assert.ok(product)
 assert.deepEqual(product.offers.map(o=>o.price),['25.00','45.00'])
 assert.equal(p.structuredData.find(x=>x['@type']==='BreadcrumbList').itemListElement[1].name,'Celebrate')
 const mochi=pages['/chocolates/chocolate-mochi'].structuredData.find(x=>x['@type']==='Product');assert.ok(mochi)
 assert.equal(mochi.offers.length,6);assert.ok(mochi.offers.every(o=>/single|1 piece/i.test(o.name)))
})
test('SEO-05: descriptions distinguish products and llms uses confirmed catalogue terms',()=>{
 assert.match(pages['/cakes/smore-stick'].description,/6.*25.*12.*45/)
 assert.match(pages['/chocolates/chocolate-mochi'].description,/six|6/i)
 assert.doesNotMatch(seo.renderRenewalLlms('https://example.test'),/subject to readiness|manual opening|automatic discounts/i)
 assert.match(seo.renderRenewalLlms('https://example.test'),/Banana.*9.00/)
})
test('SEO-06: every renewal share image matches the actual asset dimensions and MIME',async()=>{
 for(const p of Object.values(pages)){
  assert.ok(p.image,p.title)
  const meta=await sharp('public'+p.image.replace('https://example.test','')).metadata()
  assert.equal(p.imageType,'image/'+(meta.format==='jpg'?'jpeg':meta.format),p.title)
  assert.equal(p.imageWidth,meta.width,p.title);assert.equal(p.imageHeight,meta.height,p.title);assert.ok(p.imageAlt)
 }
 assert.match(pages['/cakes/brownie-cheesecake'].image,/details\/brownie-cheesecake\/hero-1080/)
})
test('SEO-08: shared Brownie canonical describes whole and loaf with their current prices',()=>{
 const p=pages['/cakes/brownie-cheesecake'];assert.match(p.title,/Whole.*Loaf/)
 for(const price of ['82.00','117.00','168.00','58.00'])assert.ok(p.fallbackHtml.includes(price),price)
 assert.match(p.fallbackHtml,/form=loaf/);assert.match(p.fallbackHtml,/form=whole/)
})

test('SEO-02 static product images fit narrow screens without JavaScript',()=>{
 assert.match(pages['/chocolates/chocolate-mochi'].fallbackHtml,/<img[^>]*style="[^"]*max-width:100%;height:auto/)
})
