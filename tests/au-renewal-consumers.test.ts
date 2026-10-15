import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRenewalOrderData } from '../appwrite-functions/reservation-api/src/au-renewal-storage.js'
import { toReservation, toPublicReservation } from '../src/lib/stored-order-reader.js'
import { buildAdminReservationUpdate } from '../src/lib/admin-reservation-edit.js'
import { reservationsToCsv, buildSmsMessage } from '../src/lib/utils.js'
import { renewalReservationProjection } from '../appwrite-functions/reservation-api/src/au-renewal-reader.js'

test('renewal admin, public lookup, CSV and local SMS renderer preserve snapshot facts',()=>{
 const doc={...buildRenewalOrderData({contractVersion:'au-renewal.2026-10.v2',customerName:'Test Buyer',customerPhone:'0412345678',customerEmail:'buyer@example.com',pickupDate:'2026-10-23',pickupTime:'09:00',privacyConsent:true,orderLines:[{lineId:'a',offerId:'brownie-whole',size:'6in',quantity:1,finish:'vanilla-fresh-cream'}]},{now:new Date('2026-10-20T00:00:00Z'),reservationNumber:'VG-TEST'}),$id:'test'}
 const reservation=toReservation(doc as never)
 const publicOrder=toPublicReservation(renewalReservationProjection(doc) as never)
 assert.equal(reservation.totalPriceCents,9200);assert.equal(publicOrder.totalPriceCents,9200)
 assert.match(reservationsToCsv([reservation]),/6in/)
 assert.match(buildSmsMessage(reservation),/Brownie Basque/)
 const edit=buildAdminReservationUpdate(reservation,{adminMemo:'checked'} as never)
 assert.equal(edit.cakeSize,'6in');assert.equal(edit.adminMemo,'checked')
 assert.equal(edit.cacaoPercent,'기본')
 assert.throws(()=>buildAdminReservationUpdate(reservation,{quantity:2} as never),/MULTI_LINE_EDIT_UNAVAILABLE/)
})
