import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectRenewalCart,splitMochiSingles,subtractRenewalSubmission,addRenewalLines,removeRenewalLine,parseRenewalCart} from '../src/lib/renewal-cart.js'
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

test('retired mochi selections are excluded without deleting other cart products',()=>{
 const cake={lineId:'cake',offerId:'pave-cake',size:'6in',quantity:1}
 const old={lineId:'old',offerId:'mochi',mode:'signature',counts:[1,1,1,1],quantity:1}
 const raw=JSON.stringify({version:1,lines:[cake,old]})
 assert.deepEqual(parseRenewalCart(raw).map(l=>l.offerId),['pave-cake'])
})
test('identical gift boxes merge, different configurations and singles stay independent',()=>{
 const counts={strawberry:1,green_grape:1,mandarin:0,amande:1,butter_redbean:0,nama_chocolate:1}
 const a={lineId:'a',offerId:'mochi',mode:'gift-four',flavourCounts:counts,quantity:2}
 let lines=addRenewalLines([],[a,{...a,lineId:'b',flavourCounts:{...counts,strawberry:0,green_grape:0,amande:0,nama_chocolate:0,mandarin:2,butter_redbean:2},quantity:1}])
 lines=addRenewalLines(lines,[{...a,lineId:'c',quantity:1}])
 assert.equal(lines.length,2);assert.equal(lines[0].quantity,3)
 lines=addRenewalLines(lines,[{...a,lineId:'s1',mode:'singles',quantity:1},{...a,lineId:'s2',mode:'singles',quantity:1}])
 assert.equal(lines.length,4);assert.deepEqual(lines.slice(2).map(l=>l.quantity),[1,1])
})


test('explicit box allocation removes exactly the selected singles and their packaging charge',()=>{
 const counts={strawberry:1,green_grape:1,mandarin:1,amande:1,butter_redbean:0,nama_chocolate:1}
 const source={lineId:'s',offerId:'mochi',mode:'singles',flavourCounts:counts,quantity:1,individualPackaging:true}
 const before=JSON.stringify(source)
 const {box,remaining}=splitMochiSingles(source,{...counts,nama_chocolate:0},'box')
 assert.equal(JSON.stringify(source),before)
 assert.equal(box.individualPackaging,false);assert.equal(box.quantity,1)
 assert.deepEqual(remaining?.flavourCounts,{strawberry:0,green_grape:0,mandarin:0,amande:0,butter_redbean:0,nama_chocolate:1})
 assert.equal(remaining?.individualPackaging,true)
 assert.throws(()=>splitMochiSingles(source,{...counts,strawberry:4,green_grape:0,mandarin:0,amande:0,nama_chocolate:0},'box'))
 assert.throws(()=>splitMochiSingles(source,{...counts,nama_chocolate:0},'s'))
 const inspection=inspectRenewalCart(JSON.stringify({version:1,lines:[{lineId:'old',offerId:'mochi',mode:'quantity',counts:[2,1,1,1],quantity:1}]}))
 assert.equal(inspection.lines.length,0);assert.equal(inspection.retiredMochi.length,1)
})
