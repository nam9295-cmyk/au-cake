import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createNotificationArchive } from '../scripts/reservation-notification-deploy-runtime.mjs'
import { createBookingReminderArchive } from '../scripts/booking-reminder-deploy-runtime.mjs'
import { createReviewApiArchive } from '../scripts/review-api-deploy-runtime.mjs'
import { buildBookingDeliveryPayload, buildBookingConfirmationPayload, deliverBookingEmail } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload, buildClassReminderPayload } from '../appwrite-functions/booking-reminder/src/reminder-business.js'
import { buildReviewInviteEmailPayload } from '../appwrite-functions/review-api/src/review-invite-email.js'
import { buildReviewRewardEmailPayload } from '../appwrite-functions/review-api/src/review-reward-email.js'
import { buildCustomCakeEmailPayload } from '../appwrite-functions/reservation-notification/src/custom-cake-notification.js'
import { customCakeDocumentId } from '../appwrite-functions/reservation-api/src/custom-cake-persistence.js'
import { decideEmailDelivery, resendIdempotencyKeyForEvent } from '../appwrite-functions/shared/email-delivery.js'

const FROM='Very Good Chocolate <mail@example.invalid>'
const KO='문의: Jenny · 0421 567 776'
const EN='Contact: Jenny · +61 421 567 776'
const cake={ $id:'cake-contact',reservationNumber:'VG-C-AU-20261024-123456789',customerName:'Contact Customer',customerEmail:'customer@example.invalid',customerPhone:'0412345678',productId:'pave-cake',cakeSize:'6in',chocolateType:'dark',poundAddon:'none',quantity:1,pickupDate:'2026-10-28',pickupTime:'10:00',totalPriceCents:7500,status:'예약확정',paymentStatus:'입금대기',requestNote:'' }
const klass={ $id:'class-contact',reservationNumber:'VG-KC-AU-20261024-123456789',classType:'school-holiday-private-cake-class',coursePlan:'basic',classDate:'2026-10-31',classTime:'10:00',durationMinutes:90,extensionMinutes:0,bookingType:'1-child',parentName:'Contact Parent',parentEmail:'parent@example.invalid',parentPhone:'0412345678',childName:'Child',totalPriceCents:9900,status:'Confirmed' }
const review={ $id:'review-contact',sourceType:'cake',sourceReservationId:cake.$id,couponId:'coupon-contact',rewardPercent:5 }
const coupon={ $id:'coupon-contact',sourceReviewId:review.$id,rewardPercent:5,status:'active',createdAt:'2026-10-24T00:00:00.000Z',expiresAt:'2026-11-23T00:00:00.000Z' }
const rows=[
 ['cake receipt',()=>buildBookingDeliveryPayload({reservation:cake,role:'customer',from:FROM})],
 ['class receipt',()=>buildBookingDeliveryPayload({reservation:klass,role:'customer',from:FROM})],
 ['cake confirmation',()=>buildBookingConfirmationPayload({reservation:cake,sourceType:'cake',from:FROM})],
 ['class confirmation',()=>buildBookingConfirmationPayload({reservation:klass,sourceType:'class',from:FROM})],
 ['cake D-1',()=>buildCakeReminderPayload({reservation:cake,from:FROM})],
 ['class D-1',()=>buildClassReminderPayload({reservation:klass,sessionKind:'first',from:FROM})],
 ...['cake','class'].map(type=>[`${type} review invitation`,()=>buildReviewInviteEmailPayload({reservation:type==='cake'?cake:klass,sourceType:type,token:'A'.repeat(43),from:FROM,reviewOrigin:'https://example.invalid'})]),
 ...['cake','class'].map(type=>[`${type} review reward`,()=>buildReviewRewardEmailPayload({review:{...review,sourceType:type,sourceReservationId:type==='cake'?cake.$id:klass.$id},coupon,reservation:type==='cake'?cake:klass,couponCode:'FOXKIWI7Q2MK',from:FROM,cakeOrderUrl:'https://example.invalid/'})]),
]
for(const[label,build]of rows)test(`${label} has Jenny contact in each existing language block and clickable phone`,()=>{
 const payload=build()
 assert.ok(payload.text.includes(KO),`${label}: Korean contact missing`)
 assert.ok(payload.text.includes(EN),`${label}: English contact missing`)
 assert.equal(payload.text.split(KO).length-1,1)
 assert.equal(payload.text.split(EN).length-1,1)
 assert.ok(payload.text.indexOf(KO)<payload.text.indexOf('[English]'))
 assert.ok(payload.text.indexOf('[English]')<payload.text.indexOf(EN))
 assert.equal((payload.html.match(/href="tel:\+61421567776"/g)||[]).length,2)
 assert.ok(payload.html.includes('문의: Jenny'))
 assert.ok(payload.html.includes('Contact: Jenny'))
 assert.equal(payload.html.split('문의: Jenny').length-1,1)
 assert.equal(payload.html.split('Contact: Jenny').length-1,1)
 assert.ok(payload.html.includes('0421 567 776'))
 assert.ok(payload.html.includes('+61 421 567 776'))
 assert.equal(payload.idempotencyKey,resendIdempotencyKeyForEvent(payload.eventKey))
 assert.equal(payload.to.length,1)
})

function customEvent(type){
 const fixture=JSON.parse(readFileSync(new URL(`./fixtures/custom-cake-contract/${type.startsWith('cake-order')?'cake-order-v2':'custom-v1'}.json`,import.meta.url),'utf8'))
 const snapshot=type==='custom-cake.confirmed'||type==='custom-cake.quoted'?fixture.finalLookup:fixture.lookup
 if(type==='custom-cake.quoted'){snapshot.status='quoted';snapshot.acceptance=null;snapshot.acceptanceHistory=[]}
 const event={schemaVersion:1,eventType:type,requestId:fixture.request.requestId,requestNumber:snapshot.requestNumber||snapshot.reservationNumber,quoteVersion:snapshot.quote?.quoteVersion||0,occurredAt:'2026-10-03T00:00:00.000Z',state:'pending',dueAt:'2026-10-03T00:00:00.000Z',snapshot,explanation:''}
 return{id:customCakeDocumentId('custom-cake-event-v1',`${event.requestId}/${event.eventType}/${event.quoteVersion}`),event}
}
for(const type of ['custom-cake.received','custom-cake.quoted','custom-cake.confirmed','cake-order-v2.received'])test(`${type} customer-only email gains the English contact without altering its existing language`,()=>{
 const payload=buildCustomCakeEmailPayload({...customEvent(type),from:FROM})
 assert.ok(payload.text.includes(EN))
 assert.ok(!payload.text.includes(KO))
 assert.equal((payload.html.match(/href="tel:\+61421567776"/g)||[]).length,1)
})

test('Jenny AU contact is not added to KR receipts or internal operator notifications',()=>{
 const payloads=[
  buildBookingDeliveryPayload({reservation:{...cake,reservationNumber:'VG-C-KR-20261024-123456789'},role:'customer',from:FROM}),
  buildBookingConfirmationPayload({reservation:{...cake,reservationNumber:'VG-C-KR-20261024-123456789'},sourceType:'cake',from:FROM}),
  buildBookingDeliveryPayload({reservation:cake,role:'operator',from:FROM,operatorRecipients:['operator@example.invalid']}),
  buildCustomCakeEmailPayload({...customEvent('custom-cake.received'),from:FROM,role:'operator',operatorRecipients:['operator@example.invalid']}),
 ]
 for(const p of payloads){assert.ok(!p.text.includes(KO)&&!p.text.includes(EN));assert.ok(!p.html.includes('tel:+61421567776'))}
})

test('adding a contact footer never reopens an existing customer delivery for another provider send',async()=>{
 const payload=buildBookingDeliveryPayload({reservation:cake,role:'customer',from:FROM})
 const old={...payload,status:'sent',recipientHash:payload.recipientHash,payloadHash:'0'.repeat(64),sentAt:'2026-10-23T00:00:00.000Z'}
 let providerCalls=0
 await deliverBookingEmail({payload,repository:{async getOrCreatePending(identity,now){return{kind:'existing',delivery:old,decision:decideEmailDelivery(old,identity,now)}}},transport:{async send(){providerCalls++;throw new Error('DUPLICATE_SEND')}}})
 assert.equal(providerCalls,0)
})

test('standalone Function copies and deployment archives use the canonical contact module',async()=>{
 const canonical=readFileSync(new URL('../appwrite-functions/shared/customer-email-contact.js',import.meta.url),'utf8')
 for(const[name,build]of [['reservation-notification',createNotificationArchive],['booking-reminder',createBookingReminderArchive],['review-api',createReviewApiArchive]]){
  assert.equal(readFileSync(new URL(`../appwrite-functions/${name}/shared/customer-email-contact.js`,import.meta.url),'utf8'),canonical)
  const archive=await build({repositoryRoot:process.cwd()})
  try{assert.equal(execFileSync('tar',['-xOf',archive.path,'./shared/customer-email-contact.js'],{encoding:'utf8'}),canonical)}finally{await archive.cleanup()}
 }
 const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts
 assert.ok(scripts.test.includes('npm run test:email-delivery'))
 assert.equal(scripts['pretest:email-delivery'],'npm run test:customer-email-contact')
})
