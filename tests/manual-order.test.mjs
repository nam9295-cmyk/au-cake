import test from 'node:test'
import assert from 'node:assert/strict'
import { assertReviewInviteSource } from '../appwrite-functions/review-api/src/business.js'
import { existsSync, readFileSync } from 'node:fs'
import { parseStoredOrderLines, publicCakeReservation } from '../appwrite-functions/reservation-api/src/business.js'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'
import { customerOrderSummary, projectCustomerOrderDetail } from '../appwrite-functions/reservation-api/src/customer-orders.js'
import { cakeReservationResponse } from '../appwrite-functions/reservation-api/src/cake-create-response.js'
import { createCake } from '../appwrite-functions/reservation-api/src/main.js'
import { createReservationNotificationHandler, buildBookingDeliveryPayload, buildBookingConfirmationPayload } from '../appwrite-functions/reservation-notification/src/main.js'
import { buildCakeReminderPayload, createBookingReminderRunner } from '../appwrite-functions/booking-reminder/src/reminder-business.js'

const moduleUrl = new URL('../appwrite-functions/reservation-api/src/manual-order.js', import.meta.url)
const manual = existsSync(moduleUrl) ? await import(moduleUrl) : {}
import { input, raw, row } from './fixtures/manual-order.mjs'
const label = 'Gâteau Cupcakes · Basic ×5 + S’more Sticks ×5 · AUD 50.00'
test('admin list uses the fixed manual summary and hides message copy for manual rows', () => {
 const source=readFileSync(new URL('../src/AdminReservationsPage.tsx',import.meta.url),'utf8')
 assert.match(source,/reservation\.manualOrder \? manualOrderSummary\(reservation\.manualOrder\)/)
 assert.ok(source.includes('!reservation.manualOrder && <button type="button" onClick={() => copySms(reservation)}'))
})
test('manual booking tests remain wired into the canonical test command', () => {
 const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 assert.match(scripts.test,/npm run test:manual-bookings/)
 for(const file of ['manual-order.test.mjs','manual-order-archives.test.mjs','manual-order-consumers.test.tsx']) assert.ok(scripts['test:manual-bookings'].includes(file))
})
test('manual builder exists and preserves physical pieces and only aggregate price', () => {
 assert.equal(typeof manual.buildManualOrderData, 'function')
 assert.deepEqual(manual.buildManualOrderData(input()), raw())
 const payload = parseStoredOrderLines(row())
 assert.deepEqual(payload, input())
 assert.equal(manual.manualOrderSummary(payload), label)
 assert.ok(payload.lines.every(line => !('unitPriceCents' in line) && !('totalPriceCents' in line)))
})
test('manual reader fails closed on malformed schema, quantities, prices, provenance and projections', () => {
 assert.equal(typeof manual.buildManualOrderData, 'function')
 const mutations = [p=>p.extra=true, p=>p.version='manual-order.v2', p=>p.source='customer', p=>p.currency='USD', p=>p.reason='free text', p=>p.audit.email='test@example.com', p=>p.audit.createdAt='yesterday', p=>p.lines[0].customerName='Synthetic', p=>p.lines[0].unitPriceCents=500, p=>p.lines[0].item='cupcake-dozen', p=>p.lines[0].item=['smore-stick'], p=>p.lines[0].item={toString:()=> 'smore-stick'}, p=>p.lines.push(p.lines[0]), p=>p.lines=[], ...[0,-1,1.5,1001,Number.MAX_SAFE_INTEGER].map(n=>p=>p.lines[0].quantity=n), ...[0,-1,1.5,Number.MAX_SAFE_INTEGER].map(n=>p=>p.totalPriceCents=n)]
 for (const mutate of mutations) { const p=input(); mutate(p); assert.throws(()=>manual.buildManualOrderData(p)); assert.throws(()=>parseStoredOrderLines({...row(),orderLinesJson:JSON.stringify(p)})) }
 for (const patch of [{totalPriceCents:1},{quantity:5},{productId:'pave-cake'},{discountPercent:10},{reviewCouponId:'x'},{appliedPromoCodeLast4:'TEST'},{orderLinesJson:'{'},{orderLinesJson:null},{orderLinesJson:''}]) assert.throws(()=>parseStoredOrderLines({...row(),...patch}))
})
test('manual builder snapshots own JSON data and rejects accessors, inherited hooks and array metadata', () => {
 const p=input(); let reads=0
 Object.defineProperty(p,'totalPriceCents',{enumerable:true,get(){reads++;return 5000}})
 assert.throws(()=>manual.buildManualOrderData(p));assert.equal(reads,0)
 const inherited=Object.assign(Object.create({toJSON(){return input()}}),input())
 assert.throws(()=>manual.buildManualOrderData(inherited))
 const array=input();array.lines.extra='private';assert.throws(()=>manual.buildManualOrderData(array))
 const proxy=new Proxy(input(),{get(target,key){return key==='totalPriceCents'?1:target[key]}})
 assert.equal(manual.buildManualOrderData(proxy).totalPriceCents,5000)
})
test('private calendar shows both physical items and fixed aggregate without contact or audit', () => {
 const event=sanitizeCakeCalendarEvent(row()); assert.equal(event.label,label)
 for(const text of ['Synthetic Buyer','0412345678','synthetic-admin','synthetic-approval']) assert.ok(!JSON.stringify(event).includes(text))
 assert.throws(()=>sanitizeCakeCalendarEvent({...row(),orderLinesJson:'{'}))
})
test('manual orders are explicitly unavailable to public and customer readers', () => {
 for(const reader of [publicCakeReservation,customerOrderSummary,projectCustomerOrderDetail,cakeReservationResponse]) assert.throws(()=>reader(row()), /MANUAL_ORDER_ADMIN_ONLY/)
})
test('public create rejects forged manual fields before database or coupon access', async () => {
 let calls=0; const db=new Proxy({}, {get(){return async()=>{calls++;throw new Error('DB_FORBIDDEN')}}})
 for(const forged of [{contractVersion:'manual-order.v1'}, {orderLinesJson:JSON.stringify(input())}, {manualOrder:input()}, {productId:'manual-order'}]) await assert.rejects(createCake(db,{...forged,promoCode:'review-code'}), /MANUAL_ORDER_ADMIN_ONLY/)
 assert.equal(calls,0)
})
test('completed manual records never qualify for review rewards', () => {
 assert.throws(()=>assertReviewInviteSource('cake',{...row(),status:'픽업완료'}), /REVIEW_SOURCE_NOT_COMPLETED/)
})
test('manual email status and retry actions stop before recipient/ledger access', async () => {
 const forbidden=()=>{throw new Error('OUTBOUND_FORBIDDEN')}
 const handler=createReservationNotificationHandler({env:{REVIEW_ADMIN_USER_IDS:'synthetic-admin'},createReservationRepository:()=>({getReservation:async()=>row()}),createTransport:forbidden,createLedgerRepository:forbidden})
 for(const action of ['get-booking-confirmation-status','send-booking-confirmation','get-booking-email-status','retry-booking-email']) {
  const result=await handler({req:{bodyJson:{action,data:{sourceType:'cake',reservationId:'synthetic-manual',emailKind:'booking-confirmed-customer'}},headers:{'x-appwrite-user-id':'synthetic-admin'}},res:{json:x=>x}})
  assert.deepEqual(result,{ok:false,code:'MANUAL_ORDER_MESSAGES_DISABLED'})
 }
})
test('manual reminder candidates explicitly skip without attempting delivery', async () => {
 let deliveries=0
 const reservation={...row(),pickupDate:'2026-08-28'}
 const result=await createBookingReminderRunner({now:()=>new Date('2026-08-27T00:30:00.000Z'),mode:'send',from:'test@example.com',repository:{listCakeCandidates:async()=>({documents:[reservation]}),listClassFirstCandidates:async()=>({documents:[]}),listClassAdvancedCandidates:async()=>({documents:[]}),getCakeReservation:async()=>reservation},deliver:async()=>{deliveries++;return {status:'sent'}}}).run()
 assert.equal(result.skipped,1);assert.equal(result.sent,0);assert.equal(deliveries,0)
})
test('manual event skips all outbound machinery even with absent config/contact or malformed payload', async () => {
 const forbidden=()=>{throw new Error('OUTBOUND_FORBIDDEN')}
 const handler=createReservationNotificationHandler({env:{},createTransport:forbidden,createLedgerRepository:forbidden})
 for(const reservation of [row(), {...row(),orderLinesJson:'{'}]) {
  const result=await handler({req:{bodyJson:reservation,headers:{}},res:{json:x=>x}})
  assert.deepEqual(result,{ok:true,skipped:'manual_order'})
  assert.equal(buildCakeReminderPayload({reservation}),null)
  for(const build of [buildBookingDeliveryPayload,buildBookingConfirmationPayload]) assert.throws(()=>build({reservation,role:'customer',sourceType:'cake'}),/MANUAL_ORDER_MESSAGES_DISABLED/)
 }
})
