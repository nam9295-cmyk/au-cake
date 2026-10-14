import test from 'node:test'
import assert from 'node:assert/strict'
import {subtractRenewalSubmission,addRenewalLines,removeRenewalLine,parseRenewalCart} from '../src/lib/renewal-cart.js'
test('cart normalizes selection identity, preserves different modes and removes attached addons',()=>{
 const a={lineId:'a',offerId:'pave-cake',size:'6in',quantity:1}
 let lines=addRenewalLines([], [a])
 lines=addRenewalLines(lines,[{...a,lineId:'b'}])
 assert.equal(lines.length,1);assert.equal(lines[0].quantity,2)
 lines=addRenewalLines(lines,[{lineId:'c',offerId:'addon-cream',quantity:2,parentLineId:'a'}])
 assert.equal(removeRenewalLine(lines,'a').length,0)
 assert.deepEqual(parseRenewalCart(JSON.stringify({version:1,lines})),lines)
 assert.equal(parseRenewalCart('{broken').length,0)
})

test('completion subtracts only submitted quantities and leaves selections added meanwhile',()=>{
 const a={lineId:'a',offerId:'pave-cake',size:'6in',quantity:2}
 assert.deepEqual(subtractRenewalSubmission([a,{lineId:'b',offerId:'smore-6',quantity:1}],[{...a,quantity:1}]).map(l=>[l.lineId,l.quantity]),[['a',1],['b',1]])
})
