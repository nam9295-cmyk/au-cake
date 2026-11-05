import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { escapeCsvCell } from '../src/lib/csv'
import { ReservationDrawer } from '../src/ReservationDrawer'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { buildAdminCalendarEvents } from '../src/lib/admin-calendar'
import { renderToStaticMarkup } from 'react-dom/server'
import { toReservation, toPublicReservation } from '../src/lib/stored-order-reader'
import { buildAdminReservationUpdate, assertReservationRepricingAllowed } from '../src/lib/admin-reservation-edit'
import { reservationsToCsv, buildSmsMessage } from '../src/lib/utils'
import { OrderDetailRows } from '../src/components/ProductDetailRows'
import { formatOrderLineSummary, getReservationOrderLines } from '../src/lib/order-lines'
const payload={version:'manual-order.v1',source:'admin',currency:'AUD',reason:'owner-approved-off-menu',audit:{operatorId:'synthetic-admin',reference:'synthetic-approval',createdAt:'2099-07-01T00:00:00.000Z'},lines:[{item:'gateau-cupcake-basic',quantity:5},{item:'smore-stick',quantity:5}],totalPriceCents:5000}
const doc={ $id:'synthetic',reservationNumber:'SYNTHETIC',customerName:'Synthetic Buyer',customerPhone:'0412345678',productId:'manual-order',cakeSize:'15cm',chocolateType:'dark',poundAddon:'none',cacaoPercent:'기본',quantity:10,subtotalCents:5000,discountBasisCents:0,discountPercent:0,discountCents:0,totalPriceCents:5000,totalPrice:50,orderLineCount:2,orderItemCount:10,individualPackagingPieces:0,individualPackagingFeeCents:0,orderLinesJson:JSON.stringify(payload),pickupDate:'2099-07-11',pickupTime:'10:00',status:'예약확정',paymentStatus:'입금대기',adminMemo:'',requestNote:'',createdAt:'2099-07-01T00:00:00.000Z',updatedAt:'2099-07-01T00:00:00.000Z'}
test('admin hydration preserves manual identity and summary without fabricated line prices',()=>{
 const r=toReservation(doc as never)
 assert.equal(r.productId,'manual-order')
 assert.equal(r.totalPrice,50);assert.equal(r.customerEmail,'')
 const summary=getReservationOrderLines(r).map(line=>formatOrderLineSummary(line)).join(' + ')
 assert.match(summary,/Gâteau Cupcakes · Basic ×5/);assert.match(summary,/S’more Sticks ×5/)
 const html=renderToStaticMarkup(<dl><OrderDetailRows reservation={r} language="en"/></dl>)
 assert.match(html,/Gâteau Cupcakes/);assert.match(html,/S’more Sticks/);assert.match(html,/AUD 50.00/);assert.doesNotMatch(html,/Line total|Dozen|Pave Cake/)
 const csv=reservationsToCsv([r]);assert.match(csv,/Gâteau Cupcakes/);assert.match(csv,/S’more Sticks/);assert.doesNotMatch(csv,/Signature Gâteau au Chocolat|Pave Cake|15cm|6in|8in/);assert.equal(csv.split('\n')[1].split(',')[6], escapeCsvCell('-'))
 assert.throws(()=>toPublicReservation(r),/MANUAL_ORDER_ADMIN_ONLY/)
 assert.throws(()=>buildSmsMessage(r),/MANUAL_ORDER_MESSAGES_DISABLED/)
 assert.match(buildAdminCalendarEvents([r],[])[0].subtitle,/Gâteau Cupcakes · Basic ×5 \+ S’more Sticks ×5 · AUD 50.00/)
})
test('manual drawer hides catalog, review, email and automatic message controls',()=>{
 const r=toReservation(doc as never)
 const html=renderToStaticMarkup(<ReservationDrawer reservation={{...r,status:'픽업완료'}} settings={DEFAULT_SETTINGS} onClose={()=>{}} onCopy={async()=>{}} onSave={async()=>{}}/>)
 assert.match(html,/Gâteau Cupcakes/);assert.match(html,/S’more Sticks/);assert.match(html,/AUD 50.00/)
 assert.doesNotMatch(html,/admin-repricing-fields|sms-preview|확정 문자 복사|리뷰 요청/)
 assert.match(html,/예약 수정 저장/)
})
test('manual operational edits never reprice and reject injected catalog changes',()=>{
 const r=toReservation(doc as never)
 const change={pickupDate:'2099-07-12',pickupTime:'11:00',adminMemo:'synthetic operational edit',status:'픽업완료' as const}
 const update=buildAdminReservationUpdate(r,change)
 assert.deepEqual(update,change)
 for(const edits of [{quantity:1},{productId:'pave-cake'},{totalPrice:1},{orderLines:[]},{manualOrder:null},{reviewCouponId:'coupon'}]) assert.throws(()=>assertReservationRepricingAllowed(r,edits as never),/MANUAL_ORDER_EDIT_UNAVAILABLE/)
 assert.throws(()=>toReservation({...doc,orderLinesJson:'{'} as never))
})
