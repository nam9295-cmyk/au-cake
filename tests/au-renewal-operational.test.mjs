import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRenewalOrderData } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
import { buildCakeNotificationRows, buildBookingConfirmationPayload, buildNotificationText } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload } from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'
test('renewal operational outputs preserve packs, physical counts, flavours and linked extras',()=>{
 const row=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,orderLines:[{lineId:'cake',offerId:'brownie-whole',size:'6in',finish:'vanilla-fresh-cream',quantity:1},{lineId:'extra',offerId:'addon-cream',parentLineId:'cake',quantity:1},{lineId:'mochi',offerId:'mochi',mode:'singles',flavourCounts:{strawberry:10,green_grape:0,mandarin:0,banana:0,butter_redbean:0,nama_chocolate:0},quantity:1,individualPackaging:true},{lineId:'eiffel',offerId:'eiffel-six-plus-one',quantity:1}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'VG-TEST',renewalPolicy:{preordersEnabled:true}})
 row.$id='renewal-test'
 const email=buildBookingConfirmationPayload({reservation:row,sourceType:'cake',from:'test@example.com'})
 const reminder=buildCakeReminderPayload({reservation:row,from:'test@example.com'})
 for(const text of [JSON.stringify(buildCakeNotificationRows(row)),buildNotificationText(row),email.text,reminder.text,sanitizeCakeCalendarEvent(row).label]){
  assert.match(text,/6in/);assert.match(text,/vanilla-fresh-cream/);assert.match(text,/Strawberry 10/);assert.match(text,/36 pieces/);assert.match(text,/Add-on for cake/);assert.match(text,/fee AUD 5.00/)
 }
})

test('each operational line names its stable ID so attached extras can be matched unambiguously',async()=>{
 const {priceRenewalOrder,renewalLineSummary}=await import('../appwrite-functions/reservation-api/src/au-renewal.js')
 const q=priceRenewalOrder([{lineId:'parent-a',offerId:'pave-cake',size:'6in',quantity:1},{lineId:'parent-b',offerId:'pave-cake',size:'8in',quantity:1},{lineId:'extra',offerId:'addon-cream',parentLineId:'parent-b',quantity:1}])
 assert.match(renewalLineSummary(q.lines[1]),/Item parent-b/)
 assert.match(renewalLineSummary(q.lines[2]),/Add-on for parent-b/)
})

test('lookup notification reminder and PIN Calendar retain an existing approved out-of-hours appointment',async()=>{
 const {renewalReservationProjection}=await import('../appwrite-functions/reservation-api/src/au-renewal-reader.js')
 const row=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-24',pickupTime:'12:00',privacyConsent:true,orderLines:[{lineId:'a',offerId:'pave-cake',size:'6in',quantity:1}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'HISTORY-TEST'})
 row.$id='history-test';row.pickupDate='2026-10-26';row.pickupTime='18:30'
 const before=JSON.stringify(row)
 const lookup=renewalReservationProjection(row),calendar=sanitizeCakeCalendarEvent(row)
 assert.equal(lookup.pickupDate,row.pickupDate);assert.equal(lookup.pickupTime,'18:30')
 assert.ok(JSON.stringify(calendar).includes('18:30'))
 for(const text of [buildBookingConfirmationPayload({reservation:row,sourceType:'cake',from:'test@example.com'}).text,buildCakeReminderPayload({reservation:row,from:'test@example.com'}).text])assert.match(text,/18:30/)
 assert.equal(JSON.stringify(row),before)
})


test('six-flavour mixed boxes round-trip through v2 and all operational outputs without changing historical readers',async()=>{
 const {parseStoredOrderLines}=await import('../appwrite-functions/reservation-api/src/stored-order-reader.js')
 const counts=(v)=>({strawberry:0,green_grape:0,mandarin:0,banana:0,butter_redbean:0,nama_chocolate:0,...v})
 const row=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,orderLines:[
  {lineId:'box-a',offerId:'mochi',mode:'gift-four',flavourCounts:counts({strawberry:1,green_grape:1,banana:1,nama_chocolate:1}),quantity:2},
  {lineId:'box-b',offerId:'mochi',mode:'gift-four',flavourCounts:counts({mandarin:2,butter_redbean:2}),quantity:1},
  {lineId:'singles',offerId:'mochi',mode:'singles',flavourCounts:counts({nama_chocolate:3}),quantity:1,individualPackaging:true},
 ]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'VG-TEST',renewalPolicy:{preordersEnabled:true}})
 row.$id='six-flavour-test'
 const saved=JSON.stringify(row),q=parseStoredOrderLines(row)
 assert.equal(q.policyVersion,'au-renewal.2026-10.v2');assert.equal(q.totalPriceCents,13350)
 assert.deepEqual(q.lines.map(l=>l.giftBoxCount),[2,1,0]);assert.deepEqual(q.lines.map(l=>l.physicalQuantity),[8,4,3])
 for(const text of [JSON.stringify(buildCakeNotificationRows(row)),buildNotificationText(row),buildBookingConfirmationPayload({reservation:row,sourceType:'cake',from:'test@example.com'}).text,buildCakeReminderPayload({reservation:row,from:'test@example.com'}).text,sanitizeCakeCalendarEvent(row).label]){
  assert.match(text,/Item box-a/);assert.match(text,/Per box: Strawberry 1/);assert.match(text,/Mandarin 2/);assert.match(text,/Nama Chocolate 3/);assert.match(text,/AUD 25.50/)
 }
 assert.equal(JSON.stringify(row),saved)
})
