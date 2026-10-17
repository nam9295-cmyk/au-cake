import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../appwrite-functions/reservation-api/src/au-renewal.js'
import { RENEWAL_CARDS } from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { renewalSeoPages, renderRenewalLlms } from '../appwrite-functions/reservation-api/src/au-renewal-seo.js'

test('Pavé branding has a separate display order; persisted flavour indexes and quote names stay unchanged',()=>{
 assert.deepEqual(core.MOCHI_FLAVOURS.map(f=>f.id),['strawberry','green_grape','mandarin','banana','butter_redbean','nama_chocolate'])
 assert.deepEqual(core.MOCHI_DISPLAY_FLAVOURS?.map(f=>f.id),['nama_chocolate','strawberry','green_grape','mandarin','banana','butter_redbean'])
 assert.deepEqual(core.MOCHI_DISPLAY_FLAVOURS.map(f=>f.priceCents),[800,1000,950,900,900,850])
 const q=core.priceRenewalOrder([{lineId:'a',offerId:'mochi',mode:'singles',quantity:1,flavourCounts:{strawberry:1,green_grape:2,mandarin:3,banana:4,butter_redbean:5,nama_chocolate:6},individualPackaging:true}])
 const before=JSON.stringify(q)
 assert.equal(q.lines[0].productName,'Chocolate Mochi')
 assert.deepEqual(q.lines[0].flavourTotals,[1,2,3,4,5,6])
 assert.match(core.renewalLineSummary(q.lines[0]),/Chocolate Mochi/)
 assert.match(core.renewalLineSummary(q.lines[0]),/Original ×6/)
 assert.equal(JSON.stringify(q),before)
 assert.equal(core.mochiFlavourName('amande','en'),'Amande Chocolat')
 assert.equal(core.mochiFlavourName('mandarin','ko'),'만다린 생초콜릿')
})
test('public catalogue, initial HTML, offers, breadcrumbs, share alt and llms use the new name without changing URL',()=>{
 const path='/chocolates/chocolate-mochi'
 const card=RENEWAL_CARDS.chocolates.find(c=>c.id==='mochi')
 assert.equal(card.en,'Chocolate Mochi');assert.equal(card.ko,'파베 모찌');assert.equal(card.href,path)
 const p=renewalSeoPages('https://example.test')[path]
 assert.equal(p.canonical,'https://example.test'+path)
 for(const text of [p.title,p.description,p.imageAlt,p.fallbackHtml,JSON.stringify(p.structuredData),renderRenewalLlms('https://example.test')])assert.match(text,/Chocolate Mochi/)
 const offers=p.structuredData.find(s=>s['@type']==='Product').offers
 assert.deepEqual(offers.map(o=>o.price),['8.00','10.00','9.50','9.00','9.00','8.50'])
 assert.match(offers[0].name,/Original Pavé Chocolate/)
})
