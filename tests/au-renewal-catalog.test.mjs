import test from 'node:test'
import assert from 'node:assert/strict'
const c=await import('../appwrite-functions/reservation-api/src/au-renewal-catalog.js').catch(()=>({}))
test('public cards are exactly 4/4/4, mochi first and only once',()=>{
 assert.ok(c.RENEWAL_CARDS)
 assert.deepEqual(Object.values(c.RENEWAL_CARDS).map(a=>a.length),[4,4,4])
 assert.equal(c.RENEWAL_CARDS.chocolates[0].id,'mochi')
 assert.deepEqual(c.RENEWAL_CARDS.celebrate.map(c=>c.id),['lemon','gateau-cupcakes','brownie-cupcakes','smore'])
 assert.notEqual(c.RENEWAL_CARDS.cakes[2].href,c.RENEWAL_CARDS.cakes[3].href)
})
test('directory URLs resolve to the same renewal product after hydration',()=>{
 assert.equal(c.renewalCardForPath('/chocolates/chocolate-mochi/').id,'mochi')
 assert.equal(c.renewalCardForPath('/cakes/brownie-cheesecake/','?form=loaf').id,'brownie-loaf')
})
