import test from 'node:test'
import assert from 'node:assert/strict'
import { priceRenewalOrder, renewalLineSummary } from '../appwrite-functions/reservation-api/src/au-renewal.js'
const counts = (values) => ({strawberry:0,green_grape:0,mandarin:0,banana:0,butter_redbean:0,nama_chocolate:0,...values})
test('gift box summary hides internal IDs, mode and zero flavours without mutating its snapshot',()=>{
 const q=priceRenewalOrder([{lineId:'11111111-2222-4333-8444-555555555555',offerId:'mochi',mode:'gift-four',quantity:1,flavourCounts:counts({strawberry:2,nama_chocolate:2})}])
 const before=JSON.stringify(q)
 assert.equal(renewalLineSummary(q.lines[0]),'Chocolate Mochi · 4-piece gift box ×1 · Strawberry ×2 / Original ×2 · AUD 36.00')
 assert.equal(JSON.stringify(q),before)
})
test('identical boxes distinguish per-box contents from total, singles retain paid packaging',()=>{
 const q=priceRenewalOrder([{lineId:'a',offerId:'mochi',mode:'gift-four',quantity:3,flavourCounts:counts({banana:4})},{lineId:'b',offerId:'mochi',mode:'singles',quantity:1,flavourCounts:counts({butter_redbean:2}),individualPackaging:true}])
 assert.equal(renewalLineSummary(q.lines[0]),'Chocolate Mochi · 4-piece gift box ×3 (12 pieces) · Each box: Banana ×4 · AUD 108.00')
 assert.match(renewalLineSummary(q.lines[1]),/Singles · 2 pieces · Ang-Butter ×2 · Individual packaging: 2 pieces \(AUD 1.00\) · AUD 18.00/)
})
test('extras identify the numbered parent and size, not its internal ID',()=>{
 const q=priceRenewalOrder([{lineId:'parent-a',offerId:'pave-cake',size:'6in',quantity:1},{lineId:'parent-b',offerId:'pave-cake',size:'8in',quantity:1},{lineId:'extra',offerId:'addon-cream',parentLineId:'parent-b',quantity:1}])
 const s=renewalLineSummary(q.lines[2],{lines:q.lines})
 assert.match(s,/For item 2: Pavé Whole Cake, 8in/)
 assert.doesNotMatch(s,/parent-b|extra/)
})

test('Korean display is concise while retaining the original stored flavour mapping',()=>{
 const q=priceRenewalOrder([{lineId:'private-id',offerId:'mochi',mode:'gift-four',quantity:1,flavourCounts:counts({strawberry:2,nama_chocolate:2})}])
 assert.equal(renewalLineSummary(q.lines[0],{language:'ko'}),'파베 모찌 · 4구 선물박스 ×1 · 딸기 ×2 / 오리지널 ×2 · AUD 36.00')
})
