import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRenewalOrderData } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
import { buildCakeNotificationRows, buildBookingConfirmationPayload, buildNotificationText } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload } from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'
test('renewal operational outputs preserve packs, physical counts, flavours and linked extras',()=>{
 const row=buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,orderLines:[{lineId:'cake',offerId:'brownie-whole',size:'6in',finish:'vanilla-fresh-cream',quantity:1},{lineId:'extra',offerId:'addon-cream',parentLineId:'cake',quantity:1},{lineId:'mochi',offerId:'mochi',mode:'quantity',counts:[10,0,0,0],quantity:1,individualPackaging:true},{lineId:'eiffel',offerId:'eiffel-six-plus-one',quantity:1}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'VG-TEST',renewalPolicy:{preordersEnabled:true}})
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
