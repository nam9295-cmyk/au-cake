import test from 'node:test'
import assert from 'node:assert/strict'
import {renewalSeoPages,renderRenewalLlms} from '../appwrite-functions/reservation-api/src/au-renewal-seo.js'
const pages=renewalSeoPages('https://example.test')
test('structured offers and fallback HTML publish every v3 whole cake configuration and truthful descriptions',()=>{
 for(const [path,prices] of [['/cakes/pave-chocolate-cake',['45.00','55.00','75.00','93.00','107.00','137.00','159.00','204.00']],['/cakes/brownie-cheesecake',['49.00','54.00','64.00','82.00','92.00','107.00','117.00','132.00','157.00','168.00','188.00','228.00']]]) {
  const page=pages[path],offers=page.structuredData.find(s=>s['@type']==='Product').offers
  for(const price of prices) assert.ok(offers.some(o=>o.price===price),path+' '+price)
  assert.match(page.fallbackHtml,/Mini 4 inch/)
  assert.doesNotMatch(page.description,/dark or milk|three sizes/)
 }
 const llms=renderRenewalLlms('https://example.test')
 assert.match(llms,/Fresh Strawberries.*AUD 55\.00/)
 assert.match(llms,/Vanilla Fresh Cream \+ Strawberries.*AUD 228\.00/)
 assert.doesNotMatch(pages['/cakes/brownie-cheesecake'].fallbackHtml,/Optional Vanilla Fresh Cream \+AUD 10\.00/)
 for(const tier of ['single','double']) {
  assert.ok(pages['/custom-cakes'].fallbackHtml.includes(`/cakes/custom-cake?tier=${tier}`))
  assert.ok(pages['/custom-cakes'].fallbackHtml.includes(`service=private-class&amp;tier=${tier}`))
 }
})
