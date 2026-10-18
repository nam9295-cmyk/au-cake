import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import * as page from '../src/pages/AccountPage'
import * as detail from '../src/components/CustomerOrderDetail'
import {CustomerAccountContext,disabledCustomerAccount} from '../src/lib/customer-account-context'
import {projectCustomerOrderDetail} from '../appwrite-functions/reservation-api/src/customer-orders.js'
import fixtures from './fixtures/customer-account/orders.json'
test('account disabled/guest/checking and bilingual profile separate login email from order contact',()=>{
  const Account=Reflect.get(page,'AccountPage');assert.equal(typeof Account,'function')
  assert.match(renderToStaticMarkup(<Account language="en"/>),/unavailable/)
  for(const language of ['en','ko']) {
    const context={...disabledCustomerAccount,enabled:true,ordersStatus:'ready',state:{status:'authenticated',identity:{userId:'customer-a',loginEmail:'login@example.test',profile:{version:1,name:'Saved Name',phone:'0412345678',contactEmail:'contact@example.test',language:'en'}}}}
    const html=renderToStaticMarkup(<CustomerAccountContext.Provider value={context as never}><Account language={language}/></CustomerAccountContext.Provider>)
    assert.match(html,/value="login@example.test"[^>]*readOnly|readOnly[^>]*value="login@example.test"/)
    assert.match(html,/value="contact@example.test"/);assert.match(html,/Saved Name/)
    assert.match(html,language==='en'?/Upcoming Orders/:/예정된 주문/)
    assert.doesNotMatch(html,/>Cancel order<|>Edit order<|>Delete account</)
    assert.match(html,language==='en'?/Some order and accounting records may need to be retained/:/일부 주문·회계 기록/)
  }
})
test('customer detail renders frozen legacy/Renewal prices without admin/coupon IDs',()=>{
  const Detail=Reflect.get(detail,'CustomerOrderDetail');assert.equal(typeof Detail,'function')
  for(const document of fixtures.slice(0,2)) {
    const view=projectCustomerOrderDetail(document)
    const html=renderToStaticMarkup(<Detail detail={view} language="en" onClose={()=>{}}/>)
    assert.ok(html.includes(view.reservationNumber));assert.doesNotMatch(html,/PRIVATE ADMIN|reviewCouponId|requestFingerprint/)
    assert.match(html,document.$id==='a-renewal'?/82\.00/:/65\.00/)
    if(view.view.format==='renewal')assert.ok(html.includes(view.view.orderLines[0].selection.size||''),'historical option size missing')
    assert.doesNotMatch(html,/예약신청|입금대기/)
  }
})
test('checking retains only a hidden inert previous account panel; lost sessions render no previous profile',()=>{
  const Account=Reflect.get(page,'AccountPage')
  const identity={userId:'customer-a',loginEmail:'private-a@example.test',profile:{version:1,name:'Saved A',phone:'0412345678',contactEmail:'contact-a@example.test',language:'en'}}
  const render=(state:unknown)=>renderToStaticMarkup(<CustomerAccountContext.Provider value={{...disabledCustomerAccount,enabled:true,ordersStatus:'ready',state} as never}><Account language="en"/></CustomerAccountContext.Provider>)
  const pending=render({status:'checking',previousIdentity:identity})
  assert.match(pending,/Checking your session/)
  assert.match(pending,/<div[^>]*hidden=""[^>]*inert=""/)
  assert.match(pending,/private-a@example.test/)
  for(const status of ['guest','unavailable'])assert.doesNotMatch(render({status,previousIdentity:identity}),/private-a@example.test|Saved A|contact-a@example.test/)
})
