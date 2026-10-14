import test from 'node:test'
import assert from 'node:assert/strict'
import { RENEWAL_CARDS } from '../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
const seo=await import('../appwrite-functions/reservation-api/src/au-renewal-seo.js')
test('renewal machine-readable content uses current menu and never historical or provisional prices',()=>{
 assert.equal(typeof seo.renderRenewalLlms,'function')
 const content=seo.renderRenewalLlms('https://example.test',['- HOGIRL preserved'])
 for(const card of Object.values(RENEWAL_CARDS).flat())assert.ok(content.includes(card.href))
 assert.match(content,/75.00/);assert.match(content,/82.00/);assert.match(content,/Wednesday.*Friday.*09:00–16:00.*Saturday.*Sunday.*09:00–12:00/)
 assert.doesNotMatch(content,/79.00|85.00|115.00|155.00|4.50 \/ stick|lemon-cake|18:00/)
 assert.match(content,/HOGIRL preserved/)
})
